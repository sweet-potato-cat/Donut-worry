import * as scraper from './scraper.js'
import * as storage from './storage.js'
import * as ai from './ai.js'

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

  // ── 동영상 ────────────────────────────────────────────
  'video:sync': async () => {
    const raw = await scraper.fetchVideos()
    await storage.saveVideos(raw)
    return storage.getVideos()
  },

  'video:getAll': async () => {
    return storage.getVideos()
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

  // ── 전체 동기화 ────────────────────────────────────────
  'sync:all': async () => {
    const [lectures, assignments, videos, notices] = await Promise.all([
      handlers['lecture:sync'](),
      handlers['assignment:sync'](),
      handlers['video:sync'](),
      handlers['notice:sync'](),
    ])
    return { lectures, assignments, videos, notices }
  },
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
