/**
 * 轻量 Markdown 渲染器（零依赖）
 * 将 Markdown 源码转换为 HTML 字符串，供预览模式渲染。
 * 支持：标题、段落、换行、粗体/斜体/删除线、行内代码、代码块、
 * 引用、有序/无序列表（含一级嵌套）、分隔线、链接、图片、表格。
 *
 * 安全：先对原始文本做 HTML 转义，再注入受控标签，避免注入。
 */

/** HTML 转义 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** URL 白名单校验（拦截 javascript: 等危险协议） */
function safeUrl(url: string): string | null {
  const trimmed = url.trim()
  if (/^(https?:|mailto:|tel:|data:image\/|#|\/|\.\/|\.\.\/)/i.test(trimmed)) {
    return trimmed
  }
  // 相对路径（不含协议冒号）
  if (!/^[a-z]+:/i.test(trimmed)) return trimmed
  return null
}

/** 行内元素解析（传入文本已 HTML 转义） */
function renderInline(text: string): string {
  // 1. 先提取行内代码，用占位符保护，避免其中的 * _ 等被误解析
  const codeSpans: string[] = []
  let out = text.replace(/`([^`]+)`/g, (_m, code: string) => {
    codeSpans.push(code)
    return `\u0000CODE${codeSpans.length - 1}\u0000`
  })

  // 2. 图片 ![alt](url)
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt: string, url: string) => {
    const safe = safeUrl(url)
    if (!safe) return _m
    return `<img alt="${alt}" src="${safe}" loading="lazy" />`
  })

  // 3. 链接 [text](url)
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, url: string) => {
    const safe = safeUrl(url)
    if (!safe) return _m
    return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${label}</a>`
  })

  // 4. 粗体 **text** / __text__
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/__([^_]+)__/g, '<strong>$1</strong>')

  // 5. 斜体 *text* / _text_
  out = out.replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, '$1<em>$2</em>')
  out = out.replace(/(^|[^_\w])_([^_\s][^_]*?)_/g, '$1<em>$2</em>')

  // 6. 删除线 ~~text~~
  out = out.replace(/~~([^~]+)~~/g, '<del>$1</del>')

  // 7. 还原行内代码
  out = out.replace(/\u0000CODE(\d+)\u0000/g, (_m, i: string) => `<code>${codeSpans[Number(i)]}</code>`)

  return out
}

/** 解析一行列表项的前缀，返回缩进空格数、标记类型、内容 */
interface ListInfo {
  indent: number
  ordered: boolean
  content: string
}
function parseListItem(line: string): ListInfo | null {
  const m = /^(\s*)(?:([-*+])|(\d+))\.\s+(.*)$/.exec(line)
  if (!m) {
    const um = /^(\s*)([-*+])\s+(.*)$/.exec(line)
    if (um) return { indent: um[1].length, ordered: false, content: um[3] }
    return null
  }
  if (m[2]) {
    return { indent: m[1].length, ordered: false, content: m[4] }
  }
  return { indent: m[1].length, ordered: true, content: m[4] }
}

/** 是否是表格分隔行，如 | --- | :--: | */
function isTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/.test(line) && line.includes('-')
}

/** 拆分表格行为单元格数组 */
function splitRow(line: string): string[] {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|')) s = s.slice(0, -1)
  return s.split('|').map((c) => c.trim())
}

