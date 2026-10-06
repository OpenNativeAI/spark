/**
 * 统一 SVG 图标库
 * 风格：细线（1.5 stroke）、15px 默认尺寸、currentColor
 */

import type { CSSProperties } from 'react'

export type IconName =
  // 文件类型
  | 'folder'
  | 'file'
  | 'file-video'
  | 'file-audio'
  | 'file-image'
  // 设备
  | 'hard-drive'
  | 'usb'
  | 'computer'
  // 导航
  | 'chevron-right'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-up'
  | 'arrow-left'
  | 'arrow-up'
  // 操作
  | 'search'
  | 'settings'
  | 'refresh'
  | 'plus'
  | 'trash'
  | 'edit'
  | 'copy'
  | 'more'
  | 'x'
  | 'minus'
  | 'square'
  | 'link'
  | 'check'
  | 'upload'
  | 'download'
  // 视图
  | 'grid'
  | 'list'
  | 'eye'
  | 'code'
  // 媒体
  | 'play'
  | 'pause'
  | 'rewind'
  | 'forward'
  | 'maximize'
  | 'volume'
  | 'volume-x'
  | 'star'
  | 'clock'
  | 'film'

interface IconProps {
  name: IconName
  size?: number
  strokeWidth?: number
  className?: string
  style?: CSSProperties
}

