/**
 * 文件管理页面
 */

import { useEffect } from 'react'
import { useDiskStore } from '../store/diskStore'
import { useAppStore } from '../store/appStore'
import { Breadcrumb } from '../components/file/Breadcrumb'
import { FileList } from '../components/file/FileList'
import { Button } from '../components/common/Button'
import { Input } from '../components/common/Input'
import { Icon } from '../components/common/Icon'
import { isSamePath, getParentPath, isPathWithin } from '../utils/path'
import { renderMarkdown } from '../utils/markdown'
import type { FileItem } from '../types'
import './FileExplorer.css'

export function FileExplorer(): React.JSX.Element {
  const {
    disks,
    rootPath,
    currentPath,
    files,
    selectedPaths,
    viewMode,
    sortBy,
    sortOrder,
    loading,
    setCurrentPath,
    setFiles,
    toggleSelect,
    clearSelection,
    setViewMode,
    setSort,
    setLoading
  } = useDiskStore()

  const { searchKeyword, setSearchKeyword, setPage, setMarkdownPath } = useAppStore()

  // 加载当前路径的文件
  useEffect(() => {
    if (!currentPath) return
    setLoading(true)
    window.api
      .listFolder(currentPath)
      .then(setFiles)
      .catch((err) => {
        console.error('加载文件失败:', err)
        setFiles([])
      })
      .finally(() => setLoading(false))
  }, [currentPath, setFiles, setLoading])

  // 切换路径时清空选中
  useEffect(() => {
    clearSelection()
  }, [currentPath, clearSelection])

  const handleOpen = (file: FileItem): void => {
    if (file.kind === 'directory') {
      setCurrentPath(file.path)
    } else {
      // Markdown 文件用内置编辑器打开
      if (file.ext === 'md' || file.ext === 'markdown') {
        setMarkdownPath(file.path)
        setPage('markdown')
        return
      }
      // 视频文件用外部播放器
      if (file.isVideo) {
        window.api.playVideo(file.path)
      } else {
        window.api.showInFolder(file.path)
      }
    }
  }

  const handleContextAction = async (action: string, file: FileItem): Promise<void> => {
    switch (action) {
      case 'showInFolder':
        await window.api.showInFolder(file.path)
        break
      case 'delete':
        if (confirm(`确定删除 ${file.name} 吗？`)) {
          await window.api.deletePath(file.path)
          // 重新加载
          if (currentPath) {
            setFiles(await window.api.listFolder(currentPath))
          }
        }
        break
      case 'rename': {
        const newName = prompt('新名称:', file.name)
        if (newName && newName !== file.name) {
          await window.api.renamePath(file.path, newName)
          if (currentPath) {
            setFiles(await window.api.listFolder(currentPath))
          }
        }
        break
      }
      case 'copy':
        // TODO: 复制功能
        console.log('复制:', file.path)
        break
      case 'exportPdf': {
        // 读取 MD 源码 -> 渲染为 HTML -> 主进程打印为 PDF
        try {
          const text = await window.api.readFile(file.path)
          const base = file.name.replace(/\.(md|markdown)$/i, '') || 'document'
          const saved = await window.api.exportMarkdownPdf(renderMarkdown(text), `${base}.pdf`)
          if (saved) alert(`PDF 已导出到：\n${saved}`)
        } catch (err) {
          console.error('导出 PDF 失败:', err)
          alert(`导出 PDF 失败：${err instanceof Error ? err.message : String(err)}`)
        }
        break
      }
    }
  }

  const handleSort = (by: typeof sortBy): void => {
    if (sortBy === by) {
      setSort(by, sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSort(by, 'asc')
    }
  }

  /** 当前路径是否已到根（不能继续后退） */
  const atRoot = !currentPath || !rootPath || isSamePath(currentPath, rootPath)

  /** 面包屑根段（磁盘名或所选文件夹名） */
  const rootSegment = (() => {
    if (!rootPath) return undefined
    const disk = disks.find((d) => isSamePath(d.path, rootPath))
    const icon = disk
      ? disk.type === 'removable'
        ? ('usb' as const)
        : disk.type === 'system'
          ? ('computer' as const)
          : ('hard-drive' as const)
      : ('folder' as const)
    // 手动选择的文件夹：取最后一段作为名称
    const fallbackName = rootPath.split(/[\\/]/).filter(Boolean).pop() ?? rootPath
    return { name: disk?.name ?? fallbackName, path: rootPath, icon }
  })()

  const handleGoUp = (): void => {
    if (!currentPath || !rootPath || atRoot) return
    const parent = getParentPath(currentPath)
    // 不允许退出 rootPath
    if (!parent || !isPathWithin(parent, rootPath)) return
    setCurrentPath(parent)
  }

  // 根据搜索过滤
  const filteredFiles = searchKeyword
    ? files.filter((f) => f.name.toLowerCase().includes(searchKeyword.toLowerCase()))
    : files

  // 未选磁盘时
  if (!rootPath) {
    return (
      <div className="file-explorer-empty">
        <Icon name="hard-drive" size={48} strokeWidth={1} />
        <h2>请选择一个磁盘</h2>
        <p>从左侧边栏选择要管理的磁盘或文件夹</p>
        <Button
          variant="primary"
          icon={<Icon name="folder" size={14} />}
          onClick={async () => {
            const path = await window.api.selectFolder()
            if (path) {
              useDiskStore.getState().setRootPath(path)
            }
          }}
        >
          选择文件夹
        </Button>
      </div>
    )
  }

  return (
    <div className="file-explorer">
      {/* 顶栏 */}
      <div className="file-explorer-topbar">
        <div className="file-explorer-nav">
          <Button
            icon={<Icon name="arrow-up" size={14} />}
            iconOnly
            size="sm"
            variant="ghost"
            onClick={handleGoUp}
            disabled={atRoot}
            title="上一级"
          />
        </div>
        <Breadcrumb path={currentPath} rootSegment={rootSegment} onNavigate={setCurrentPath} />
        <div className="file-explorer-actions">
          <Input
            prefix={<Icon name="search" size={13} />}
            placeholder="搜索文件..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            style={{ width: 200 }}
          />
          <Button
            icon={<Icon name="refresh" size={13} />}
            iconOnly
            size="sm"
            variant="ghost"
            onClick={async () => {
              if (currentPath) {
                setFiles(await window.api.listFolder(currentPath))
              }
            }}
            title="刷新"
          />
          <div className="view-mode-toggle">
            <button
              className={`view-mode-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="列表视图"
            >
              <Icon name="list" size={14} />
            </button>
            <button
              className={`view-mode-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="网格视图"
              disabled
            >
              <Icon name="grid" size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* 主内容 */}
      <div className="file-explorer-content">
        {loading ? (
          <div className="file-explorer-loading">
            <Icon name="refresh" size={24} strokeWidth={1} />
            <span>加载中...</span>
          </div>
        ) : (
          <FileList
            files={filteredFiles}
            selectedPaths={selectedPaths}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
            onSelect={toggleSelect}
            onOpen={handleOpen}
            onContextAction={handleContextAction}
          />
        )}
      </div>
    </div>
  )
}
