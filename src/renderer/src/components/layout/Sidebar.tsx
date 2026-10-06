/**
 * 公共侧边栏
 * 包含：磁盘列表、模式切换（下拉框）、收藏、设置入口
 * 支持折叠/展开（点击 Logo）
 */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useAppStore } from '../../store/appStore'
import { useDiskStore } from '../../store/diskStore'
import { useMediaStore } from '../../store/mediaStore'
import { useWebsiteStore } from '../../store/websiteStore'
import { useCategoryStore } from '../../store/categoryStore'
import { bookmarkCategoryActions } from '../../pages/Bookmarks'
import { SETTINGS_TABS } from '../../pages/Settings'
import { Icon, type IconName } from '../common/Icon'
import { SparkLogo } from '../common/SparkLogo'
import type { AppPage } from '../../types'
import './Sidebar.css'

interface SidebarItemProps {
  icon: IconName
  label: string
  active?: boolean
  collapsed?: boolean
  badge?: string | number
  onClick?: () => void
}

function SidebarItem({
  icon,
  label,
  active,
  collapsed,
  badge,
  onClick
}: SidebarItemProps): React.JSX.Element {
  return (
    <button
      className={`sidebar-item ${active ? 'active' : ''} ${collapsed ? 'collapsed' : ''}`}
      onClick={onClick}
      title={collapsed ? label : undefined}
    >
      <span className="sidebar-item-icon">
        <Icon name={icon} size={15} />
      </span>
      {!collapsed && <span className="sidebar-item-label text-ellipsis">{label}</span>}
      {!collapsed && badge !== undefined && (
        <span className="sidebar-item-badge">{badge}</span>
      )}
    </button>
  )
}

interface SidebarSectionProps {
  title?: string
  collapsed?: boolean
  /** 标题右侧的操作按钮 */
  action?: React.JSX.Element
  children: React.ReactNode
}

