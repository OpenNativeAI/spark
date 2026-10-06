/**
 * 网页书签 Store
 * 管理用户收藏的网页，支持增删改查。
 * 持久化：数据存 userData/data/bookmarks.json（主进程文件写入），
 * logo 图片存 userData/logos/ 目录（sparklogo:// 协议显示），
 * 首次启动自动迁移旧版 localStorage 数据。
 */

import { create } from 'zustand'
import type { Website } from '../types'

/** 主进程数据文件 key（对应 userData/data/bookmarks.json） */
const DATA_KEY = 'bookmarks'
/** 旧版 localStorage key（仅用于迁移） */
const LEGACY_KEY = 'spark.bookmarks'

/** 写入数据文件（fire-and-forget，失败打日志） */
function persist(bookmarks: Website[]): void {
  void window.api.writeData(DATA_KEY, bookmarks)
}

/** 生成唯一 ID（小写字母数字，兼容 sparklogo:// hostname 小写化） */
function generateId(): string {
  return (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).toLowerCase()
}

/** 把 data URL 的 logo 落盘为图片文件，返回 sparklogo:// URL；失败时保留原 data URL */
async function persistLogoFile(id: string, logo: string): Promise<string> {
  if (logo.startsWith('data:') && window.api?.saveLogo) {
    const saved = await window.api.saveLogo(id, logo)
    if (saved) return saved
  }
  return logo
}

