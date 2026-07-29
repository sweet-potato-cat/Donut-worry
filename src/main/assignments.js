/**
 * assignments.js — scraper-output/assignments.json 읽기 전담
 * core.js에서만 호출됨.
 */

import fs from 'fs'
import path from 'path'
import { app, shell } from 'electron'

// process.cwd() 기준 상대 경로였던 걸 courses.js와 같은 절대 경로 기준으로
// 맞춤(cwd는 앱이 어디서 실행됐느냐에 따라 달라져 패키징된 앱에서는 전혀 다른
// 곳을 가리킬 수 있음 — 실제로 이 파일들은 courses.js가 쓰는 위치와 달랐다)
const ASSIGNMENTS_PATH = path.join(app.getPath('userData'), 'scraper-output', 'assignments.json')

function readAssignments() {
  if (!fs.existsSync(ASSIGNMENTS_PATH)) return []
  try {
    return JSON.parse(fs.readFileSync(ASSIGNMENTS_PATH, 'utf-8'))
  } catch {
    return []
  }
}

export function listAssignmentCourses() {
  const assignments = readAssignments()
  const byCourse = new Map()

  for (const item of assignments) {
    const name = item.courseName ?? '기타'
    if (!byCourse.has(name)) byCourse.set(name, { count: 0, pending: 0 })
    const entry = byCourse.get(name)
    entry.count += 1
    if (item.isUnsubmitted || item.missing) entry.pending += 1
  }

  return Array.from(byCourse.entries())
    .map(([name, { count, pending }]) => ({ name, count, pending }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
}

export function listAssignmentsForCourse(courseName) {
  return readAssignments()
    .filter((item) => (item.courseName ?? '기타') === courseName)
    .sort((a, b) => {
      const aTime = a.dueAt ? Date.parse(a.dueAt) : Number.POSITIVE_INFINITY
      const bTime = b.dueAt ? Date.parse(b.dueAt) : Number.POSITIVE_INFINITY
      return aTime - bTime
    })
}

export async function openAssignment(url) {
  if (!url) return
  await shell.openExternal(url)
}
