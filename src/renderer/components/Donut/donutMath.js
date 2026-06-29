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
