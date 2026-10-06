import { create } from 'zustand'
import type { AppPage, PortableStatus } from '../types'

interface AppState {
  /** 当前页面 */
  currentPage: AppPage
  /** 侧边栏是否折叠 */
  sidebarCollapsed: boolean
  /** 便携模式状态 */
  portableStatus: PortableStatus | null
  /** 全局搜索关键词 */
  searchKeyword: string
  /** 书签当前筛选分类：'all' = 全部，'none' = 未分类，其他 = 分类 id（侧边栏与书签页共享） */
  activeCategory: string
  /** 设置页当前分类（侧边栏与设置页共享） */
  settingsTab: 'general' | 'web' | 'storage' | 'about'
  /** 当前打开的 Markdown 文件路径（编辑器页使用） */
  markdownPath: string | null

  // Actions
  setPage: (page: AppPage) => void
  toggleSidebar: () => void
  setPortableStatus: (status: PortableStatus) => void
  setSearchKeyword: (keyword: string) => void
  setActiveCategory: (id: string) => void
  setSettingsTab: (tab: 'general' | 'web' | 'storage' | 'about') => void
  setMarkdownPath: (path: string | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  currentPage: 'files',
  sidebarCollapsed: false,
  portableStatus: null,
  searchKeyword: '',
  activeCategory: 'all',
  settingsTab: 'general',
  markdownPath: null,

  setPage: (page) => set({ currentPage: page }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setPortableStatus: (status) => set({ portableStatus: status }),
  setSearchKeyword: (keyword) => set({ searchKeyword: keyword }),
  setActiveCategory: (id) => set({ activeCategory: id }),
  setSettingsTab: (tab) => set({ settingsTab: tab }),
  setMarkdownPath: (path) => set({ markdownPath: path })
}))
