/**
 * 面包屑导航
 * 首段为磁盘/根目录，后续为相对路径，支持点击跳转
 */

import { useMemo } from 'react'
import { Icon, type IconName } from '../common/Icon'
import { isWindowsPath, normalizePath, isSamePath } from '../../utils/path'
import './Breadcrumb.css'

export interface RootSegment {
  name: string
  path: string
  /** 根段图标类型 */
  icon?: IconName
}

interface BreadcrumbProps {
  path: string | null
  rootSegment?: RootSegment
  onNavigate: (path: string) => void
}

interface PathSegment {
  name: string
  path: string
}

/** 计算 currentPath 相对于 rootPath 的路径段 */
function getRelativeSegments(rootPath: string, currentPath: string): PathSegment[] {
  const isWin = isWindowsPath(currentPath)
  const sep = isWin ? '\\' : '/'

  let rel = ''
  if (isSamePath(rootPath, currentPath)) {
    rel = ''
  } else if (currentPath.startsWith(normalizePath(rootPath))) {
    rel = currentPath.slice(normalizePath(rootPath).length)
  } else {
    rel = currentPath
  }

  const parts = rel.split(/[\\/]/).filter(Boolean)
  const segments: PathSegment[] = []
  let acc = normalizePath(rootPath)

  for (const part of parts) {
    acc = acc + (acc.endsWith(sep) ? '' : sep) + part
    segments.push({ name: part, path: acc })
  }
  return segments
}

export function Breadcrumb({ path, rootSegment, onNavigate }: BreadcrumbProps): React.JSX.Element {
  const segments = useMemo(() => {
    if (!path) return []
    if (rootSegment) return getRelativeSegments(rootSegment.path, path)
    // 未提供根段时退化为完整路径
    const isWin = isWindowsPath(path)
    const sep = isWin ? '\\' : '/'
    const parts = path.split(/[\\/]/).filter(Boolean)
    const result: PathSegment[] = []
    let acc = isWin ? '' : sep
    parts.forEach((part) => {
      acc = acc + (acc.endsWith(sep) || acc === '' ? '' : sep) + part
      if (acc === '') acc = part + sep
      result.push({ name: part, path: acc })
    })
    return result
  }, [path, rootSegment])

  const rootActive = rootSegment ? isSamePath(path, rootSegment.path) : false

  return (
    <nav className="breadcrumb">
      {rootSegment && (
        <div className="breadcrumb-item">
          <button
            className={`breadcrumb-btn ${rootActive ? 'current' : ''}`}
            onClick={() => !rootActive && onNavigate(rootSegment.path)}
            disabled={rootActive}
            title={rootSegment.path}
          >
            {rootSegment.icon && (
              <span className="breadcrumb-root-icon">
                <Icon name={rootSegment.icon} size={13} />
              </span>
            )}
            {rootSegment.name}
          </button>
          {segments.length > 0 && (
            <span className="breadcrumb-sep">
              <Icon name="chevron-right" size={12} />
            </span>
          )}
        </div>
      )}

      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1
        return (
          <div key={seg.path} className="breadcrumb-item">
            <button
              className={`breadcrumb-btn ${isLast ? 'current' : ''}`}
              onClick={() => !isLast && onNavigate(seg.path)}
              disabled={isLast}
            >
              {seg.name}
            </button>
            {!isLast && (
              <span className="breadcrumb-sep">
                <Icon name="chevron-right" size={12} />
              </span>
            )}
          </div>
        )
      })}
    </nav>
  )
}
