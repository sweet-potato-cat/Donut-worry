import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { app, shell, BrowserWindow } from 'electron'
import { getDecryptedCredentials } from './credentials.js'

// 스크래퍼는 npm/외부 Node 설치에 의존하지 않도록 Electron 자신의 Node
// 런타임(ELECTRON_RUN_AS_NODE)으로 직접 실행한다. 배포된 앱은 process.cwd()가
// 프로젝트 폴더를 가리킨다는 보장이 없으므로, 출력/세션 경로도 모두
// app.getPath('userData') 기준 절대 경로로 고정한다
const OUTPUT_ROOT = path.join(app.getPath('userData'), 'scraper-output')
const PLAYWRIGHT_PROFILE_DIR = path.join(app.getPath('userData'), 'playwright-profile')
const COURSES_ROOT = path.join(OUTPUT_ROOT, 'courses')
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

// 개발 중에는 <프로젝트 루트>/scraper-output이 실제 결과가 쌓이는 userData 폴더를
// 가리키는 심링크가 되게 해서, 매번 ~/Library/Application Support까지 안 가고
// 프로젝트 폴더에서 바로 결과를 확인할 수 있게 한다. 패키징된 앱에는 프로젝트
// 폴더 자체가 없으므로 개발 모드에서만 한다. 기존에 진짜 폴더가 있었다면
// 지우지 않고 타임스탬프를 붙여 백업해둔다
function ensureDevOutputSymlink() {
  if (app.isPackaged) return

  const projectOutputPath = path.join(app.getAppPath(), 'scraper-output')

  try {
    const stat = fs.lstatSync(projectOutputPath)
    if (stat.isSymbolicLink()) {
      if (fs.readlinkSync(projectOutputPath) === OUTPUT_ROOT) return
      fs.unlinkSync(projectOutputPath)
    } else {
      const backupPath = `${projectOutputPath}.bak-${Date.now()}`
      fs.renameSync(projectOutputPath, backupPath)
      console.log(`[courses] existing scraper-output/ moved to ${backupPath}`)
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(`[courses] failed to prepare dev scraper-output symlink: ${err.message}`)
      return
    }
  }

  fs.mkdirSync(OUTPUT_ROOT, { recursive: true })
  fs.symlinkSync(OUTPUT_ROOT, projectOutputPath, 'dir')
  console.log(`[courses] scraper-output/ symlinked to ${OUTPUT_ROOT}`)
}

ensureDevOutputSymlink()

let syncChild = null
let syncTimeout = null
let syncState = {
  running: false,
  category: null,
  lastResult: null,
  lastError: null,
  lastRunAt: null
}
const syncListeners = new Set()

// 메인 도넛 4개 메뉴(강의자료/과제/동영상/공지) 각각을 개별로 새로고침할 수 있게
// 스크래퍼 CLI 플래그로 매핑. 강의자료/동영상은 같은 주차학습 스캔에서 함께
// 나오는 데이터라 스캔 자체는 공유하고, 동영상만 볼 때는 자료 다운로드는 생략한다
const CATEGORY_ARGS = {
  all: ['--download'],
  notices: ['--notices-only'],
  assignments: ['--assignments-only'],
  materials: ['--materials-only', '--download'],
  videos: ['--videos-only']
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
  const filePath = path.join(OUTPUT_ROOT, fileName)

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

// 패키징된 앱에서는 src/scraper가 asarUnpack으로 app.asar 밖에 실제 파일로
// 존재하고, 개발 중에는 프로젝트 소스를 그대로 가리킨다
function resolveScraperEntry() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'src', 'scraper', 'ecampus-sandbox.mjs')
    : path.join(app.getAppPath(), 'src', 'scraper', 'ecampus-sandbox.mjs')
}

// 개발 중엔 이 컴퓨터에 npx playwright install로 받아둔 전역 캐시를 그대로 쓰고,
// 배포된 앱은 빌드 시점에 resources/playwright-browsers로 함께 번들링한 브라우저를 쓴다
// (scripts/stage-playwright-browser.mjs 참고)
function resolvePlaywrightBrowsersPath() {
  if (!app.isPackaged) return null
  return path.join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'playwright-browsers')
}

export function startSync(category = 'all') {
  if (syncState.running) return { ...syncState }

  const categoryArgs = CATEGORY_ARGS[category] ?? CATEGORY_ARGS.all

  const beforeSnapshot = createSyncSnapshot()
  syncState = { running: true, category, lastResult: null, lastError: null, lastRunAt: Date.now() }
  broadcastSyncEvent({ type: 'start', category })

  let timedOut = false

  const credentials = getDecryptedCredentials()
  const browsersPath = resolvePlaywrightBrowsersPath()

  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    DONUT_OUTPUT_ROOT: OUTPUT_ROOT,
    DONUT_PLAYWRIGHT_PROFILE_DIR: PLAYWRIGHT_PROFILE_DIR,
    ...(browsersPath ? { PLAYWRIGHT_BROWSERS_PATH: browsersPath } : {}),
    ...(credentials
      ? { KHU_LOGIN_ID: credentials.id, KHU_LOGIN_PASSWORD: credentials.password }
      : {})
  }

  syncChild = spawn(
    process.execPath,
    [resolveScraperEntry(), '--live', ...categoryArgs, '--headless'],
    {
      cwd: app.getPath('userData'),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env
    }
  )

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
      category,
      lastResult: 'error',
      lastError: err.message,
      lastRunAt: syncState.lastRunAt
    }
    broadcastSyncEvent({ type: 'done', category, success: false, error: err.message })
  })

  syncChild.on('close', (code) => {
    clearSyncTimeout()
    syncChild = null

    const success = code === 0 && !timedOut
    const changed = success ? hasSyncSnapshotChanged(beforeSnapshot, createSyncSnapshot()) : false
    const message = changed ? '새로고침 완료' : '새로 가져올 내용이 없습니다'

    syncState = {
      running: false,
      category,
      lastResult: success ? 'success' : 'error',
      lastError: success
        ? null
        : timedOut
          ? '새로고침 시간이 너무 오래 걸려 중단했습니다'
          : `스크래퍼가 종료 코드 ${code}로 실패했습니다`,
      lastRunAt: syncState.lastRunAt
    }
    broadcastSyncEvent({
      type: 'done',
      category,
      success,
      changed,
      message,
      error: syncState.lastError
    })
  })

  return { ...syncState }
}

export function stopSync() {
  clearSyncTimeout()
  syncChild?.kill()
}
