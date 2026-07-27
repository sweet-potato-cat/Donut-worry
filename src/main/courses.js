import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { app, shell, BrowserWindow } from 'electron'

const COURSES_ROOT = path.resolve('scraper-output', 'courses')
const PROJECT_ROOT = process.cwd()
const NPM_BIN = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const SYNC_TIMEOUT_MS = 10 * 60 * 1000
const PLAYWRIGHT_USER_DATA_DIR = path.join(app.getPath('userData'), 'playwright-user-data')
const COURSE_NAME_SOURCE_FILES = [
  'weekly-learning-material-items.json',
  'weekly-learning-downloaded-materials.json',
  'weekly-learning-videos.json',
  'weekly-learning-incomplete-videos.json',
  'assignments.json',
  'unsubmitted-assignments.json',
  'notices.json'
]
const SYNC_SCOPES = {
  all: {
    label: '전체',
    snapshotFiles: [
      'assignments.json',
      'unsubmitted-assignments.json',
      'notices.json',
      'weekly-learning-videos.json',
      'weekly-learning-incomplete-videos.json',
      'weekly-learning-material-items.json',
      'weekly-learning-downloaded-materials.json'
    ],
    scraperArgs: ['--headless', '--skip-grading'],
    includeCourseFiles: true
  },
  lectures: {
    label: '강의자료',
    snapshotFiles: ['weekly-learning-material-items.json', 'weekly-learning-downloaded-materials.json'],
    scraperArgs: ['--headless', '--skip-grading', '--materials-only', '--download'],
    includeCourseFiles: true
  },
  assignments: {
    label: '과제',
    snapshotFiles: ['assignments.json', 'unsubmitted-assignments.json'],
    scraperArgs: ['--headless', '--assignments-only'],
    includeCourseFiles: false
  },
  notices: {
    label: '공지',
    snapshotFiles: ['notices.json'],
    scraperArgs: ['--headless', '--notices-only'],
    includeCourseFiles: false
  },
  videos: {
    label: '동영상',
    snapshotFiles: ['weekly-learning-videos.json', 'weekly-learning-incomplete-videos.json'],
    scraperArgs: ['--headless', '--skip-grading', '--videos-only'],
    includeCourseFiles: false
  }
}
let syncChild = null
let syncTimeout = null
let syncState = { running: false, lastResult: null, lastError: null, lastRunAt: null }
const syncListeners = new Set()

function ensureSyncStateConsistent() {
  if (syncState.running && !syncChild) {
    syncState = {
      running: false,
      lastResult: 'error',
      lastError: '새로고침 프로세스가 종료되어 상태를 복구했습니다',
      lastRunAt: syncState.lastRunAt,
      scope: syncState.scope ?? 'all',
      courseName: syncState.courseName ?? ''
    }
  }
}

function getSyncScope(scope) {
  return SYNC_SCOPES[scope] ? scope : 'all'
}

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

function createSyncSnapshot(scope = 'all', courseName = '') {
  const syncScope = SYNC_SCOPES[getSyncScope(scope)]

  return {
    courseFiles: syncScope.includeCourseFiles ? listCourseFileKeys(courseName) : [],
    jsonCounts: Object.fromEntries(
      syncScope.snapshotFiles.map((fileName) => [fileName, readJsonItemCount(fileName, courseName)])
    )
  }
}

