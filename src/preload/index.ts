import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { RendererAPI } from '../shared/types'

const api: RendererAPI = {
  // 平台/系统
  getPlatform: () => process.platform,
  getPortableStatus: () => ipcRenderer.invoke('system:get-portable-status'),

  // 窗口控制
  windowMinimize: () => ipcRenderer.send('window:minimize'),
  windowMaximize: () => ipcRenderer.send('window:maximize'),
  windowClose: () => ipcRenderer.send('window:close'),
  onWindowMaximizedChange: (callback) => {
    const handler = (_e: Electron.IpcRendererEvent, maximized: boolean): void => {
      callback(maximized)
    }
    ipcRenderer.on('window:maximized-changed', handler)
    return () => {
      ipcRenderer.removeListener('window:maximized-changed', handler)
    }
  },

  // 磁盘
  listDisks: () => ipcRenderer.invoke('disk:list'),

  // 文件系统
  listFolder: (path) => ipcRenderer.invoke('fs:list-folder', path),
  selectFolder: () => ipcRenderer.invoke('fs:select-folder'),
  selectMarkdownFile: () => ipcRenderer.invoke('fs:select-md-file'),
  saveMarkdownFile: (defaultFileName) => ipcRenderer.invoke('fs:save-md-file', defaultFileName),
  showInFolder: (path) => ipcRenderer.invoke('fs:show-in-folder', path),
  deletePath: (path) => ipcRenderer.invoke('fs:delete', path),
  renamePath: (oldPath, newName) => ipcRenderer.invoke('fs:rename', oldPath, newName),
  readFile: (path) => ipcRenderer.invoke('fs:read-file', path),
  writeFile: (path, content) => ipcRenderer.invoke('fs:write-file', path, content),

  // Markdown 导出
  exportMarkdownPdf: (html, defaultFileName) =>
    ipcRenderer.invoke('md:export-pdf', html, defaultFileName),

  // 媒体
  scanMedia: (rootPath) => ipcRenderer.invoke('media:scan', rootPath),
  getVideoMeta: (path) => ipcRenderer.invoke('media:get-meta', path),
  getVideoPoster: (path) => ipcRenderer.invoke('media:get-poster', path),
  playVideo: (path, options) => ipcRenderer.invoke('media:play', path, options),
  getProgress: (path) => ipcRenderer.invoke('media:get-progress', path),
  saveProgress: (path, position, duration) =>
    ipcRenderer.invoke('media:save-progress', path, position, duration),

  // ===== 网页书签 =====
  fetchFavicon: (url) => ipcRenderer.invoke('favicon:fetch', url),
  fetchSiteInfo: (url) => ipcRenderer.invoke('site:fetch-info', url),

  // ===== 浏览器 =====
  detectBrowsers: () => ipcRenderer.invoke('browser:detect'),
  openUrlInBrowser: (url, browserId) => ipcRenderer.invoke('browser:open-url', url, browserId),

  // ===== 数据文件存储 =====
  readData: (key) => ipcRenderer.invoke('data:read', key),
  writeData: (key, value) => ipcRenderer.invoke('data:write', key, value),
  saveLogo: (id, dataUrl) => ipcRenderer.invoke('logo:save', id, dataUrl),
  deleteLogo: (id) => ipcRenderer.invoke('logo:delete', id),
  getStorageInfo: () => ipcRenderer.invoke('data:storage-info')
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