/** 主渲染入口：Markdown 源码 -> HTML */
export function renderMarkdown(src: string): string {
  const lines = src.replace(/\r\n?/g, '\n').split('\n')
  const html: string[] = []
  let i = 0

  const flushParagraph = (buf: string[]): void => {
    if (buf.length === 0) return
    html.push(`<p>${renderInline(escapeHtml(buf.join('\n'))).replace(/\n/g, '<br />')}</p>`)
    buf.length = 0
  }

  let para: string[] = []

  while (i < lines.length) {
    const line = lines[i]

    // 代码块 ```
    const fence = /^\s*```+\s*([\w-]*)\s*$/.exec(line)
    if (fence) {
      flushParagraph(para)
      const lang = fence[1] || ''
      const codeLines: string[] = []
      i++
      while (i < lines.length && !/^\s*```+\s*$/.test(lines[i])) {
        codeLines.push(lines[i])
        i++
      }
      i++ // 跳过结束围栏
      const cls = lang ? ` class="language-${escapeHtml(lang)}"` : ''
      html.push(`<pre><code${cls}>${escapeHtml(codeLines.join('\n'))}</code></pre>`)
      continue
    }

    // 空行 -> 结束当前段落
    if (line.trim() === '') {
      flushParagraph(para)
      i++
      continue
    }

    // 分隔线 --- *** ___
    if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(line)) {
      flushParagraph(para)
      html.push('<hr />')
      i++
      continue
    }

    // 标题 # ~ ######
    const heading = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line)
    if (heading) {
      flushParagraph(para)
      const level = heading[1].length
      html.push(`<h${level}>${renderInline(escapeHtml(heading[2]))}</h${level}>`)
      i++
      continue
    }

    // 引用 >
    if (/^\s{0,3}>\s?/.test(line)) {
      flushParagraph(para)
      const quoteLines: string[] = []
      while (i < lines.length && /^\s{0,3}>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^\s{0,3}>\s?/, ''))
        i++
      }
      // 递归渲染引用内部
      html.push(`<blockquote>${renderMarkdown(quoteLines.join('\n'))}</blockquote>`)
      continue
    }

    // 表格（当前行含 |，下一行为分隔行）
    if (line.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      flushParagraph(para)
      const headerCells = splitRow(line)
      i += 2
      const bodyRows: string[][] = []
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        bodyRows.push(splitRow(lines[i]))
        i++
      }
      const thead = headerCells.map((c) => `<th>${renderInline(escapeHtml(c))}</th>`).join('')
      const tbody = bodyRows
        .map(
          (row) =>
            `<tr>${row.map((c) => `<td>${renderInline(escapeHtml(c))}</td>`).join('')}</tr>`
        )
        .join('')
      html.push(
        `<table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`
      )
      continue
    }

    // 列表
    if (parseListItem(line)) {
      flushParagraph(para)
      const rendered = renderList(lines, i)
      html.push(rendered.html)
      i = rendered.next
      continue
    }

    // 普通段落文本
    para.push(escapeHtml(line))
    i++
  }

  flushParagraph(para)
  return html.join('\n')
}

/** 解析从 start 开始的（可能嵌套的）列表，返回 HTML 与下一行索引 */
function renderList(lines: string[], start: number): { html: string; next: number } {
  const first = parseListItem(lines[start])
  if (!first) return { html: '', next: start + 1 }
  const baseIndent = first.indent
  const ordered = first.ordered
  const items: string[] = []
  let i = start

  while (i < lines.length) {
    const info = parseListItem(lines[i])
    if (info && info.indent <= baseIndent + 1 && info.indent >= baseIndent) {
      // 当前层列表项
      let content = info.content
      i++
      // 收集缩进更深的子行（嵌套列表或续行）
      const childLines: string[] = []
      while (i < lines.length) {
        const childInfo = parseListItem(lines[i])
        const rawIndent = /^(\s*)/.exec(lines[i])?.[1].length ?? 0
        if (childInfo && childInfo.indent > baseIndent) {
          childLines.push(lines[i])
          i++
        } else if (!childInfo && lines[i].trim() !== '' && rawIndent > baseIndent) {
          childLines.push(lines[i])
          i++
        } else if (lines[i].trim() === '') {
          // 空行：可能是列表内段落分隔，peek 下一行是否仍属于本列表
          const peek = lines[i + 1]
          if (peek && parseListItem(peek) && (parseListItem(peek) as ListInfo).indent >= baseIndent) {
            childLines.push(lines[i])
            i++
          } else {
            break
          }
        } else {
          break
        }
      }
      let inner = renderInline(escapeHtml(content))
      if (childLines.length > 0) {
        inner += renderMarkdown(childLines.join('\n'))
      }
      items.push(inner)
    } else if (!info && lines[i].trim() === '' && items.length > 0) {
      // 列表结束后的空行
      const peek = lines[i + 1]
      if (peek && parseListItem(peek)) {
        break
      }
      break
    } else {
      break
    }
  }

  const tag = ordered ? 'ol' : 'ul'
  const html = `<${tag}>${items.map((it) => `<li>${it}</li>`).join('')}</${tag}>`
  return { html, next: i }
}

/* ============================ DOM -> Markdown 序列化 ============================ */
/**
 * 将 contentEditable 富文本区（由 renderMarkdown 产出 + 用户编辑）反向序列化为 Markdown。
 * 因为 DOM 结构由本模块渲染器产出、可预测，往返转换稳定。
 */

function repeatChar(s: string, n: number): string {
  return s.repeat(Math.max(0, n))
}

function indentLines(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces)
  return text
    .split('\n')
    .map((l) => (l.length ? pad + l : l))
    .join('\n')
}

