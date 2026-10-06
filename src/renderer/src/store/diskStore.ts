import { create } from 'zustand'
import type { DiskInfo, FileItem, SortBy, SortOrder, ViewMode } from '../types'

interface DiskState {
  /** 磁盘列表 */
  disks: DiskInfo[]
  /** 当前根路径（文件管理的根目录） */
  rootPath: string | null
  /** 当前浏览路径（面包屑用） */
  currentPath: string | null
  /** 当前路径下的文件列表 */
  files: FileItem[]
  /** 选中的文件路径集合 */
  selectedPaths: Set<string>
  /** 视图模式 */
  viewMode: ViewMode
  /** 排序方式 */
  sortBy: SortBy
  /** 排序方向 */
  sortOrder: SortOrder
  /** 加载中 */
  loading: boolean

  // Actions
  setDisks: (disks: DiskInfo[]) => void
  setRootPath: (path: string | null) => void
  setCurrentPath: (path: string | null) => void
  setFiles: (files: FileItem[]) => void
  setSelectedPaths: (paths: Set<string>) => void
  toggleSelect: (path: string, multi: boolean) => void
  clearSelection: () => void
  setViewMode: (mode: ViewMode) => void
  setSort: (by: SortBy, order: SortOrder) => void
  setLoading: (loading: boolean) => void
}

export const useDiskStore = create<DiskState>((set) => ({
  disks: [],
  rootPath: null,
  currentPath: null,
  files: [],
  selectedPaths: new Set(),
  viewMode: 'list',
  sortBy: 'name',
  sortOrder: 'asc',
  loading: false,

  setDisks: (disks) => set({ disks }),
  setRootPath: (rootPath) => set({ rootPath, currentPath: rootPath }),
  setCurrentPath: (currentPath) => set({ currentPath }),
  setFiles: (files) => set({ files }),
  setSelectedPaths: (selectedPaths) => set({ selectedPaths }),
  toggleSelect: (path, multi) =>
    set((s) => {
      const next = new Set(multi ? s.selectedPaths : [])
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return { selectedPaths: next }
    }),
  clearSelection: () => set({ selectedPaths: new Set() }),
  setViewMode: (viewMode) => set({ viewMode }),
  setSort: (sortBy, sortOrder) => set({ sortBy, sortOrder }),
  setLoading: (loading) => set({ loading })
}))
