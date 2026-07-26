import * as scraper from './scraper.js'
import * as storage from './storage.js'
import * as ai from './ai.js'
import * as courses from './courses.js'
import * as assignments from './assignments.js'
import * as videos from './videos.js'
import * as notices from './notices.js'
import * as settings from './settings.js'

/**
 * core.js — Fan-in 중앙 라우터
 * 모든 기능은 이 파일을 통해서만 호출됨
 * scraper / storage / ai 는 서로 직접 호출하지 않음
 *
 * 기능 추가 시: 아래 handlers에 항목만 추가
 */

const handlers = {
  // ── 강의자료 ──────────────────────────────────────────
  'lecture:sync': async () => {
    const raw = await scraper.fetchLectures()
    const named = await ai.refineLectureNames(raw)
    await storage.saveLectures(named)
    return storage.getLectures()
  },

  'lecture:getAll': async () => {
    return storage.getLectures()
  },

  // ── 다운로드된 강의자료 폴더(scraper-output/courses) ───────
  'course:list': async () => {
    return courses.listCourses()
  },

  'course:listFiles': async ({ courseName }) => {
    return courses.listCourseFiles(courseName)
  },

  'course:openFile': async ({ filePath }) => {
    await courses.openCourseFile(filePath)
    return { success: true }
  },

  'course:sync': async () => {
    return courses.startSync()
  },

  'course:syncStatus': async () => {
    return courses.getSyncState()
  },

  // ── 과제 ──────────────────────────────────────────────
  'assignment:sync': async () => {
    const raw = await scraper.fetchAssignments()
    const summarized = await ai.summarizeAssignments(raw)
    await storage.saveAssignments(summarized)
    return storage.getAssignments()
  },

  'assignment:getAll': async () => {
    return storage.getAssignments()
  },

  'assignment:complete': async ({ id }) => {
    return storage.markAssignmentComplete(id)
  },

  // ── 다운로드된 과제 목록(scraper-output/assignments.json) ───
  'assignment:listCourses': async () => {
    return assignments.listAssignmentCourses()
  },

  'assignment:listByCourse': async ({ courseName }) => {
    return assignments.listAssignmentsForCourse(courseName)
  },

  'assignment:open': async ({ url }) => {
    await assignments.openAssignment(url)
    return { success: true }
  },

  // ── 동영상 ────────────────────────────────────────────
  'video:sync': async () => {
    const raw = await scraper.fetchVideos()
    await storage.saveVideos(raw)
    return storage.getVideos()
  },

  'video:getAll': async () => {
    return storage.getVideos()
  },

  // ── 다운로드된 동영상 목록(scraper-output/weekly-learning-videos.json) ─
  'video:listCourses': async () => {
    return videos.listVideoCourses()
  },

  'video:listByCourse': async ({ courseName }) => {
    return videos.listVideosForCourse(courseName)
  },

  'video:open': async ({ url }) => {
    await videos.openVideo(url)
    return { success: true }
  },

  // ── 공지 ──────────────────────────────────────────────
  'notice:sync': async () => {
    const raw = await scraper.fetchNotices()
    const summarized = await ai.summarizeNotices(raw)
    await storage.saveNotices(summarized)
    return storage.getNotices()
  },

  'notice:getAll': async () => {
    return storage.getNotices()
  },

  'notice:read': async ({ id }) => {
    return storage.markNoticeRead(id)
  },

  // ── 다운로드된 공지 목록(scraper-output/notices.json) ───────
  'notice:list': async () => {
    return notices.listNotices()
  },

  'notice:open': async ({ url }) => {
    await notices.openNotice(url)
    return { success: true }
  },

  // ── 환경설정(단축키/시간표) ────────────────────────────
  'settings:get': async () => {
    return settings.getSettings()
  },

  'settings:setMainHotkey': async ({ keys }) => {
    return settings.setMainHotkey(keys)
  },

  'settings:resetMainHotkey': async () => {
    return settings.resetMainHotkey()
  },

  'timetable:list': async () => {
    return settings.listTimetable()
  },

  'timetable:add': async ({ day, time, label }) => {
    return settings.addTimetableEntry({ day, time, label })
  },

  'timetable:remove': async ({ id }) => {
    return settings.removeTimetableEntry(id)
  },

  // ── 전체 동기화 ────────────────────────────────────────
  'sync:all': async () => {
    const [lectures, assignments, videos, notices] = await Promise.all([
      handlers['lecture:sync'](),
      handlers['assignment:sync'](),
      handlers['video:sync'](),
      handlers['notice:sync']()
    ])
    return { lectures, assignments, videos, notices }
  }
}

/**
 * IPC에서 호출하는 단일 진입점
 * @param {string} channel - 핸들러 키 (예: 'lecture:sync')
 * @param {object} payload - 전달 데이터
 */
export async function handle(channel, payload = {}) {
  const handler = handlers[channel]
  if (!handler) {
    throw new Error(`[core] 알 수 없는 채널: ${channel}`)
  }
  try {
    return await handler(payload)
  } catch (err) {
    console.error(`[core] ${channel} 처리 중 오류:`, err)
    throw err
  }
}
