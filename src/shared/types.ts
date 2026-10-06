/**
 * 共享类型定义
 * 主进程 / preload / renderer 三方共用
 * 不要在此文件中依赖任何 Node.js 或 DOM API
 */

/** 磁盘/驱动器 */
export interface DiskInfo {
  /** 盘符或挂载点（如 C:\ / /Volumes/USB） */
  path: string
  /** 显示名称（如 "本地磁盘 (C:)" / "USB_DRIVE"） */
  name: string
  /** 类型：system 系统盘 / removable U盘 / network 网络盘 */
  type: 'system' | 'removable' | 'network' | 'unknown'
  /** 总容量（字节） */
  total?: number
  /** 可用空间（字节） */
  free?: number
}

/** 文件/文件夹项 */
export interface FileItem {
  /** 完整路径 */
  path: string
  /** 文件名（含扩展名） */
  name: string
  /** 类型：文件 / 文件夹 */
  kind: 'file' | 'directory'
  /** 扩展名（小写，不含点） */
  ext?: string
  /** 大小（字节），文件夹为 undefined */
  size?: number
  /** 修改时间戳 */
  mtime?: number
  /** 是否为视频文件 */
  isVideo?: boolean
  /** 是否为音频文件 */
  isAudio?: boolean
  /** 是否为图片文件 */
  isImage?: boolean
}

/** 视频元数据 */
export interface MediaMeta {
  /** 时长（秒） */
  duration?: number
  /** 宽度 */
  width?: number
  /** 高度 */
  height?: number
  /** 码率（kbps） */
  bitrate?: number
  /** 视频编码 */
  videoCodec?: string
  /** 音频编码 */
  audioCodec?: string
  /** 帧率 */
  fps?: number
}

/** 视频项（带元数据 + 播放进度） */
export interface VideoItem extends FileItem {
  kind: 'file'
  isVideo: true
  /** 元数据 */
  meta?: MediaMeta
  /** 海报缩略图（本地路径或 data URL） */
  poster?: string
  /** 观看进度（0-1） */
  progress?: number
  /** 上次播放位置（秒） */
  lastPosition?: number
  /** 上次观看时间戳 */
  lastWatchedAt?: number
}

/** 应用页面 */
export type AppPage = 'files' | 'media' | 'mediaDetail' | 'markdown' | 'settings' | 'bookmarks'

/** 视图模式 */
export type ViewMode = 'list' | 'grid'

/** 排序方式 */
export type SortBy = 'name' | 'mtime' | 'size' | 'progress'

/** 排序方向 */
export type SortOrder = 'asc' | 'desc'

/** 网页书签 */
export interface Website {
  /** 唯一标识 */
  id: string
  /** 网页名称 */
  name: string
  /** 网页链接 */
  url: string
  /** logo URL（自动识别或自定义） */
  logo?: string
  /** 所属分类 id（undefined/'' 表示未分类） */
  categoryId?: string
  /** 创建时间 */
  createdAt: number
}

/** 书签分类（用户可自定义添加） */
export interface BookmarkCategory {
  /** 唯一标识 */
  id: string
  /** 分类名称 */
  name: string
  /** 创建时间 */
  createdAt: number
}

/** 电脑上已安装的浏览器 */
export interface BrowserInfo {
  /** 唯一标识（如 chrome / safari / edge） */
  id: string
  /** 显示名称 */
  name: string
  /** macOS: .app 名称；Windows/Linux: 可执行文件路径或命令名 */
  path: string
}

/** 便携模式状态 */
export interface PortableStatus {
  /** 是否为便携模式 */
  isPortable: boolean
  /** 程序所在目录 */
  exeDir: string
  /** userData 实际路径 */
  userDataPath: string
}

/** 播放器配置 */
export interface PlayerConfig {
  /** 播放器类型 */
  type: 'vlc' | 'mpv' | 'system'
  /** 自定义路径 */
  customPath?: string
  /** 额外参数 */
  extraArgs?: string[]
}