function SidebarSection({ title, collapsed, action, children }: SidebarSectionProps): React.JSX.Element {
  return (
    <div className="sidebar-section">
      {title && !collapsed && (
        <div className="sidebar-section-title">
          <span>{title}</span>
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

/** 模式选项 */
const MODES: { id: AppPage; icon: IconName; label: string }[] = [
  { id: 'files', icon: 'folder', label: '文件' },
  { id: 'markdown', icon: 'file', label: '文档' },
  { id: 'media', icon: 'film', label: '影音' },
  { id: 'bookmarks', icon: 'link', label: '书签' },
  { id: 'settings', icon: 'settings', label: '设置' }
]

export function Sidebar(): React.JSX.Element {
  const { sidebarCollapsed, toggleSidebar, currentPage, setPage, portableStatus } = useAppStore()
  const { disks, rootPath, setRootPath } = useDiskStore()
  const { videos } = useMediaStore()
  const { bookmarks, loaded: bookmarksLoaded, hydrate: hydrateBookmarks } = useWebsiteStore()
  const { categories, loaded: categoriesLoaded, hydrate: hydrateCategories } = useCategoryStore()
  const { activeCategory, setActiveCategory, settingsTab, setSettingsTab } = useAppStore()
  const [modeOpen, setModeOpen] = useState(false)
  const [modeMenuStyle, setModeMenuStyle] = useState<CSSProperties>({})
  const modeRef = useRef<HTMLDivElement>(null)

  // 当前模式（mediaDetail 归属影音）
  const currentMode = MODES.find(
    (m) => m.id === currentPage || (m.id === 'media' && currentPage === 'mediaDetail')
  )

  // 点击外部关闭模式下拉
  useEffect(() => {
    if (!modeOpen) return
    const onDocClick = (e: MouseEvent): void => {
      if (modeRef.current && !modeRef.current.contains(e.target as Node)) {
        setModeOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [modeOpen])

  const handleModeSelect = (page: AppPage): void => {
    setPage(page)
    // 从下拉框进入设置时，保持上次浏览的设置分类
    setModeOpen(false)
  }

  // 书签模式：确保分类/书签数据已加载
  useEffect(() => {
    if (currentPage === 'bookmarks' && !bookmarksLoaded) void hydrateBookmarks()
    if (currentPage === 'bookmarks' && !categoriesLoaded) void hydrateCategories()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage])

  // 分类统计（侧边栏分类区）
  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {}
    let uncategorized = 0
    for (const b of bookmarks) {
      if (b.categoryId) {
        map[b.categoryId] = (map[b.categoryId] || 0) + 1
      } else {
        uncategorized++
      }
    }
    return { map, uncategorized }
  }, [bookmarks])

  const hasUncategorized = categoryCounts.uncategorized > 0

  const handleCategoryRename = useCallback(
    (e: React.MouseEvent, id: string, name: string): void => {
      e.stopPropagation()
      bookmarkCategoryActions.openRename?.(id, name)
    },
    []
  )

  const handleCategoryDelete = useCallback(
    (e: React.MouseEvent, id: string, name: string): void => {
      e.stopPropagation()
      bookmarkCategoryActions.remove?.(id, name)
    },
    []
  )

  const handleModeToggle = (): void => {
    if (!modeOpen && modeRef.current) {
      // fixed 定位：避免菜单被侧边栏 overflow 裁剪；折叠时从右侧弹出
      const rect = modeRef.current.getBoundingClientRect()
      setModeMenuStyle(
        sidebarCollapsed
          ? { top: rect.top, left: rect.right + 6 }
          : { top: rect.bottom + 6, left: rect.left, width: rect.width }
      )
    }
    setModeOpen((v) => !v)
  }

  const handleDiskSelect = (path: string): void => {
    setRootPath(path)
    if (currentPage === 'media') {
      useMediaStore.getState().setMediaRootPath(path)
    }
    setModeOpen(false)
  }

  const diskIconName = (type: string): IconName => {
    if (type === 'removable') return 'usb'
    if (type === 'system') return 'computer'
    return 'hard-drive'
  }

  return (
    <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
      {/* Logo 区 */}
      <button
        className="sidebar-logo"
        onClick={toggleSidebar}
        title={sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'}
      >
        <span className="sidebar-logo-icon">
          <SparkLogo size={22} />
        </span>
        {!sidebarCollapsed && <span className="sidebar-logo-text">Spark</span>}
      </button>

      <div className="sidebar-content scrollbar-hidden">
        {/* 模式（下拉框，含磁盘选择） */}
        <SidebarSection title="模式" collapsed={sidebarCollapsed}>
          <div className="sidebar-mode" ref={modeRef}>
            <button
              className={`mode-trigger ${sidebarCollapsed ? 'collapsed' : ''}`}
              onClick={handleModeToggle}
              title={sidebarCollapsed ? `模式：${currentMode?.label || ''}` : '切换模式'}
            >
              <span className="sidebar-item-icon">
                <Icon name={currentMode?.icon || 'folder'} size={15} />
              </span>
              {!sidebarCollapsed && (
                <span className="mode-trigger-label text-ellipsis">{currentMode?.label || '文件'}</span>
              )}
              {!sidebarCollapsed && <Icon name="chevron-down" size={12} />}
            </button>
            {modeOpen && (
              <div className="mode-menu" style={modeMenuStyle}>
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    className={`mode-option ${currentMode?.id === m.id ? 'active' : ''}`}
                    onClick={() => handleModeSelect(m.id)}
                  >
                    <span className="mode-option-check">
                      {currentMode?.id === m.id && <Icon name="check" size={12} />}
                    </span>
                    <span className="sidebar-item-icon">
                      <Icon name={m.icon} size={15} />
                    </span>
                    <span className="mode-option-label">{m.label}</span>
                    {m.id === 'media' && videos.length > 0 && (
                      <span className="sidebar-item-badge">{videos.length}</span>
                    )}
                  </button>
                ))}
                {disks.length > 0 && (
                  <>
                    <div className="mode-menu-divider" />
                    <div className="mode-menu-group-label">存储</div>
                    {disks.map((disk) => (
                      <button
                        key={disk.path}
                        className={`mode-option ${rootPath === disk.path ? 'active' : ''}`}
                        onClick={() => handleDiskSelect(disk.path)}
                      >
                        <span className="mode-option-check">
                          {rootPath === disk.path && <Icon name="check" size={12} />}
                        </span>
                        <span className="sidebar-item-icon">
                          <Icon name={diskIconName(disk.type)} size={15} />
                        </span>
                        <span className="mode-option-label">{disk.name}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </SidebarSection>

        {/* 分类（仅书签模式：真实读取书签分类数据，点击筛选） */}
        {currentPage === 'bookmarks' && !sidebarCollapsed && (
          <SidebarSection
            title="分类"
            action={
              <button
                className="sidebar-section-action"
                title="新建分类"
                onClick={() => bookmarkCategoryActions.openNew?.()}
              >
                <Icon name="plus" size={12} />
              </button>
            }
          >
            <SidebarItem
              icon="grid"
              label="全部"
              active={activeCategory === 'all'}
              badge={bookmarks.length}
              onClick={() => setActiveCategory('all')}
            />
            {categories.map((c) => (
              <div className="sidebar-category-row" key={c.id}>
                <SidebarItem
                  icon="folder"
                  label={c.name}
                  active={activeCategory === c.id}
                  badge={categoryCounts.map[c.id] || 0}
                  onClick={() => setActiveCategory(c.id)}
                />
                <span className="sidebar-category-actions">
                  <button
                    className="sidebar-category-btn"
                    title="重命名分类"
                    onClick={(e) => handleCategoryRename(e, c.id, c.name)}
                  >
                    <Icon name="edit" size={12} />
                  </button>
                  <button
                    className="sidebar-category-btn danger"
                    title="删除分类"
                    onClick={(e) => handleCategoryDelete(e, c.id, c.name)}
                  >
                    <Icon name="trash" size={12} />
                  </button>
                </span>
              </div>
            ))}
            {hasUncategorized && (
              <SidebarItem
                icon="minus"
                label="未分类"
                active={activeCategory === 'none'}
                badge={categoryCounts.uncategorized}
                onClick={() => setActiveCategory('none')}
              />
            )}
          </SidebarSection>
        )}

        {/* 设置分类（仅设置模式：与设置页内容联动） */}
        {currentPage === 'settings' && !sidebarCollapsed && (
          <SidebarSection title="设置">
            {SETTINGS_TABS.map((t) => (
              <SidebarItem
                key={t.id}
                icon={t.icon}
                label={t.label}
                active={settingsTab === t.id}
                onClick={() => {
                  setPage('settings')
                  setSettingsTab(t.id)
                }}
              />
            ))}
          </SidebarSection>
        )}

        {/* 便携模式标识 */}
        {portableStatus?.isPortable && !sidebarCollapsed && (
          <div className="sidebar-portable-hint">
            <Icon name="usb" size={12} />
            <span>便携模式</span>
          </div>
        )}
      </div>

      {/* 底部：设置 */}
      <div className="sidebar-footer">
        <SidebarItem
          icon="settings"
          label="设置"
          active={currentPage === 'settings'}
          collapsed={sidebarCollapsed}
          onClick={() => setPage('settings')}
        />
      </div>
    </aside>
  )
}
