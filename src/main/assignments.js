/**
 * assignments.js — scraper-output/assignments.json 읽기 전담
 * core.js에서만 호출됨.
 */

import fs from 'fs'
import path from 'path'
import { shell } from 'electron'

const ASSIGNMENTS_PATH = path.resolve('scraper-output', 'assignments.json')

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
    if (!byCourse.has(name)) byCourse.set(name, 0)
    byCourse.set(name, byCourse.get(name) + 1)
  }

  return Array.from(byCourse.entries())
    .map(([name, count]) => ({ name, count }))
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
