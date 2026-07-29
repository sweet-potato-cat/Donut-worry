/**
 * videos.js — scraper-output/weekly-learning-videos.json 읽기 전담
 * core.js에서만 호출됨.
 */

import fs from 'fs'
import path from 'path'
import { app, shell } from 'electron'

// process.cwd() 기준 상대 경로였던 걸 courses.js와 같은 절대 경로 기준으로 맞춤
const VIDEOS_PATH = path.join(
  app.getPath('userData'),
  'scraper-output',
  'weekly-learning-videos.json'
)

function readVideos() {
  if (!fs.existsSync(VIDEOS_PATH)) return []
  try {
    return JSON.parse(fs.readFileSync(VIDEOS_PATH, 'utf-8'))
  } catch {
    return []
  }
}

export function listVideoCourses() {
  const videos = readVideos()
  const byCourse = new Map()

  for (const item of videos) {
    const name = item.courseName ?? '기타'
    if (!byCourse.has(name)) byCourse.set(name, { total: 0, incomplete: 0 })
    const entry = byCourse.get(name)
    entry.total += 1
    if (!item.isCompleted) entry.incomplete += 1
  }

  return Array.from(byCourse.entries())
    .map(([name, { total, incomplete }]) => ({ name, total, incomplete }))
    .sort((a, b) => {
      const incompleteDiff = Number(b.incomplete > 0) - Number(a.incomplete > 0)
      if (incompleteDiff !== 0) return incompleteDiff
      return a.name.localeCompare(b.name, 'ko')
    })
}

function parseFirstNumber(value) {
  const match = String(value ?? '').match(/\d+/)
  return match ? Number(match[0]) : Number.POSITIVE_INFINITY
}

export function listVideosForCourse(courseName) {
  return readVideos()
    .filter((item) => (item.courseName ?? '기타') === courseName)
    .sort((a, b) => {
      const completedDiff = Number(!!a.isCompleted) - Number(!!b.isCompleted)
      if (completedDiff !== 0) return completedDiff
      const weekDiff = parseFirstNumber(a.week) - parseFirstNumber(b.week)
      if (weekDiff !== 0) return weekDiff
      return parseFirstNumber(a.lesson) - parseFirstNumber(b.lesson)
    })
}

export async function openVideo(url) {
  if (!url) return
  await shell.openExternal(url)
}
