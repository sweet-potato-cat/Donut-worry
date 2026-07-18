export function polarToXY(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

export function getSectorPath(cx, cy, innerR, outerR, startAngle, endAngle) {
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

export function getSectorCenter(cx, cy, innerR, outerR, startAngle, endAngle) {
  const midAngle = (startAngle + endAngle) / 2
  const midR = (innerR + outerR) / 2
  return polarToXY(cx, cy, midR, midAngle)
}

// 주어진 좌표(px, py)가 어느 섹터 위에 있는지 반환 (도넛 바깥/구멍 안이면 null)
export function getSectorIndexAtPoint(px, py, cx, cy, innerR, outerR, sectorCount) {
  const dx = px - cx
  const dy = py - cy
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist < innerR || dist > outerR) return null

  let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90
  angle = ((angle % 360) + 360) % 360

  const sectorSize = 360 / sectorCount
  return Math.floor(angle / sectorSize)
}
