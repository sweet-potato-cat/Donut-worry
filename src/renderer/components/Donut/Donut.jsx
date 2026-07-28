import { useState } from 'react'
import { BiBookAlt, BiSolidPencil, BiSolidCaretRightCircle, BiSolidMegaphone } from 'react-icons/bi'
import { getSectorPath, getSectorCenter, getSectorIndexAtPoint } from './donutMath'

const SECTORS = [
  { index: 0, label: '강의자료', icon: BiBookAlt },
  { index: 1, label: '과제', icon: BiSolidPencil },
  { index: 2, label: '동영상', icon: BiSolidCaretRightCircle },
  { index: 3, label: '공지', icon: BiSolidMegaphone }
]

const SIZE = 400
const CX = SIZE / 2
const CY = SIZE / 2
const OUTER_R = 185
const INNER_R = 52.5
const BASE_COLOR = '#fe748a'
const HOVER_COLOR = '#ff99b0'
const CENTER_ICON_SIZE = 40

// 창이 다시 보일 때 마우스가 이미 섹터 위에 있으면(움직이지 않아 mouseenter가
// 발생하지 않는 경우) 커서 위치로 직접 초기 호버 섹터를 계산
function getInitialHoverIndex(cursor) {
  if (!cursor) return null
  const offsetX = (window.innerWidth - SIZE) / 2
  const offsetY = (window.innerHeight - SIZE) / 2
  return getSectorIndexAtPoint(
    cursor.x - offsetX,
    cursor.y - offsetY,
    CX,
    CY,
    INNER_R,
    OUTER_R,
    SECTORS.length
  )
}

export default function Donut({ onHoverChange, initialCursor }) {
  // 초기 호버 상태를 렌더 중(동기)에 바로 부모(App)에도 동기화한다. 이걸
  // useEffect로 미루면, 창이 열리자마자 바로 단축키를 떼는 경우 main:confirm이
  // 그 effect보다 먼저 도착해 부모의 호버 상태가 아직 반영 안 된 채로 판정될 수 있음
  const [hoveredIndex, setHoveredIndex] = useState(() => {
    const initial = getInitialHoverIndex(initialCursor)
    onHoverChange?.(initial)
    return initial
  })
  const HoveredIcon = hoveredIndex !== null ? SECTORS[hoveredIndex].icon : null

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

      {HoveredIcon && (
        <HoveredIcon
          x={CX - CENTER_ICON_SIZE / 2}
          y={CY - CENTER_ICON_SIZE / 2}
          size={CENTER_ICON_SIZE}
          color={BASE_COLOR}
          style={{ pointerEvents: 'none' }}
        />
      )}
    </svg>
  )
}
