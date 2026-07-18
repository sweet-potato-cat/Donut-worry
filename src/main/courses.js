/**
 * courses.js — 다운로드된 강의자료(scraper-output/courses) 파일시스템 접근 전담
 * core.js에서만 호출됨.
 */

import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { shell, BrowserWindow } from 'electron'

const COURSES_ROOT = path.resolve('scraper-output', 'courses')
const PROJECT_ROOT = process.cwd()
const NPM_BIN = process.platform === 'win32' ? 'npm.cmd' : 'npm'

function isInsideCoursesRoot(target) {
  const rel = path.relative(COURSES_ROOT, target)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

export function listCourses() {
  if (!fs.existsSync(COURSES_ROOT)) return []

  return fs
    .readdirSync(COURSES_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => {
      const dir = path.join(COURSES_ROOT, entry.name)
      const fileCount = fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((f) => f.isFile() && !f.name.startsWith('.')).length
      return { name: entry.name, fileCount }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
}

export function listCourseFiles(courseName) {
  const dir = path.join(COURSES_ROOT, courseName)
  if (!isInsideCoursesRoot(dir) || !fs.existsSync(dir)) return []

  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.name.startsWith('.'))
    .map((entry) => ({ name: entry.name, path: path.join(dir, entry.name) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
}

export async function openCourseFile(filePath) {
  const resolved = path.resolve(filePath)
  if (!isInsideCoursesRoot(resolved) || !fs.existsSync(resolved)) {
    throw new Error('잘못된 파일 경로입니다')
  }

  const result = await shell.openPath(resolved)
  if (result) throw new Error(result)
}

// ── 강의자료 새로고침 (npm run scrape:download) ──────────────
// scrape:download는 e-campus에 접속해 새/변경된 강의자료를 scraper-output/courses/에
// 내려받는 스크립트로, 세션 만료 시 별도로 뜨는 브라우저 창에서 수동 로그인이 필요할 수 있음

let syncChild = null
let syncState = { running: false, lastResult: null, lastError: null, lastRunAt: null }
const syncListeners = new Set()

function broadcastSyncEvent(event) {
  syncListeners.forEach((listener) => listener(event))
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('course:syncEvent', event)
  }
}

export function getSyncState() {
  return { ...syncState }
}

export function onSyncEvent(listener) {
  syncListeners.add(listener)
  return () => syncListeners.delete(listener)
}

export function startSync() {
  if (syncState.running) return { ...syncState }

  syncState = { running: true, lastResult: null, lastError: null, lastRunAt: Date.now() }
  broadcastSyncEvent({ type: 'start' })

  // 세션이 살아있으면 창 없이 조용히 실행되고, 만료된 경우에만 로그인 창이 자동으로 뜸
  syncChild = spawn(NPM_BIN, ['run', 'scrape:download', '--', '--headless'], { cwd: PROJECT_ROOT })

  syncChild.on('error', (err) => {
    syncChild = null
    syncState = {
      running: false,
      lastResult: 'error',
      lastError: err.message,
      lastRunAt: syncState.lastRunAt
    }
    broadcastSyncEvent({ type: 'done', success: false, error: err.message })
  })

  syncChild.on('close', (code) => {
    syncChild = null
    syncState = {
      running: false,
      lastResult: code === 0 ? 'success' : 'error',
      lastError: code === 0 ? null : `스크래퍼가 종료 코드 ${code}로 실패했습니다`,
      lastRunAt: syncState.lastRunAt
    }
    broadcastSyncEvent({ type: 'done', success: code === 0, error: syncState.lastError })
  })

  return { ...syncState }
}

export function stopSync() {
  if (syncChild) syncChild.kill()
}
