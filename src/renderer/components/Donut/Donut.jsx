import { useState } from 'react'
import { BiBookAlt, BiSolidPencil, BiSolidCaretRightCircle, BiSolidMegaphone } from 'react-icons/bi'
import { getSectorPath, getSectorCenter } from './donutMath'

const SECTORS = [
  { index: 0, label: '강의자료', icon: BiBookAlt },
  { index: 1, label: '과제',    icon: BiSolidPencil },
  { index: 2, label: '동영상',  icon: BiSolidCaretRightCircle },
  { index: 3, label: '공지',    icon: BiSolidMegaphone },
]

const SIZE = 400
const CX = SIZE / 2
const CY = SIZE / 2
const OUTER_R = 185
const INNER_R = 52.5
const BASE_COLOR = '#fe748a'
const HOVER_COLOR = '#ff99b0'

export default function Donut({ onHoverChange }) {
  const [hoveredIndex, setHoveredIndex] = useState(null)

  const handleHover = (index) => {
    setHoveredIndex(index)
    onHoverChange?.(index)
  }

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
        const Icon = sector.icon
        const iconSize = isHovered ? 42 : 36

        return (
          <g
            key={sector.index}
            onMouseEnter={() => handleHover(sector.index)}
            onMouseLeave={() => handleHover(null)}
          >
            <path
              d={path}
              fill={isHovered ? HOVER_COLOR : BASE_COLOR}
              style={{ transition: 'fill 0.15s ease' }}
            />
            <Icon
              x={center.x - iconSize / 2}
              y={center.y - iconSize / 2}
              size={iconSize}
              color="#fff"
              style={{ transition: 'width 0.15s ease, height 0.15s ease', userSelect: 'none' }}
            />
          </g>
        )
      })}

      {/* 중앙 구멍 투명 */}
      <circle cx={CX} cy={CY} r={INNER_R} fill="transparent" />
    </svg>
  )
}
