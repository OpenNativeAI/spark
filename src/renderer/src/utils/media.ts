/**
 * 将本地文件路径编码为 sparkmedia:// URL
 * 用于渲染进程通过自定义协议访问本地视频文件
 * 使用 pathname 而非 hostname，避免 URL 解析将大小写转换
 */
export function toMediaUrl(filePath: string): string {
  const encoded = btoa(unescape(encodeURIComponent(filePath)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `sparkmedia://local/${encoded}`
}

/** 缩略图结果缓存（避免重复解码） */
const posterCache = new Map<string, string | null>()

/** 并发队列：限制同时解码的视频数量，避免卡顿 */
const MAX_CONCURRENT = 2
let running = 0
const queue: Array<() => void> = []

function next(): void {
  if (running >= MAX_CONCURRENT) return
  const task = queue.shift()
  if (task) {
    running++
    task()
  }
}

function enqueue(task: () => void): void {
  queue.push(task)
  next()
}

function complete(): void {
  running--
  next()
}

/**
 * 从视频文件中捕获首帧作为缩略图（data URL）
 * 利用 Chromium 内置的视频解码能力，无需外部 ffmpeg
 */
export function captureVideoFrame(filePath: string, timeSeconds = 1): Promise<string | null> {
  // 命中缓存直接返回
  if (posterCache.has(filePath)) {
    return Promise.resolve(posterCache.get(filePath) ?? null)
  }

  return new Promise((resolve) => {
    enqueue(() => {
      const run = (): void => {
        const video = document.createElement('video')
        video.preload = 'metadata'
        video.muted = true
        video.src = toMediaUrl(filePath)

        let settled = false
        const finish = (result: string | null): void => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          video.src = ''
          video.load()
          posterCache.set(filePath, result)
          complete()
          resolve(result)
        }

        video.onloadeddata = (): void => {
          // 跳转到接近首帧的位置
          video.currentTime = Math.min(timeSeconds, (video.duration || 0) * 0.1)
        }

        video.onseeked = (): void => {
          try {
            const canvas = document.createElement('canvas')
            const w = video.videoWidth || 480
            const h = video.videoHeight || 270
            const scale = Math.min(1, 480 / w)
            canvas.width = Math.round(w * scale)
            canvas.height = Math.round(h * scale)
            const ctx = canvas.getContext('2d')
            if (!ctx) {
              finish(null)
              return
            }
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            finish(canvas.toDataURL('image/jpeg', 0.75))
          } catch {
            finish(null)
          }
        }

        video.onerror = (): void => finish(null)

        // 超时保护
        const timer = setTimeout(() => finish(null), 15000)

        video.load()
      }
      // 微任务延迟，让队列调度生效
      run()
    })
  })
}
