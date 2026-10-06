/**
 * 网站信息识别（多层兜底）
 * 1. 静态抓取：首页 HTML → 解析 <link rel="icon"> / og:image → 按权重下载
 * 2. 隐藏窗口渲染：拿浏览器标签页实际显示的 favicon，覆盖 SPA 运行时换图标场景
 * 3. 猜测路径 /favicon.ico 等 + 第三方 favicon 服务兜底
 * logo 以 base64 data URL 返回，便于 renderer 直接显示与持久化。
 */

import * as https from 'node:https'
import * as http from 'node:http'
import * as zlib from 'node:zlib'
import { URL } from 'node:url'
import { BrowserWindow } from 'electron'

/** 识别结果 */
export interface SiteInfo {
  /** logo 的 data URL */
  logo: string | null
  /** 网站名称 */
  name: string | null
}

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const HTML_MAX_BYTES = 512 * 1024
const IMAGE_MAX_BYTES = 5 * 1024 * 1024
const REDIRECT_LIMIT = 5
const REQUEST_TIMEOUT = 8000

/** 内存缓存：domain → SiteInfo */
const cache = new Map<string, SiteInfo>()

// ========== 基础 HTTP 工具 ==========

interface FetchResult {
  buffer: Buffer
  finalUrl: string
  contentType: string
}

