import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { dashboardUrl, outputRoot } from './core/constants.mjs'
import { getPlaywright, waitForCanvasLogin, navigateAndCheckAuth } from './core/browser.mjs'
import { collectCoursesFromDashboard } from './core/courses.mjs'
import {
  collectLinksWithFallback,
  downloadWeeklyMaterials,
  isWeeklyMaterialItem
} from './features/materials.mjs'
import { collectAssignmentRecords } from './features/assignments.mjs'
import { collectGradingWeightRecords } from './features/grading.mjs'
import { collectNoticeRecords } from './features/notices.mjs'
import { collectVideoRecords } from './features/videos.mjs'
import { getCliOption, hasCliFlag, printUsage } from './utils/cli-utils.mjs'
import { uniqueBy } from './utils/file-utils.mjs'

// preferHeadless가 true면 창 없이 실행하되, 저장된 세션이 만료되어 로그인이
// 필요한 경우에만 로그인용 브라우저 창을 자동으로 띄움
async function launchAuthenticatedContext(preferHeadless) {
  const { chromium } = await getPlaywright()
  const userDataDir = path.resolve('.playwright-user-data')

  let browserContext = await chromium.launchPersistentContext(userDataDir, {
    headless: preferHeadless
  })
  let page = await browserContext.newPage()

  if (!preferHeadless) {
    console.log('Browser opened.')
    console.log('If login is required, log in manually in the opened browser.')
  }

  if (await navigateAndCheckAuth(page, dashboardUrl)) {
    return { browserContext, page }
  }

  if (preferHeadless) {
    console.log('Session expired or not logged in. Opening a visible browser window for login.')
    await browserContext.close()
    browserContext = await chromium.launchPersistentContext(userDataDir, { headless: false })
    page = await browserContext.newPage()
  }

  await waitForCanvasLogin(page, dashboardUrl)
  return { browserContext, page }
}

const WEEKLY_SCAN_CONCURRENCY = 3

// 과목별 주차학습 목록 스캔은 새 자료 여부를 확인하기 위해 매번 필요하지만,
// 순차 대신 탭 여러 개를 동시에 열어 병렬로 처리해 소요 시간을 줄임
async function collectAllWeeklyLinks(browserContext, courses) {
  const results = new Array(courses.length)
  let nextIndex = 0

  async function worker() {
    for (;;) {
      const courseIndex = nextIndex
      nextIndex += 1

      if (courseIndex >= courses.length) return

      const course = courses[courseIndex]
      console.log(`Collecting weekly-learning links from ${course.courseName} (${course.courseId})`)

      const page = await browserContext.newPage()

      try {
        results[courseIndex] = await collectLinksWithFallback(
          page,
          course.weeklyLearningUrl,
          course
        )
      } finally {
        await page.close().catch(() => {})
      }
    }
  }

  const workerCount = Math.min(WEEKLY_SCAN_CONCURRENCY, courses.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))

  return results
}