/** 行内节点 -> Markdown */
function inlineToMd(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent ?? '').replace(/\u00a0/g, ' ')
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return ''
  const el = node as HTMLElement
  const children = (): string => {
    let out = ''
    el.childNodes.forEach((n) => {
      out += inlineToMd(n)
    })
    return out
  }
  switch (el.tagName) {
    case 'BR':
      return '\n'
    case 'STRONG':
    case 'B': {
      const inner = children()
      return inner.trim() ? `**${inner}**` : inner
    }
    case 'EM':
    case 'I': {
      const inner = children()
      return inner.trim() ? `*${inner}*` : inner
    }
    case 'DEL':
    case 'S':
    case 'STRIKE': {
      const inner = children()
      return inner.trim() ? `~~${inner}~~` : inner
    }
    case 'CODE':
      return '`' + (el.textContent ?? '') + '`'
    case 'A': {
      const href = el.getAttribute('href') ?? ''
      return `[${children()}](${href})`
    }
    case 'IMG': {
      const alt = el.getAttribute('alt') ?? ''
      const src = el.getAttribute('src') ?? ''
      return `![${alt}](${src})`
    }
    default:
      return children()
  }
}

/** 无序/有序列表（含嵌套） */
function listToMd(el: Element, ordered: boolean): string {
  const lines: string[] = []
  let idx = 1
  Array.from(el.children).forEach((li) => {
    if (li.tagName !== 'LI') return
    let text = ''
    let nested = ''
    Array.from(li.childNodes).forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const t = (child as HTMLElement).tagName
        if (t === 'UL' || t === 'OL') {
          nested += '\n' + indentLines(listToMd(child as Element, t === 'OL'), 2)
          return
        }
      }
      text += inlineToMd(child)
    })
    const marker = ordered ? `${idx}. ` : '- '
    lines.push(marker + text.trim() + nested)
    idx++
  })
  return lines.join('\n')
}

/** 表格 */
function tableToMd(table: Element): string {
  const rows = Array.from(table.querySelectorAll('tr'))
  if (rows.length === 0) return ''
  const cellsOf = (tr: Element): string[] =>
    Array.from(tr.children)
      .filter((c) => c.tagName === 'TD' || c.tagName === 'TH')
      .map((c) => inlineToMd(c).trim().replace(/\|/g, '\\|'))
  const header = cellsOf(rows[0])
  const body = rows.slice(1).map(cellsOf)
  const line = (cells: string[]): string => `| ${cells.join(' | ')} |`
  const sep = `| ${header.map(() => '---').join(' | ')} |`
  return [line(header), sep, ...body.map(line)].join('\n')
}

/** 块级节点 -> Markdown（返回 null 表示空块跳过） */
function blockToMd(node: Node): string | null {
  if (node.nodeType === Node.TEXT_NODE) {
    const t = (node.textContent ?? '').trim()
    return t || null
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return null
  const el = node as HTMLElement
  const tag = el.tagName
  if (/^H[1-6]$/.test(tag)) {
    return `${repeatChar('#', Number(tag[1]))} ${inlineToMd(el).trim()}`
  }
  switch (tag) {
    case 'P':
    case 'DIV': {
      const inner = inlineToMd(el)
      return inner.trim() ? inner : null
    }
    case 'UL':
      return listToMd(el, false)
    case 'OL':
      return listToMd(el, true)
    case 'BLOCKQUOTE': {
      const inner = containerToMd(el)
      return inner
        .split('\n')
        .map((l) => (l ? `> ${l}` : '>'))
        .join('\n')
    }
    case 'PRE': {
      const codeEl = el.querySelector('code') ?? el
      const langClass = (codeEl.getAttribute('class') ?? '').match(/language-([\w-]+)/)
      const lang = langClass ? langClass[1] : ''
      const code = (codeEl.textContent ?? '').replace(/\n$/, '')
      const fence = code.includes('```') ? '````' : '```'
      return `${fence}${lang}\n${code}\n${fence}`
    }
    case 'HR':
      return '---'
    case 'TABLE':
      return tableToMd(el)
    default:
      return inlineToMd(el).trim() || null
  }
}

/** 容器内所有块级子节点 -> Markdown（块间空行分隔） */
function containerToMd(container: Element): string {
  const blocks: string[] = []
  Array.from(container.childNodes).forEach((n) => {
    const md = blockToMd(n)
    if (md !== null && md !== '') blocks.push(md)
  })
  return blocks.join('\n\n')
}

/** 主入口：将编辑区 DOM 序列化为 Markdown */
export function serializeDomToMarkdown(root: Element): string {
  const NL = String.fromCharCode(10)
  const md = containerToMd(root)
  const collapsed = md.split(NL + NL + NL).join(NL + NL)
  return collapsed.trim() + NL
}
