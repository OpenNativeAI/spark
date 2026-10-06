/**
 * 设置页面
 * 左侧分类导航（常规 / 网页标签 / 存储 / 关于）+ 右侧内容面板
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { useWebSettingsStore } from '../store/webSettingsStore'
import { Icon, type IconName } from '../components/common/Icon'
import { SparkLogo } from '../components/common/SparkLogo'
import type { StorageInfo } from '../types'
import './Settings.css'

/** 字节数人性化显示 */
function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

/** 设置分类页签（侧边栏也引用此定义） */
export type SettingsTab = 'general' | 'web' | 'storage' | 'about'

export const SETTINGS_TABS: { id: SettingsTab; icon: IconName; label: string }[] = [
  { id: 'general', icon: 'settings', label: '常规' },
  { id: 'web', icon: 'link', label: '网页标签' },
  { id: 'storage', icon: 'hard-drive', label: '存储' },
  { id: 'about', icon: 'star', label: '关于' }
]

export function Settings(): React.JSX.Element {
  const { portableStatus, settingsTab: tab } = useAppStore()
  const {
    background,
    hydrate: hydrateWebSettings,
    setBackgroundFromFile,
    resetBackground
  } = useWebSettingsStore()
  const [storage, setStorage] = useState<StorageInfo | null>(null)
  // 背景图片选择
  const bgInputRef = useRef<HTMLInputElement>(null)
  const [bgSaving, setBgSaving] = useState(false)
  const [bgError, setBgError] = useState<string | null>(null)

  const loadStorage = useCallback((): void => {
    void window.api.getStorageInfo().then(setStorage)
  }, [])

  useEffect(() => {
    loadStorage()
    void hydrateWebSettings()
  }, [loadStorage, hydrateWebSettings])

  /** 选择本地图片作为书签页背景 */
  const handleBgFile = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBgSaving(true)
    setBgError(null)
    const error = await setBackgroundFromFile(file)
    setBgError(error)
    setBgSaving(false)
  }

  /** 恢复默认背景 */
  const handleBgReset = (): void => {
    setBgError(null)
    void resetBackground()
  }

  /** 在访达/资源管理器中显示并选中 */
  const reveal = (path: string): void => {
    void window.api.showInFolder(path)
  }

  return (
    <div className="settings-page">
      <div className="settings-container">
        <h1 className="settings-title">设置</h1>

        <div className="settings-body">
          {/* 内容面板（分类导航在整体侧边栏中） */}
          <div className="settings-panel">
            {/* ===== 常规 ===== */}
            {tab === 'general' && (
              <>
                <section className="settings-section">
                  <h2 className="settings-section-title">运行模式</h2>
                  <div className="settings-item">
                    <div className="settings-item-label">
                      <div className="settings-item-name">当前模式</div>
                      <div className="settings-item-desc">
                        {portableStatus?.isPortable
                          ? '便携模式（数据存储在程序目录）'
                          : '安装模式（数据存储在系统目录）'}
                      </div>
                    </div>
                    <div className="settings-item-control">
                      <span
                        className={`mode-badge ${portableStatus?.isPortable ? 'portable' : ''}`}
                      >
                        {portableStatus?.isPortable ? (
                          <>
                            <Icon name="usb" size={11} /> 便携
                          </>
                        ) : (
                          <>
                            <Icon name="computer" size={11} /> 安装
                          </>
                        )}
                      </span>
                    </div>
                  </div>

                  {portableStatus && (
                    <div className="settings-item">
                      <div className="settings-item-label">
                        <div className="settings-item-name">数据目录</div>
                        <div className="settings-item-desc text-mono">
                          {portableStatus.userDataPath}
                        </div>
                      </div>
                    </div>
                  )}
                </section>

                <div className="settings-hint">
                  <Icon name="usb" size={13} />
                  <span>
                    在程序目录创建 <code>portable</code>{' '}
                    文件即可启用便携模式，所有数据将保存在程序目录
                  </span>
                </div>
              </>
            )}

            {/* ===== 网页标签 ===== */}
            {tab === 'web' && (
              <section className="settings-section">
                <h2 className="settings-section-title">书签背景</h2>
                <div className="settings-item">
                  <div className="settings-item-label">
                    <div className="settings-item-name">页面背景</div>
                    <div className="settings-item-desc">
                      {background
                        ? '正在使用自定义背景图片'
                        : '正在使用默认渐变背景，可选择本地图片替换'}
                    </div>
                  </div>
                  <div className="settings-item-control">
                    {background && <img className="bg-preview" src={background} alt="背景预览" />}
                    <button
                      className="storage-jump"
                      disabled={bgSaving}
                      onClick={() => bgInputRef.current?.click()}
                    >
                      <Icon name="file-image" size={11} />{' '}
                      {bgSaving ? '保存中...' : background ? '更换图片' : '选择图片'}
                    </button>
                    {background && (
                      <button className="storage-jump" onClick={handleBgReset}>
                        <Icon name="refresh" size={11} /> 恢复默认
                      </button>
                    )}
                    <input
                      ref={bgInputRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => void handleBgFile(e)}
                    />
                  </div>
                </div>
                {bgError && <div className="bg-error">{bgError}</div>}

                <div className="settings-hint">
                  <Icon name="link" size={13} />
                  <span>自定义背景将保存在数据目录，仅作用于书签页面的背景显示</span>
                </div>
              </section>
            )}

            {/* ===== 存储 ===== */}
            {tab === 'storage' && (
              <section className="settings-section">
                <h2 className="settings-section-title">
                  <span>数据文件</span>
                  <button className="storage-link" onClick={loadStorage} title="重新扫描存储信息">
                    <Icon name="refresh" size={11} /> 刷新
                  </button>
                </h2>

                {storage?.items.length === 0 && (
                  <div className="settings-item">
                    <div className="settings-item-label">
                      <div className="settings-item-desc">
                        暂无数据，添加书签后这里会显示存储位置
                      </div>
                    </div>
                  </div>
                )}
                {storage?.items.map((item) => (
                  <div className="settings-item" key={item.key}>
                    <div className="settings-item-label">
                      <div className="settings-item-name">{item.label}</div>
                      <div className="settings-item-desc text-mono">{item.path}</div>
                    </div>
                    <div className="settings-item-control">
                      <span className="storage-size">
                        {item.count !== undefined ? `${item.count} 个文件 · ` : ''}
                        {formatBytes(item.size || 0)}
                      </span>
                      <button
                        className="storage-jump"
                        title="在访达中显示"
                        onClick={() => reveal(item.path)}
                      >
                        <Icon name="arrow-up" size={11} /> 跳转
                      </button>
                    </div>
                  </div>
                ))}

                {storage && (
                  <div className="settings-item">
                    <div className="settings-item-label">
                      <div className="settings-item-name">数据根目录</div>
                      <div className="settings-item-desc text-mono">{storage.root}</div>
                    </div>
                    <div className="settings-item-control">
                      <button
                        className="storage-jump"
                        title="打开数据根目录"
                        onClick={() => reveal(storage.dataDir)}
                      >
                        <Icon name="folder" size={11} /> 打开
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* ===== 关于 ===== */}
            {tab === 'about' && (
              <section className="settings-section">
                <h2 className="settings-section-title">关于</h2>
                <div className="settings-item">
                  <div className="settings-item-label">
                    <div className="settings-item-name settings-about-name">
                      <SparkLogo size={22} />
                      <span>Spark</span>
                    </div>
                    <div className="settings-item-desc">跨平台文件 / 影音管理器</div>
                  </div>
                  <div className="settings-item-control">
                    <span className="text-secondary text-sm">v1.0.0</span>
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
