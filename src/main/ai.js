/**
 * ai.js — Claude API 호출 전담
 * core.js에서만 호출됨. 다른 모듈 직접 호출 금지.
 */

const API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-haiku-4-5'

async function callClaude(prompt) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) throw new Error(`Claude API 오류: ${res.status}`)
  const data = await res.json()
  return data.content[0].text
}

// ── 강의자료 파일명 정제 ─────────────────────────────────

export async function refineLectureNames(lectures) {
  // 예: '20260124.pdf' → '[미분적분학] 1강 3월 14일.pdf'
  return Promise.all(
    lectures.map(async (lec) => {
      const prompt = `
다음 강의자료 파일명을 사람이 읽기 좋게 정제해줘.
과목명: ${lec.subjectName}
원본 파일명: ${lec.originalName}
업로드 날짜: ${lec.date}

규칙:
- "[과목명] 내용 날짜.확장자" 형식으로
- 날짜는 "M월 D일" 형식
- 추측이 불가능하면 원본 파일명 그대로 반환
- 파일명만 반환, 설명 없이
      `.trim()

      try {
        const refined = await callClaude(prompt)
        return { ...lec, fileName: refined.trim() }
      } catch {
        return lec // 실패 시 원본 유지
      }
    })
  )
}

// ── 과제 요약 ────────────────────────────────────────────

export async function summarizeAssignments(assignments) {
  return Promise.all(
    assignments.map(async (asgn) => {
      const prompt = `
다음 과제 설명을 3줄로 요약해줘.
과목: ${asgn.subjectName}
과제명: ${asgn.title}
내용: ${asgn.description}

규칙:
- 핵심만 3줄
- 각 줄은 "- "으로 시작
- 한국어로
      `.trim()

      try {
        const summary = await callClaude(prompt)
        return { ...asgn, summary: summary.trim() }
      } catch {
        return { ...asgn, summary: asgn.description?.slice(0, 100) ?? '' }
      }
    })
  )
}

// ── 공지 요약 ────────────────────────────────────────────

export async function summarizeNotices(notices) {
  return Promise.all(
    notices.map(async (notice) => {
      const prompt = `
다음 공지사항을 3줄로 요약해줘.
제목: ${notice.title}
내용: ${notice.content}

규칙:
- 핵심만 3줄
- 각 줄은 "- "으로 시작
- 한국어로
      `.trim()

      try {
        const summary = await callClaude(prompt)
        return { ...notice, summary: summary.trim() }
      } catch {
        return { ...notice, summary: notice.content?.slice(0, 100) ?? '' }
      }
    })
  )
}