async function runLiveCollector() {
  const { browserContext, page } = await launchAuthenticatedContext(hasCliFlag('--headless'))
  const allLinks = []
  const allWeeklyItems = []

  const courseFilter = getCliOption('--course')
  const courses = (await collectCoursesFromDashboard(page)).filter(
    (course) => !courseFilter || course.courseName.includes(courseFilter)
  )

  console.log(`Found ${courses.length} courses from dashboard.`)

  const assignmentsPath = path.join(outputRoot, 'assignments.json')
  const unsubmittedAssignmentsPath = path.join(outputRoot, 'unsubmitted-assignments.json')
  const noticesPath = path.join(outputRoot, 'notices.json')
  const gradingWeightsPath = path.join(outputRoot, 'grading-weights.json')

  await mkdir(outputRoot, { recursive: true })

  if (!hasCliFlag('--notices-only') && !hasCliFlag('--grading-only')) {
    const { assignments, unsubmittedAssignments } = await collectAssignmentRecords(page, courses)

    await writeFile(assignmentsPath, JSON.stringify(assignments, null, 2))
    await writeFile(unsubmittedAssignmentsPath, JSON.stringify(unsubmittedAssignments, null, 2))

    console.log(
      `Found ${assignments.length} real assignments (${unsubmittedAssignments.length} unsubmitted).`
    )
    console.log(`Saved to ${assignmentsPath}`)
    console.log(`Saved to ${unsubmittedAssignmentsPath}`)
  }

  if (!hasCliFlag('--assignments-only') && !hasCliFlag('--grading-only')) {
    const notices = await collectNoticeRecords(page, courses)

    await writeFile(noticesPath, JSON.stringify(notices, null, 2))

    console.log(`Found ${notices.length} notices.`)
    console.log(`Saved to ${noticesPath}`)
  }

  if (!hasCliFlag('--assignments-only') && !hasCliFlag('--notices-only')) {
    const gradingWeights = await collectGradingWeightRecords(browserContext, courses)

    await writeFile(gradingWeightsPath, JSON.stringify(gradingWeights, null, 2))

    console.log(
      `Found grading weights for ${
        gradingWeights.filter((record) => record.weights.length > 0).length
      } courses.`
    )
    console.log(`Saved to ${gradingWeightsPath}`)
  }

  if (
    hasCliFlag('--assignments-only') ||
    hasCliFlag('--notices-only') ||
    hasCliFlag('--grading-only')
  ) {
    await browserContext.close()
    return
  }

  const weeklyLinkResults = await collectAllWeeklyLinks(browserContext, courses)

  for (const result of weeklyLinkResults) {
    allLinks.push(...result.materialLinks)
    allWeeklyItems.push(...result.weeklyItems)
  }

  const materials = uniqueBy(allLinks, (link) => link.url)
  const weeklyItems = uniqueBy(allWeeklyItems, (item) => item.url)
  const weeklyMaterialItems = weeklyItems.filter(isWeeklyMaterialItem)
  const { videos, incompleteVideos } = collectVideoRecords(weeklyItems, courses)
  const outputPath = path.join(outputRoot, 'weekly-learning-material-links.json')
  const weeklyItemsPath = path.join(outputRoot, 'weekly-learning-items.json')
  const weeklyMaterialItemsPath = path.join(outputRoot, 'weekly-learning-material-items.json')
  const videosPath = path.join(outputRoot, 'weekly-learning-videos.json')
  const incompleteVideosPath = path.join(outputRoot, 'weekly-learning-incomplete-videos.json')

  await mkdir(outputRoot, { recursive: true })
  await writeFile(outputPath, JSON.stringify(materials, null, 2))
  await writeFile(weeklyItemsPath, JSON.stringify(weeklyItems, null, 2))
  await writeFile(weeklyMaterialItemsPath, JSON.stringify(weeklyMaterialItems, null, 2))
  await writeFile(videosPath, JSON.stringify(videos, null, 2))
  await writeFile(incompleteVideosPath, JSON.stringify(incompleteVideos, null, 2))

  console.log(`Found ${weeklyItems.length} weekly-learning items.`)
  console.log(`Saved to ${weeklyItemsPath}`)
  console.log(`Found ${weeklyMaterialItems.length} weekly material items.`)
  console.log(`Saved to ${weeklyMaterialItemsPath}`)
  console.log(`Found ${videos.length} video items (${incompleteVideos.length} below 100%).`)
  console.log(`Saved to ${videosPath}`)
  console.log(`Saved to ${incompleteVideosPath}`)
  console.log(`Found ${materials.length} material link candidates.`)
  console.log(`Saved to ${outputPath}`)

  if (hasCliFlag('--download')) {
    await downloadWeeklyMaterials(page, browserContext, weeklyMaterialItems)
  }

  await browserContext.close()
}

async function main() {
  if (hasCliFlag('--live')) {
    await runLiveCollector()
    return
  }

  await printUsage()
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
