import { useState } from 'react'

const SECTORS = [
  { index: 0, label: '강의자료', icon: '📚' },
  { index: 1, label: '과제',    icon: '📝' },
  { index: 2, label: '동영상',  icon: '🎬' },
  { index: 3, label: '공지',    icon: '📢' },
]

const SIZE = 400
const CX = SIZE / 2
const CY = SIZE / 2
const OUTER_R = 185
const INNER_R = 75
const BASE_COLOR = '#fe748a'
const HOVER_COLOR = '#ff99b0'

function polarToXY(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function getSectorPath(cx, cy, innerR, outerR, startAngle, endAngle) {
  const o1 = polarToXY(cx, cy, outerR, startAngle)
  const o2 = polarToXY(cx, cy, outerR, endAngle)
  const i1 = polarToXY(cx, cy, innerR, endAngle)
  const i2 = polarToXY(cx, cy, innerR, startAngle)
  return [
    `M ${o1.x} ${o1.y}`,
    `A ${outerR} ${outerR} 0 0 1 ${o2.x} ${o2.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${innerR} ${innerR} 0 0 0 ${i2.x} ${i2.y}`,
    'Z',
  ].join(' ')
}

function getSectorCenter(cx, cy, innerR, outerR, startAngle, endAngle) {
  const midAngle = (startAngle + endAngle) / 2
  const midR = (innerR + outerR) / 2
  return polarToXY(cx, cy, midR, midAngle)
}

export default function Donut({ onSelect }) {
  const [hoveredIndex, setHoveredIndex] = useState(null)

  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      style={{ filter: 'drop-shadow(0 8px 32px rgba(254,116,138,0.5))' }}
    >
      {SECTORS.map((sector) => {
        const startAngle = sector.index * 90
        const endAngle = startAngle + 89.5
        const isHovered = hoveredIndex === sector.index
        const path = getSectorPath(CX, CY, INNER_R, OUTER_R, startAngle, endAngle)
        const center = getSectorCenter(CX, CY, INNER_R, OUTER_R, startAngle, endAngle)

        return (
          <g
            key={sector.index}
            onMouseEnter={() => setHoveredIndex(sector.index)}
            onMouseLeave={() => setHoveredIndex(null)}
            onClick={() => onSelect?.(sector.index)}
            style={{ cursor: 'pointer' }}
          >
            <path
              d={path}
              fill={isHovered ? HOVER_COLOR : BASE_COLOR}
              style={{ transition: 'fill 0.15s ease' }}
            />
            <text
              x={center.x}
              y={center.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={isHovered ? 42 : 36}
              style={{ transition: 'font-size 0.15s ease', userSelect: 'none' }}
            >
              {sector.icon}
            </text>
          </g>
        )
      })}

      {/* 중앙 구멍 투명 */}
      <circle cx={CX} cy={CY} r={INNER_R} fill="transparent" />
    </svg>
  )
}