/** 从 localStorage 读取旧版数据（迁移用） */
function loadLegacyBookmarks(): Website[] {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** 从 URL 提取域名 */
export function extractDomain(url: string): string {
  try {
    const u = new URL(url)
    return u.hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** 上传 SVG logo 的大小上限（2 MB） */
export const SVG_LOGO_MAX_SIZE = 2 * 1024 * 1024

/** 把本地文件读成 data URL */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (): void => resolve(String(reader.result))
    reader.onerror = (): void => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/** 校验 SVG 文件并读成 data URL；失败时返回错误提示 */
export async function svgFileToDataUrl(
  file: File
): Promise<{ dataUrl: string; error?: undefined } | { dataUrl?: undefined; error: string }> {
  if (!/\.svg$/i.test(file.name) && file.type !== 'image/svg+xml') {
    return { error: '请选择 SVG 格式的文件' }
  }
  if (file.size > SVG_LOGO_MAX_SIZE) {
    return { error: 'SVG 文件过大，请选择 2 MB 以内的文件' }
  }
  try {
    // 文件头快照内容校验（允许前置 xml 声明/注释）
    const head = await file.slice(0, 4096).text()
    if (!/<svg[\s>]/i.test(head)) return { error: '文件内容不是有效的 SVG' }
    const dataUrl = await readFileAsDataUrl(file)
    // 个别系统 .svg 的 MIME 识别不准，统一修正前缀（base64 内容不变）
    return { dataUrl: dataUrl.replace(/^data:[^;,]*(;base64)?,/, 'data:image/svg+xml;base64,') }
  } catch {
    return { error: '读取 SVG 文件失败' }
  }
}

/** 获取 favicon data URL（通过 Electron 主进程下载） */
export async function fetchFaviconDataUrl(url: string): Promise<string | null> {
  try {
    if (window?.api?.fetchFavicon) {
      return await window.api.fetchFavicon(url)
    }
  } catch (err) {
    console.error('获取 favicon 失败:', err)
  }
  return null
}

/** 识别网站信息（logo + 名称） */
export async function fetchSiteInfo(
  url: string
): Promise<{ logo: string | null; name: string | null }> {
  try {
    if (window?.api?.fetchSiteInfo) {
      return (await window.api.fetchSiteInfo(url)) ?? { logo: null, name: null }
    }
  } catch (err) {
    console.error('识别网站信息失败:', err)
  }
  return { logo: null, name: null }
}

interface WebsiteState {
  /** 书签列表 */
  bookmarks: Website[]
  /** 是否已从数据文件加载完成 */
  loaded: boolean
  /** 搜索关键词 */
  searchKeyword: string
  /** 是否处于编辑状态 */
  editingId: string | null

  // Actions
  /** 启动时从数据文件加载（含旧 localStorage 迁移），幂等 */
  hydrate: () => Promise<void>
  addBookmark: (url: string, name?: string, logo?: string, categoryId?: string) => Promise<Website>
  removeBookmark: (id: string) => void
  updateBookmark: (id: string, patch: Partial<Omit<Website, 'id' | 'createdAt'>>) => void
  refreshFavicon: (id: string) => Promise<void>
  /** 上传本地 SVG 作为书签 logo；成功返回 null，失败返回错误提示 */
  setLogoFromFile: (id: string, file: File) => Promise<string | null>
  setSearchKeyword: (keyword: string) => void
  setEditingId: (id: string | null) => void
}

export const useWebsiteStore = create<WebsiteState>((set, get) => ({
  bookmarks: [],
  loaded: false,
  searchKeyword: '',
  editingId: null,

  hydrate: async () => {
    if (get().loaded) return
    try {
      let list: Website[] = []
      const stored = (await window.api.readData(DATA_KEY)) as Website[] | null
      if (Array.isArray(stored) && stored.length > 0) {
        list = stored
      } else {
        // 文件为空：尝试从旧版 localStorage 迁移
        const legacy = loadLegacyBookmarks()
        list = legacy
        if (legacy.length > 0) {
          console.log(`[websiteStore] 迁移旧版 localStorage 数据：${legacy.length} 条书签`)
          // 旧数据里的 base64 logo 顺便落盘
          for (const b of legacy) {
            if (b.logo?.startsWith('data:')) {
              b.logo = await persistLogoFile(b.id, b.logo)
            }
          }
          persist(list)
        }
      }
      set({ bookmarks: list, loaded: true })
    } catch (err) {
      console.error('加载书签数据文件失败:', err)
      set({ loaded: true })
    }
  },

  addBookmark: async (url, name, logo, categoryId) => {
    const domain = extractDomain(url)
    // 识别网站信息（真实 logo + 网站名称）
    let favicon = logo || ''
    let detectedName: string | null = null
    if (!favicon || !name) {
      const info = await fetchSiteInfo(url)
      if (!favicon) favicon = info.logo || ''
      detectedName = info.name
    }
    const id = generateId()
    // logo 落盘为独立图片文件
    favicon = await persistLogoFile(id, favicon)
    const newBookmark: Website = {
      id,
      // 优先级：用户手填 > 网站识别名称 > 域名
      name: name?.trim() || detectedName?.trim() || domain,
      url,
      logo: favicon,
      categoryId: categoryId || undefined,
      createdAt: Date.now()
    }
    const updated = [...get().bookmarks, newBookmark]
    persist(updated)
    set({ bookmarks: updated })
    return newBookmark
  },

  removeBookmark: (id) => {
    const updated = get().bookmarks.filter((b) => b.id !== id)
    persist(updated)
    set({ bookmarks: updated })
    // 同步删除 logo 图片文件
    void window.api.deleteLogo(id)
  },

  updateBookmark: (id, patch) => {
    const prev = get().bookmarks.find((b) => b.id === id)
    const updated = get().bookmarks.map((b) => (b.id === id ? { ...b, ...patch } : b))
    persist(updated)
    set({ bookmarks: updated })
    // logo 变化：新 logo 落盘，旧 logo 文件清理
    if (patch.logo !== undefined && prev && patch.logo !== prev.logo) {
      const next = patch.logo
      if (next.startsWith('data:')) {
        void persistLogoFile(id, next).then((saved) => {
          if (saved !== next) {
            set((s) => ({
              bookmarks: s.bookmarks.map((b) => (b.id === id ? { ...b, logo: saved } : b))
            }))
            persist(get().bookmarks)
          }
        })
      } else if (
        (prev.logo || '').startsWith('data:') ||
        (prev.logo || '').startsWith('sparklogo://')
      ) {
        void window.api.deleteLogo(id)
      }
    }
  },

  refreshFavicon: async (id) => {
    const bookmark = get().bookmarks.find((b) => b.id === id)
    if (!bookmark) return
    const info = await fetchSiteInfo(bookmark.url)
    if (info.logo) {
      const saved = await persistLogoFile(id, info.logo)
      const updated = get().bookmarks.map((b) => (b.id === id ? { ...b, logo: saved } : b))
      persist(updated)
      set({ bookmarks: updated })
    }
  },

  setLogoFromFile: async (id, file) => {
    const result = await svgFileToDataUrl(file)
    if (!result.dataUrl) return result.error || 'SVG 读取失败'
    // 复用 updateBookmark 落盘链路：data URL 会存为 userData/logos/<id>.svg（sparklogo:// 显示）
    get().updateBookmark(id, { logo: result.dataUrl })
    return null
  },

  setSearchKeyword: (searchKeyword) => set({ searchKeyword }),
  setEditingId: (editingId) => set({ editingId })
}))

/** 过滤书签（支持关键词 + 分类）
 * categoryId: undefined = 不限制分类；'' = 仅未分类；其他 = 指定分类
 */
export function filterBookmarks(
  bookmarks: Website[],
  keyword: string,
  categoryId?: string
): Website[] {
  let list = bookmarks
  if (categoryId !== undefined) {
    list = list.filter((b) => (b.categoryId || '') === categoryId)
  }
  if (!keyword) return list
  const lower = keyword.toLowerCase()
  return list.filter(
    (b) => b.name.toLowerCase().includes(lower) || b.url.toLowerCase().includes(lower)
  )
}
