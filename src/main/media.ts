/**
 * 媒体扫描 + 播放进度存储
 */

import { app } from 'electron'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { spawn } from 'node:child_process'
import type { VideoItem, MediaMeta } from '../shared/types'
import { isVideoFile, getExt } from './fs'

/** 进度存储文件路径 */
function getProgressDbPath(): string {
  return path.join(app.getPath('userData'), 'play-progress.json')
}

interface ProgressRecord {
  position: number
  duration: number
  progress: number
  updatedAt: number
}

type ProgressDB = Record<string, ProgressRecord>

async function readProgressDB(): Promise<ProgressDB> {
  try {
    const data = await fs.promises.readFile(getProgressDbPath(), 'utf-8')
    return JSON.parse(data) as ProgressDB
  } catch {
    return {}
  }
}

async function writeProgressDB(db: ProgressDB): Promise<void> {
  const dbPath = getProgressDbPath()
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) {
    await fs.promises.mkdir(dir, { recursive: true })
  }
  await fs.promises.writeFile(dbPath, JSON.stringify(db, null, 2), 'utf-8')
}

/** 递归扫描视频文件 */
export async function scanMedia(rootPath: string, maxDepth = 4): Promise<VideoItem[]> {
  const videos: VideoItem[] = []
  const db = await readProgressDB()

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth) return
    let entries: fs.Dirent[]
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      // 跳过隐藏文件和系统目录
      if (entry.name.startsWith('.')) continue
      if (entry.name === 'node_modules') continue
      if (entry.name === '$RECYCLE.BIN') continue
      if (entry.name === 'System Volume Information') continue

      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        await walk(fullPath, depth + 1)
      } else if (entry.isFile() && isVideoFile(entry.name)) {
        try {
          const stat = await fs.promises.stat(fullPath)
          const record = db[fullPath]
          videos.push({
            path: fullPath,
            name: entry.name,
            kind: 'file',
            isVideo: true,
            ext: getExt(entry.name),
            size: stat.size,
            mtime: stat.mtimeMs,
            progress: record?.progress ?? 0,
            lastPosition: record?.position ?? 0,
            lastWatchedAt: record?.updatedAt
          })
        } catch {
          // 忽略读取失败的文件
        }
      }
    }
  }

  await walk(rootPath, 0)
  return videos
}

/** 用 ffprobe 获取视频元数据（如果系统装了 ffprobe） */
export async function getVideoMeta(filePath: string): Promise<MediaMeta | undefined> {
  return new Promise((resolve) => {
    const proc = spawn('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath
    ])

    let stdout = ''
    proc.stdout.on('data', (chunk) => (stdout += chunk.toString()))
    proc.on('error', () => resolve(undefined))
    proc.on('close', (code) => {
      if (code !== 0) {
        resolve(undefined)
        return
      }
      try {
        const data = JSON.parse(stdout)
        const videoStream = data.streams?.find((s: { codec_type: string }) => s.codec_type === 'video')
        const audioStream = data.streams?.find((s: { codec_type: string }) => s.codec_type === 'audio')
        resolve({
          duration: data.format?.duration ? parseFloat(data.format.duration) : undefined,
          bitrate: data.format?.bit_rate
            ? Math.round(parseInt(data.format.bit_rate) / 1000)
            : undefined,
          width: videoStream?.width,
          height: videoStream?.height,
          videoCodec: videoStream?.codec_name,
          audioCodec: audioStream?.codec_name,
          fps: videoStream?.r_frame_rate
            ? parseFloat(videoStream.r_frame_rate.split('/')[0]) /
              parseFloat(videoStream.r_frame_rate.split('/')[1] || '1')
            : undefined
        })
      } catch {
        resolve(undefined)
      }
    })
  })
}

/** 检查 ffmpeg 是否可用 */
let ffmpegAvailable: boolean | null = null
async function checkFfmpeg(): Promise<boolean> {
  if (ffmpegAvailable !== null) return ffmpegAvailable
  return new Promise((resolve) => {
    const proc = spawn('ffmpeg', ['-version'])
    proc.on('error', () => {
      ffmpegAvailable = false
      resolve(false)
    })
    proc.on('close', (code) => {
      ffmpegAvailable = code === 0
      resolve(ffmpegAvailable)
    })
    proc.stdout.destroy()
    proc.stderr.destroy()
  })
}

