/**
 * 影音库页面
 * 视频卡片网格 + 扫描 + 筛选/排序
 */

import { useEffect, useMemo, useState } from 'react'
import { useMediaStore, filterVideos, sortVideos, type MediaFilter } from '../store/mediaStore'
import { useDiskStore } from '../store/diskStore'
import { useAppStore } from '../store/appStore'
import { VideoCard } from '../components/media/VideoCard'
import { Button } from '../components/common/Button'
import { Icon } from '../components/common/Icon'
import { showContextMenu, type MenuItem } from '../components/common/ContextMenu'
import type { VideoItem } from '../types'
import './MediaLibrary.css'

const FILTER_OPTIONS: Array<{ key: MediaFilter; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'unwatched', label: '未看' },
  { key: 'inProgress', label: '在看' },
  { key: 'watched', label: '已看' }
]

export function MediaLibrary(): React.JSX.Element {
  const {
    mediaRootPath,
    videos,
    filter,
    sortBy,
    sortOrder,
    scanning,
    setMediaRootPath,
    setVideos,
    setFilter,
    setScanning,
    setCurrentVideo
  } = useMediaStore()

  const { rootPath } = useDiskStore()
  const { setPage } = useAppStore()
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())

  // 如果没有专门的 mediaRootPath，使用 rootPath
  const effectiveRoot = mediaRootPath || rootPath

  // 扫描视频
  const handleScan = async (): Promise<void> => {
    if (!effectiveRoot) return
    setScanning(true)
    try {
      const scanned = await window.api.scanMedia(effectiveRoot)
      // 加载每个视频的进度
      const withProgress = await Promise.all(
        scanned.map(async (v) => {
          const p = await window.api.getProgress(v.path)
          return {
            ...v,
            progress: p?.progress ?? 0,
            lastPosition: p?.position ?? 0
          }
        })
      )
      setVideos(withProgress)
    } catch (err) {
      console.error('扫描失败:', err)
    } finally {
      setScanning(false)
    }
  }

  // 首次进入且根路径变化时自动扫描
  useEffect(() => {
    if (effectiveRoot && videos.length === 0 && !scanning) {
      handleScan()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveRoot])

  // 过滤 + 排序
  const displayVideos = useMemo(() => {
    return sortVideos(filterVideos(videos, filter), sortBy, sortOrder)
  }, [videos, filter, sortBy, sortOrder])

  const handlePlay = (video: VideoItem): void => {
    setCurrentVideo(video)
    setPage('mediaDetail')
  }

  const handleContextMenu = (e: React.MouseEvent, video: VideoItem): void => {
    const items: MenuItem[] = [
      {
        key: 'play',
        label: video.progress && video.progress > 0.05 ? '继续播放' : '播放',
        icon: <Icon name="play" size={13} />,
        onClick: () => handlePlay(video)
      },
      {
        key: 'playFromStart',
        label: '从头播放',
        icon: <Icon name="refresh" size={13} />,
        disabled: !video.progress || video.progress < 0.05,
        onClick: () => {
          const reset = { ...video, lastPosition: 0, progress: 0 }
          setCurrentVideo(reset)
          setPage('mediaDetail')
        }
      },
      { key: 'divider-1', label: '', divider: true },
      {
        key: 'detail',
        label: '查看详情',
        icon: <Icon name="file" size={13} />,
        onClick: () => {
          setCurrentVideo(video)
          useDiskStore.setState({})
          useMediaStore.getState().setCurrentVideo(video)
          // TODO: 切到详情页
        }
      },
      {
        key: 'showInFolder',
        label: '在文件夹中显示',
        icon: <Icon name="hard-drive" size={13} />,
        onClick: () => window.api.showInFolder(video.path)
      },
      { key: 'divider-2', label: '', divider: true },
      {
        key: 'refreshMeta',
        label: '刷新元数据',
        icon: <Icon name="refresh" size={13} />,
        onClick: async () => {
          const meta = await window.api.getVideoMeta(video.path)
          useMediaStore.getState().updateVideo(video.path, { meta })
        }
      },
      {
        key: 'delete',
        label: '删除',
        icon: <Icon name="trash" size={13} />,
        danger: true,
        onClick: async () => {
          if (confirm(`确定删除 ${video.name} 吗？`)) {
            await window.api.deletePath(video.path)
            setVideos(videos.filter((v) => v.path !== video.path))
          }
        }
      }
    ]
    showContextMenu(e, items)
  }

  // 未选磁盘时
  if (!effectiveRoot) {
    return (
      <div className="media-library-empty">
        <Icon name="film" size={48} strokeWidth={1} />
        <h2>请选择一个磁盘</h2>
        <p>从左侧边栏选择包含视频的磁盘或文件夹</p>
        <Button
          variant="primary"
          icon={<Icon name="folder" size={14} />}
          onClick={async () => {
            const path = await window.api.selectFolder()
            if (path) {
              setMediaRootPath(path)
            }
          }}
        >
          选择文件夹
        </Button>
      </div>
    )
  }

  return (
    <div className="media-library">
      {/* 顶栏 */}
      <div className="media-library-topbar">
        <div className="media-library-filters">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              className={`filter-btn ${filter === opt.key ? 'active' : ''}`}
              onClick={() => setFilter(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="media-library-actions">
          <Button
            size="sm"
            variant="ghost"
            icon={<Icon name="refresh" size={13} />}
            onClick={handleScan}
            disabled={scanning}
          >
            {scanning ? '扫描中...' : '重新扫描'}
          </Button>
        </div>
      </div>

      {/* 网格 */}
      <div className="media-library-content">
        {scanning && videos.length === 0 ? (
          <div className="media-library-loading">
            <Icon name="refresh" size={24} strokeWidth={1} />
            <span>正在扫描视频...</span>
          </div>
        ) : displayVideos.length === 0 ? (
          <div className="media-library-empty-result">
            <Icon name="film" size={32} strokeWidth={1} />
            <span>{filter === 'all' ? '未发现视频文件' : '没有符合筛选条件的视频'}</span>
            {filter === 'all' && (
              <Button size="sm" variant="primary" onClick={handleScan}>
                重新扫描
              </Button>
            )}
          </div>
        ) : (
          <div className="media-grid">
            {displayVideos.map((video) => (
              <VideoCard
                key={video.path}
                video={video}
                selected={selectedPaths.has(video.path)}
                onSelect={(multi) => {
                  setSelectedPaths((prev) => {
                    const next = new Set(multi ? prev : [])
                    if (next.has(video.path)) {
                      next.delete(video.path)
                    } else {
                      next.add(video.path)
                    }
                    return next
                  })
                }}
                onPlay={() => handlePlay(video)}
                onContextMenu={(e) => handleContextMenu(e, video)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
