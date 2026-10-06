import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import './Input.css'

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix' | 'suffix'> {
  /** 前置图标 */
  prefix?: ReactNode
  /** 后置图标 */
  suffix?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { prefix, suffix, className = '', ...rest },
  ref
) {
  return (
    <div className={`input-wrapper ${className}`}>
      {prefix && <span className="input-prefix">{prefix}</span>}
      <input ref={ref} className="input" {...rest} />
      {suffix && <span className="input-suffix">{suffix}</span>}
    </div>
  )
})
