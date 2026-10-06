/**
 * 右键菜单
 * 用法：const { menu, openMenu } = useContextMenu()
 * 在 onContextMenu 时调用 openMenu(e, items)
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import './ContextMenu.css'

export interface MenuItem {
  /** 唯一 key */
  key: string
  /** 显示文本 */
  label: string
  /** 图标 */
  icon?: ReactNode
  /** 是否危险 */
  danger?: boolean
  /** 是否禁用 */
  disabled?: boolean
  /** 分隔线（此 item 之前） */
  divider?: boolean
  /** 点击回调 */
  onClick?: () => void
}

interface MenuState {
  x: number
  y: number
  items: MenuItem[]
}

let menuStateSetter: ((state: MenuState | null) => void) | null = null

export function showContextMenu(e: React.MouseEvent, items: MenuItem[]): void {
  e.preventDefault()
  e.stopPropagation()
  menuStateSetter?.({ x: e.clientX, y: e.clientY, items })
}

export function ContextMenuHost(): React.JSX.Element | null {
  const [state, setState] = useState<MenuState | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    menuStateSetter = setState
    return () => {
      menuStateSetter = null
    }
  }, [])

  useEffect(() => {
    if (!state) return
    const close = (): void => setState(null)
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    // 下一帧再绑定，避免当前右键事件触发关闭
    const timer = setTimeout(() => {
      window.addEventListener('click', close)
      window.addEventListener('contextmenu', close)
      window.addEventListener('keydown', onKey)
      window.addEventListener('blur', close)
    }, 0)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('click', close)
      window.removeEventListener('contextmenu', close)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('blur', close)
    }
  }, [state])

  if (!state) return null

  // 边界检测，防止菜单超出窗口
  const maxHeight = window.innerHeight - 16
  const menuHeight = state.items.length * 32 + 16
  const finalY = state.y + menuHeight > maxHeight ? maxHeight - menuHeight : state.y

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: state.x, top: finalY }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {state.items.map((item) =>
        item.divider ? (
          <div key={item.key} className="context-menu-divider" />
        ) : (
          <button
            key={item.key}
            className={`context-menu-item ${item.danger ? 'danger' : ''}`}
            disabled={item.disabled}
            onClick={() => {
              item.onClick?.()
              setState(null)
            }}
          >
            {item.icon && <span className="context-menu-icon">{item.icon}</span>}
            <span className="context-menu-label">{item.label}</span>
          </button>
        )
      )}
    </div>
  )
}