/** 发起 GET 请求，自动跟随重定向、解压 gzip/deflate/br */
function fetchUrl(
  rawUrl: string,
  maxBytes: number,
  redirectsLeft = REDIRECT_LIMIT
): Promise<FetchResult> {
  return new Promise((resolve, reject) => {
    let parsed: URL
    try {
      parsed = new URL(rawUrl)
    } catch {
      reject(new Error('Invalid URL'))
      return
    }

    const mod = parsed.protocol === 'http:' ? http : https
    const req = mod.get(
      rawUrl,
      {
        headers: {
          'User-Agent': UA,
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/*,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br'
        },
        timeout: REQUEST_TIMEOUT
      },
      (res) => {
        const status = res.statusCode ?? 0

        // 重定向
        if ([301, 302, 303, 307, 308].includes(status)) {
          res.resume()
          const location = res.headers.location
          if (!location || redirectsLeft <= 0) {
            reject(new Error('Redirect failed'))
            return
          }
          const nextUrl = new URL(location, rawUrl).toString()
          fetchUrl(nextUrl, maxBytes, redirectsLeft - 1).then(resolve, reject)
          return
        }

        if (status !== 200) {
          res.resume()
          reject(new Error(`HTTP ${status}`))
          return
        }

        const chunks: Buffer[] = []
        let received = 0
        let aborted = false
        let settled = false

        res.on('data', (chunk: Buffer) => {
          if (aborted) return
          received += chunk.length
          if (received > maxBytes) {
            // 已拿到足够解析 <head> 的内容，截断即可
            aborted = true
            req.destroy()
            return
          }
          chunks.push(chunk)
        })

        const finish = (buffer: Buffer): void => {
          if (settled) return
          settled = true
          const encoding = (res.headers['content-encoding'] || '').toLowerCase()
          try {
            let decoded = buffer
            if (encoding === 'gzip') decoded = zlib.gunzipSync(buffer)
            else if (encoding === 'deflate') decoded = zlib.inflateSync(buffer)
            else if (encoding === 'br') decoded = zlib.brotliDecompressSync(buffer)
            resolve({
              buffer: decoded,
              finalUrl: rawUrl,
              contentType: res.headers['content-type'] || ''
            })
          } catch {
            // 解压失败则用原始数据
            resolve({ buffer, finalUrl: rawUrl, contentType: res.headers['content-type'] || '' })
          }
        }

        res.on('end', () => finish(Buffer.concat(chunks)))
        res.on('error', (err) => {
          // 主动截断不算错误
          if (aborted && chunks.length > 0) finish(Buffer.concat(chunks))
          else if (!settled) reject(err)
        })
        req.on('error', (err) => {
          // 主动截断不算错误
          if (aborted && chunks.length > 0) {
            finish(Buffer.concat(chunks))
          } else if (!settled) {
            reject(err)
          }
        })
      }
    )

    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Request timeout'))
    })
    req.on('error', reject)
  })
}

// ========== HTML 解析 ==========

/** 从标签字符串中提取属性值（大小写不敏感，兼容单双引号） */
function getAttr(tag: string, name: string): string | null {
  const re = new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i')
  const m = tag.match(re)
  return m ? m[1] : null
}

/** HTML 实体解码（覆盖常见实体） */
function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '…')
}

interface IconCandidate {
  href: string
  /** 声明尺寸（像素），用于优先级排序 */
  size: number
  /** 来源权重：link 声明 > og:image > 猜测路径 > 第三方服务 */
  weight: number
}

/** 从 URL 尺寸线索推断图标大小（如 -64-64.png / 128x128 / tps-200-200） */
function sizeHint(href: string): number {
  const m = href.match(/[?\-_/x×](\d{1,4})[x×_-](\d{1,4})(?:\D|$)/i)
  if (!m) return 0
  const a = parseInt(m[1], 10)
  const b = parseInt(m[2], 10)
  if (a > 512 || b > 512 || a < 8 || b < 8) return 0
  return Math.max(a, b)
}

/** 从 HTML 中解析图标候选与网站名称 */
function parseHtml(html: string, baseUrl: string): { icons: IconCandidate[]; name: string | null } {
  const icons: IconCandidate[] = []
  const seen = new Set<string>()

  const addIcon = (href: string | null, size: number, weight: number): void => {
    if (!href) return
    let absolute: string
    try {
      absolute = new URL(href, baseUrl).toString()
    } catch {
      return
    }
    if (seen.has(absolute)) return
    seen.add(absolute)
    // 不要把第三方统计脚本之类的非图片地址加入
    icons.push({ href: absolute, size, weight })
  }

  // 所有 <link ...> 标签
  const linkTags = html.match(/<link\b[^>]*>/gi) || []
  for (const tag of linkTags) {
    const rel = (getAttr(tag, 'rel') || '').toLowerCase()
    const href = getAttr(tag, 'href')
    if (!href) continue

    const sizesStr = getAttr(tag, 'sizes') || ''
    const sizeMatch = sizesStr.match(/(\d+)\s*[x×]\s*\d+/i)
    const declaredSize = sizeMatch ? parseInt(sizeMatch[1], 10) : sizeHint(href)

    if (/(^|\s)apple-touch-icon(\s|$)/.test(rel)) {
      // apple-touch-icon 通常最清晰
      addIcon(href, declaredSize || 180, 100)
    } else if (/(^|\s)shortcut icon(\s|$)/.test(rel)) {
      // 遗留 IE 写法，常为母站通用图标，权重低于标准 icon
      addIcon(href, declaredSize || 32, 80)
    } else if (/(^|\s)(icon|fluid-icon)(\s|$)/.test(rel)) {
      // SVG/mask-icon 也接受
      const isSvg = /\.svg(\?|$)/i.test(href)
      addIcon(href, declaredSize || (isSvg ? 512 : 32), 90)
    } else if (/(^|\s)mask-icon(\s|$)/.test(rel)) {
      addIcon(href, 512, 50)
    }
  }

  // og:image / twitter:image 兜底（可能不是方形 logo，权重较低）
  const metaTags = html.match(/<meta\b[^>]*>/gi) || []
  for (const tag of metaTags) {
    const prop = (getAttr(tag, 'property') || getAttr(tag, 'name') || '').toLowerCase()
    if (prop === 'og:image' || prop === 'og:image:url' || prop === 'twitter:image') {
      addIcon(getAttr(tag, 'content'), 0, 40)
    }
  }

  // 名称：og:site_name → <title>
  let name: string | null = null
  for (const tag of metaTags) {
    const prop = (getAttr(tag, 'property') || '').toLowerCase()
    if (prop === 'og:site_name') {
      const content = getAttr(tag, 'content')
      if (content && content.trim()) {
        name = decodeEntities(content.trim())
        break
      }
    }
  }

  if (!name) {
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    if (titleMatch) {
      const title = decodeEntities(titleMatch[1].replace(/\s+/g, ' ').trim())
      if (title) name = title
    }
  }

  // 按权重、尺寸排序
  icons.sort((a, b) => b.weight - a.weight || b.size - a.size)
  return { icons, name }
}

// ========== 图片下载与校验 ==========

/** 根据 Buffer 魔数判断图片类型，非图片返回 null */
function detectImageType(buffer: Buffer): string | null {
  if (buffer.length < 4) return null
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png'
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return 'image/gif'
  if (buffer[0] === 0x42 && buffer[1] === 0x4d) return 'image/bmp'
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp'
  }
  // ICO: 00 00 01 00
  if (buffer[0] === 0x00 && buffer[1] === 0x00 && buffer[2] === 0x01 && buffer[3] === 0x00) {
    return 'image/x-icon'
  }
  // SVG：以 < 开头且包含 svg 标识
  const head = buffer.toString('utf8', 0, Math.min(256, buffer.length)).trimStart().toLowerCase()
  if (head.startsWith('<?xml') || head.startsWith('<svg')) {
    if (head.includes('<svg') || buffer.toString('utf8', 0, 2000).toLowerCase().includes('<svg')) {
      return 'image/svg+xml'
    }
  }
  return null
}

/** 尝试下载单个图标，成功返回 data URL */
async function tryDownloadIcon(url: string): Promise<string | null> {
  try {
    const { buffer } = await fetchUrl(url, IMAGE_MAX_BYTES)
    if (buffer.length < 50) return null
    const type = detectImageType(buffer)
    if (!type) return null
    return `data:${type};base64,${buffer.toString('base64')}`
  } catch {
    return null
  }
}

/** 分批并行下载，命中即返回；批大小 4 */
async function downloadFirstMatch(candidates: IconCandidate[]): Promise<string | null> {
  const BATCH = 4
  for (let i = 0; i < candidates.length; i += BATCH) {
    const batch = candidates.slice(i, i + BATCH)
    const results = await Promise.all(batch.map((c) => tryDownloadIcon(c.href)))
    for (const r of results) {
      if (r) return r
    }
  }
  return null
}

// ========== 隐藏窗口渲染兜底 ==========

/**
 * 用隐藏 BrowserWindow 真实渲染页面，获取浏览器标签页实际显示的 favicon。
 * 覆盖静态抓取无法命中的场景：SPA 运行时动态换图标、JS 注入的 link 标签等。
 * 内部串行排队，避免批量识别时同时开多个隐藏窗口。
 */
let captureQueue: Promise<unknown> = Promise.resolve()

function captureBrowserIcons(
  rawUrl: string,
  timeoutMs = 9000
): Promise<{ icons: string[]; title: string | null }> {
  const task = captureQueue.then(() => doCaptureBrowserIcons(rawUrl, timeoutMs))
  captureQueue = task.catch(() => undefined)
  return task
}

function doCaptureBrowserIcons(
  rawUrl: string,
  timeoutMs: number
): Promise<{ icons: string[]; title: string | null }> {
  return new Promise((resolve) => {
    let settled = false
    let title: string | null = null
    const iconSet = new Set<string>()
    let win: BrowserWindow | null = null

    const finish = (): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        win?.destroy()
      } catch {
        // ignore
      }
      resolve({ icons: [...iconSet], title })
    }
    const timer = setTimeout(finish, timeoutMs)

    try {
      win = new BrowserWindow({
        show: false,
        width: 1000,
        height: 700,
        webPreferences: { sandbox: true, nodeIntegration: false }
      })
    } catch (err) {
      console.error('创建隐藏窗口失败:', err)
      clearTimeout(timer)
      resolve({ icons: [], title: null })
      return
    }

    win.webContents.on('page-favicon-updated', (_e, favs) => {
      favs.forEach((f) => iconSet.add(f))
    })
    win.webContents.on('page-title-updated', (_e, t) => {
      if (t && t.trim()) title = t.trim()
    })
    win.webContents.on('did-stop-loading', () => {
      // 再给 JS 运行时替换 favicon 一点时间
      setTimeout(finish, 1500)
    })
    win.webContents.on(
      'did-fail-load',
      (_e, _code, _desc, _failedUrl, isMainFrame) => {
        if (isMainFrame) setTimeout(finish, 300)
      }
    )
    win.webContents.loadURL(rawUrl).catch(() => setTimeout(finish, 300))
  })
}

// ========== 主入口 ==========

/** 规范化用户输入的网址 */
export function normalizeUrl(input: string): string | null {
  let url = input.trim()
  if (!url) return null
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url
  }
  try {
    const u = new URL(url)
    if (!u.hostname.includes('.')) return null
    return u.toString()
  } catch {
    return null
  }
}

