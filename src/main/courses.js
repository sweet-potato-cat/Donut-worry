import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { shell, BrowserWindow } from 'electron'
import { getDecryptedCredentials } from './credentials.js'

const COURSES_ROOT = path.resolve('scraper-output', 'courses')
const PROJECT_ROOT = process.cwd()
const NPM_BIN = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const SYNC_TIMEOUT_MS = 10 * 60 * 1000
const SNAPSHOT_JSON_FILES = [
  'assignments.json',
  'unsubmitted-assignments.json',
  'notices.json',
  'weekly-learning-videos.json',
  'weekly-learning-incomplete-videos.json',
  'weekly-learning-material-items.json',
  'weekly-learning-downloaded-materials.json'
]

let syncChild = null
let syncTimeout = null
let syncState = { running: false, lastResult: null, lastError: null, lastRunAt: null }
const syncListeners = new Set()

function isInsideCoursesRoot(target) {
  const rel = path.relative(COURSES_ROOT, target)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

function broadcastSyncEvent(event) {
  syncListeners.forEach((listener) => listener(event))

  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('course:syncEvent', event)
  }
}

function clearSyncTimeout() {
  if (syncTimeout) {
    clearTimeout(syncTimeout)
    syncTimeout = null
  }
}

function createSyncSnapshot() {
  return {
    courseFiles: listCourseFileKeys(),
    jsonCounts: Object.fromEntries(
      SNAPSHOT_JSON_FILES.map((fileName) => [fileName, readJsonItemCount(fileName)])
    )
  }
}

function listCourseFileKeys() {
  if (!fs.existsSync(COURSES_ROOT)) return []

  const keys = []
  const courseNames = fs
    .readdirSync(COURSES_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)

  for (const courseName of courseNames) {
    const courseDir = path.join(COURSES_ROOT, courseName)
    const fileNames = fs
      .readdirSync(courseDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && !entry.name.startsWith('.'))
      .map((entry) => entry.name)

    keys.push(...fileNames.map((fileName) => path.join(courseName, fileName)))
  }

  return keys.sort()
}

function readJsonItemCount(fileName) {
  const filePath = path.join('scraper-output', fileName)

  try {
    const value = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    return Array.isArray(value) ? value.length : 0
  } catch {
    return 0
  }
}

function hasSyncSnapshotChanged(before, after) {
  return (
    before.courseFiles.join('\n') !== after.courseFiles.join('\n') ||
    SNAPSHOT_JSON_FILES.some(
      (fileName) => before.jsonCounts[fileName] !== after.jsonCounts[fileName]
    )
  )
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
        .filter((file) => file.isFile() && !file.name.startsWith('.')).length

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
    throw new Error('Invalid course file path')
  }

  const result = await shell.openPath(resolved)

  if (result) throw new Error(result)
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

  const beforeSnapshot = createSyncSnapshot()
  syncState = { running: true, lastResult: null, lastError: null, lastRunAt: Date.now() }
  broadcastSyncEvent({ type: 'start' })

  let timedOut = false

  const credentials = getDecryptedCredentials()
  const env = credentials
    ? { ...process.env, KHU_LOGIN_ID: credentials.id, KHU_LOGIN_PASSWORD: credentials.password }
    : process.env

  syncChild = spawn(NPM_BIN, ['run', 'scrape:download', '--', '--headless'], {
    cwd: PROJECT_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    env
  })

  syncTimeout = setTimeout(() => {
    timedOut = true
    syncChild?.kill()
  }, SYNC_TIMEOUT_MS)

  syncChild.stdout?.on('data', (chunk) => {
    console.log(`[course:sync] ${chunk.toString().trimEnd()}`)
  })

  syncChild.stderr?.on('data', (chunk) => {
    console.error(`[course:sync] ${chunk.toString().trimEnd()}`)
  })

  syncChild.on('error', (err) => {
    clearSyncTimeout()
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
    clearSyncTimeout()
    syncChild = null

    const success = code === 0 && !timedOut
    const changed = success ? hasSyncSnapshotChanged(beforeSnapshot, createSyncSnapshot()) : false
    const message = changed ? '새로고침 완료' : '새로 가져올 내용이 없습니다'

    syncState = {
      running: false,
      lastResult: success ? 'success' : 'error',
      lastError: success
        ? null
        : timedOut
          ? '새로고침 시간이 너무 오래 걸려 중단했습니다'
          : `스크래퍼가 종료 코드 ${code}로 실패했습니다`,
      lastRunAt: syncState.lastRunAt
    }
    broadcastSyncEvent({ type: 'done', success, changed, message, error: syncState.lastError })
  })

  return { ...syncState }
}

export function stopSync() {
  clearSyncTimeout()
  syncChild?.kill()
}