const PATHS: Record<IconName, React.ReactNode> = {
  // 文件类型
  folder: (
    <path d="M3 5a1 1 0 0 1 1-1h3.5l1.5 1.5H11a1 1 0 0 1 1 1V11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5z" />
  ),
  file: (
    <>
      <path d="M5 3h4l3 3v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M9 3v3h3" />
    </>
  ),
  'file-video': (
    <>
      <path d="M5 3h4l3 3v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M9 3v3h3" />
      <path d="M6.5 9.5l3 1.5-3 1.5v-3z" fill="currentColor" stroke="none" />
    </>
  ),
  'file-audio': (
    <>
      <path d="M5 3h4l3 3v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M9 3v3h3" />
      <circle cx="7" cy="11" r="0.5" fill="currentColor" />
      <path d="M7.5 11V8.5l2-0.5" />
    </>
  ),
  'file-image': (
    <>
      <path d="M5 3h4l3 3v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M9 3v3h3" />
      <circle cx="7" cy="8" r="0.8" />
      <path d="M5 12l2-2 1.5 1.5L11 9l1 1v2" />
    </>
  ),

  // 设备
  'hard-drive': (
    <>
      <rect x="3" y="6" width="10" height="5" rx="1" />
      <path d="M5 9.5h.01M11 9.5h.01" strokeLinecap="round" />
      <path d="M3 11v1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1" />
    </>
  ),
  usb: (
    <>
      <rect x="6" y="3" width="4" height="4" rx="0.5" />
      <path d="M7 4h.01M9 4h.01" strokeLinecap="round" />
      <path d="M6 7v3a3 3 0 0 0 4 0V7" />
      <path d="M8 13v2" strokeLinecap="round" />
    </>
  ),
  computer: (
    <>
      <rect x="3" y="3" width="10" height="7" rx="1" />
      <path d="M6 13h4M8 10v3" strokeLinecap="round" />
    </>
  ),

  // 导航
  'chevron-right': <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />,
  'chevron-down': <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />,
  'chevron-left': <path d="M10 4l-4 4 4 4" strokeLinecap="round" strokeLinejoin="round" />,
  'chevron-up': <path d="M4 10l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />,
  'arrow-left': (
    <>
      <path d="M11 8H4M7 4l-4 4 4 4" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  'arrow-up': (
    <>
      <path d="M8 12V4M4 8l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),

  // 操作
  search: (
    <>
      <circle cx="7" cy="7" r="3.5" />
      <path d="M12 12l-2.5-2.5" strokeLinecap="round" />
    </>
  ),
  settings: (
    <>
      <circle cx="8" cy="8" r="2" />
      <path
        d="M8 2v2M8 12v2M2 8h2M12 8h2M3.5 3.5l1.5 1.5M11 11l1.5 1.5M3.5 12.5L5 11M11 5l1.5-1.5"
        strokeLinecap="round"
      />
    </>
  ),
  refresh: (
    <>
      <path d="M13 8A5 5 0 1 0 13.5 5.5" strokeLinecap="round" />
      <path d="M13 3v3h-3" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  plus: <path d="M8 3v10M3 8h10" strokeLinecap="round" />,
  trash: (
    <>
      <path
        d="M3 5h10M6 5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1M5 5v7a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V5"
        strokeLinecap="round"
      />
      <path d="M7 8v3M9 8v3" strokeLinecap="round" />
    </>
  ),
  edit: (
    <>
      <path d="M10 3l2 2-7 7H3v-2l7-7z" strokeLinejoin="round" />
      <path d="M9 4l2 2" />
    </>
  ),
  copy: (
    <>
      <rect x="5" y="5" width="7" height="7" rx="1" />
      <path d="M5 9H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
    </>
  ),
  more: (
    <>
      <circle cx="4" cy="8" r="0.5" fill="currentColor" />
      <circle cx="8" cy="8" r="0.5" fill="currentColor" />
      <circle cx="12" cy="8" r="0.5" fill="currentColor" />
    </>
  ),
  x: <path d="M5 5l6 6M11 5l-6 6" strokeLinecap="round" />,
  check: <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />,
  minus: <path d="M4 8h8" strokeLinecap="round" />,
  square: <rect x="4" y="4" width="8" height="8" rx="1" />,
  link: (
    <>
      <path d="M7 9a3 3 0 0 0 4.24.24l1.5-1.5A3 3 0 0 0 10.5 4.5L9 6" strokeLinecap="round" />
      <path d="M9 7a3 3 0 0 0-4.24-.24l-1.5 1.5a3 3 0 0 0 2.24 4.24L7 11" strokeLinecap="round" />
    </>
  ),
  upload: (
    <>
      <path d="M8 10.5V3M5 6l3-3 3 3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 10.5V12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1.5" strokeLinecap="round" />
    </>
  ),
  download: (
    <>
      <path d="M8 3v7.5M5 8l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 10.5V12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1.5" strokeLinecap="round" />
    </>
  ),

  // 视图
  grid: (
    <>
      <rect x="3" y="3" width="4" height="4" rx="0.5" />
      <rect x="9" y="3" width="4" height="4" rx="0.5" />
      <rect x="3" y="9" width="4" height="4" rx="0.5" />
      <rect x="9" y="9" width="4" height="4" rx="0.5" />
    </>
  ),
  list: (
    <>
      <path d="M5 4h8M5 8h8M5 12h8" strokeLinecap="round" />
      <circle cx="3.5" cy="4" r="0.5" fill="currentColor" />
      <circle cx="3.5" cy="8" r="0.5" fill="currentColor" />
      <circle cx="3.5" cy="12" r="0.5" fill="currentColor" />
    </>
  ),
  eye: (
    <>
      <path d="M1.5 8C3 5.5 5.5 4 8 4s5 1.5 6.5 4C13 10.5 10.5 12 8 12S3 10.5 1.5 8z" strokeLinejoin="round" />
      <circle cx="8" cy="8" r="1.8" />
    </>
  ),
  code: (
    <>
      <path d="M6 5L2.5 8 6 11M10 5l3.5 3L10 11" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),

  // 媒体
  play: <path d="M5 3l8 5-8 5V3z" strokeLinejoin="round" />,
  pause: <path d="M5 3v10M11 3v10" strokeLinecap="round" />,
  rewind: (
    <>
      <path d="M8 4L4.5 8 8 12V4z" strokeLinejoin="round" />
      <path d="M12 4L8.5 8 12 12V4z" strokeLinejoin="round" />
    </>
  ),
  forward: (
    <>
      <path d="M8 4l3.5 4L8 12V4z" strokeLinejoin="round" />
      <path d="M4 4l3.5 4L4 12V4z" strokeLinejoin="round" />
    </>
  ),
  maximize: (
    <path
      d="M6 3H3v3M10 3h3v3M13 10v3h-3M3 10v3h3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  volume: (
    <>
      <path d="M8 4L5 6.5H3v3h2L8 12V4z" strokeLinejoin="round" />
      <path d="M10.5 6a2.5 2.5 0 0 1 0 4" strokeLinecap="round" />
    </>
  ),
  'volume-x': (
    <>
      <path d="M8 4L5 6.5H3v3h2L8 12V4z" strokeLinejoin="round" />
      <path d="M10.5 6.5l3 3M13.5 6.5l-3 3" strokeLinecap="round" />
    </>
  ),
  star: (
    <path
      d="M8 2l1.8 3.7 4.2.6-3 2.9.7 4.1L8 11.4 4.3 13.3 5 9.2 2 6.3l4.2-.6L8 2z"
      strokeLinejoin="round"
    />
  ),
  clock: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 5v3l2 1.5" strokeLinecap="round" />
    </>
  ),
  film: (
    <>
      <rect x="3" y="3" width="10" height="10" rx="1" />
      <path d="M5.5 3v10M10.5 3v10M3 6h2.5M3 10h2.5M10.5 6H13M10.5 10H13" />
    </>
  )
}

export function Icon({
  name,
  size = 15,
  strokeWidth = 1.5,
  className,
  style
}: IconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      className={className}
      style={style}
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  )
}
