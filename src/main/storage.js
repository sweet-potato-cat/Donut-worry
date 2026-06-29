/**
 * storage.js — SQLite DB 읽기/쓰기 전담
 * core.js에서만 호출됨. 다른 모듈 직접 호출 금지.
 */

// TODO Sprint 1: better-sqlite3 설치 후 구현
// import Database from 'better-sqlite3'

let _db = null

export function initDB(dbPath) {
  // TODO: DB 초기화 및 테이블 생성
  // _db = new Database(dbPath)
  // _db.exec(CREATE_TABLES_SQL)
  throw new Error('미구현: initDB')
}

// ── 강의자료 ────────────────────────────────────────────

export function saveLectures(lectures) {
  // TODO: 신규 파일만 INSERT (중복 제외)
  throw new Error('미구현: saveLectures')
}

export function getLectures() {
  // TODO: 전체 강의자료 반환
  // return _db.prepare('SELECT * FROM lectures').all()
  throw new Error('미구현: getLectures')
}

// ── 과제 ────────────────────────────────────────────────

export function saveAssignments(assignments) {
  throw new Error('미구현: saveAssignments')
}

export function getAssignments() {
  throw new Error('미구현: getAssignments')
}

export function markAssignmentComplete(id) {
  // TODO: completed = 1 업데이트
  throw new Error('미구현: markAssignmentComplete')
}

// ── 동영상 ──────────────────────────────────────────────

export function saveVideos(videos) {
  throw new Error('미구현: saveVideos')
}

export function getVideos() {
  throw new Error('미구현: getVideos')
}

// ── 공지 ────────────────────────────────────────────────

export function saveNotices(notices) {
  throw new Error('미구현: saveNotices')
}

export function getNotices() {
  throw new Error('미구현: getNotices')
}

export function markNoticeRead(id) {
  throw new Error('미구현: markNoticeRead')
}
