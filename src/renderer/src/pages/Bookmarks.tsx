/**
 * 网页收藏页面
 * 收藏网址，自动识别名称和 logo，支持自定义编辑
 * 支持选择电脑已安装的浏览器打开书签
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { useAppStore } from '../store/appStore'
import {
  useWebsiteStore,
  filterBookmarks,
  extractDomain,
  fetchFaviconDataUrl,
  svgFileToDataUrl
} from '../store/websiteStore'
import { useBrowserStore } from '../store/browserStore'
import { useCategoryStore } from '../store/categoryStore'
import { useWebSettingsStore } from '../store/webSettingsStore'
import { showContextMenu, type MenuItem } from '../components/common/ContextMenu'
import { Icon } from '../components/common/Icon'
import { Button } from '../components/common/Button'
import { Modal } from '../components/common/Modal'
import type { Website } from '../types'
import './Bookmarks.css'

/** 打开系统文件选择器挑选 SVG 文件；取消时返回 null */
function pickSvgFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.svg,image/svg+xml'
    let done = false
    const finish = (file: File | null): void => {
      if (done) return
      done = true
      resolve(file)
    }
    input.addEventListener('change', () => finish(input.files?.[0] ?? null))
    input.addEventListener('cancel', () => finish(null))
    input.click()
  })
}

/** 书签卡片组件 */
function BookmarkCard({
  bookmark,
  onEdit
}: {
  bookmark: Website
  onEdit: (bookmark: Website) => void
}): React.JSX.Element {
  const { removeBookmark, updateBookmark, refreshFavicon, setLogoFromFile } = useWebsiteStore()
  const { openUrl } = useBrowserStore()
  const [imgError, setImgError] = useState(false)

  useEffect(() => {
    setImgError(false)
  }, [bookmark.logo])

  const handleImgError = useCallback(async (): Promise<void> => {
    if (bookmark.logo && bookmark.logo.startsWith('http')) {
      // 外部 URL 失败，尝试通过主进程下载
      const dataUrl = await fetchFaviconDataUrl(bookmark.url)
      if (dataUrl) {
        updateBookmark(bookmark.id, { logo: dataUrl })
        return
      }
    }
    setImgError(true)
  }, [bookmark.url, bookmark.logo, updateBookmark])

  const handleRefreshFavicon = async (): Promise<void> => {
    setImgError(false)
    await refreshFavicon(bookmark.id)
  }

  // 上传本地 SVG 作为 logo（落盘到 userData/logos，与自动识别的 logo 同目录）
  const handleUploadLogo = async (): Promise<void> => {
    const file = await pickSvgFile()
    if (!file) return
    const error = await setLogoFromFile(bookmark.id, file)
    if (error) alert(error)
  }

  const handleDelete = (): void => {
    if (confirm(`确定删除书签「${bookmark.name}」吗？`)) {
      removeBookmark(bookmark.id)
    }
  }

  // 左键点击：跳转
  const handleOpen = (): void => {
    void openUrl(bookmark.url)
  }

  // 右键：编辑 / 刷新 Logo / 上传 SVG / 删除（浏览器选择在右上角，不在此处）
  const handleContextMenu = (e: React.MouseEvent): void => {
    const items: MenuItem[] = [
      {
        key: 'edit',
        label: '编辑',
        icon: <Icon name="edit" size={12} />,
        onClick: () => onEdit(bookmark)
      },
      {
        key: 'refresh',
        label: '刷新 Logo',
        icon: <Icon name="refresh" size={12} />,
        onClick: () => void handleRefreshFavicon()
      },
      {
        key: 'upload',
        label: '上传 SVG Logo',
        icon: <Icon name="upload" size={12} />,
        onClick: () => void handleUploadLogo()
      },
      { key: 'divider', label: '', divider: true },
      {
        key: 'delete',
        label: '删除书签',
        icon: <Icon name="trash" size={12} />,
        danger: true,
        onClick: handleDelete
      }
    ]
    showContextMenu(e, items)
  }

  const domain = extractDomain(bookmark.url)
  const fallbackLetter = (bookmark.name || domain).charAt(0)

  return (
    <div
      className="bookmark-item"
      onClick={handleOpen}
      onContextMenu={handleContextMenu}
      title={bookmark.url}
    >
      <div className="bookmark-tile">
        {bookmark.logo && !imgError ? (
          <img src={bookmark.logo} alt={bookmark.name} onError={() => void handleImgError()} />
        ) : (
          <span className="bookmark-logo-fallback">{fallbackLetter}</span>
        )}
      </div>

      <span className="bookmark-name">{bookmark.name}</span>
    </div>
  )
}