/** 生成视频缩略图（用 ffmpeg 抽帧） */
export async function getVideoPoster(filePath: string): Promise<string | null> {
  // 检查 ffmpeg 可用性
  if (!(await checkFfmpeg())) {
    console.warn('[media] ffmpeg not available, cannot generate poster for:', filePath)
    return null
  }

  const thumbnailsDir = path.join(app.getPath('userData'), 'thumbnails')
  if (!fs.existsSync(thumbnailsDir)) {
    await fs.promises.mkdir(thumbnailsDir, { recursive: true })
  }

  // 用文件路径的 hash 作为缩略图文件名
  const hash = Buffer.from(filePath).toString('base64url').slice(0, 32)
  const posterPath = path.join(thumbnailsDir, `${hash}.jpg`)

  // 已存在则直接读取为 data URL
  if (fs.existsSync(posterPath)) {
    return readAsDataUrl(posterPath)
  }

  return new Promise((resolve) => {
    // 在第 1 秒处抽帧（接近第一帧）
    const proc = spawn('ffmpeg', [
      '-ss', '1',
      '-i', filePath,
      '-vframes', '1',
      '-vf', 'scale=480:-2',
      '-q:v', '5',
      '-y',
      posterPath
    ])

    proc.on('error', () => resolve(null))
    proc.on('close', async (code) => {
      if (code === 0 && fs.existsSync(posterPath)) {
        resolve(await readAsDataUrl(posterPath))
      } else {
        resolve(null)
      }
    })
  })
}

/** 读取文件为 data URL */
async function readAsDataUrl(filePath: string): Promise<string> {
  const buffer = await fs.promises.readFile(filePath)
  const base64 = buffer.toString('base64')
  return `data:image/jpeg;base64,${base64}`
}

/** 用外部播放器播放视频 */
export async function playVideo(
  filePath: string,
  options?: { startTime?: number }
): Promise<void> {
  const platform = process.platform

  // 优先尝试 VLC
  const vlcPaths =
    platform === 'win32'
      ? [
          'C:\\Program Files\\VideoLAN\\VLC\\vlc.exe',
          'C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe'
        ]
      : platform === 'darwin'
        ? ['/Applications/VLC.app/Contents/MacOS/VLC']
        : ['/usr/bin/vlc', '/usr/local/bin/vlc']

  // mpv 备选
  const mpvPaths =
    platform === 'win32'
      ? ['C:\\Program Files\\mpv\\mpv.exe']
      : platform === 'darwin'
        ? ['/Applications/mpv.app/Contents/MacOS/mpv', '/usr/local/bin/mpv', '/opt/homebrew/bin/mpv']
        : ['/usr/bin/mpv', '/usr/local/bin/mpv']

  const args: string[] = [filePath]
  if (options?.startTime && options.startTime > 0) {
    args.unshift(`--start-time=${Math.floor(options.startTime)}`)
  }

  // 尝试找可用的播放器
  for (const p of [...vlcPaths, ...mpvPaths]) {
    if (fs.existsSync(p)) {
      spawn(p, args, { detached: true, stdio: 'ignore' }).unref()
      return
    }
  }

  // 都没有则用系统默认
  const { shell } = await import('electron')
  await shell.openPath(filePath)
}

/** 获取播放进度 */
export async function getProgress(
  filePath: string
): Promise<{ progress: number; position: number } | null> {
  const db = await readProgressDB()
  const record = db[filePath]
  if (!record) return null
  return { progress: record.progress, position: record.position }
}

/** 保存播放进度 */
export async function saveProgress(
  filePath: string,
  position: number,
  duration: number
): Promise<void> {
  const db = await readProgressDB()
  db[filePath] = {
    position,
    duration,
    progress: duration > 0 ? position / duration : 0,
    updatedAt: Date.now()
  }
  await writeProgressDB(db)
}
