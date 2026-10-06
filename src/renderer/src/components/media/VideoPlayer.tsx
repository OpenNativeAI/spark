/**
 * 内置视频播放器
 * 使用 <video> + sparkmedia:// 协议实现应用内播放
 * 控制层悬浮于视频之上，播放时自动隐藏
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useMediaStore } from '../../store/mediaStore'
import { useAppStore } from '../../store/appStore'
import { Icon } from '../common/Icon'
import { toMediaUrl } from '../../utils/media'
import './VideoPlayer.css'

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2]

export function VideoPlayer(): React.JSX.Element {
  const { videos, currentVideo, setCurrentVideo, updateVideo } = useMediaStore()
  const { setPage } = useAppStore()
  const videoRef = useRef<HTMLVideoElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const playlistBodyRef = useRef<HTMLDivElement>(null)

  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [rate, setRate] = useState(1)
  const [showControls, setShowControls] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [showPlaylist, setShowPlaylist] = useState(true)
  const [autoNext, setAutoNext] = useState(true)

  // 每次挂载生成破缓存 nonce：避免退出后重进命中失效的媒体缓存导致 "no supported sources"
  const nonceRef = useRef(Date.now())
  const src = currentVideo
    ? `${toMediaUrl(currentVideo.path)}?v=${nonceRef.current}`
    : ''

  // 待恢复的起始位置（元数据加载后再 seek，避免源未就绪报错）
  const resumeAtRef = useRef(0)
  const startedRef = useRef(false)
  const retryRef = useRef(0)

  useEffect(() => {
    // 切换视频时重置启动标记、错误与重试计数
    startedRef.current = false
    retryRef.current = 0
    setLoadError(false)
    resumeAtRef.current = currentVideo?.lastPosition ?? 0
    // 强制重新加载新源（src 已由 React 更新）
    const el = videoRef.current
    if (el) {
      el.load()
    }
  }, [currentVideo])

  // 卸载时彻底释放视频资源，避免连接/缓存泄漏影响下次播放
  useEffect(() => {
    return () => {
      const el = videoRef.current
      if (el) {
        el.pause()
        el.removeAttribute('src')
        el.load()
      }
    }
  }, [])

  // 定时保存进度
  useEffect(() => {
    if (!currentVideo) return
    saveTimerRef.current = setInterval(() => {
      const v = videoRef.current
      if (v && !v.paused && v.duration > 0) {
        window.api.saveProgress(currentVideo.path, v.currentTime, v.duration)
        updateVideo(currentVideo.path, {
          progress: v.currentTime / v.duration,
          lastPosition: v.currentTime
        })
      }
    }, 5000)
    return () => {
      if (saveTimerRef.current) clearInterval(saveTimerRef.current)
    }
  }, [currentVideo, updateVideo])

  // 鼠标移动显示控制层，无操作 3 秒后自动隐藏（仅播放时）
  const revealControls = useCallback((): void => {
    setShowControls(true)
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setShowControls(false)
      }
    }, 3000)
  }, [])

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [])

  const togglePlay = useCallback((): void => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      v.play().catch(() => {})
    } else {
      v.pause()
    }
  }, [])

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const v = videoRef.current
    if (!v) return
    const t = parseFloat(e.target.value)
    v.currentTime = t
    setCurrentTime(t)
  }

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const v = videoRef.current
    if (!v) return
    const vol = parseFloat(e.target.value)
    v.volume = vol
    v.muted = vol === 0
    setVolume(vol)
    setMuted(vol === 0)
  }

  const cycleRate = (): void => {
    const v = videoRef.current
    if (!v) return
    const idx = (RATES.indexOf(rate) + 1) % RATES.length
    const next = RATES[idx]
    v.playbackRate = next
    setRate(next)
  }

  const handleClose = (): void => {
    const v = videoRef.current
    if (v && currentVideo && v.duration > 0) {
      window.api.saveProgress(currentVideo.path, v.currentTime, v.duration)
    }
    setCurrentVideo(null)
    setPage('media')
  }

  // 当前视频在列表中的索引
  const currentIndex = videos.findIndex((v) => v.path === currentVideo?.path)

  // 切换视频时将当前项滚动到可见区域
  useEffect(() => {
    const body = playlistBodyRef.current
    if (!body) return
    const active = body.querySelector('.playlist-item.active')
    active?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [currentVideo, showPlaylist])

  // 播放列表中的某个视频
  const playAtIndex = (idx: number): void => {
    if (idx < 0 || idx >= videos.length) return
    setCurrentVideo(videos[idx])
  }

  // 播完自动下一个
  const handleEnded = (): void => {
    setPlaying(false)
    if (autoNext && currentIndex >= 0 && currentIndex < videos.length - 1) {
      playAtIndex(currentIndex + 1)
    }
  }

  // 键盘快捷键
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const v = videoRef.current
      if (!v) return
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault()
          togglePlay()
          break
        case 'ArrowRight':
          v.currentTime = Math.min(v.duration || 0, v.currentTime + 5)
          revealControls()
          break
        case 'ArrowLeft':
          v.currentTime = Math.max(0, v.currentTime - 5)
          revealControls()
          break
        case 'ArrowUp':
          v.volume = Math.min(1, v.volume + 0.1)
          v.muted = false
          setVolume(v.volume)
          setMuted(false)
          break
        case 'ArrowDown':
          v.volume = Math.max(0, v.volume - 0.1)
          setVolume(v.volume)
          break
        case 'm':
          v.muted = !v.muted
          setMuted(v.muted)
          break
        case 'f': {
          if (document.fullscreenElement) {
            void document.exitFullscreen()
          } else {
            void document.querySelector('.video-player')?.requestFullscreen()
          }
          break
        }
        case 'Escape':
          if (!document.fullscreenElement) handleClose()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [togglePlay, revealControls])

  const formatTime = (s: number): string => {
    if (!isFinite(s) || s < 0) s = 0
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = Math.floor(s % 60)
    const pad = (n: number): string => String(n).padStart(2, '0')
    return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
  }

  if (!currentVideo) {
    return (
      <div className="video-player-empty">
        <Icon name="film" size={48} strokeWidth={1} />
        <p>没有正在播放的视频</p>
        <button onClick={() => setPage('media')}>返回影音库</button>
      </div>
    )
  }

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0
  const bufPct = duration > 0 ? (buffered / duration) * 100 : 0

  return (
    <div
      className={`video-player ${showControls ? '' : 'hide-cursor'}`}
      onMouseMove={revealControls}
      onMouseLeave={() => playing && setShowControls(false)}
    >
      <div className="video-player-main">
      {/* 视频舞台 */}
      <div className="video-player-stage">
        <video
          ref={videoRef}
          src={src}
          onClick={togglePlay}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => {
            const el = e.currentTarget
            setDuration(el.duration)
            el.playbackRate = rate
            // 元数据就绪后再恢复到上次位置
            if (resumeAtRef.current > 5 && resumeAtRef.current < el.duration) {
              el.currentTime = resumeAtRef.current
            }
          }}
          onCanPlay={(e) => {
            // 首次可播放时自动开始
            if (startedRef.current) return
            startedRef.current = true
            e.currentTarget.play().catch(() => {})
          }}
          onProgress={(e) => {
            const el = e.currentTarget
            if (el.buffered.length > 0) {
              setBuffered(el.buffered.end(el.buffered.length - 1))
            }
          }}
          onPlay={() => {
            setPlaying(true)
            revealControls()
          }}
          onPause={() => {
            setPlaying(false)
            setShowControls(true)
          }}
          onEnded={handleEnded}
          onError={() => {
            const el = videoRef.current
            // 先破缓存重试最多 2 次（应对退出后重进的失效媒体缓存），仍失败才报错
            if (el && currentVideo && retryRef.current < 2) {
              retryRef.current++
              const fresh = `${toMediaUrl(currentVideo.path)}?v=${Date.now()}-${retryRef.current}`
              el.src = fresh
              el.load()
              return
            }
            setLoadError(true)
            setPlaying(false)
          }}
        />

        {/* 中央错误提示 / 播放浮层 */}
        {loadError ? (
          <div className="video-player-error">
            <Icon name="film" size={40} strokeWidth={1} />
            <p>无法播放此视频</p>
            <span>可能编码格式不受支持（如 HEVC/H.265）</span>
          </div>
        ) : (
          !playing && (
            <button className="video-player-center" onClick={togglePlay} aria-label="播放">
              <Icon name="play" size={30} />
            </button>
          )
        )}
      </div>

      {/* 顶栏渐变（返回 + 标题） */}
      <div className={`video-player-topbar ${showControls ? 'visible' : ''}`}>
        <div className="video-player-topbar-inner">
          <button className="video-player-back" onClick={handleClose} title="返回">
            <Icon name="chevron-left" size={20} />
          </button>
          <span className="video-player-title text-ellipsis">
            {currentVideo.name.replace(/\.[^.]+$/, '')}
          </span>
        </div>
      </div>

      {/* 底部控制栏 */}
      <div className={`video-player-controls ${showControls ? 'visible' : ''}`}>
        {/* 进度条 */}
        <div className="video-player-seek-wrap">
          <div className="video-player-seek-track">
            <div className="video-player-seek-buffered" style={{ width: `${bufPct}%` }} />
            <div className="video-player-seek-filled" style={{ width: `${pct}%` }} />
          </div>
          <input
            type="range"
            className="video-player-seek"
            min={0}
            max={duration || 0}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
          />
        </div>

        <div className="video-player-buttons">
          <button
            className="video-player-btn"
            onClick={togglePlay}
            title={playing ? '暂停' : '播放'}
          >
            <Icon name={playing ? 'pause' : 'play'} size={18} />
          </button>

          <button
            className="video-player-btn"
            onClick={() => {
              const v = videoRef.current
              if (v) v.currentTime = Math.max(0, v.currentTime - 10)
            }}
            title="后退 10 秒"
          >
            <Icon name="rewind" size={16} />
          </button>

          <button
            className="video-player-btn"
            onClick={() => {
              const v = videoRef.current
              if (v) v.currentTime = Math.min(duration, v.currentTime + 10)
            }}
            title="前进 10 秒"
          >
            <Icon name="forward" size={16} />
          </button>

          <div className="video-player-volume-group">
            <button
              className="video-player-btn"
              onClick={() => {
                const v = videoRef.current
                if (!v) return
                v.muted = !v.muted
                setMuted(v.muted)
              }}
              title={muted ? '取消静音' : '静音'}
            >
              <Icon name={muted || volume === 0 ? 'volume-x' : 'volume'} size={16} />
            </button>
            <div className="video-player-volume-wrap">
              <div
                className="video-player-volume-filled"
                style={{ width: `${(muted ? 0 : volume) * 100}%` }}
              />
              <input
                type="range"
                className="video-player-volume"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={handleVolume}
              />
            </div>
          </div>

          <span className="video-player-time">
            {formatTime(currentTime)} <span className="video-player-time-sep">/</span>{' '}
            {formatTime(duration)}
          </span>

          <div className="video-player-spacer" />

          <button className="video-player-rate" onClick={cycleRate} title="播放速度">
            {rate}x
          </button>

          <button
            className="video-player-btn"
            onClick={() => setShowPlaylist((v) => !v)}
            title="播放列表"
          >
            <Icon name="list" size={16} />
          </button>

          <button
            className="video-player-btn"
            onClick={() => {
              if (document.fullscreenElement) {
                void document.exitFullscreen()
              } else {
                void document.querySelector('.video-player')?.requestFullscreen()
              }
            }}
            title="全屏"
          >
            <Icon name="maximize" size={16} />
          </button>
        </div>
      </div>
      </div>

      {/* 右侧播放列表 */}
      {showPlaylist && videos.length > 0 && (
        <div className="video-player-playlist">
          <div className="playlist-header">
            <span className="playlist-title">播放列表</span>
            <span className="playlist-count">{videos.length}</span>
            <div className="playlist-header-spacer" />
            <button
              className={`playlist-toggle-auto ${autoNext ? 'active' : ''}`}
              onClick={() => setAutoNext((v) => !v)}
              title="播完自动播放下一个"
            >
              自动连播
            </button>
            <button
              className="playlist-close"
              onClick={() => setShowPlaylist(false)}
              title="收起列表"
            >
              <Icon name="x" size={14} />
            </button>
          </div>
          <div className="playlist-body scrollbar-thin" ref={playlistBodyRef}>
            {videos.map((video, idx) => {
              const active = video.path === currentVideo?.path
              return (
                <button
                  key={video.path}
                  className={`playlist-item ${active ? 'active' : ''}`}
                  onClick={() => playAtIndex(idx)}
                >
                  <span className="playlist-index">
                    {active && playing && (
                      <span className="playlist-eq">
                        <i />
                        <i />
                        <i />
                      </span>
                    )}
                  </span>
                  <span className="playlist-info">
                    <span className="playlist-name text-ellipsis" title={video.name}>
                      {video.name.replace(/\.[^.]+$/, '')}
                    </span>
                    <span className="playlist-meta">
                      {video.meta?.duration ? formatTime(video.meta.duration) : video.ext?.toUpperCase()}
                      {video.progress && video.progress > 0.02
                        ? ` · 已看 ${Math.round(video.progress * 100)}%`
                        : ''}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