/**
 * 识别网站信息（logo + 名称）
 * 流程：抓首页 HTML → 解析 link/meta → 并行下载声明的图标 → 兜底 /favicon.ico → 第三方服务
 */
export async function fetchSiteInfo(rawInput: string): Promise<SiteInfo> {
  const url = normalizeUrl(rawInput)
  if (!url) return { logo: null, name: null }

  const parsed = new URL(url)
  const domain = parsed.hostname.replace(/^www\./, '')
  const cached = cache.get(domain)
  if (cached) return cached

  const baseUrl = `${parsed.protocol}//${parsed.host}`
  const result: SiteInfo = { logo: null, name: null }

  // 1. 抓首页 HTML
  let html: string | null = null
  let finalBaseUrl = baseUrl
  try {
    const fetched = await fetchUrl(url, HTML_MAX_BYTES)
    if (fetched.contentType.includes('text/html') || fetched.buffer[0] === 0x3c) {
      html = fetched.buffer.toString('utf8')
      try {
        const finalParsed = new URL(fetched.finalUrl)
        finalBaseUrl = `${finalParsed.protocol}//${finalParsed.host}`
      } catch {
        // ignore
      }
    }
  } catch {
    // 首页抓取失败（个别站点只放行浏览器），仍走兜底路径
  }

  // 2. 解析 HTML 中的图标与名称
  const candidates: IconCandidate[] = []
  if (html) {
    const { icons, name } = parseHtml(html, finalBaseUrl)
    result.name = name
    candidates.push(...icons)
  }

  // 3. 常规猜测路径（HTML 未声明时兜底）
  const seenHrefs = new Set(candidates.map((c) => c.href))
  const guesses: Array<[string, number]> = [
    ['/favicon.ico', 30],
    ['/favicon.png', 30],
    ['/favicon.svg', 30],
    ['/apple-touch-icon.png', 20],
    ['/apple-touch-icon-precomposed.png', 20]
  ]
  for (const [pathStr, weight] of guesses) {
    const guessUrl = finalBaseUrl + pathStr
    if (!seenHrefs.has(guessUrl)) {
      candidates.push({ href: guessUrl, size: 0, weight })
      seenHrefs.add(guessUrl)
    }
  }

  // 4. 第三方 favicon 服务（最后兜底；Google 国内不可达，排在末位）
  candidates.push(
    { href: `https://icon.horse/icon/${parsed.hostname}`, size: 0, weight: 10 },
    { href: `https://icons.duckduckgo.com/ip3/${parsed.hostname}.ico`, size: 0, weight: 9 },
    { href: `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=128`, size: 0, weight: 8 }
  )

  result.logo = await downloadFirstMatch(candidates)

  // 5. 隐藏窗口渲染兜底：浏览器标签页实际显示的图标最准（SPA 运行时换图标也能拿到），
  //    拿到后覆盖静态结果；渲染失败则保留静态链路的发现
  try {
    const { icons, title } = await captureBrowserIcons(url)
    if (icons.length > 0) {
      const ranked: IconCandidate[] = icons
        .map((href) => ({ href, size: sizeHint(href), weight: 95 }))
        .sort((a, b) => b.size - a.size)
      const rendered = await downloadFirstMatch(ranked)
      if (rendered) result.logo = rendered
    }
    if (!result.name && title) result.name = title
  } catch (err) {
    console.error('隐藏窗口获取 favicon 失败（保留静态抓取结果）:', err)
  }

  cache.set(domain, result)
  return result
}

/** 兼容旧接口：只取 logo */
export async function fetchFavicon(url: string): Promise<string | null> {
  return (await fetchSiteInfo(url)).logo
}
