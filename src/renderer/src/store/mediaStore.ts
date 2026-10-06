import { create } from 'zustand'
import type { VideoItem, SortBy, SortOrder } from '../types'

/** 媒体库筛选 */
export type MediaFilter = 'all' | 'watched' | 'unwatched' | 'inProgress'

interface MediaState {
  /** 当前媒体库根路径 */
  mediaRootPath: string | null
  /** 扫描到的视频列表 */
  videos: VideoItem[]
  /** 当前筛选 */
  filter: MediaFilter
  /** 排序 */
  sortBy: SortBy
  sortOrder: SortOrder
  /** 当前正在查看的视频 */
  currentVideo: VideoItem | null
  /** 扫描中 */
  scanning: boolean

  // Actions
  setMediaRootPath: (path: string | null) => void
  setVideos: (videos: VideoItem[]) => void
  updateVideo: (path: string, patch: Partial<VideoItem>) => void
  setFilter: (filter: MediaFilter) => void
  setSort: (by: SortBy, order: SortOrder) => void
  setCurrentVideo: (video: VideoItem | null) => void
  setScanning: (scanning: boolean) => void
}

export const useMediaStore = create<MediaState>((set) => ({
  mediaRootPath: null,
  videos: [],
  filter: 'all',
  sortBy: 'name',
  sortOrder: 'asc',
  currentVideo: null,
  scanning: false,

  setMediaRootPath: (mediaRootPath) => set({ mediaRootPath }),
  setVideos: (videos) => set({ videos }),
  updateVideo: (path, patch) =>
    set((s) => ({
      videos: s.videos.map((v) => (v.path === path ? { ...v, ...patch } : v))
    })),
  setFilter: (filter) => set({ filter }),
  setSort: (sortBy, sortOrder) => set({ sortBy, sortOrder }),
  setCurrentVideo: (currentVideo) => set({ currentVideo }),
  setScanning: (scanning) => set({ scanning })
}))

/** 根据筛选条件过滤视频 */
export function filterVideos(videos: VideoItem[], filter: MediaFilter): VideoItem[] {
  switch (filter) {
    case 'watched':
      return videos.filter((v) => (v.progress ?? 0) >= 0.95)
    case 'unwatched':
      return videos.filter((v) => !v.progress || v.progress < 0.05)
    case 'inProgress':
      return videos.filter((v) => {
        const p = v.progress ?? 0
        return p >= 0.05 && p < 0.95
      })
    case 'all':
    default:
      return videos
  }
}

/** 排序视频 */
export function sortVideos(
  videos: VideoItem[],
  by: SortBy,
  order: SortOrder
): VideoItem[] {
  const sorted = [...videos].sort((a, b) => {
    let cmp = 0
    switch (by) {
      case 'name':
        cmp = a.name.localeCompare(b.name, 'zh-CN')
        break
      case 'mtime':
        cmp = (a.mtime ?? 0) - (b.mtime ?? 0)
        break
      case 'size':
        cmp = (a.size ?? 0) - (b.size ?? 0)
        break
      case 'progress':
        cmp = (a.progress ?? 0) - (b.progress ?? 0)
        break
    }
    return order === 'asc' ? cmp : -cmp
  })
  return sorted
}
