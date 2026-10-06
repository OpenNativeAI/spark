/**
 * 数据文件存储（主进程）
 * 书签 / 分类 / 设置等数据以 JSON 文件形式存储在 userData 目录，
 * logo 图片以独立文件存储在 userData/logos 目录。
 *
 * 目录结构（便携模式下自动跟随 U 盘目录）：
 *   <userData>/data/bookmarks.json
 *   <userData>/data/categories.json
 *   <userData>/data/settings.json
 *   <userData>/logos/<id>.<ext>
 */

import { app } from 'electron'
import { join } from 'node:path'
import { statSync, readdirSync, existsSync } from 'node:fs'
import { readFile, writeFile, mkdir, unlink, readdir, rename } from 'node:fs/promises'
import type { StorageInfo, StorageInfoItem } from '../shared/types'

const DATA_DIR = (): string => join(app.getPath('userData'), 'data')
const LOGO_DIR = (): string => join(app.getPath('userData'), 'logos')

/** 允许的数据 key 白名单（防止路径穿越） */
const ALLOWED_KEYS = new Set(['bookmarks', 'categories', 'settings'])

/** data URL 的 MIME -> 文件扩展名 */
const MIME_EXT: Record<string, string> = {
  'image/svg+xml': 'svg',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico'
}

function dataFilePath(key: string): string | null {
  if (!ALLOWED_KEYS.has(key)) return null
  return join(DATA_DIR(), `${key}.json`)
}

/** 读取数据文件，不存在或损坏时返回 null */
export async function readData(key: string): Promise<unknown> {
  const file = dataFilePath(key)
  if (!file) return null
  try {
    const raw = await readFile(file, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** 写入数据文件（原子写：先写 .tmp 再 rename） */
export async function writeData(key: string, value: unknown): Promise<boolean> {
  const file = dataFilePath(key)
  if (!file) return false
  try {
    await mkdir(DATA_DIR(), { recursive: true })
    const tmp = file + '.tmp'
    await writeFile(tmp, JSON.stringify(value, null, 2), 'utf-8')
    await rename(tmp, file)
    return true
  } catch (err) {
    console.error(`写入数据文件失败 (${key}):`, err)
    return false
  }
}

/** 保存 logo（data URL）为独立图片文件，返回 sparklogo:// URL；失败返回 null */
export async function saveLogo(id: string, dataUrl: string): Promise<string | null> {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl)
  if (!match) return null
  // id 来自渲染进程，做安全过滤 + 小写化（sparklogo:// 的 hostname 会被 URL 解析小写）
  const safeId = id.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 64)
  if (!safeId) return null
  const mime = match[1].toLowerCase()
  const isBase64 = !!match[2]
  const ext = MIME_EXT[mime] || 'png'
  try {
    await mkdir(LOGO_DIR(), { recursive: true })
    const buffer = isBase64
      ? Buffer.from(match[3], 'base64')
      : Buffer.from(decodeURIComponent(match[3]), 'utf-8')
    // 先清理该 id 的旧文件（扩展名可能变化）
    await deleteLogo(id)
    await writeFile(join(LOGO_DIR(), `${safeId}.${ext}`), buffer)
    return `sparklogo://${safeId}.${ext}`
  } catch (err) {
    console.error(`保存 logo 文件失败 (${id}):`, err)
    return null
  }
}

/** 删除某个书签的 logo 文件（忽略不存在的情况） */
export async function deleteLogo(id: string): Promise<void> {
  const safeId = id.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 64)
  if (!safeId) return
  const dir = LOGO_DIR()
  if (!existsSync(dir)) return
  try {
    const files = await readdir(dir)
    await Promise.all(
      files
        .filter((f) => f.startsWith(safeId + '.'))
        .map((f) => unlink(join(dir, f)).catch(() => undefined))
    )
  } catch {
    // ignore
  }
}

/** logo 文件路径（供 sparklogo:// 协议解析），非法路径返回 null */
export function logoFilePath(fileName: string): string | null {
  // 只允许 <id>.<ext> 形式
  if (!/^[a-zA-Z0-9]+\.[a-z]{2,4}$/.test(fileName)) return null
  const path = join(LOGO_DIR(), fileName)
  return existsSync(path) ? path : null
}

/** 存储信息：供设置页展示，类型定义在 shared/types.ts */

function fileSize(p: string): number {
  try {
    return statSync(p).size
  } catch {
    return 0
  }
}

/** 收集当前所有存储位置信息 */
export function getStorageInfo(): StorageInfo {
  const dataDir = DATA_DIR()
  const logoDir = LOGO_DIR()
  const items: StorageInfoItem[] = []

  const dataFiles: { key: string; label: string; file: string }[] = [
    { key: 'bookmarks', label: '书签数据', file: join(dataDir, 'bookmarks.json') },
    { key: 'categories', label: '分类数据', file: join(dataDir, 'categories.json') },
    { key: 'settings', label: '浏览器偏好', file: join(dataDir, 'settings.json') }
  ]
  for (const f of fileExistsList(dataFiles)) {
    items.push({ key: f.key, label: f.label, path: f.file, exists: true, size: fileSize(f.file) })
  }

  // logo 文件汇总
  let logoCount = 0
  let logoSize = 0
  if (existsSync(logoDir)) {
    try {
      for (const name of readdirSync(logoDir)) {
        logoCount++
        logoSize += fileSize(join(logoDir, name))
      }
    } catch {
      // ignore
    }
    items.push({
      key: 'logos',
      label: 'Logo 图片文件',
      path: logoDir,
      exists: true,
      size: logoSize,
      count: logoCount
    })
  }

  return { root: app.getPath('userData'), dataDir, logoDir, items }
}

/** 过滤出实际存在的文件 */
function fileExistsList(
  list: { key: string; label: string; file: string }[]
): { key: string; label: string; file: string }[] {
  return list.filter((f) => existsSync(f.file))
}
