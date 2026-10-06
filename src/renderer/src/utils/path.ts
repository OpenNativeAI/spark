/**
 * Renderer 端路径工具（跨平台，不依赖 Node path 模块）
 */

/** 是否为 Windows 盘符路径（C:\ 或 C:/） */
export function isWindowsPath(p: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(p)
}

/** 规范化路径：去掉末尾分隔符，根目录保留分隔符 */
export function normalizePath(p: string | null | undefined): string {
  if (!p) return ''
  const sep = isWindowsPath(p) ? '\\' : '/'
  const clean = p.replace(/[\\/]+$/, '')
  if (!clean) return sep
  // Windows 盘根：'C:' → 'C:\'
  if (isWindowsPath(p) && /^[A-Za-z]:$/.test(clean)) {
    return clean + '\\'
  }
  return clean
}

/** 判断两个路径是否指向同一位置 */
export function isSamePath(a: string | null, b: string | null): boolean {
  if (!a || !b) return false
  const na = normalizePath(a)
  const nb = normalizePath(b)
  return isWindowsPath(na) || isWindowsPath(nb)
    ? na.toLowerCase() === nb.toLowerCase()
    : na === nb
}

/**
 * 获取父路径
 * @returns 父路径；已到根目录时返回 null
 */
export function getParentPath(p: string): string | null {
  // Windows: C:\Users\z → C:\Users；C:\ → null
  if (isWindowsPath(p)) {
    const drive = p.slice(0, 3) // 形如 'C:\'
    const rest = p.slice(3).replace(/[\\/]+$/, '')
    if (!rest) return null
    const parts = rest.split(/[\\/]/).filter(Boolean)
    parts.pop()
    return parts.length > 0 ? drive + parts.join('\\') : drive
  }

  // POSIX: /Applications/X.app → /Applications；/Applications → /；/ → null
  const clean = normalizePath(p)
  if (clean === '/') return null
  const idx = clean.lastIndexOf('/')
  return idx <= 0 ? '/' : clean.slice(0, idx)
}

/**
 * 判断 child 是否等于 parent 或位于 parent 之内
 */
export function isPathWithin(child: string, parent: string): boolean {
  const nc = normalizePath(child)
  const np = normalizePath(parent)
  if (!nc || !np) return false
  if (nc === np) return true
  const sep = np === '/' || isWindowsPath(np) === false ? '/' : '\\'
  return nc.startsWith(np.endsWith(sep) ? np : np + sep)
}
