import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { outputRoot } from '../core/constants.mjs'
import { hasCliFlag } from '../utils/cli-utils.mjs'
import { compareByCourseOrder, createCourseOrderMap } from '../utils/sort-utils.mjs'

const openSyllabusTextPattern =
  /수업\s*계획서\s*(바로가기|조회|보기|확인|열기)?|강의\s*계획서\s*(바로가기|조회|보기|확인|열기)?|syllabus/i
const gradingSectionPattern =
  /성적|평가|반영|출석|과제|중간|기말|퀴즈|시험|발표|토론|프로젝트|실습|태도|참여/i
const gradingItemPatterns = [
  ['attendance', /출석|출결|attendance/i],
  ['assignment', /과제|숙제|assignment|homework/i],
  ['midterm', /중간|midterm/i],
  ['final', /기말|final/i],
  ['quiz', /퀴즈|quiz/i],
  ['presentation', /발표|presentation/i],
  ['project', /프로젝트|project/i],
  ['discussion', /토론|discussion/i],
  ['practice', /실습|practice|lab/i],
  ['participation', /참여|태도|participation|attitude/i],
  ['etc', /기타|etc|other/i]
]
const gradingKeywordPattern =
  /출석|출결|과제|숙제|중간(?:고사)?|기말(?:고사)?|퀴즈|발표|프로젝트|토론|실습|참여|태도|기타|attendance|assignment|homework|midterm|final|quiz|presentation|project|discussion|practice|lab|participation|attitude|etc|other/gi

async function collectGradingWeightRecords(browserContext, courses) {
  const courseOrderMap = createCourseOrderMap(courses)
  const results = []

  for (const course of courses) {
    console.log(`Collecting grading weights from ${course.courseName} (${course.courseId})`)

    const page = await browserContext.newPage()

    try {
      results.push(await collectCourseGradingWeights(page, course))
    } catch (error) {
      results.push(
        createEmptyGradingRecord(course, {
          status: 'error',
          error: error.message
        })
      )
    } finally {
      await page.close().catch(() => {})
    }
  }

  return results.sort((a, b) => compareByCourseOrder(a, b, courseOrderMap))
}

async function collectCourseGradingWeights(page, course) {
  const apiSnapshot = await collectCanvasCourseSyllabusSnapshot(page, course)
  const candidates = [
    ...apiSnapshot.candidates,
    ...(await collectSyllabusCandidatesFromCoursePage(page, course))
  ]
  const uniqueCandidates = dedupeCandidates(candidates)
  const snapshots = []

  if (apiSnapshot.text) {
    snapshots.push({
      sourceType: 'canvas-course-api',
      sourceUrl: course.courseUrl,
      text: apiSnapshot.text
    })
  }

  for (const candidate of uniqueCandidates.slice(0, hasCliFlag('--deep') ? 12 : 6)) {
    const snapshot = await collectSyllabusSnapshotFromCandidate(page, candidate)

    if (snapshot) {
      snapshots.push(snapshot)
    }
  }

  const bestSnapshot = pickBestGradingSnapshot(snapshots)
  const weights = bestSnapshot ? parseGradingWeights(bestSnapshot.text) : []
  const totalPercent = calculateTotalPercent(weights)
  const status =
    weights.length > 0 && totalPercent >= 95 && totalPercent <= 105
      ? 'parsed'
      : bestSnapshot
        ? 'needs-review'
        : 'not-found'
  const record = createEmptyGradingRecord(course, {
    status,
    sourceUrl: bestSnapshot?.sourceUrl ?? '',
    sourceType: bestSnapshot?.sourceType ?? '',
    rawText: bestSnapshot?.text ?? '',
    weights,
    candidates: uniqueCandidates
  })

  await maybeSaveGradingDebugSnapshot(course, record, snapshots)

  return record
}

