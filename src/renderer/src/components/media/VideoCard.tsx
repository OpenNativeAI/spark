/**
 * 视频卡片
 * 海报 + 标题 + 元信息 + 进度条
 */

import { useEffect, useState } from 'react'
import type { VideoItem } from '../../types'
import { Icon } from '../common/Icon'
import { captureVideoFrame } from '../../utils/media'
import './VideoCard.css'

interface VideoCardProps {
  video: VideoItem
  selected?: boolean
  onSelect?: (multi: boolean) => void
  onPlay?: () => void
  onContextMenu?: (e: React.MouseEvent) => void
}

/** 格式化时长（秒 → HH:MM:SS 或 MM:SS） */
function formatDuration(seconds?: number): string {
  if (!seconds) return '--:--'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/** 格式化分辨率 */
function formatResolution(height?: number): string | null {
  if (!height) return null
  if (height >= 2160) return '4K'
  if (height >= 1440) return '2K'
  if (height >= 1080) return '1080P'
  if (height >= 720) return '720P'
  return `${height}P`
}

export function VideoCard({
  video,
  selected,
  onSelect,
  onPlay,
  onContextMenu
}: VideoCardProps): React.JSX.Element {
  const [posterUrl, setPosterUrl] = useState<string | null>(video.poster ?? null)

  // 用内置视频解码捕获首帧作为缩略图
  useEffect(() => {
    if (video.poster || posterUrl) return
    let cancelled = false
    captureVideoFrame(video.path).then((url) => {
      if (!cancelled && url) setPosterUrl(url)
    })
    return () => {
      cancelled = true
    }
  }, [video.path, video.poster, posterUrl])

  const progress = video.progress ?? 0
  const resolution = formatResolution(video.meta?.height)
  const ext = video.ext?.toUpperCase()

  return (
    <div
      className={`video-card ${selected ? 'selected' : ''}`}
      onClick={(e) => onSelect?.(e.metaKey || e.ctrlKey)}
      onDoubleClick={onPlay}
      onContextMenu={onContextMenu}
    >
      {/* 海报 */}
      <div className="video-card-poster">
        {posterUrl ? (
          <img src={posterUrl} alt={video.name} loading="lazy" />
        ) : (
          <div className="video-card-poster-placeholder">
            <Icon name="film" size={32} strokeWidth={1} />
          </div>
        )}

        {/* 时长标签 */}
        {video.meta?.duration && (
          <div className="video-card-duration">{formatDuration(video.meta.duration)}</div>
        )}

        {/* 进度条（海报底部） */}
        {progress > 0 && (
          <div className="video-card-progress-track">
            <div className="video-card-progress-bar" style={{ width: `${progress * 100}%` }} />
          </div>
        )}

        {/* 悬停播放按钮 */}
        <button
          className="video-card-play-btn"
          onClick={(e) => {
            e.stopPropagation()
            onPlay?.()
          }}
          aria-label="播放"
        >
          <Icon name="play" size={16} />
        </button>
      </div>

      {/* 信息 */}
      <div className="video-card-info">
        <div className="video-card-title text-ellipsis" title={video.name}>
          {video.name.replace(/\.[^.]+$/, '')}
        </div>
        <div className="video-card-meta">
          {resolution && <span className="video-card-tag">{resolution}</span>}
          {ext && <span className="video-card-tag">{ext}</span>}
          {video.meta?.duration && (
            <span className="video-card-meta-text">{formatDuration(video.meta.duration)}</span>
          )}
        </div>
      </div>
    </div>
  )
}
