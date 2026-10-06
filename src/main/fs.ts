/**
 * 文件系统操作
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { FileItem } from '../shared/types'

const VIDEO_EXTS = new Set([
  'mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'mpg', 'mpeg', 'ts', 'm2ts', 'rmvb', 'rm', '3gp', 'vob'
])

const AUDIO_EXTS = new Set([
  'mp3', 'flac', 'wav', 'aac', 'ogg', 'm4a', 'wma', 'ape', 'opus'
])

const IMAGE_EXTS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico', 'tiff', 'tif', 'heic', 'heif'
])

export function getExt(name: string): string | undefined {
  const idx = name.lastIndexOf('.')
  if (idx <= 0) return undefined
  return name.slice(idx + 1).toLowerCase()
}

export function isVideoFile(name: string): boolean {
  const ext = getExt(name)
  return ext ? VIDEO_EXTS.has(ext) : false
}

export function isAudioFile(name: string): boolean {
  const ext = getExt(name)
  return ext ? AUDIO_EXTS.has(ext) : false
}

export function isImageFile(name: string): boolean {
  const ext = getExt(name)
  return ext ? IMAGE_EXTS.has(ext) : false
}

/** 列出指定路径下的文件/文件夹 */
export async function listFolder(dirPath: string): Promise<FileItem[]> {
  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
  const items: FileItem[] = []

  for (const entry of entries) {
    // 跳过隐藏文件
    if (entry.name.startsWith('.')) continue

    const fullPath = path.join(dirPath, entry.name)
    const isDir = entry.isDirectory()

    let stat: fs.Stats | null = null
    try {
      stat = await fs.promises.stat(fullPath)
    } catch {
      // 无权限或已删除
      continue
    }

    const item: FileItem = {
      path: fullPath,
      name: entry.name,
      kind: isDir ? 'directory' : 'file',
      mtime: stat.mtimeMs
    }

    if (!isDir) {
      item.size = stat.size
      item.ext = getExt(entry.name)
      item.isVideo = isVideoFile(entry.name)
      item.isAudio = isAudioFile(entry.name)
      item.isImage = isImageFile(entry.name)
    }

    items.push(item)
  }

  return items
}

/** 重命名 */
export async function renamePath(oldPath: string, newName: string): Promise<void> {
  const dir = path.dirname(oldPath)
  const newPath = path.join(dir, newName)
  await fs.promises.rename(oldPath, newPath)
}

/** 删除（移到回收站或永久删除） */
export async function deletePath(p: string): Promise<void> {
  // 简单实现：直接删除。生产环境应该用 shell.trashItem
  const stat = await fs.promises.stat(p)
  if (stat.isDirectory()) {
    await fs.promises.rm(p, { recursive: true })
  } else {
    await fs.promises.unlink(p)
  }
}

/** 读取文本文件内容（UTF-8） */
export async function readFileContent(p: string): Promise<string> {
  return await fs.promises.readFile(p, 'utf-8')
}

/** 写入文本文件内容（UTF-8，先写临时文件再原子替换） */
export async function writeFileContent(p: string, content: string): Promise<void> {
  const tmp = `${p}.${process.pid}.tmp`
  await fs.promises.writeFile(tmp, content, 'utf-8')
  await fs.promises.rename(tmp, p)
}