async function collectCanvasCourseSyllabusSnapshot(page, course) {
  await page.goto(course.courseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(500)

  return page.evaluate(
    async ({ courseId, courseUrl }) => {
      const courseOrigin = new URL(courseUrl).origin

      async function fetchJson(url) {
        const response = await fetch(new URL(url, courseOrigin).href, {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' }
        })

        if (!response.ok) {
          return null
        }

        return response.json()
      }

      const courseDetail = await fetchJson(`/api/v1/courses/${courseId}?include[]=syllabus_body`)
      const tabs = (await fetchJson(`/api/v1/courses/${courseId}/tabs`)) ?? []
      const parser = new DOMParser()
      const syllabusBody = courseDetail?.syllabus_body ?? ''
      const text = stripHtmlInBrowser(syllabusBody)
      const candidates = []

      if (syllabusBody) {
        const doc = parser.parseFromString(syllabusBody, 'text/html')

        for (const link of doc.querySelectorAll('a[href]')) {
          const title = normalizeText(link.textContent)
          const href = link.getAttribute('href') ?? ''

          if (title.match(/수업\s*계획서|강의\s*계획서|syllabus/i) || href.match(/syllabus/i)) {
            candidates.push({
              sourceType: 'canvas-course-api-syllabus-body',
              title,
              url: new URL(href, location.origin).href
            })
          }
        }
      }

      for (const tab of tabs) {
        const title = normalizeText(tab.label ?? tab.id ?? '')
        const url = tab.html_url ?? tab.url ?? ''

        if (
          (title.match(/수업\s*계획서|강의\s*계획서|syllabus/i) || url.match(/syllabus/i)) &&
          url
        ) {
          candidates.push({
            sourceType: 'canvas-course-tabs',
            title,
            url
          })
        }
      }

      return { text, candidates }

      function normalizeText(value) {
        return String(value ?? '')
          .replace(/\s+/g, ' ')
          .trim()
      }

      function stripHtmlInBrowser(value) {
        const doc = parser.parseFromString(String(value ?? ''), 'text/html')

        return normalizeText(doc.body?.textContent ?? '')
      }
    },
    {
      courseId: course.courseId,
      courseUrl: course.courseUrl
    }
  )
}

async function collectSyllabusCandidatesFromCoursePage(page, course) {
  await page.goto(course.courseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(1000)

  return page.evaluate(() => {
    const candidates = []
    const elements = [
      ...document.querySelectorAll(
        'a[href], button, [role="button"], input[type="button"], input[type="submit"], iframe[src]'
      )
    ]

    for (const element of elements) {
      const title = normalizeText(
        element.textContent ||
          element.getAttribute('aria-label') ||
          element.getAttribute('title') ||
          element.getAttribute('value') ||
          ''
      )
      const rawUrl =
        element.getAttribute('href') ||
        element.getAttribute('src') ||
        element.getAttribute('data-url') ||
        element.getAttribute('data-href') ||
        ''

      if (!title.match(/수업\s*계획서|강의\s*계획서|syllabus/i) && !rawUrl.match(/syllabus/i)) {
        continue
      }

      candidates.push({
        sourceType: 'course-page',
        title,
        url: rawUrl ? new URL(rawUrl, location.href).href : location.href
      })
    }

    return candidates

    function normalizeText(value) {
      return String(value ?? '')
        .replace(/\s+/g, ' ')
        .trim()
    }
  })
}

async function collectSyllabusSnapshotFromCandidate(page, candidate) {
  try {
    await page.goto(candidate.url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(1500)

    const openedPage = await clickSyllabusOpenButtonIfPresent(page)
    const snapshotPage = openedPage ?? page

    await snapshotPage.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {})
    await snapshotPage.waitForTimeout(1000)

    const frameSnapshots = []

    for (const frame of snapshotPage.frames()) {
      try {
        const text = await frame.evaluate(
          () => document.body?.textContent.replace(/\s+/g, ' ').trim() ?? ''
        )

        if (text) {
          frameSnapshots.push({
            sourceType: candidate.sourceType,
            sourceUrl: frame.url() || snapshotPage.url(),
            title: candidate.title,
            text
          })
        }
      } catch {
        // Cross-origin frames may be inaccessible. The page URL is still kept through candidates.
      }
    }

    if (openedPage) {
      await openedPage.close().catch(() => {})
    }

    return pickBestGradingSnapshot(frameSnapshots)
  } catch (error) {
    return {
      sourceType: candidate.sourceType,
      sourceUrl: candidate.url,
      title: candidate.title,
      text: '',
      error: error.message
    }
  }
}

async function clickSyllabusOpenButtonIfPresent(page) {
  const popupPromise = page.waitForEvent('popup', { timeout: 3000 }).catch(() => null)
  const didClick = await page.evaluate((patternSource) => {
    const pattern = new RegExp(patternSource, 'i')
    const elements = [
      ...document.querySelectorAll(
        'a[href], button, [role="button"], input[type="button"], input[type="submit"]'
      )
    ]
    const target = elements.find((element) => {
      const text = [
        element.textContent,
        element.getAttribute('aria-label'),
        element.getAttribute('title'),
        element.getAttribute('value')
      ]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()

      return pattern.test(text)
    })

    if (!target) {
      return false
    }

    target.click()
    return true
  }, openSyllabusTextPattern.source)

  if (!didClick) {
    return null
  }

  const popup = await popupPromise

  await page.waitForTimeout(1500)

  return popup
}

function pickBestGradingSnapshot(snapshots) {
  return snapshots
    .filter((snapshot) => snapshot?.text)
    .map((snapshot) => ({
      ...snapshot,
      score: calculateGradingTextScore(snapshot.text)
    }))
    .sort((a, b) => b.score - a.score || b.text.length - a.text.length)[0]
}

function calculateGradingTextScore(text) {
  const normalizedText = normalizeText(text)
  const percentCount = normalizedText.match(/\d+(?:\.\d+)?\s*%/g)?.length ?? 0
  const keywordCount = gradingItemPatterns.filter(([, pattern]) =>
    pattern.test(normalizedText)
  ).length
  const sectionBonus = gradingSectionPattern.test(normalizedText) ? 5 : 0

  return percentCount * 4 + keywordCount * 2 + sectionBonus
}

function parseGradingWeights(text) {
  const normalizedText = extractGradingRelevantText(text)
  const weightsByKey = new Map()
  const compactPairs = parseCompactWeightPairs(normalizedText)

  for (const pair of compactPairs) {
    addWeight(weightsByKey, pair)
  }

  const lines = normalizedText
    .split(/(?:\r?\n| {2,}|(?<=%)\s+)/)
    .map((line) => line.trim())
    .filter(Boolean)

  for (const line of lines) {
    const percentMatch = line.match(/(\d+(?:\.\d+)?)\s*%/)

    if (!percentMatch || !gradingSectionPattern.test(line)) {
      continue
    }

    const label = extractGradingLabel(line, percentMatch.index ?? 0)

    addWeight(weightsByKey, {
      key: classifyGradingItem(label),
      label,
      percent: Number(percentMatch[1]),
      rawText: line
    })
  }

  return [...weightsByKey.values()].sort((a, b) => a.label.localeCompare(b.label, 'ko'))
}

function extractGradingRelevantText(text) {
  const normalizedText = normalizeText(text)
  const startPattern = /평가\s*방법|평가\s*항목|평가\s*비율|성적\s*평가|성적\s*반영/i
  const endPattern = /주별\s*강의|주차|교재|참고\s*자료|수업\s*안내|장애\s*학생|COPYRIGHT/i
  const startMatch = normalizedText.match(startPattern)

  if (!startMatch || startMatch.index === undefined) {
    return normalizedText
  }

  const afterStart = normalizedText.slice(startMatch.index)
  const endMatch = afterStart.match(endPattern)

  if (!endMatch || endMatch.index === undefined || endMatch.index < 20) {
    return afterStart
  }

  return afterStart.slice(0, endMatch.index)
}

function parseCompactWeightPairs(text) {
  const results = []
  const percentPattern = /(\d+(?:\.\d+)?)\s*%/g
  let match

  while ((match = percentPattern.exec(text))) {
    const percentIndex = match.index
    const beforePercent = text.slice(Math.max(0, percentIndex - 80), percentIndex)
    const label = findNearestGradingLabel(beforePercent)

    if (!label) {
      continue
    }

    results.push({
      key: classifyGradingItem(label),
      label,
      percent: Number(match[1]),
      rawText: normalizeText(`${label} ${match[0]}`)
    })
  }

  return results
}

function findNearestGradingLabel(text) {
  const matches = [...text.matchAll(gradingKeywordPattern)]
  const nearestMatch = matches.at(-1)

  return normalizeText(nearestMatch?.[0] ?? '')
}

function addWeight(weightsByKey, weight) {
  if (!Number.isFinite(weight.percent)) {
    return
  }

  const key = weight.key === 'unknown' ? `${weight.label}:${weight.percent}` : weight.key
  const existing = weightsByKey.get(key)

  if (!existing || weight.rawText.length < existing.rawText.length) {
    weightsByKey.set(key, weight)
  }
}

function extractGradingLabel(line, percentIndex) {
  const beforePercent = line.slice(0, percentIndex)
  const nearestLabel = findNearestGradingLabel(beforePercent)

  return normalizeText(nearestLabel || beforePercent.split(/\s+/).slice(-3).join(' '))
}

function classifyGradingItem(label) {
  for (const [key, pattern] of gradingItemPatterns) {
    if (pattern.test(label)) {
      return key
    }
  }

  return 'unknown'
}

function createEmptyGradingRecord(course, overrides = {}) {
  return {
    courseId: course.courseId,
    courseName: course.courseName,
    courseCode: course.courseCode ?? '',
    status: 'not-found',
    sourceType: '',
    sourceUrl: '',
    weights: [],
    rawText: '',
    candidates: [],
    error: '',
    collectedAt: new Date().toISOString(),
    ...overrides,
    totalPercent: calculateTotalPercent(overrides.weights ?? [])
  }
}

function calculateTotalPercent(weights) {
  return Number(weights.reduce((sum, weight) => sum + Number(weight.percent ?? 0), 0).toFixed(2))
}

function dedupeCandidates(candidates) {
  const seen = new Set()
  const results = []

  for (const candidate of candidates) {
    const key = `${candidate.sourceType}:${candidate.url}:${candidate.title}`

    if (!candidate.url || seen.has(key)) {
      continue
    }

    seen.add(key)
    results.push(candidate)
  }

  return results
}

async function maybeSaveGradingDebugSnapshot(course, record, snapshots) {
  if (!hasCliFlag('--debug')) {
    return
  }

  const debugDirectory = path.join(outputRoot, 'debug', 'grading')

  await mkdir(debugDirectory, { recursive: true })
  await writeFile(
    path.join(debugDirectory, `${course.courseId}.json`),
    JSON.stringify({ record, snapshots }, null, 2)
  )
}

function normalizeText(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

export { collectGradingWeightRecords, parseGradingWeights }
