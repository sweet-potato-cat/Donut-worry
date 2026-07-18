import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { dashboardUrl, outputRoot } from './core/constants.mjs'
import { getPlaywright, waitForCanvasLogin } from './core/browser.mjs'
import { collectCoursesFromDashboard } from './core/courses.mjs'
import {
  collectLinksWithFallback,
  downloadWeeklyMaterials,
  isWeeklyMaterialItem
} from './features/materials.mjs'
import { collectAssignmentRecords } from './features/assignments.mjs'
import { collectNoticeRecords } from './features/notices.mjs'
import { collectVideoRecords } from './features/videos.mjs'
import { getCliOption, hasCliFlag, printUsage } from './utils/cli-utils.mjs'
import { uniqueBy } from './utils/file-utils.mjs'

async function runLiveCollector() {
  const { chromium } = await getPlaywright()
  const userDataDir = path.resolve('.playwright-user-data')
  const browserContext = await chromium.launchPersistentContext(userDataDir, {
    headless: false
  })
  const page = await browserContext.newPage()
  const allLinks = []
  const allWeeklyItems = []

  console.log('Browser opened.')
  console.log('If login is required, log in manually in the opened browser.')

  await waitForCanvasLogin(page, dashboardUrl)
  const courseFilter = getCliOption('--course')
  const courses = (await collectCoursesFromDashboard(page)).filter(
    (course) => !courseFilter || course.courseName.includes(courseFilter)
  )

  console.log(`Found ${courses.length} courses from dashboard.`)

  const assignmentsPath = path.join(outputRoot, 'assignments.json')
  const unsubmittedAssignmentsPath = path.join(outputRoot, 'unsubmitted-assignments.json')
  const noticesPath = path.join(outputRoot, 'notices.json')

  await mkdir(outputRoot, { recursive: true })

  if (!hasCliFlag('--notices-only')) {
    const { assignments, unsubmittedAssignments } = await collectAssignmentRecords(page, courses)

    await writeFile(assignmentsPath, JSON.stringify(assignments, null, 2))
    await writeFile(unsubmittedAssignmentsPath, JSON.stringify(unsubmittedAssignments, null, 2))

    console.log(
      `Found ${assignments.length} real assignments (${unsubmittedAssignments.length} unsubmitted).`
    )
    console.log(`Saved to ${assignmentsPath}`)
    console.log(`Saved to ${unsubmittedAssignmentsPath}`)
  }

  if (!hasCliFlag('--assignments-only')) {
    const notices = await collectNoticeRecords(page, courses)

    await writeFile(noticesPath, JSON.stringify(notices, null, 2))

    console.log(`Found ${notices.length} notices.`)
    console.log(`Saved to ${noticesPath}`)
  }

  if (hasCliFlag('--assignments-only') || hasCliFlag('--notices-only')) {
    await browserContext.close()
    return
  }

  for (const course of courses) {
    console.log(`Collecting weekly-learning links from ${course.courseName} (${course.courseId})`)
    const result = await collectLinksWithFallback(page, course.weeklyLearningUrl, course)
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
