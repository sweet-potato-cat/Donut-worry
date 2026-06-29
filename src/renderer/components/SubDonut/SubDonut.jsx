import { useState } from 'react'
import { BiSolidFolder } from 'react-icons/bi'
import { getSectorPath, getSectorCenter } from '../Donut/donutMath'

const SIZE = 400
const CX = SIZE / 2
const CY = SIZE / 2
const OUTER_R = 185
const INNER_R = 52.5
const LABEL_COLOR = '#3a3a3a'

export default function SubDonut({ subjects, color, onSelect }) {
  const [hoveredIndex, setHoveredIndex] = useState(null)
  const sweep = 360 / subjects.length

  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      style={{ filter: `drop-shadow(0 8px 32px ${color}80)` }}
    >
      {subjects.map((label, index) => {
        const startAngle = index * sweep
        const endAngle = startAngle + sweep - 0.5
        const isHovered = hoveredIndex === index
        const path = getSectorPath(CX, CY, INNER_R, OUTER_R, startAngle, endAngle)
        const center = getSectorCenter(CX, CY, INNER_R, OUTER_R, startAngle, endAngle)
        const iconSize = isHovered ? 30 : 26

        return (
          <g
            key={index}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            onClick={() => onSelect?.(index)}
            style={{ cursor: 'pointer' }}
          >
            <path
              d={path}
              fill={color}
              style={{ filter: isHovered ? 'brightness(1.1)' : 'none', transition: 'filter 0.15s ease' }}
            />
            <BiSolidFolder
              x={center.x - iconSize / 2}
              y={center.y - iconSize - 4}
              size={iconSize}
              color="#fff"
              style={{ transition: 'width 0.15s ease, height 0.15s ease' }}
            />
            <text
              x={center.x}
              y={center.y + iconSize / 2 + 6}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={14}
              fontWeight={700}
              fill={LABEL_COLOR}
              style={{ userSelect: 'none' }}
            >
              {label}
            </text>
          </g>
        )
      })}

      {/* 중앙 구멍 투명 */}
      <circle cx={CX} cy={CY} r={INNER_R} fill="transparent" />
    </svg>
  )
}