function listCourseFileKeys(courseNameFilter = '') {
  if (!fs.existsSync(COURSES_ROOT)) return []

  const keys = []
  const courseNames = fs
    .readdirSync(COURSES_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .filter((courseName) => !courseNameFilter || courseName === courseNameFilter)

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

function sanitizeCourseName(value) {
  return String(value ?? '')
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
}

function readJsonArray(fileName) {
  const filePath = path.join('scraper-output', fileName)

  try {
    const value = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function courseNameMatches(itemCourseName, courseNameFilter = '') {
  if (!courseNameFilter) return true

  const normalizedFilter = String(courseNameFilter).trim()
  const normalizedCourseName = String(itemCourseName ?? '').trim()

  return (
    normalizedCourseName === normalizedFilter ||
    sanitizeCourseName(normalizedCourseName) === normalizedFilter
  )
}

function readJsonItemCount(fileName, courseNameFilter = '') {
  const value = readJsonArray(fileName)
  if (!courseNameFilter) return value.length
  return value.filter((item) => courseNameMatches(item.courseName, courseNameFilter)).length
}

function hasSyncSnapshotChanged(before, after, scope = 'all') {
  const syncScope = SYNC_SCOPES[getSyncScope(scope)]

  return (
    before.courseFiles.join('\n') !== after.courseFiles.join('\n') ||
    syncScope.snapshotFiles.some(
      (fileName) => before.jsonCounts[fileName] !== after.jsonCounts[fileName]
    )
  )
}

function createNpmRunCommand(scriptName, scriptArgs) {
  const npmArgs = ['run', scriptName, '--', ...scriptArgs]

  if (process.platform === 'win32') {
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', NPM_BIN, ...npmArgs]
    }
  }

  return {
    command: NPM_BIN,
    args: npmArgs
  }
}

function resolveScraperCourseName(courseName) {
  const normalizedCourseName = String(courseName ?? '').trim()
  if (!normalizedCourseName) return ''

  for (const fileName of COURSE_NAME_SOURCE_FILES) {
    const match = readJsonArray(fileName).find((item) =>
      courseNameMatches(item.courseName, normalizedCourseName)
    )

    if (match?.courseName) return String(match.courseName).trim()
  }

  return normalizedCourseName
}

function createScraperArgs(scope, courseName) {
  const args = [...SYNC_SCOPES[scope].scraperArgs]
  const trimmedCourseName = resolveScraperCourseName(courseName)

  if (trimmedCourseName) {
    args.push(`--course=${trimmedCourseName}`)
  }

  return args
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
  ensureSyncStateConsistent()
  return { ...syncState }
}

export function onSyncEvent(listener) {
  syncListeners.add(listener)
  return () => syncListeners.delete(listener)
}

export function startSync(scope = 'all', courseName = '') {
  ensureSyncStateConsistent()
  if (syncState.running) return { ...syncState }

  const syncScopeName = getSyncScope(scope)
  const syncScope = SYNC_SCOPES[syncScopeName]
  const syncCourseName = String(courseName ?? '').trim()
  const beforeSnapshot = createSyncSnapshot(syncScopeName, syncCourseName)
  syncState = {
    running: true,
    lastResult: null,
    lastError: null,
    lastRunAt: Date.now(),
    scope: syncScopeName,
    courseName: syncCourseName
  }
  broadcastSyncEvent({ type: 'start', scope: syncScopeName, courseName: syncCourseName })

  let timedOut = false
  const { command, args } = createNpmRunCommand(
    'scrape:download',
    createScraperArgs(syncScopeName, syncCourseName)
  )

  try {
    syncChild = spawn(command, args, {
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        DONUT_PLAYWRIGHT_USER_DATA_DIR: PLAYWRIGHT_USER_DATA_DIR
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    })
  } catch (err) {
    syncState = {
      running: false,
      lastResult: 'error',
      lastError: err.message,
      lastRunAt: syncState.lastRunAt,
      scope: syncScopeName,
      courseName: syncCourseName
    }
    broadcastSyncEvent({
      type: 'done',
      success: false,
      error: err.message,
      scope: syncScopeName,
      courseName: syncCourseName
    })
    return { ...syncState }
  }

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
      lastRunAt: syncState.lastRunAt,
      scope: syncScopeName,
      courseName: syncCourseName
    }
    broadcastSyncEvent({
      type: 'done',
      success: false,
      error: err.message,
      scope: syncScopeName,
      courseName: syncCourseName
    })
  })

  syncChild.on('close', (code) => {
    clearSyncTimeout()
    syncChild = null

    const success = code === 0 && !timedOut
    const changed = success
      ? hasSyncSnapshotChanged(
          beforeSnapshot,
          createSyncSnapshot(syncScopeName, syncCourseName),
          syncScopeName
        )
      : false
    const targetLabel = syncCourseName ? `${syncCourseName} ${syncScope.label}` : syncScope.label
    const message = changed
      ? `${targetLabel} 새로고침 완료`
      : `${targetLabel}에 새로 가져올 내용이 없습니다`

    syncState = {
      running: false,
      lastResult: success ? 'success' : 'error',
      lastError: success
        ? null
        : timedOut
          ? '새로고침 시간이 너무 오래 걸려 중단했습니다'
          : `스크래퍼가 종료 코드 ${code}로 실패했습니다`,
      lastRunAt: syncState.lastRunAt,
      scope: syncScopeName,
      courseName: syncCourseName
    }
    broadcastSyncEvent({
      type: 'done',
      success,
      changed,
      message,
      error: syncState.lastError,
      scope: syncScopeName,
      courseName: syncCourseName
    })
  })

  return { ...syncState }
}

export function stopSync() {
  clearSyncTimeout()
  syncChild?.kill()
  syncChild = null
  syncState = {
    running: false,
    lastResult: 'error',
    lastError: '새로고침이 중단되었습니다',
    lastRunAt: syncState.lastRunAt,
    scope: syncState.scope ?? 'all',
    courseName: syncState.courseName ?? ''
  }
  broadcastSyncEvent({
    type: 'done',
    success: false,
    error: syncState.lastError,
    scope: syncState.scope,
    courseName: syncState.courseName
  })
}
