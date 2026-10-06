/**
 * 浏览器 Store
 * 识别电脑上已安装的浏览器，管理打开书签时使用的默认浏览器。
 * 持久化：默认浏览器偏好存 userData/data/settings.json（主进程文件写入）。
 */

import { create } from 'zustand'
import type { BrowserInfo } from '../../../shared/types'

/** 主进程数据文件 key（对应 userData/data/settings.json） */
const DATA_KEY = 'settings'
/** 旧版 localStorage key（仅用于迁移） */
const LEGACY_BROWSER_KEY = 'spark.defaultBrowser'

interface SettingsData {
  /** 默认浏览器 id（'' = 系统默认） */
  defaultBrowser?: string
}

/** 读取设置文件并合并写入（读-改-写，不覆盖其他字段） */
async function patchSettings(patch: Partial<SettingsData>): Promise<void> {
  try {
    const stored = ((await window.api.readData(DATA_KEY)) as SettingsData | null) || {}
    await window.api.writeData(DATA_KEY, { ...stored, ...patch })
  } catch (err) {
    console.error('写入设置文件失败:', err)
  }
}

interface BrowserState {
  /** 已检测到的浏览器列表 */
  browsers: BrowserInfo[]
  /** 是否已完成检测 */
  detected: boolean
  /** 默认浏览器 id（'' = 系统默认） */
  defaultBrowserId: string
  /** 是否已从设置文件加载完成 */
  hydrated: boolean

  // Actions
  /** 启动时从设置文件加载默认浏览器偏好，幂等 */
  hydrate: () => Promise<void>
  detect: () => Promise<void>
  setDefaultBrowser: (id: string) => void
  /** 用默认浏览器打开网址 */
  openUrl: (url: string) => Promise<void>
  /** 用指定浏览器打开网址 */
  openUrlWith: (url: string, browserId: string) => Promise<void>
}

export const useBrowserStore = create<BrowserState>((set, get) => ({
  browsers: [],
  detected: false,
  defaultBrowserId: '',
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return
    set({ hydrated: true })
    try {
      const stored = (await window.api.readData(DATA_KEY)) as SettingsData | null
      if (stored && typeof stored.defaultBrowser === 'string') {
        set({ defaultBrowserId: stored.defaultBrowser })
        return
      }
      // 设置文件无记录：尝试从旧版 localStorage 迁移
      const legacy = localStorage.getItem(LEGACY_BROWSER_KEY)
      if (legacy) {
        console.log(`[browserStore] 迁移旧版默认浏览器偏好: ${legacy}`)
        set({ defaultBrowserId: legacy })
        void patchSettings({ defaultBrowser: legacy })
      }
    } catch (err) {
      console.error('加载设置文件失败:', err)
    }
  },

  detect: async () => {
    try {
      if (!window.api?.detectBrowsers) {
        // preload 未暴露该 API（主进程/preload 代码未重新加载）
        console.error('window.api.detectBrowsers 不存在，请重启 dev 进程以加载新的 preload/主进程代码')
        set({ browsers: [], detected: true })
        return
      }
      const browsers = (await window.api.detectBrowsers()) ?? []
      console.log('[browserStore] 检测到浏览器:', browsers.map((b) => b.name))
      set({ browsers, detected: true })
      // 默认浏览器已被卸载时，回退到系统默认
      const saved = get().defaultBrowserId
      if (saved && !browsers.some((b) => b.id === saved)) {
        get().setDefaultBrowser('')
      }
    } catch (err) {
      console.error('检测浏览器失败:', err)
      set({ browsers: [], detected: true })
    }
  },

  setDefaultBrowser: (id) => {
    void patchSettings({ defaultBrowser: id })
    set({ defaultBrowserId: id })
  },

  openUrl: async (url) => {
    const { defaultBrowserId, browsers } = get()
    // 未选择或浏览器列表为空时，走系统默认（browserId 传空）
    const browserId = defaultBrowserId && browsers.some((b) => b.id === defaultBrowserId)
      ? defaultBrowserId
      : undefined
    try {
      const ok = await window.api.openUrlInBrowser(url, browserId)
      if (!ok) window.open(url, '_blank')
    } catch {
      window.open(url, '_blank')
    }
  },

  openUrlWith: async (url, browserId) => {
    try {
      const ok = await window.api.openUrlInBrowser(url, browserId)
      if (!ok) window.open(url, '_blank')
    } catch {
      window.open(url, '_blank')
    }
  }
}))
