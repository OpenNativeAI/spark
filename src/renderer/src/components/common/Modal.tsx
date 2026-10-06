/**
 * 弹窗组件
 * 特点：点击遮罩不关闭，只能通过按钮关闭
 */

import { useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './Modal.css'

export interface ModalProps {
  /** 是否显示 */
  open: boolean
  /** 标题 */
  title: string
  /** 内容 */
  children: ReactNode
  /** 底部按钮区域 */
  footer?: ReactNode
  /** 自定义容器类名 */
  className?: string
}

export function Modal({
  open,
  title,
  children,
  footer,
  className = ''
}: ModalProps): React.JSX.Element | null {
  const containerRef = useRef<HTMLDivElement>(null)

  if (!open) return null

  // 遮罩层鼠标按下 — 不关闭弹窗，给出抖动反馈
  const handleOverlayMouseDown = (e: React.MouseEvent): void => {
    e.stopPropagation()
    e.preventDefault()
    const container = containerRef.current
    if (container) {
      container.style.transform = 'scale(0.995)'
      setTimeout(() => {
        container.style.transform = ''
      }, 100)
    }
  }

  // 弹窗容器鼠标按下 — 阻止事件冒泡到遮罩层
  const handleContainerMouseDown = (e: React.MouseEvent): void => {
    e.stopPropagation()
  }

  return createPortal(
    <div className="modal-overlay" onMouseDown={handleOverlayMouseDown}>
      <div
        className={`modal-container ${className}`}
        ref={containerRef}
        onMouseDown={handleContainerMouseDown}
      >
        <div className="modal-header">
          <span className="modal-title">{title}</span>
        </div>

        <div className="modal-body">{children}</div>

        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}
