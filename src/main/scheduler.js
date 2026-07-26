/**
 * scheduler.js — 시간표 기반 자동 새로고침
 * 등록된 시간표 항목의 시작 시각 10분 전에 courses.startSync()를 1회 호출.
 * core.js를 거치지 않고 index.js에서 앱 시작 시 직접 구동/정리됨.
 */

import { listTimetable } from './settings.js'
import { startSync } from './courses.js'

const CHECK_INTERVAL_MS = 30_000
const LEAD_MS = 10 * 60 * 1000

let timer = null
const triggered = new Set()

// entry.day는 Date.getDay()와 동일한 규칙(0=일 ~ 6=토)
function todaysOccurrence(entry, now) {
  if (entry.day !== now.getDay()) return null
  const [hh, mm] = String(entry.time ?? '')
    .split(':')
    .map(Number)
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null
  const occurrence = new Date(now)
  occurrence.setHours(hh, mm, 0, 0)
  return occurrence
}

function tick() {
  const now = new Date()

  for (const entry of listTimetable()) {
    const occurrence = todaysOccurrence(entry, now)
    if (!occurrence) continue

    const diff = occurrence.getTime() - now.getTime()
    if (diff <= 0 || diff > LEAD_MS) continue

    const key = `${entry.id}:${occurrence.toDateString()}`
    if (triggered.has(key)) continue

    triggered.add(key)
    startSync()
  }

  if (triggered.size > 200) triggered.clear()
}

export function startScheduler() {
  if (timer) return
  timer = setInterval(tick, CHECK_INTERVAL_MS)
}

export function stopScheduler() {
  if (timer) clearInterval(timer)
  timer = null
}
