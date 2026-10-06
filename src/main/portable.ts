/**
 * 便携模式检测
 * 必须在 app 启动最早阶段调用，确保 userData 路径在 ready 之前切换
 */

import { app } from 'electron'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { PortableStatus } from '../shared/types'

let cachedStatus: PortableStatus | null = null

/** 初始化便携模式（必须在 app.whenReady 之前调用） */
export function initPortableMode(): PortableStatus {
  if (cachedStatus) return cachedStatus

  const exeDir = path.dirname(app.getPath('exe'))
  const portableMarker = path.join(exeDir, 'portable')
  const isPortable = fs.existsSync(portableMarker)

  let userDataPath: string
  if (isPortable) {
    userDataPath = path.join(exeDir, 'userData')
    // 确保目录存在
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true })
    }
    // 关键：覆盖默认 userData 路径
    app.setPath('userData', userDataPath)
  } else {
    userDataPath = app.getPath('userData')
  }

  cachedStatus = { isPortable, exeDir, userDataPath }
  return cachedStatus
}

/** 获取便携模式状态 */
export function getPortableStatus(): PortableStatus {
  if (!cachedStatus) {
    return initPortableMode()
  }
  return cachedStatus
}
