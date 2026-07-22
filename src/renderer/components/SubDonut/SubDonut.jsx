import { useState } from 'react'
import { BiSolidFolder } from 'react-icons/bi'
import { getSectorPath, getSectorCenter } from '../Donut/donutMath'

const SIZE = 400
const CX = SIZE / 2
const CY = SIZE / 2
const OUTER_R = 185
const INNER_R = 52.5
const LABEL_COLOR = '#3a3a3a'
const LABEL_FONT_SIZE = 11
const LABEL_LINE_HEIGHT = 12
const LABEL_MAX_CHARS = 6
const LABEL_MAX_LINES = 3
const CENTER_ICON_SIZE = 40

// 좁은 섹터 안에 들어가도록 라벨을 여러 줄로 나누고, 넘치면 말줄임표로 축약
function wrapLabel(text, maxChars = LABEL_MAX_CHARS, maxLines = LABEL_MAX_LINES) {
  const words = String(text).split(' ')
  const lines = []
  let current = ''

  const flush = () => {
    if (current) lines.push(current)
    current = ''
  }

  for (const word of words) {
    let rest = word
    while (rest.length > maxChars) {
      flush()
      lines.push(rest.slice(0, maxChars))
      rest = rest.slice(maxChars)
    }
    if (!current) {
      current = rest
    } else if ((current + ' ' + rest).length <= maxChars) {
      current = current + ' ' + rest
    } else {
      flush()
      current = rest
    }
  }
  flush()

  if (lines.length <= maxLines) return lines

  const truncated = lines.slice(0, maxLines)
  const last = truncated[maxLines - 1]
  truncated[maxLines - 1] = last.length >= maxChars ? last.slice(0, maxChars - 1) + '…' : last + '…'
  return truncated
}

export default function SubDonut({ subjects, color, onSelect, centerIcon: CenterIcon }) {
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
              style={{
                filter: isHovered ? 'brightness(1.1)' : 'none',
                transition: 'filter 0.15s ease'
              }}
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
              dominantBaseline="hanging"
              fontSize={LABEL_FONT_SIZE}
              fontWeight={700}
              fill={LABEL_COLOR}
              style={{ userSelect: 'none' }}
            >
              {wrapLabel(label).map((line, lineIndex) => (
                <tspan key={lineIndex} x={center.x} dy={lineIndex === 0 ? 0 : LABEL_LINE_HEIGHT}>
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        )
      })}

      {/* 중앙 구멍 투명 */}
      <circle cx={CX} cy={CY} r={INNER_R} fill="transparent" />

      {CenterIcon && (
        <CenterIcon
          x={CX - CENTER_ICON_SIZE / 2}
          y={CY - CENTER_ICON_SIZE / 2}
          size={CENTER_ICON_SIZE}
          color={color}
          style={{ pointerEvents: 'none' }}
        />
      )}
    </svg>
  )
}
