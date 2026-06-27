import { useState } from 'react'

/**
 * 섹터 정의
 * index 0~3 순서: 강의자료, 과제, 동영상, 공지
 */
const SECTORS = [
  { index: 0, label: '강의자료', icon: '📚', color: '#fe748a' },
  { index: 1, label: '과제',    icon: '📝', color: '#ff9eb5' },
  { index: 2, label: '동영상',  icon: '🎬', color: '#ffb3c6' },
  { index: 3, label: '공지',    icon: '📢', color: '#ffc8d8' },
]

const SIZE = 300        // SVG 전체 크기
const CX = SIZE / 2     // 중심 x
const CY = SIZE / 2     // 중심 y
const OUTER_R = 130     // 바깥 반지름
const INNER_R = 55      // 안쪽 반지름 (도넛 구멍)

/**
 * 각도(도) → SVG 좌표 변환
 */
function polarToXY(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  }
}

/**
 * 섹터 SVG path 생성
 * 4분할이므로 각 섹터는 90도
 */
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

/**
 * 섹터 중심 좌표 (아이콘 배치용)
 */
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
      style={{ filter: 'drop-shadow(0 4px 24px rgba(254,116,138,0.35))' }}
    >
      {SECTORS.map((sector) => {
        const startAngle = sector.index * 90
        const endAngle = startAngle + 90
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
              fill={isHovered ? '#ffffff' : sector.color}
              stroke="#fff"
              strokeWidth={3}
              style={{ transition: 'fill 0.15s ease' }}
            />
            {/* 아이콘 */}
            <text
              x={center.x}
              y={center.y - 8}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={isHovered ? 30 : 26}
              style={{ transition: 'font-size 0.15s ease', userSelect: 'none' }}
            >
              {sector.icon}
            </text>
            {/* 라벨 */}
            <text
              x={center.x}
              y={center.y + 20}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={11}
              fill={isHovered ? '#fe748a' : '#fff'}
              fontWeight="600"
              style={{ transition: 'fill 0.15s ease', userSelect: 'none' }}
            >
              {sector.label}
            </text>
          </g>
        )
      })}

      {/* 중앙 원 (도넛 구멍) */}
      <circle cx={CX} cy={CY} r={INNER_R} fill="white" opacity={0.92} />
      <text
        x={CX}
        y={CY - 8}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={22}
      >
        🍩
      </text>
      <text
        x={CX}
        y={CY + 16}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={11}
        fill="#fe748a"
        fontWeight="700"
      >
        Donut
      </text>
    </svg>
  )
}
