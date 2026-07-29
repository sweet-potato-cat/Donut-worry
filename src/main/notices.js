/**
 * notices.js — scraper-output/notices.json 읽기 전담
 * core.js에서만 호출됨.
 */

import fs from 'fs'
import path from 'path'
import { app, shell } from 'electron'

// process.cwd() 기준 상대 경로였던 걸 courses.js와 같은 절대 경로 기준으로 맞춤
const NOTICES_PATH = path.join(app.getPath('userData'), 'scraper-output', 'notices.json')

// 공지 제목/본문에 아래 키워드가 하나라도 있으면 해당 유형 목록에 포함시킨다.
// (하나의 공지가 여러 유형에 동시에 속할 수 있음)
const TYPE_KEYWORDS = {
  exam: ['시험', '고사', '퀴즈'],
  assignment: ['과제', '제출', '레포트', '리포트'],
  attendance: ['출석', '출결']
}

export const NOTICE_TYPES = [
  { key: 'exam', label: '시험' },
  { key: 'assignment', label: '과제' },
  { key: 'attendance', label: '출석' },
  { key: 'etc', label: '기타' }
]

function readNotices() {
  if (!fs.existsSync(NOTICES_PATH)) return []
  try {
    return JSON.parse(fs.readFileSync(NOTICES_PATH, 'utf-8'))
  } catch {
    return []
  }
}

function classifyTypes(notice) {
  const text = `${notice.title ?? ''} ${notice.messageText ?? ''}`
  const matched = Object.entries(TYPE_KEYWORDS)
    .filter(([, keywords]) => keywords.some((word) => text.includes(word)))
    .map(([key]) => key)

  return matched.length > 0 ? matched : ['etc']
}

export function listNotices() {
  return readNotices()
    .map((notice) => ({ ...notice, types: classifyTypes(notice) }))
    .sort((a, b) => {
      const aTime = a.postedAt ? Date.parse(a.postedAt) : 0
      const bTime = b.postedAt ? Date.parse(b.postedAt) : 0
      return bTime - aTime
    })
}

export async function openNotice(url) {
  if (!url) return
  await shell.openExternal(url)
}
