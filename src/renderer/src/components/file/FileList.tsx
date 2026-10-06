/**
 * 文件列表（表格视图）
 * 列：名称 / 大小 / 修改时间
 */

import { useMemo } from 'react'
import type { FileItem, SortBy, SortOrder } from '../../types'
import { Icon, type IconName } from '../common/Icon'
import { showContextMenu, type MenuItem } from '../common/ContextMenu'
import './FileList.css'

interface FileListProps {
  files: FileItem[]
  selectedPaths: Set<string>
  sortBy: SortBy
  sortOrder: SortOrder
  onSort: (by: SortBy) => void
  onSelect: (path: string, multi: boolean) => void
  onOpen: (file: FileItem) => void
  onContextAction: (action: string, file: FileItem) => void
}

function formatSize(bytes?: number): string {
  if (bytes === undefined) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatTime(ts?: number): string {
  if (!ts) return '—'
  const d = new Date(ts)
  const now = new Date()
  const sameYear = d.getFullYear() === now.getFullYear()
  const pad = (n: number): string => String(n).padStart(2, '0')
  const date = sameYear
    ? `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function getFileIcon(file: FileItem): IconName {
  if (file.kind === 'directory') return 'folder'
  if (file.isVideo) return 'file-video'
  if (file.isAudio) return 'file-audio'
  if (file.isImage) return 'file-image'
  return 'file'
}

export function FileList({
  files,
  selectedPaths,
  sortBy,
  sortOrder,
  onSort,
  onSelect,
  onOpen,
  onContextAction
}: FileListProps): React.JSX.Element {
  const sortedFiles = useMemo(() => {
    const sorted = [...files].sort((a, b) => {
      // 文件夹永远在前面
      if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
      let cmp = 0
      switch (sortBy) {
        case 'name':
          cmp = a.name.localeCompare(b.name, 'zh-CN')
          break
        case 'size':
          cmp = (a.size ?? 0) - (b.size ?? 0)
          break
        case 'mtime':
          cmp = (a.mtime ?? 0) - (b.mtime ?? 0)
          break
      }
      return sortOrder === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [files, sortBy, sortOrder])

  const handleContextMenu = (e: React.MouseEvent, file: FileItem): void => {
    // 如果右键的文件不在选中里，先选中它
    if (!selectedPaths.has(file.path)) {
      onSelect(file.path, false)
    }

    const isMarkdown =
      file.kind !== 'directory' && (file.ext === 'md' || file.ext === 'markdown')

    const items: MenuItem[] = [
      {
        key: 'open',
        label: file.kind === 'directory' ? '打开文件夹' : '打开',
        icon: <Icon name={file.kind === 'directory' ? 'folder' : 'play'} size={13} />,
        onClick: () => onOpen(file)
      },
      // Markdown 文件专属：直接导出 PDF，无需先进入编辑器
      ...(isMarkdown
        ? [
            {
              key: 'exportPdf',
              label: '导出 PDF',
              icon: <Icon name="download" size={13} />,
              onClick: () => onContextAction('exportPdf', file)
            }
          ]
        : []),
      { key: 'divider-1', label: '', divider: true },
      {
        key: 'showInFolder',
        label: '在文件夹中显示',
        icon: <Icon name="hard-drive" size={13} />,
        onClick: () => onContextAction('showInFolder', file)
      },
      {
        key: 'copy',
        label: '复制',
        icon: <Icon name="copy" size={13} />,
        onClick: () => onContextAction('copy', file)
      },
      {
        key: 'rename',
        label: '重命名',
        icon: <Icon name="edit" size={13} />,
        onClick: () => onContextAction('rename', file)
      },
      { key: 'divider-2', label: '', divider: true },
      {
        key: 'delete',
        label: '删除',
        icon: <Icon name="trash" size={13} />,
        danger: true,
        onClick: () => onContextAction('delete', file)
      }
    ]
    showContextMenu(e, items)
  }

  const renderSortIcon = (col: SortBy): React.ReactNode => {
    if (sortBy !== col) return null
    return (
      <Icon
        name={sortOrder === 'asc' ? 'chevron-up' : 'chevron-down'}
        size={11}
        className="file-list-sort-icon"
      />
    )
  }

  return (
    <div className="file-list">
      {/* 表头 */}
      <div className="file-list-header">
        <button
          className={`file-list-th name ${sortBy === 'name' ? 'sorted' : ''}`}
          onClick={() => onSort('name')}
        >
          名称 {renderSortIcon('name')}
        </button>
        <button
          className={`file-list-th size ${sortBy === 'size' ? 'sorted' : ''}`}
          onClick={() => onSort('size')}
        >
          大小 {renderSortIcon('size')}
        </button>
        <button
          className={`file-list-th mtime ${sortBy === 'mtime' ? 'sorted' : ''}`}
          onClick={() => onSort('mtime')}
        >
          修改时间 {renderSortIcon('mtime')}
        </button>
      </div>

      {/* 文件列表 */}
      <div className="file-list-body">
        {sortedFiles.length === 0 ? (
          <div className="file-list-empty">
            <Icon name="folder" size={32} strokeWidth={1} />
            <span>空文件夹</span>
          </div>
        ) : (
          sortedFiles.map((file) => {
            const isSelected = selectedPaths.has(file.path)
            return (
              <div
                key={file.path}
                className={`file-list-row ${isSelected ? 'selected' : ''}`}
                onClick={(e) => onSelect(file.path, e.metaKey || e.ctrlKey)}
                onDoubleClick={() => onOpen(file)}
                onContextMenu={(e) => handleContextMenu(e, file)}
              >
                <div className="file-list-td name">
                  <span className={`file-icon ${file.kind}`}>
                    <Icon name={getFileIcon(file)} size={15} />
                  </span>
                  <span className="file-name text-ellipsis" title={file.name}>
                    {file.name}
                  </span>
                </div>
                <div className="file-list-td size text-secondary">{formatSize(file.size)}</div>
                <div className="file-list-td mtime text-secondary">{formatTime(file.mtime)}</div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
