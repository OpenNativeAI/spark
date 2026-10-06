import { ElectronAPI } from '@electron-toolkit/preload'
import type { RendererAPI } from '../shared/types'

declare global {
  interface Window {
    electron: ElectronAPI
    api: RendererAPI
  }
}

export {}
