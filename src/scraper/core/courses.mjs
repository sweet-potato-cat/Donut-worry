import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { dashboardUrl, outputRoot, weeklyLearningToolId } from './constants.mjs'
import { collectCanvasCoursesApi } from './canvas-api.mjs'
import { uniqueBy } from '../utils/file-utils.mjs'

function parseCourseId(url) {
  return url.match(/\/courses\/(\d+)/)?.[1] ?? null
}

async function collectCoursesFromDashboard(page) {
  await page.goto(dashboardUrl, { waitUntil: 'domcontentloaded' })
  // 대시보드는 알림 등 백그라운드 요청이 계속 떠 있어 networkidle 자체가 잘 안
  // 걸린다(실제로 30초 타임아웃이 재현됨). 짧게만 시도해보고 안 되면 그냥
  // 넘어간 뒤, 아래 explicit wait로 클라이언트 렌더링 시간을 벌충한다
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(3000)

  const apiCourses = await collectCanvasCoursesApi(page)

  if (apiCourses.length > 0) {
    return apiCourses
  }

  const html = await page.content()
  const debugDirectory = path.join(outputRoot, 'debug')

  await mkdir(debugDirectory, { recursive: true })
  await writeFile(path.join(debugDirectory, 'khcanvas-dashboard.html'), html)

  const courses = await page.evaluate((currentToolId) => {
    const courseCards = [...document.querySelectorAll('.xn-student-course-container')]

    if (courseCards.length > 0) {
      return courseCards
        .map((card) => {
          const title =
            card.querySelector('.xnscc-header-title')?.textContent.replace(/\s+/g, ' ').trim() ?? ''
          const courseUrl = card.querySelector('.xnscc-header-redirect-link')?.href ?? ''
          const courseId = courseUrl.match(/\/courses\/(\d+)/)?.[1] ?? null

          if (!courseId) {
            return null
          }

          return {
            courseId,
            courseName: title || `Course ${courseId}`,
            courseUrl,
            weeklyLearningUrl: `${courseUrl}/external_tools/${currentToolId}`
          }
        })
        .filter(Boolean)
    }

    return [...document.querySelectorAll('a[href*="/courses/"]')]
      .map((link) => {
        const courseUrl = new URL(link.getAttribute('href'), location.href).href
        const courseId = courseUrl.match(/\/courses\/(\d+)/)?.[1] ?? null

        if (!courseId) {
          return null
        }

        return {
          courseId,
          courseName: link.textContent.replace(/\s+/g, ' ').trim() || `Course ${courseId}`,
          courseUrl: `${location.origin}/courses/${courseId}`,
          weeklyLearningUrl: `${location.origin}/courses/${courseId}/external_tools/${currentToolId}`
        }
      })
      .filter(Boolean)
  }, weeklyLearningToolId)

  return uniqueBy(courses, (course) => course.courseId)
}

export { collectCoursesFromDashboard, parseCourseId }
