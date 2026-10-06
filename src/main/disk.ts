/**
 * 磁盘列表
 * Windows: 遍历 A-Z 盘符
 * macOS: /Volumes + 根
 * Linux: /media /mnt + 根
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { DiskInfo } from '../shared/types'

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.promises.access(p)
    return true
  } catch {
    return false
  }
}

async function getDiskSize(p: string): Promise<{ total?: number; free?: number }> {
  try {
    const stat = await fs.promises.statfs(p)
    return {
      total: stat.blocks * stat.bsize,
      free: stat.bavail * stat.bsize
    }
  } catch {
    return {}
  }
}

async function listWindowsDisks(): Promise<DiskInfo[]> {
  const disks: DiskInfo[] = []
  // 遍历 A-Z
  for (let i = 65; i <= 90; i++) {
    const letter = String.fromCharCode(i)
    const drivePath = `${letter}:\\`
    if (await pathExists(drivePath)) {
      const size = await getDiskSize(drivePath)
      // 简单判断：C 为系统盘，其它为 unknown
      const type = letter === 'C' ? 'system' : 'unknown'
      disks.push({
        path: drivePath,
        name: letter === 'C' ? `系统 (${letter}:)` : `本地磁盘 (${letter}:)`,
        type,
        ...size
      })
    }
  }
  return disks
}

async function listMacDisks(): Promise<DiskInfo[]> {
  const disks: DiskInfo[] = []

  // 系统根
  const rootSize = await getDiskSize('/')
  disks.push({
    path: '/',
    name: 'Macintosh HD',
    type: 'system',
    ...rootSize
  })

  // /Volumes 下的外接盘
  try {
    const volumes = await fs.promises.readdir('/Volumes')
    for (const vol of volumes) {
      if (vol === 'Macintosh HD') continue
      const volPath = path.join('/Volumes', vol)
      try {
        const stat = await fs.promises.stat(volPath)
        if (stat.isDirectory()) {
          const size = await getDiskSize(volPath)
          disks.push({
            path: volPath,
            name: vol,
            type: 'removable',
            ...size
          })
        }
      } catch {
        // 忽略无法访问的卷
      }
    }
  } catch {
    // /Volumes 不存在或无权限
  }

  return disks
}

async function listLinuxDisks(): Promise<DiskInfo[]> {
  const disks: DiskInfo[] = []

  const rootSize = await getDiskSize('/')
  disks.push({
    path: '/',
    name: '根目录',
    type: 'system',
    ...rootSize
  })

  // /media 和 /mnt
  for (const baseDir of ['/media', '/mnt']) {
    try {
      const entries = await fs.promises.readdir(baseDir)
      for (const entry of entries) {
        const fullPath = path.join(baseDir, entry)
        try {
          const stat = await fs.promises.stat(fullPath)
          if (stat.isDirectory()) {
            const size = await getDiskSize(fullPath)
            disks.push({
              path: fullPath,
              name: entry,
              type: 'removable',
              ...size
            })
          }
        } catch {
          // 忽略
        }
      }
    } catch {
      // 目录不存在
    }
  }

  return disks
}

export async function listDisks(): Promise<DiskInfo[]> {
  switch (process.platform) {
    case 'win32':
      return listWindowsDisks()
    case 'darwin':
      return listMacDisks()
    case 'linux':
      return listLinuxDisks()
    default:
      return []
  }
}
