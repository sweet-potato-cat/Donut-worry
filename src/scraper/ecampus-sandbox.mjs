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

  for (const course of courses) {
    console.log(`Collecting weekly-learning links from ${course.courseName} (${course.courseId})`)
    const result = await collectLinksWithFallback(page, course.weeklyLearningUrl, course)
    allLinks.push(...result.materialLinks)
    allWeeklyItems.push(...result.weeklyItems)
  }

  const materials = uniqueBy(allLinks, (link) => link.url)
  const weeklyItems = uniqueBy(allWeeklyItems, (item) => item.url)
  const weeklyMaterialItems = weeklyItems.filter(isWeeklyMaterialItem)
  const outputPath = path.join(outputRoot, 'weekly-learning-material-links.json')
  const weeklyItemsPath = path.join(outputRoot, 'weekly-learning-items.json')
  const weeklyMaterialItemsPath = path.join(outputRoot, 'weekly-learning-material-items.json')

  await mkdir(outputRoot, { recursive: true })
  await writeFile(outputPath, JSON.stringify(materials, null, 2))
  await writeFile(weeklyItemsPath, JSON.stringify(weeklyItems, null, 2))
  await writeFile(weeklyMaterialItemsPath, JSON.stringify(weeklyMaterialItems, null, 2))

  console.log(`Found ${weeklyItems.length} weekly-learning items.`)
  console.log(`Saved to ${weeklyItemsPath}`)
  console.log(`Found ${weeklyMaterialItems.length} weekly material items.`)
  console.log(`Saved to ${weeklyMaterialItemsPath}`)
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