/** 存储位置条目（设置页展示） */
export interface StorageInfoItem {
  key: string
  label: string
  /** 绝对路径 */
  path: string
  exists: boolean
  /** 字节数 */
  size?: number
  /** 文件数（目录类条目） */
  count?: number
}

/** 存储信息总览 */
export interface StorageInfo {
  /** userData 根目录 */
  root: string
  dataDir: string
  logoDir: string
  items: StorageInfoItem[]
}

/** preload 暴露给 renderer 的 API */
export interface RendererAPI {
  // ===== 平台/系统 =====
  getPlatform: () => string
  getPortableStatus: () => Promise<PortableStatus>

  // ===== 窗口控制 =====
  windowMinimize: () => void
  windowMaximize: () => void
  windowClose: () => void
  onWindowMaximizedChange: (callback: (maximized: boolean) => void) => () => void

  // ===== 磁盘 =====
  listDisks: () => Promise<DiskInfo[]>

  // ===== 文件系统 =====
  listFolder: (path: string) => Promise<FileItem[]>
  selectFolder: () => Promise<string | null>
  /** 弹出文件选择框（仅 Markdown），返回路径；取消返回 null */
  selectMarkdownFile: () => Promise<string | null>
  /** 弹出保存框（Markdown 另存为），返回路径；取消返回 null */
  saveMarkdownFile: (defaultFileName: string) => Promise<string | null>
  showInFolder: (path: string) => Promise<void>
  deletePath: (path: string) => Promise<void>
  renamePath: (oldPath: string, newName: string) => Promise<void>
  /** 读取文本文件内容（UTF-8） */
  readFile: (path: string) => Promise<string>
  /** 写入文本文件内容（UTF-8，原子写） */
  writeFile: (path: string, content: string) => Promise<void>

  // ===== Markdown 导出 =====
  /** 将渲染后的 Markdown HTML 导出为 PDF（弹保存框）；返回保存路径，取消返回 null */
  exportMarkdownPdf: (html: string, defaultFileName: string) => Promise<string | null>

  // ===== 媒体扫描 =====
  scanMedia: (rootPath: string) => Promise<VideoItem[]>
  getVideoMeta: (path: string) => Promise<MediaMeta | undefined>
  getVideoPoster: (path: string) => Promise<string | null>

  // ===== 播放 =====
  playVideo: (path: string, options?: { startTime?: number }) => Promise<void>
  getProgress: (path: string) => Promise<{ progress: number; position: number } | null>
  saveProgress: (path: string, position: number, duration: number) => Promise<void>

  // ===== 网页书签 =====
  fetchFavicon: (url: string) => Promise<string | null>
  /** 识别网站信息：logo（data URL）+ 网站名称 */
  fetchSiteInfo: (url: string) => Promise<{ logo: string | null; name: string | null } | null>

  // ===== 浏览器 =====
  /** 检测电脑上已安装的浏览器 */
  detectBrowsers: () => Promise<BrowserInfo[]>
  /** 用指定浏览器打开网址；browserId 为空时用系统默认浏览器 */
  openUrlInBrowser: (url: string, browserId?: string) => Promise<boolean>

  // ===== 数据文件存储 =====
  /** 读取数据文件（userData/data/<key>.json），不存在或损坏返回 null */
  readData: (key: string) => Promise<unknown>
  /** 写入数据文件（原子写） */
  writeData: (key: string, value: unknown) => Promise<boolean>
  /** 保存 logo（data URL）为独立图片文件，返回 sparklogo:// URL；失败返回 null */
  saveLogo: (id: string, dataUrl: string) => Promise<string | null>
  /** 删除某个书签对应的 logo 图片文件 */
  deleteLogo: (id: string) => Promise<void>
  /** 获取存储信息总览（设置页展示存储位置） */
  getStorageInfo: () => Promise<StorageInfo>
}
