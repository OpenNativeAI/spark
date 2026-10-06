/**
 * 书签分类 Store
 * 用户可自定义添加/重命名/删除分类。
 * 持久化：数据存 userData/data/categories.json（主进程文件写入），
 * 首次启动自动迁移旧版 localStorage 数据。
 */

import { create } from 'zustand'
import type { BookmarkCategory } from '../types'

/** 主进程数据文件 key（对应 userData/data/categories.json） */
const DATA_KEY = 'categories'
/** 旧版 localStorage key（仅用于迁移） */
const LEGACY_KEY = 'spark.categories'

function persist(categories: BookmarkCategory[]): void {
  void window.api.writeData(DATA_KEY, categories)
}

/** 生成唯一 ID（小写字母数字） */
function generateId(): string {
  return (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).toLowerCase()
}

function loadLegacyCategories(): BookmarkCategory[] {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

interface CategoryState {
  categories: BookmarkCategory[]
  /** 是否已从数据文件加载完成 */
  loaded: boolean

  // Actions
  /** 启动时从数据文件加载（含旧 localStorage 迁移），幂等 */
  hydrate: () => Promise<void>
  addCategory: (name: string) => BookmarkCategory | null
  renameCategory: (id: string, name: string) => void
  removeCategory: (id: string) => void
}

export const useCategoryStore = create<CategoryState>((set, get) => ({
  categories: [],
  loaded: false,

  hydrate: async () => {
    if (get().loaded) return
    try {
      let list: BookmarkCategory[] = []
      const stored = (await window.api.readData(DATA_KEY)) as BookmarkCategory[] | null
      if (Array.isArray(stored) && stored.length > 0) {
        list = stored
      } else {
        const legacy = loadLegacyCategories()
        list = legacy
        if (legacy.length > 0) {
          console.log(`[categoryStore] 迁移旧版 localStorage 数据：${legacy.length} 个分类`)
          persist(list)
        }
      }
      set({ categories: list, loaded: true })
    } catch (err) {
      console.error('加载分类数据文件失败:', err)
      set({ loaded: true })
    }
  },

  addCategory: (name) => {
    const trimmed = name.trim()
    if (!trimmed) return null
    // 同名去重
    if (get().categories.some((c) => c.name === trimmed)) return null
    const category: BookmarkCategory = { id: generateId(), name: trimmed, createdAt: Date.now() }
    const updated = [...get().categories, category]
    persist(updated)
    set({ categories: updated })
    return category
  },

  renameCategory: (id, name) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const updated = get().categories.map((c) => (c.id === id ? { ...c, name: trimmed } : c))
    persist(updated)
    set({ categories: updated })
  },

  removeCategory: (id) => {
    const updated = get().categories.filter((c) => c.id !== id)
    persist(updated)
    set({ categories: updated })
  }
}))
