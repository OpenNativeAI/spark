/**
 * 自定义标题栏
 * 跨平台：macOS 左侧留出 traffic light 空间；Windows 右侧显示窗口控制按钮
 */

import { useEffect, useState } from 'react'
import { Icon } from '../common/Icon'
import { SparkLogo } from '../common/SparkLogo'
import './TitleBar.css'

type Platform = 'darwin' | 'win32' | 'linux'

export function TitleBar(): React.JSX.Element {
  const [platform, setPlatform] = useState<Platform>('darwin')
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    // 从 preload 获取平台
    const p = window.api?.getPlatform?.()
    if (p) setPlatform(p as Platform)

    // 监听窗口最大化状态变化
    const cleanup = window.api?.onWindowMaximizedChange?.((maximized: boolean) => {
      setIsMaximized(maximized)
    })
    return () => cleanup?.()
  }, [])

  const isMac = platform === 'darwin'

  const handleMinimize = (): void => window.api?.windowMinimize?.()
  const handleMaximize = (): void => window.api?.windowMaximize?.()
  const handleClose = (): void => window.api?.windowClose?.()

  return (
    <div className={`titlebar ${isMac ? 'titlebar-mac' : ''}`}>
      {/* 拖动区 */}
      <div className="titlebar-drag drag-region">
        {!isMac && (
          <span className="titlebar-title">
            <SparkLogo size={16} />
            <span>Spark</span>
          </span>
        )}
      </div>

      {/* Windows / Linux 显示窗口控制 */}
      {!isMac && (
        <div className="titlebar-controls no-drag">
          <button
            className="titlebar-btn"
            onClick={handleMinimize}
            aria-label="最小化"
            title="最小化"
          >
            <Icon name="minus" size={14} />
          </button>
          <button
            className="titlebar-btn"
            onClick={handleMaximize}
            aria-label={isMaximized ? '还原' : '最大化'}
            title={isMaximized ? '还原' : '最大化'}
          >
            <Icon name="square" size={12} />
          </button>
          <button
            className="titlebar-btn titlebar-btn-close"
            onClick={handleClose}
            aria-label="关闭"
            title="关闭"
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
