/**
 * 网页标签设置 Store
 * 管理书签页的自定义项（背景图片等）。
 * 持久化：设置项存 userData/data/settings.json（与浏览器偏好共用同一文件，读-改-写）；
 * 背景图片存 userData/logos/background.<ext>（sparklogo:// 协议显示）。
 */

import { create } from 'zustand'

/** 主进程数据文件 key（对应 userData/data/settings.json） */
const DATA_KEY = 'settings'
/** 背景图片文件的固定 id（userData/logos/background.<ext>） */
const BG_FILE_ID = 'background'
/** 背景图片大小上限（8 MB，data URL 传输开销较大） */
export const BG_MAX_SIZE = 8 * 1024 * 1024

interface SettingsData {
  /** 默认浏览器 id（browserStore 管理，此处仅透传保留） */
  defaultBrowser?: string
  /** 书签页背景图片（sparklogo:// URL，undefined = 默认渐变背景） */
  bookmarksBackground?: string
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

/** 把本地文件读成 data URL */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (): void => resolve(String(reader.result))
    reader.onerror = (): void => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

interface WebSettingsState {
  /** 书签页背景（sparklogo:// URL；'' = 默认渐变背景） */
  background: string
  /** 是否已从设置文件加载完成 */
  loaded: boolean

  // Actions
  /** 启动时从设置文件加载背景偏好，幂等 */
  hydrate: () => Promise<void>
  /** 选择本地图片设置为书签页背景；成功返回 null，失败返回错误提示 */
  setBackgroundFromFile: (file: File) => Promise<string | null>
  /** 恢复默认背景（清除图片文件与设置项） */
  resetBackground: () => Promise<void>
}

export const useWebSettingsStore = create<WebSettingsState>((set, get) => ({
  background: '',
  loaded: false,

  hydrate: async () => {
    if (get().loaded) return
    try {
      const stored = (await window.api.readData(DATA_KEY)) as SettingsData | null
      set({ background: stored?.bookmarksBackground || '', loaded: true })
    } catch (err) {
      console.error('加载网页标签设置失败:', err)
      set({ loaded: true })
    }
  },

  setBackgroundFromFile: async (file) => {
    if (!file.type.startsWith('image/')) return '请选择图片文件'
    if (file.size > BG_MAX_SIZE) return '图片过大，请选择 8 MB 以内的图片'
    try {
      const dataUrl = await readFileAsDataUrl(file)
      // 复用 logo 落盘机制：存为 userData/logos/background.<ext>
      const saved = await window.api.saveLogo(BG_FILE_ID, dataUrl)
      if (!saved) return '背景图片保存失败'
      await patchSettings({ bookmarksBackground: saved })
      set({ background: saved })
      return null
    } catch (err) {
      console.error('设置背景图片失败:', err)
      return '设置背景图片失败'
    }
  },

  resetBackground: async () => {
    await patchSettings({ bookmarksBackground: undefined })
    // 同步删除背景图片文件
    void window.api.deleteLogo(BG_FILE_ID)
    set({ background: '' })
  }
}))
