/**
 * 浏览器检测与打开
 * 识别电脑上已安装的浏览器，并支持用指定浏览器打开网址
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { BrowserInfo } from '../shared/types'

/** 各平台候选浏览器列表 */
interface Candidate {
  id: string
  name: string
  /** macOS: 应用名（open -a 使用）；Windows/Linux: 可执行文件绝对路径 */
  target: string
}

/** macOS：常见浏览器的 .app 名称 */
const MAC_CANDIDATES: Candidate[] = [
  { id: 'safari', name: 'Safari', target: 'Safari' },
  { id: 'chrome', name: 'Google Chrome', target: 'Google Chrome' },
  { id: 'chrome-canary', name: 'Chrome Canary', target: 'Google Chrome Canary' },
  { id: 'chromium', name: 'Chromium', target: 'Chromium' },
  { id: 'edge', name: 'Microsoft Edge', target: 'Microsoft Edge' },
  { id: 'firefox', name: 'Firefox', target: 'Firefox' },
  { id: 'firefox-dev', name: 'Firefox Developer Edition', target: 'Firefox Developer Edition' },
  { id: 'arc', name: 'Arc', target: 'Arc' },
  { id: 'brave', name: 'Brave Browser', target: 'Brave Browser' },
  { id: 'opera', name: 'Opera', target: 'Opera' },
  { id: 'vivaldi', name: 'Vivaldi', target: 'Vivaldi' },
  { id: 'tabbit', name: 'Tabbit', target: 'Tabbit' },
  { id: 'quark', name: '夸克浏览器', target: 'Quark' }
]

/** Windows：注册在 Program Files 下的浏览器可执行文件 */
function winCandidates(): Candidate[] {
  const pf = process.env['ProgramFiles'] || 'C:\\Program Files'
  const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'
  const local = process.env['LOCALAPPDATA'] || ''
  return [
    { id: 'edge', name: 'Microsoft Edge', target: join(pf86, 'Microsoft', 'Edge', 'Application', 'msedge.exe') },
    { id: 'edge', name: 'Microsoft Edge', target: join(pf, 'Microsoft', 'Edge', 'Application', 'msedge.exe') },
    { id: 'chrome', name: 'Google Chrome', target: join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe') },
    { id: 'chrome', name: 'Google Chrome', target: join(local, 'Google', 'Chrome', 'Application', 'chrome.exe') },
    { id: 'firefox', name: 'Firefox', target: join(pf, 'Mozilla Firefox', 'firefox.exe') },
    { id: 'firefox', name: 'Firefox', target: join(pf86, 'Mozilla Firefox', 'firefox.exe') },
    { id: 'brave', name: 'Brave', target: join(pf, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe') },
    { id: 'vivaldi', name: 'Vivaldi', target: join(pf, 'Vivaldi', 'Application', 'vivaldi.exe') },
    { id: 'opera', name: 'Opera', target: join(pf86, 'Opera', 'opera.exe') }
  ]
}

/** Linux：常见浏览器的可执行文件命令名 */
const LINUX_CANDIDATES: Candidate[] = [
  { id: 'chrome', name: 'Google Chrome', target: 'google-chrome' },
  { id: 'chromium', name: 'Chromium', target: 'chromium' },
  { id: 'firefox', name: 'Firefox', target: 'firefox' },
  { id: 'edge', name: 'Microsoft Edge', target: 'microsoft-edge' },
  { id: 'brave', name: 'Brave', target: 'brave-browser' },
  { id: 'opera', name: 'Opera', target: 'opera' },
  { id: 'vivaldi', name: 'Vivaldi', target: 'vivaldi' }
]

/** macOS：判断浏览器 .app 是否安装 */
function macAppExists(appName: string): boolean {
  return (
    existsSync(`/Applications/${appName}.app`) ||
    existsSync(join(process.env['HOME'] || '', 'Applications', `${appName}.app`))
  )
}

/** Linux：判断命令是否存在于 PATH（同步扫描 PATH 目录） */
function commandExists(cmd: string): boolean {
  try {
    const paths = (process.env['PATH'] || '').split(':')
    return paths.some((dir) => existsSync(join(dir, cmd)))
  } catch {
    return false
  }
}

/** 检测电脑上已安装的浏览器 */
export function detectBrowsers(): BrowserInfo[] {
  const platform = process.platform
  const found = new Map<string, BrowserInfo>()

  if (platform === 'darwin') {
    for (const c of MAC_CANDIDATES) {
      if (macAppExists(c.target) && !found.has(c.id)) {
        found.set(c.id, { id: c.id, name: c.name, path: c.target })
      }
    }
  } else if (platform === 'win32') {
    for (const c of winCandidates()) {
      if (existsSync(c.target) && !found.has(c.id)) {
        found.set(c.id, { id: c.id, name: c.name, path: c.target })
      }
    }
  } else {
    for (const c of LINUX_CANDIDATES) {
      if (commandExists(c.target) && !found.has(c.id)) {
        found.set(c.id, { id: c.id, name: c.name, path: c.target })
      }
    }
  }

  return [...found.values()]
}

/** 用指定浏览器打开 URL；browserId 为空时用系统默认浏览器 */
export async function openUrlInBrowser(url: string, browserId?: string): Promise<boolean> {
  try {
    // 未指定浏览器 → 系统默认
    if (!browserId) {
      const { shell } = await import('electron')
      await shell.openExternal(url)
      return true
    }

    const browser = detectBrowsers().find((b) => b.id === browserId)
    if (!browser) return false

    const platform = process.platform
    if (platform === 'darwin') {
      const child = spawn('open', ['-a', browser.path, url], { stdio: 'ignore' })
      child.on('error', () => undefined)
      child.unref()
      return true
    } else if (platform === 'win32') {
      const child = spawn(browser.path, [url], { stdio: 'ignore', windowsVerbatimArguments: true })
      child.on('error', () => undefined)
      child.unref()
      return true
    } else {
      const child = spawn(browser.path, [url], { stdio: 'ignore' })
      child.on('error', () => undefined)
      child.unref()
      return true
    }
  } catch {
    return false
  }
}
