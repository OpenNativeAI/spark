import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './Button.css'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 变体 */
  variant?: 'default' | 'primary' | 'ghost' | 'danger'
  /** 尺寸 */
  size?: 'sm' | 'md'
  /** 图标（左侧） */
  icon?: ReactNode
  /** 仅图标模式（无文字时） */
  iconOnly?: boolean
}

export function Button({
  variant = 'default',
  size = 'md',
  icon,
  iconOnly,
  className = '',
  children,
  ...rest
}: ButtonProps): React.JSX.Element {
  const cls = [
    'btn',
    `btn-${variant}`,
    `btn-${size}`,
    iconOnly ? 'btn-icon-only' : '',
    className
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button className={cls} {...rest}>
      {icon && <span className="btn-icon">{icon}</span>}
      {!iconOnly && children}
    </button>
  )
}
