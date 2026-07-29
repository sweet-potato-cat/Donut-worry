/**
 * grading.js — scraper-output/grading-weights.json 읽기 전담
 * core.js에서만 호출됨.
 */

import fs from 'fs'
import path from 'path'
import { app } from 'electron'

// process.cwd() 기준 상대 경로였던 걸 courses.js와 같은 절대 경로 기준으로 맞춤
const GRADING_WEIGHTS_PATH = path.join(
  app.getPath('userData'),
  'scraper-output',
  'grading-weights.json'
)

function readGradingWeights() {
  if (!fs.existsSync(GRADING_WEIGHTS_PATH)) return []
  try {
    return JSON.parse(fs.readFileSync(GRADING_WEIGHTS_PATH, 'utf-8'))
  } catch {
    return []
  }
}

export function listGradingCourses() {
  return readGradingWeights()
    .filter((record) => record.weights?.length > 0)
    .map((record) => ({
      courseId: record.courseId,
      courseName: record.courseName,
      totalPercent: record.totalPercent,
      weights: record.weights.map((weight) => ({
        key: weight.key,
        label: weight.label,
        percent: weight.percent
      }))
    }))
    .sort((a, b) => a.courseName.localeCompare(b.courseName, 'ko'))
}
