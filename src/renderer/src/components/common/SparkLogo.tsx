/**
 * Spark 品牌 Logo（矢量）
 * 依据 resources/icon.png 的彩色烟花/火花绽放图案手绘：
 * 中心金色五角星 + 8 条彩虹辐射光带 + 粉色加号与紫、青两颗小星点缀。
 * 通过 size 控制尺寸，可安全用于侧边栏、标题栏等小尺寸场景。
 */

interface SparkLogoProps {
  size?: number
  className?: string
}

/** 单条光带路径（尖端朝上，底部汇聚于中心 50,52） */
const PETAL = 'M50 52 C45 36 42 18 50 7 C58 18 55 36 50 52 Z'

/** 8 条光带的颜色（近中心浅 -> 外端饱和）与旋转角度 */
const PETALS: Array<{ angle: number; from: string; to: string }> = [
  { angle: 0, from: '#ff8fab', to: '#ff2d55' }, // 上·粉红
  { angle: 45, from: '#ffc078', to: '#ff8c00' }, // 橙
  { angle: 90, from: '#ffe680', to: '#ffc400' }, // 右·黄
  { angle: 135, from: '#86efac', to: '#16a34a' }, // 绿
  { angle: 180, from: '#7ff0e0', to: '#06b6a4' }, // 下·青绿
  { angle: 225, from: '#93c5fd', to: '#2563eb' }, // 蓝
  { angle: 270, from: '#c4b5fd', to: '#7c3aed' }, // 左·紫
  { angle: 315, from: '#f9a8d4', to: '#db2777' } // 品红
]

export function SparkLogo({ size = 20, className }: SparkLogoProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="Spark"
    >
      <defs>
        {PETALS.map((p, i) => (
          <linearGradient key={i} id={`spark-petal-${i}`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={p.from} />
            <stop offset="100%" stopColor={p.to} />
          </linearGradient>
        ))}
        <linearGradient id="spark-star" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>

      {/* 辐射光带 */}
      {PETALS.map((p, i) => (
        <path
          key={i}
          d={PETAL}
          fill={`url(#spark-petal-${i})`}
          transform={`rotate(${p.angle} 50 50)`}
        />
      ))}

      {/* 中心金色五角星 */}
      <polygon
        points="50,41 52.23,46.93 58.56,47.22 53.61,51.17 55.29,57.28 50,53.8 44.71,57.28 46.39,51.17 41.44,47.22 47.77,46.93"
        fill="url(#spark-star)"
      />

      {/* 点缀：粉色加号 + 紫、青小星 */}
      <path
        d="M18 25 h8 M22 21 v8"
        stroke="#ec4899"
        strokeWidth={2.6}
        strokeLinecap="round"
      />
      <path
        d="M0 -5 C0.6 -1.4 1.4 -0.6 5 0 C1.4 0.6 0.6 1.4 0 5 C-0.6 1.4 -1.4 0.6 -5 0 C-1.4 -0.6 -0.6 -1.4 0 -5 Z"
        transform="translate(80 64)"
        fill="#8b5cf6"
      />
      <path
        d="M0 -4.4 C0.5 -1.2 1.2 -0.5 4.4 0 C1.2 0.5 0.5 1.2 0 4.4 C-0.5 1.2 -1.2 0.5 -4.4 0 C-1.2 -0.5 -0.5 -1.2 0 -4.4 Z"
        transform="translate(29 76)"
        fill="#06b6d4"
      />
    </svg>
  )
}
