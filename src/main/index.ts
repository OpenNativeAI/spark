import { app, shell, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { initPortableMode, getPortableStatus } from './portable'
import { listDisks } from './disk'
import { listFolder, renamePath, deletePath, readFileContent, writeFileContent } from './fs'
import { scanMedia, getVideoMeta, getVideoPoster, playVideo, getProgress, saveProgress } from './media'
import { serveMediaFile } from './mediaProtocol'
import { fetchFavicon, fetchSiteInfo } from './favicon'
import { detectBrowsers, openUrlInBrowser } from './browsers'
import { readData, writeData, saveLogo, deleteLogo, logoFilePath, getStorageInfo } from './storage'
import { exportMarkdownToPdf } from './pdf'

// ⚠️ 必须在 app ready 之前调用：便携模式检测 + userData 路径切换
initPortableMode()

// ⚠️ 必须在 app ready 之前注册：logo 图片文件协议（sparklogo://<id>.<ext>）+ 媒体协议
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'sparklogo',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
  },
  {
    scheme: 'sparkmedia',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: true }
  }
])

function createWindow(): BrowserWindow {
  const isMac = process.platform === 'darwin'

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    // 自定义标题栏
    ...(isMac
      ? { titleBarStyle: 'hiddenInset' as const }
      : { frame: false }),
    // macOS 走 Dock 图标（见 app.whenReady），Windows/Linux 用窗口图标
    ...(!isMac ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // 通知渲染进程窗口最大化状态变化
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window:maximized-changed', true)
  })
  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window:maximized-changed', false)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

function registerIpcHandlers(): void {
  // ===== 平台/系统 =====
  ipcMain.handle('system:get-platform', () => process.platform)
  ipcMain.handle('system:get-portable-status', () => getPortableStatus())

  // ===== 窗口控制 =====
  ipcMain.on('window:minimize', (e) => {
    BrowserWindow.fromWebContents(e.sender)?.minimize()
  })
  ipcMain.on('window:maximize', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (win) {
      if (win.isMaximized()) {
        win.unmaximize()
      } else {
        win.maximize()
      }
    }
  })
  ipcMain.on('window:close', (e) => {
    BrowserWindow.fromWebContents(e.sender)?.close()
  })

  // ===== 磁盘 =====
  ipcMain.handle('disk:list', () => listDisks())

  // ===== 文件系统 =====
  ipcMain.handle('fs:list-folder', (_e, p: string) => listFolder(p))
  ipcMain.handle('fs:select-folder', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })
  // 选择 Markdown 文件（文档模式「打开」）
  ipcMain.handle('fs:select-md-file', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      title: '打开 Markdown 文件',
      properties: ['openFile'],
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }]
    })
    return result.canceled ? null : result.filePaths[0]
  })
  // 另存为 Markdown 文件（新建未命名文档时保存）
  ipcMain.handle('fs:save-md-file', async (e, defaultFileName: string) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return null
    const result = await dialog.showSaveDialog(win, {
      title: '保存 Markdown 文件',
      defaultPath: defaultFileName,
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    })
    return result.canceled ? null : result.filePath
  })
  ipcMain.handle('fs:show-in-folder', (_e, p: string) => shell.showItemInFolder(p))
  ipcMain.handle('fs:delete', (_e, p: string) => deletePath(p))
  ipcMain.handle('fs:rename', (_e, oldPath: string, newName: string) => renamePath(oldPath, newName))
  ipcMain.handle('fs:read-file', (_e, p: string) => readFileContent(p))
  ipcMain.handle('fs:write-file', (_e, p: string, content: string) => writeFileContent(p, content))

  // ===== Markdown 导出 PDF =====
  ipcMain.handle('md:export-pdf', (e, html: string, defaultFileName: string) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return null
    return exportMarkdownToPdf(win, html, defaultFileName)
  })

  // ===== 媒体 =====
  ipcMain.handle('media:scan', (_e, rootPath: string) => scanMedia(rootPath))
  ipcMain.handle('media:get-meta', (_e, p: string) => getVideoMeta(p))
  ipcMain.handle('media:get-poster', (_e, p: string) => getVideoPoster(p))
  ipcMain.handle('media:play', (_e, p: string, options?: { startTime?: number }) =>
    playVideo(p, options)
  )
  ipcMain.handle('media:get-progress', (_e, p: string) => getProgress(p))
  ipcMain.handle('media:save-progress', (_e, p: string, position: number, duration: number) =>
    saveProgress(p, position, duration)
  )

  // ===== 网页书签 =====
  ipcMain.handle('favicon:fetch', (_e, url: string) => fetchFavicon(url))
  ipcMain.handle('site:fetch-info', (_e, url: string) => fetchSiteInfo(url))

  // ===== 浏览器 =====
  ipcMain.handle('browser:detect', () => detectBrowsers())
  ipcMain.handle('browser:open-url', (_e, url: string, browserId?: string) =>
    openUrlInBrowser(url, browserId)
  )

  // ===== 数据文件存储 =====
  ipcMain.handle('data:read', (_e, key: string) => readData(key))
  ipcMain.handle('data:write', (_e, key: string, value: unknown) => writeData(key, value))
  ipcMain.handle('logo:save', (_e, id: string, dataUrl: string) => saveLogo(id, dataUrl))
  ipcMain.handle('logo:delete', (_e, id: string) => deleteLogo(id))
  ipcMain.handle('data:storage-info', () => getStorageInfo())
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.myfileplayer.app')

  // 开发模式宿主是 Electron.app，Dock 默认显示 Electron 原子图标，这里显式设为应用图标
  // （打包后与 icon.icns 一致，运行时设置无副作用）
  if (process.platform === 'darwin') {
    void app.dock?.setIcon(icon)
  }

  // sparklogo:// 协议：从 userData/logos 目录读取图片文件
  protocol.handle('sparklogo', (request) => {
    const fileName = new URL(request.url).hostname
    const path = logoFilePath(fileName)
    if (!path) return new Response('Not Found', { status: 404 })
    return net.fetch(pathToFileURL(path).toString())
  })

  // sparkmedia:// 协议：服务本地视频文件（支持 Range 分段，用于缩略图捕获和内置播放）
  // URL 格式: sparkmedia://local/<base64url-of-filepath>
  protocol.handle('sparkmedia', (request) => {
    const url = new URL(request.url)
    const encoded = url.pathname.slice(1) // 去掉前导 /
    if (!encoded) return new Response('Bad Request', { status: 400 })
    const filePath = Buffer.from(encoded, 'base64url').toString('utf-8')
    const range = request.headers.get('range')
    return serveMediaFile(filePath, range)
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers()
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
