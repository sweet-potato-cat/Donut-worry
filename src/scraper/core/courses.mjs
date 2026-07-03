import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { dashboardUrl, outputRoot, weeklyLearningToolId } from './constants.mjs'
import { collectCanvasCoursesApi } from './canvas-api.mjs'
import { uniqueBy } from '../utils/file-utils.mjs'

function parseCourseId(url) {
  return url.match(/\/courses\/(\d+)/)?.[1] ?? null
}

async function collectCoursesFromDashboard(page) {
  await page.goto(dashboardUrl, { waitUntil: 'networkidle' })
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
