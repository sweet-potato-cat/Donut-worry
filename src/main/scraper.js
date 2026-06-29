/**
 * scraper.js — e-campus 스크래핑 전담
 * core.js에서만 호출됨. 다른 모듈 직접 호출 금지.
 */

// TODO Sprint 1: Playwright 설치 후 구현
// import { chromium } from 'playwright'

const BASE_URL = 'https://e-campus.khu.ac.kr'

let _browser = null
let _page = null

// ── 로그인 / 세션 ────────────────────────────────────────

export async function login(username, password) {
  // TODO: Playwright 로그인 자동화
  // 1. 브라우저 실행
  // 2. e-campus 로그인 페이지 접속
  // 3. username / password 입력 후 제출
  // 4. 세션 쿠키 저장
  throw new Error('미구현: login')
}

export async function restoreSession(cookies) {
  // TODO: 저장된 쿠키로 세션 복원
  throw new Error('미구현: restoreSession')
}

// ── 강의자료 ────────────────────────────────────────────

export async function fetchLectures() {
  // TODO: 강의자료 목록 파싱 후 아래 형태로 반환
  // return [
  //   { subjectId, fileName, originalName, url, date }
  // ]
  throw new Error('미구현: fetchLectures')
}

// ── 과제 ────────────────────────────────────────────────

export async function fetchAssignments() {
  // TODO: 과제 목록 파싱 후 아래 형태로 반환
  // return [
  //   { subjectId, title, dueDate, score, description }
  // ]
  throw new Error('미구현: fetchAssignments')
}

// ── 동영상 ──────────────────────────────────────────────

export async function fetchVideos() {
  // TODO: 미시청 동영상 목록 파싱 후 아래 형태로 반환
  // return [
  //   { subjectId, title, isWatched }
  // ]
  throw new Error('미구현: fetchVideos')
}

// ── 공지 ────────────────────────────────────────────────

export async function fetchNotices() {
  // TODO: 공지사항 목록 파싱 후 아래 형태로 반환
  // return [
  //   { title, content, date }
  // ]
  throw new Error('미구현: fetchNotices')
}