/** 书签主页面组件 */

/** 分类操作注册表：供侧边栏分类区调用（弹窗/删除逻辑在本页组件内实现） */
export const bookmarkCategoryActions: {
  openNew: (() => void) | null
  openRename: ((id: string, name: string) => void) | null
  remove: ((id: string, name: string) => void) | null
} = { openNew: null, openRename: null, remove: null }

export function Bookmarks(): React.JSX.Element {
  const { searchKeyword, setSearchKeyword, activeCategory, setActiveCategory } = useAppStore()
  const { bookmarks, loaded, addBookmark, refreshFavicon, updateBookmark, hydrate } =
    useWebsiteStore()
  const {
    browsers,
    defaultBrowserId,
    setDefaultBrowser,
    detect,
    hydrate: hydrateBrowser
  } = useBrowserStore()
  const {
    categories,
    addCategory: createCategory,
    renameCategory,
    removeCategory,
    hydrate: hydrateCategories
  } = useCategoryStore()
  // 网页标签设置：自定义背景（'' = 默认渐变背景）
  const { background: customBackground, hydrate: hydrateWebSettings } = useWebSettingsStore()

  const [addUrl, setAddUrl] = useState('')
  const [addName, setAddName] = useState('')
  const [addCategory, setAddCategory] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [adding, setAdding] = useState(false)
  const [showBrowserMenu, setShowBrowserMenu] = useState(false)
  const [showCategoryMenu, setShowCategoryMenu] = useState(false)
  // 新建/重命名分类弹窗
  const [catModal, setCatModal] = useState<{ open: boolean; editId: string | null }>({
    open: false,
    editId: null
  })
  const [catName, setCatName] = useState('')
  // 编辑书签弹窗
  const [editBookmark, setEditBookmark] = useState<Website | null>(null)
  const [editUrl, setEditUrl] = useState('')
  const [editName, setEditName] = useState('')
  const [editLogo, setEditLogo] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const catInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (showModal && inputRef.current) {
      inputRef.current.focus()
    }
  }, [showModal])

  useEffect(() => {
    if (catModal.open && catInputRef.current) {
      catInputRef.current.focus()
    }
  }, [catModal.open])

  // 检测电脑上已安装的浏览器
  useEffect(() => {
    void detect()
  }, [detect])

  // 点击外部关闭下拉菜单（浏览器 / 分类）
  useEffect(() => {
    if (!showBrowserMenu && !showCategoryMenu) return
    const close = (): void => {
      setShowBrowserMenu(false)
      setShowCategoryMenu(false)
    }
    const timer = setTimeout(() => window.addEventListener('click', close), 0)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('click', close)
    }
  }, [showBrowserMenu, showCategoryMenu])

  // 启动：从数据文件加载书签/分类/浏览器偏好/网页标签设置 + 检测已安装浏览器
  useEffect(() => {
    void hydrate()
    void hydrateCategories()
    void hydrateBrowser()
    void hydrateWebSettings()
    void detect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 修复旧数据：logo 还是 http 链接的，重新下载并落盘为图片文件
  useEffect(() => {
    if (!loaded) return
    bookmarks.forEach((b) => {
      if (b.logo && b.logo.startsWith('http')) {
        void refreshFavicon(b.id)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded])

  const filteredBookmarks = filterBookmarks(
    bookmarks,
    searchKeyword,
    activeCategory === 'all' ? undefined : activeCategory === 'none' ? '' : activeCategory
  )

  // 存在未分类书签时才显示“未分类”标签
  const hasUncategorized = bookmarks.some((b) => !b.categoryId)

  const categoryCount = (id: string): number =>
    id === 'none' || id === ''
      ? bookmarks.filter((b) => !b.categoryId).length
      : bookmarks.filter((b) => b.categoryId === id).length

  const handleCloseModal = (): void => {
    setShowModal(false)
    setAddUrl('')
    setAddName('')
    setAddCategory('')
  }

  const handleAdd = async (): Promise<void> => {
    let url = addUrl.trim()
    if (!url) return

    // 自动补全协议
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url
    }

    // 简单验证 URL
    try {
      new URL(url)
    } catch {
      alert('请输入有效的网址')
      return
    }

    setAdding(true)
    try {
      await addBookmark(url, addName.trim() || undefined, undefined, addCategory || undefined)
      handleCloseModal()
    } finally {
      setAdding(false)
    }
  }

  // ===== 编辑书签（右键→编辑 弹出） =====
  const openEdit = (bookmark: Website): void => {
    setEditBookmark(bookmark)
    setEditUrl(bookmark.url)
    setEditName(bookmark.name)
    setEditLogo(bookmark.logo || '')
    setEditCategory(bookmark.categoryId || '')
  }

  const closeEdit = (): void => setEditBookmark(null)

  // 编辑弹窗内上传 SVG：先填入 data URL，保存时经 updateBookmark 统一落盘
  const handleEditUploadLogo = async (): Promise<void> => {
    const file = await pickSvgFile()
    if (!file) return
    const result = await svgFileToDataUrl(file)
    if (!result.dataUrl) {
      alert(result.error || 'SVG 读取失败')
      return
    }
    setEditLogo(result.dataUrl)
  }

  const handleSaveEdit = (): void => {
    if (!editBookmark) return
    let url = editUrl.trim()
    if (!url) {
      alert('网址不能为空')
      return
    }
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url
    try {
      new URL(url)
    } catch {
      alert('请输入有效的网址')
      return
    }
    updateBookmark(editBookmark.id, {
      url,
      name: editName.trim() || extractDomain(url),
      logo: editLogo,
      categoryId: editCategory || undefined
    })
    closeEdit()
  }

  // ===== 分类相关 =====
  const openNewCategory = (): void => {
    setCatName('')
    setCatModal({ open: true, editId: null })
  }

  const openRenameCategory = (id: string, name: string): void => {
    setCatName(name)
    setCatModal({ open: true, editId: id })
  }

  const closeCatModal = (): void => setCatModal({ open: false, editId: null })

  const handleSubmitCategory = (): void => {
    const name = catName.trim()
    if (!name) return
    if (catModal.editId) {
      renameCategory(catModal.editId, name)
    } else {
      const created = createCategory(name)
      if (created) setActiveCategory(created.id)
    }
    closeCatModal()
  }

  const handleDeleteCategory = (id: string, name: string): void => {
    if (!confirm(`确定删除分类「${name}」吗？该分类下的书签将变为未分类。`)) return
    // 先将该分类下的书签移到未分类
    bookmarks
      .filter((b) => b.categoryId === id)
      .forEach((b) => updateBookmark(b.id, { categoryId: undefined }))
    removeCategory(id)
    if (activeCategory === id) setActiveCategory('all')
  }

  // 向侧边栏注册分类操作
  bookmarkCategoryActions.openNew = openNewCategory
  bookmarkCategoryActions.openRename = openRenameCategory
  bookmarkCategoryActions.remove = handleDeleteCategory

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      void handleAdd()
    }
  }

  return (
    <div
      className="bookmarks-page"
      style={
        customBackground
          ? { background: `#2c46a8 url(${customBackground}) center / cover no-repeat` }
          : undefined
      }
    >
      {/* 顶栏 */}
      <div className="bookmarks-topbar">
        {/* 分类下拉框（左侧，与右侧控件同一行） */}
        <div className="category-picker">
          <button
            className="category-picker-btn"
            onClick={(e) => {
              e.stopPropagation()
              setShowCategoryMenu((v) => !v)
            }}
            title="选择分类"
          >
            <Icon name="grid" size={12} />
            <span className="category-picker-name">
              {activeCategory === 'all'
                ? '全部'
                : activeCategory === 'none'
                  ? '未分类'
                  : categories.find((c) => c.id === activeCategory)?.name || '全部'}
            </span>
            <Icon name="chevron-down" size={12} />
          </button>
          {showCategoryMenu && (
            <div className="category-picker-menu">
              <button
                className={`category-option ${activeCategory === 'all' ? 'active' : ''}`}
                onClick={() => {
                  setActiveCategory('all')
                  setShowCategoryMenu(false)
                }}
              >
                <span className="category-option-check">
                  {activeCategory === 'all' && <Icon name="check" size={12} />}
                </span>
                <span className="category-option-name">全部</span>
                <span className="category-option-count">{bookmarks.length}</span>
              </button>
              {categories.map((c) => (
                <div
                  key={c.id}
                  className={`category-option ${activeCategory === c.id ? 'active' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setActiveCategory(c.id)
                    setShowCategoryMenu(false)
                  }}
                >
                  <span className="category-option-check">
                    {activeCategory === c.id && <Icon name="check" size={12} />}
                  </span>
                  <span className="category-option-name">{c.name}</span>
                  <span className="category-option-actions">
                    <button
                      className="category-option-btn"
                      title="重命名"
                      onClick={(e) => {
                        e.stopPropagation()
                        openRenameCategory(c.id, c.name)
                        setShowCategoryMenu(false)
                      }}
                    >
                      <Icon name="edit" size={12} />
                    </button>
                    <button
                      className="category-option-btn delete"
                      title="删除"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteCategory(c.id, c.name)
                      }}
                    >
                      <Icon name="trash" size={12} />
                    </button>
                  </span>
                  <span className="category-option-count">{categoryCount(c.id)}</span>
                </div>
              ))}
              {hasUncategorized && (
                <button
                  className={`category-option ${activeCategory === 'none' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveCategory('none')
                    setShowCategoryMenu(false)
                  }}
                >
                  <span className="category-option-check">
                    {activeCategory === 'none' && <Icon name="check" size={12} />}
                  </span>
                  <span className="category-option-name">未分类</span>
                  <span className="category-option-count">{categoryCount('none')}</span>
                </button>
              )}
              <div className="category-option-divider" />
              <button
                className="category-option add"
                onClick={() => {
                  openNewCategory()
                  setShowCategoryMenu(false)
                }}
              >
                <span className="category-option-check">
                  <Icon name="plus" size={12} />
                </span>
                <span className="category-option-name">新建分类</span>
              </button>
            </div>
          )}
        </div>
        <div className="bookmarks-topbar-right">
          {/* 默认浏览器选择器 */}
          <div className="browser-picker">
            <button
              className="browser-picker-btn"
              onClick={(e) => {
                e.stopPropagation()
                setShowBrowserMenu((v) => !v)
              }}
              title="选择打开书签的浏览器"
            >
              <Icon name="computer" size={12} />
              <span className="browser-picker-name">
                {browsers.find((b) => b.id === defaultBrowserId)?.name || '系统默认'}
              </span>
              <Icon name="chevron-down" size={12} />
            </button>
            {showBrowserMenu && (
              <div className="browser-picker-menu">
                {browsers.map((b) => (
                  <button
                    key={b.id}
                    className={`browser-picker-option ${defaultBrowserId === b.id ? 'active' : ''}`}
                    onClick={() => {
                      setDefaultBrowser(b.id)
                      setShowBrowserMenu(false)
                    }}
                  >
                    <span className="browser-picker-check">
                      {defaultBrowserId === b.id && <Icon name="check" size={12} />}
                    </span>
                    <span>{b.name}</span>
                  </button>
                ))}
                <button
                  className={`browser-picker-option ${defaultBrowserId === '' ? 'active' : ''}`}
                  onClick={() => {
                    setDefaultBrowser('')
                    setShowBrowserMenu(false)
                  }}
                >
                  <span className="browser-picker-check">
                    {defaultBrowserId === '' && <Icon name="check" size={12} />}
                  </span>
                  <span>系统默认浏览器</span>
                </button>
              </div>
            )}
          </div>
          {/* 搜索 */}
          <input
            className="bookmarks-search"
            placeholder="搜索书签..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
          />
          <Button
            size="sm"
            variant="primary"
            className="bookmarks-glass-btn"
            icon={<Icon name="plus" size={12} />}
            onClick={() => setShowModal(true)}
            disabled={adding}
          >
            添加
          </Button>
        </div>
      </div>

      {/* 内容区 */}
      <div className="bookmarks-content">
        {loaded && bookmarks.length === 0 ? (
          <div className="bookmarks-empty">
            <Icon name="link" size={48} strokeWidth={1} />
            <h2>还没有收藏</h2>
            <p>点击右上角「添加」按钮，保存你常用的网站</p>
            <span className="bookmarks-empty-hint">输入网址时会自动识别网站名称和 Logo</span>
          </div>
        ) : loaded && filteredBookmarks.length === 0 ? (
          <div className="bookmarks-empty">
            <Icon name="search" size={36} strokeWidth={1} />
            <p>没有找到匹配的书签</p>
          </div>
        ) : (
          <div className="bookmarks-grid">
            {filteredBookmarks.map((bookmark) => (
              <BookmarkCard key={bookmark.id} bookmark={bookmark} onEdit={openEdit} />
            ))}
          </div>
        )}
      </div>

      {/* 添加书签弹窗 */}
      <Modal
        open={showModal}
        title="添加书签"
        className="bookmarks-modal"
        footer={
          <>
            <Button
              size="sm"
              variant="ghost"
              className="bookmarks-glass-btn"
              onClick={handleCloseModal}
              disabled={adding}
            >
              取消
            </Button>
            <Button
              size="sm"
              variant="primary"
              className="bookmarks-glass-btn"
              onClick={() => void handleAdd()}
              disabled={adding}
            >
              {adding ? '获取中...' : '确定'}
            </Button>
          </>
        }
      >
        <div className="modal-field">
          <label className="modal-label">网址</label>
          <input
            ref={inputRef}
            className="modal-input"
            value={addUrl}
            onChange={(e) => setAddUrl(e.target.value)}
            placeholder="请输入网址，如：github.com"
            onKeyDown={handleKeyDown}
            disabled={adding}
          />
        </div>
        <div className="modal-field">
          <label className="modal-label">名称（可选）</label>
          <input
            className="modal-input"
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            placeholder="留空则自动识别"
            onKeyDown={handleKeyDown}
            disabled={adding}
          />
        </div>
        <div className="modal-field">
          <label className="modal-label">分类</label>
          <select
            className="modal-input"
            value={addCategory}
            onChange={(e) => setAddCategory(e.target.value)}
            disabled={adding}
          >
            <option value="">未分类</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </Modal>

      {/* 编辑书签弹窗（右键 → 编辑） */}
      <Modal
        open={editBookmark !== null}
        title="编辑书签"
        className="bookmarks-modal"
        footer={
          <>
            <Button size="sm" variant="ghost" className="bookmarks-glass-btn" onClick={closeEdit}>
              取消
            </Button>
            <Button
              size="sm"
              variant="primary"
              className="bookmarks-glass-btn"
              onClick={handleSaveEdit}
            >
              保存
            </Button>
          </>
        }
      >
        <div className="modal-field">
          <label className="modal-label">网址</label>
          <input
            className="modal-input"
            value={editUrl}
            onChange={(e) => setEditUrl(e.target.value)}
            placeholder="如：https://github.com"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveEdit()
            }}
          />
        </div>
        <div className="modal-field">
          <label className="modal-label">名称</label>
          <input
            className="modal-input"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="书签名称"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveEdit()
            }}
          />
        </div>
        <div className="modal-field">
          <label className="modal-label">Logo URL（可选）</label>
          <div className="logo-field-row">
            <input
              className="modal-input"
              value={editLogo.startsWith('data:') ? '' : editLogo}
              onChange={(e) => setEditLogo(e.target.value)}
              placeholder={
                editLogo.startsWith('data:')
                  ? '已上传 SVG 文件，可重新上传或输入 URL'
                  : '留空则使用已识别的 Logo'
              }
            />
            <Button
              size="sm"
              variant="ghost"
              className="bookmarks-glass-btn"
              icon={<Icon name="upload" size={12} />}
              onClick={() => void handleEditUploadLogo()}
            >
              上传 SVG
            </Button>
            {editLogo && <img className="logo-preview" src={editLogo} alt="Logo 预览" />}
          </div>
        </div>
        <div className="modal-field">
          <label className="modal-label">分类</label>
          <select
            className="modal-input"
            value={editCategory}
            onChange={(e) => setEditCategory(e.target.value)}
          >
            <option value="">未分类</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </Modal>

      {/* 新建/重命名分类弹窗 */}
      <Modal
        open={catModal.open}
        title={catModal.editId ? '重命名分类' : '新建分类'}
        className="bookmarks-modal"
        footer={
          <>
            <Button
              size="sm"
              variant="ghost"
              className="bookmarks-glass-btn"
              onClick={closeCatModal}
            >
              取消
            </Button>
            <Button
              size="sm"
              variant="primary"
              className="bookmarks-glass-btn"
              onClick={handleSubmitCategory}
            >
              确定
            </Button>
          </>
        }
      >
        <div className="modal-field">
          <label className="modal-label">分类名称</label>
          <input
            ref={catInputRef}
            className="modal-input"
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            placeholder="如：工作、学习、工具…"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmitCategory()
            }}
          />
        </div>
      </Modal>
    </div>
  )
}
