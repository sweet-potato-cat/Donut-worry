import { useState } from 'react'
import { BiSolidFolder } from 'react-icons/bi'
import { getSectorPath, getSectorCenter, getSectorIndexAtPoint } from '../Donut/donutMath'

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
const ALERT_STROKE_WIDTH = 3

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

// 창이 다시 보일 때 마우스가 이미 섹터 위에 있으면(움직이지 않아 mouseenter가
// 발생하지 않는 경우) 커서 위치로 직접 초기 호버 섹터를 계산
function getInitialHoverIndex(cursor, sectorCount) {
  if (!cursor || !sectorCount) return null
  const offsetX = (window.innerWidth - SIZE) / 2
  const offsetY = (window.innerHeight - SIZE) / 2
  return getSectorIndexAtPoint(
    cursor.x - offsetX,
    cursor.y - offsetY,
    CX,
    CY,
    INNER_R,
    OUTER_R,
    sectorCount
  )
}

export default function SubDonut({
  subjects,
  color,
  onHoverChange,
  initialCursor,
  centerIcon: CenterIcon,
  alerts
}) {
  // 초기 호버 상태를 렌더 중(동기)에 바로 부모에도 동기화한다. 이걸 useEffect로
  // 미루면, 창이 열리자마자 바로 단축키를 떼는 경우 subdonut:confirm이 그
  // effect보다 먼저 도착해 부모의 hoveredIndexRef가 아직 null인 채로 판정되어
  // (실제로는 섹터가 호버된 채 보이는데도) 그냥 창이 닫혀버리는 문제가 있었음
  const [hoveredIndex, setHoveredIndex] = useState(() => {
    const initial = getInitialHoverIndex(initialCursor, subjects.length)
    onHoverChange?.(initial)
    return initial
  })
  const sweep = 360 / subjects.length

  const handleHover = (index) => {
    setHoveredIndex(index)
    onHoverChange?.(index)
  }

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
        const hasAlert = Boolean(alerts?.[index])
        const path = getSectorPath(CX, CY, INNER_R, OUTER_R, startAngle, endAngle)
        const center = getSectorCenter(CX, CY, INNER_R, OUTER_R, startAngle, endAngle)
        const iconSize = isHovered ? 30 : 26

        return (
          <g
            key={index}
            onMouseEnter={() => handleHover(index)}
            onMouseLeave={() => handleHover(null)}
          >
            <path
              d={path}
              fill={color}
              style={{
                filter: isHovered ? 'brightness(1.1)' : 'none',
                transition: 'filter 0.15s ease'
              }}
            />
            {hasAlert && (
              <path
                d={path}
                fill="none"
                stroke="#fff"
                strokeWidth={ALERT_STROKE_WIDTH}
                style={{
                  filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.9))',
                  pointerEvents: 'none'
                }}
              />
            )}
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
