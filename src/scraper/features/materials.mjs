import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { dashboardUrl, outputRoot, weeklyMaterialTypes } from '../core/constants.mjs'
import { collectCanvasModuleItemsApi } from '../core/canvas-api.mjs'
import { hasCliFlag } from '../utils/cli-utils.mjs'
import {
  addDownloadedFileToCache,
  createDownloadCandidateFromUrl,
  createDownloadedFilePath,
  findExistingDownloadedFile,
  getFileExtensionFromValue,
  parseModuleItemId,
  sanitizeFileName,
  uniqueBy
} from '../utils/file-utils.mjs'
import { parseCourseId } from '../core/courses.mjs'

function isWeeklyMaterialItem(item) {
  const title = item.title ?? ''
  const url = item.url ?? ''

  return (
    weeklyMaterialTypes.has(item.type) ||
    getFileExtensionFromValue(title) ||
    getFileExtensionFromValue(url)
  )
}

async function collectLinksFromPage(page, sourceUrl, course) {
  await page.goto(sourceUrl, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  await expandWeeklyLearningFrame(page)

  const frameSnapshots = []
  const shouldCollectDebugHtml = hasCliFlag('--debug')

  for (const frame of page.frames()) {
    try {
      frameSnapshots.push(await collectLinksFromFrame(frame, sourceUrl, shouldCollectDebugHtml))
    } catch (error) {
      frameSnapshots.push({
        frameUrl: frame.url(),
        html: '',
        allLinks: [],
        weeklyItems: [],
        materialLinks: [],
        buttons: [],
        error: error.message
      })
    }
  }

  const pageSnapshot = {
    html: hasCliFlag('--debug') ? await page.content() : '',
    allLinks: frameSnapshots.flatMap((snapshot) => snapshot.allLinks),
    weeklyItems: frameSnapshots.flatMap((snapshot) => snapshot.weeklyItems),
    materialLinks: frameSnapshots.flatMap((snapshot) => snapshot.materialLinks),
    buttons: frameSnapshots.flatMap((snapshot) => snapshot.buttons),
    frames: frameSnapshots
  }

  await maybeSavePageDebugSnapshot(sourceUrl, pageSnapshot, course)

  return pageSnapshot
}

async function expandWeeklyLearningFrame(page) {
  const moduleBuilderFrame = page
    .frames()
    .find((frame) => frame.url().includes('/learningx/lti/modulebuilder'))

  if (!moduleBuilderFrame) {
    return
  }

  try {
    const didClickExpandAll = await moduleBuilderFrame.evaluate(() => {
      const button = document.querySelector('.xnmb-all_fold-btn')

      if (!button) {
        return false
      }

      button.click()
      return true
    })

    if (didClickExpandAll) {
      await page.waitForTimeout(2500)
      return
    }

    await moduleBuilderFrame.evaluate(() => {
      document
        .querySelectorAll('.xnmb-module-left-wrapper[aria-expanded="false"]')
        .forEach((button) => button.click())
    })

    await page.waitForTimeout(2000)
  } catch (error) {
    console.log(`Could not expand weekly learning frame: ${error.message}`)
  }
}

async function collectLinksFromFrame(frame, sourceUrl, shouldCollectDebugHtml) {
  return frame.evaluate(
    ({ currentSourceUrl, collectDebugHtml }) => {
      const ignoredExtensions = new Set(['html', 'htm', 'php', 'aspx', 'asp', 'jsp', 'do'])
      const fileLikePattern = /\.([a-z0-9][a-z0-9_-]{0,15})(?=$|[?#])/i
      const canvasFilePattern = /\/(files|courses\/\d+\/files)\/\d+/i
      const hasDownloadableExtension = (value) => {
        const match = value.match(fileLikePattern)

        return match ? !ignoredExtensions.has(match[1].toLowerCase()) : false
      }

      const allLinks = [...document.querySelectorAll('a[href]')].map((link) => ({
        sourceUrl: currentSourceUrl,
        frameUrl: location.href,
        title: link.textContent.replace(/\s+/g, ' ').trim(),
        url: new URL(link.getAttribute('href'), location.href).href
      }))
      const fileElements = [
        ...document.querySelectorAll(
          '[class*="file"], [class*="attachment"], [class*="content"], [data-file-id], [data-content-id]'
        )
      ].map((element) => ({
        title: element.textContent.replace(/\s+/g, ' ').trim(),
        className: element.className?.toString() ?? '',
        fileId: element.getAttribute('data-file-id') ?? '',
        contentId: element.getAttribute('data-content-id') ?? '',
        href: element.getAttribute('href') ?? ''
      }))
      const ignoredIconClasses = new Set(['xnmb-module_item-icon'])
      const weeklyItems = [...document.querySelectorAll('.xnmb-module_item-outer-wrapper')]
        .map((item) => {
          const titleLink = item.querySelector('.xnmb-module_item-left-title')
          const icon = item.querySelector('.xnmb-module_item-icon')
          const iconClasses = icon?.className?.toString().split(/\s+/) ?? []
          const itemType = iconClasses.find((className) => !ignoredIconClasses.has(className)) ?? ''
          const href = titleLink?.getAttribute('href') ?? ''
          const progressElement = item.querySelector(
            '[class*="progress"], [class*="percentage"], [class*="percent"], [class*="rate"]'
          )
          const progressText = progressElement?.textContent.replace(/\s+/g, ' ').trim() ?? ''
          const progressAttribute =
            progressElement?.getAttribute('aria-valuenow') ??
            progressElement?.getAttribute('data-progress') ??
            progressElement?.getAttribute('data-percentage') ??
            ''
          const progressAttributeNumber = progressAttribute === '' ? NaN : Number(progressAttribute)
          const progressMatch = progressText.match(/(\d+(?:\.\d+)?)\s*%/)
          const progressPercent = Number.isFinite(progressAttributeNumber)
            ? progressAttributeNumber
            : progressMatch
              ? Number(progressMatch[1])
              : null

          return {
            sourceUrl: currentSourceUrl,
            frameUrl: location.href,
            title:
              titleLink?.textContent.replace(/\s+/g, ' ').trim() ??
              item.textContent.replace(/\s+/g, ' ').trim(),
            type: itemType,
            week:
              item
                .querySelector('.xnmb-module_item-meta_data-lesson_periods-week')
                ?.textContent.replace(/\s+/g, ' ')
                .trim() ?? '',
            lesson:
              item
                .querySelector('.xnmb-module_item-meta_data-lesson_periods-lesson')
                ?.textContent.replace(/\s+/g, ' ')
                .trim() ?? '',
            status:
              item
                .querySelector('.xnmb-module_item-meta_data-attendance_status')
                ?.textContent.replace(/\s+/g, ' ')
                .trim() ?? '',
            progressText,
            progressPercent,
            periodText:
              item
                .querySelector(
                  '.xnlal-attendance-list-item-meta_data-lecture_periods, .xnmb-module_item-meta_data-lecture_periods'
                )
                ?.textContent.replace(/\s+/g, ' ')
                .trim() ?? '',
            url: href ? new URL(href, location.href).href : ''
          }
        })
        .filter((item) => item.title && item.url)

      return {
        frameUrl: location.href,
        html: collectDebugHtml ? document.documentElement.outerHTML : '',
        allLinks,
        weeklyItems,
        materialLinks: allLinks.filter(
          (link) =>
            link.title && (hasDownloadableExtension(link.url) || canvasFilePattern.test(link.url))
        ),
        buttons: [...document.querySelectorAll('button')]
          .map((button) => ({
            title: button.textContent.replace(/\s+/g, ' ').trim(),
            ariaLabel: button.getAttribute('aria-label') ?? ''
          }))
          .filter((button) => button.title || button.ariaLabel),
        fileElements
      }
    },
    { currentSourceUrl: sourceUrl, collectDebugHtml: shouldCollectDebugHtml }
  )
}

async function maybeSavePageDebugSnapshot(sourceUrl, pageSnapshot, course) {
  if (!hasCliFlag('--debug')) {
    console.log(
      `Collected weekly-learning: ${pageSnapshot.weeklyItems.length} weekly items, ${pageSnapshot.materialLinks.length} direct material links`
    )
    return
  }

  const courseLabel = sanitizeFileName(
    course?.courseName || `course-${parseCourseId(sourceUrl) ?? 'unknown'}`
  )
  const pageName = 'weekly-learning'
  const debugDirectory = path.join(outputRoot, 'debug')

  await mkdir(debugDirectory, { recursive: true })
  await writeFile(path.join(debugDirectory, `${courseLabel}-${pageName}.html`), pageSnapshot.html)
  await writeFile(
    path.join(debugDirectory, `${courseLabel}-${pageName}-links.json`),
    JSON.stringify(
      {
        allLinks: pageSnapshot.allLinks,
        weeklyItems: pageSnapshot.weeklyItems,
        materialLinks: pageSnapshot.materialLinks,
        buttons: pageSnapshot.buttons,
        fileElements: pageSnapshot.frames.flatMap((snapshot) => snapshot.fileElements ?? []),
        frames: pageSnapshot.frames.map((snapshot) => ({
          frameUrl: snapshot.frameUrl,
          linkCount: snapshot.allLinks.length,
          weeklyItemCount: snapshot.weeklyItems?.length ?? 0,
          materialCount: snapshot.materialLinks.length,
          error: snapshot.error
        }))
      },
      null,
      2
    )
  )

  for (const [index, frameSnapshot] of pageSnapshot.frames.entries()) {
    await writeFile(
      path.join(debugDirectory, `${courseLabel}-${pageName}-frame-${index}.html`),
      frameSnapshot.html
    )
  }

  console.log(
    `Debug ${pageName}: ${pageSnapshot.allLinks.length} links, ${pageSnapshot.weeklyItems.length} weekly items, ${pageSnapshot.materialLinks.length} material candidates`
  )
}

async function collectLinksWithFallback(page, sourceUrl, course) {
  const pageSnapshot = await collectLinksFromPage(page, sourceUrl, course)
  const materialLinks = pageSnapshot.materialLinks.map((link) => ({
    ...link,
    courseId: course.courseId,
    courseName: course.courseName
  }))
  const weeklyItems = pageSnapshot.weeklyItems.map((item) => ({
    ...item,
    courseId: course.courseId,
    courseName: course.courseName
  }))

  return {
    materialLinks: uniqueBy(materialLinks, (link) => link.url),
    weeklyItems: uniqueBy(weeklyItems, (item) => item.url)
  }
}

// 교수가 다운로드 기간을 닫아버린 자료는 링크만 남아있고 파일도, 다운로드
// 버튼도 없어 매번 새로고침할 때마다 새 탭을 열고 못 찾은 뒤 닫는 시간이
// 그대로 낭비된다. 한 번 실패로 바로 영구 제외하면 일시적 네트워크 문제로
// 우연히 한 번 실패한 것까지 영영 안 받게 될 수 있어, 연속 2회 실패해야
// "확정 unresolved"로 등록해 이후엔 아예 열어보지도 않고 건너뛴다. 나중에
// 교수가 기간을 다시 열면 이 파일(weekly-learning-unresolved.json)에서 해당
// 항목을 지우거나 파일 전체를 지우면 다시 시도한다
const MIN_FAILURES_BEFORE_SKIP = 2

async function loadUnresolvedRecord(unresolvedMaterialsPath) {
  const map = new Map()

  try {
    const raw = await readFile(unresolvedMaterialsPath, 'utf8')
    for (const record of JSON.parse(raw)) {
      if (record?.url) map.set(record.url, record)
    }
  } catch {
    // 파일이 없거나 깨졌으면 빈 상태로 시작 (아래에서 새로 만들어짐)
  }

  return map
}

async function downloadWeeklyMaterials(page, browserContext, weeklyMaterialItems) {
  console.log(`Resolving ${weeklyMaterialItems.length} weekly material items...`)

  const canvasModuleItems = await collectCanvasModuleItemsApi(page, weeklyMaterialItems)
  const canvasModuleItemsPath = path.join(outputRoot, 'canvas-module-items.json')
  const resolvedMaterialsPath = path.join(outputRoot, 'weekly-learning-resolved-downloads.json')
  const downloadedMaterialsPath = path.join(outputRoot, 'weekly-learning-downloaded-materials.json')
  const unresolvedMaterialsPath = path.join(outputRoot, 'weekly-learning-unresolved.json')
  const resolvedMaterials = []
  const downloadedMaterials = []
  const directoryFileCache = new Map()
  const unresolvedRecord = await loadUnresolvedRecord(unresolvedMaterialsPath)

  await writeFile(canvasModuleItemsPath, JSON.stringify([...canvasModuleItems.values()], null, 2))
  console.log(`Saved Canvas module item metadata to ${canvasModuleItemsPath}`)

  for (const [index, item] of weeklyMaterialItems.entries()) {
    const itemLabel = `[${index + 1}/${weeklyMaterialItems.length}] ${item.courseName} - ${item.title}`
    const unresolvedEntry = unresolvedRecord.get(item.url)

    if (unresolvedEntry?.confirmed) {
      console.log(`- skipped known-unresolved ${itemLabel}`)
      continue
    }

    const existingPath = await findExistingDownloadedFile(item, directoryFileCache)

    if (existingPath) {
      downloadedMaterials.push({
        ...item,
        savedPath: existingPath,
        skipped: true
      })
      await writeFile(downloadedMaterialsPath, JSON.stringify(downloadedMaterials, null, 2))
      console.log(`- skipped existing ${itemLabel}`)
      continue
    }

    const canvasModuleItem = canvasModuleItems.get(item.url)
    console.log(`- downloading ${itemLabel}`)
    const itemPage = await browserContext.newPage()
    let result

    try {
      result = await withTimeout(
        processMaterialDownload(itemPage, item, canvasModuleItem),
        hasCliFlag('--deep') ? 45000 : 12000,
        `timed out ${itemLabel}`
      )
    } catch (error) {
      console.log(`- failed ${itemLabel}: ${error.message}`)
    } finally {
      await itemPage.close().catch(() => {})
    }

    if (!result) {
      console.log(`- unresolved ${itemLabel}`)

      const failCount = (unresolvedEntry?.failCount ?? 0) + 1
      const now = new Date().toISOString()

      unresolvedRecord.set(item.url, {
        url: item.url,
        title: item.title,
        courseName: item.courseName,
        courseId: item.courseId,
        failCount,
        confirmed: failCount >= MIN_FAILURES_BEFORE_SKIP,
        firstFailedAt: unresolvedEntry?.firstFailedAt ?? now,
        lastFailedAt: now
      })
      await writeFile(
        unresolvedMaterialsPath,
        JSON.stringify([...unresolvedRecord.values()], null, 2)
      )
      continue
    }

    // 이번엔 성공했으니(예전에 한 번 실패했던 기록이 있었다면) 지워서 다음에도
    // 정상적으로 다시 시도되게 한다
    if (unresolvedRecord.delete(item.url)) {
      await writeFile(
        unresolvedMaterialsPath,
        JSON.stringify([...unresolvedRecord.values()], null, 2)
      )
    }

    if (result.kind === 'downloaded') {
      downloadedMaterials.push(result.material)
      addDownloadedFileToCache(result.material.savedPath, directoryFileCache)
      await writeFile(downloadedMaterialsPath, JSON.stringify(downloadedMaterials, null, 2))
      console.log(`- downloaded ${itemLabel}`)
      continue
    }

    resolvedMaterials.push(result.material)
    await writeFile(resolvedMaterialsPath, JSON.stringify(resolvedMaterials, null, 2))
    console.log(`- resolved ${itemLabel}`)
  }

  await writeFile(resolvedMaterialsPath, JSON.stringify(resolvedMaterials, null, 2))
  await writeFile(downloadedMaterialsPath, JSON.stringify(downloadedMaterials, null, 2))
  console.log(`Resolved ${resolvedMaterials.length} downloads.`)
  console.log(`Saved to ${resolvedMaterialsPath}`)
  console.log(`Downloaded ${downloadedMaterials.length} files from embedded viewers.`)
  console.log(`Saved download records to ${downloadedMaterialsPath}`)

  await downloadMaterials(
    browserContext,
    resolvedMaterials,
    downloadedMaterials,
    downloadedMaterialsPath
  )
}

async function processMaterialDownload(page, item, canvasModuleItem) {
  const downloadedMaterial = await downloadExternalToolMaterial(page, item, canvasModuleItem)

  if (downloadedMaterial) {
    return {
      kind: 'downloaded',
      material: downloadedMaterial
    }
  }

  const resolvedMaterial =
    createDownloadCandidateFromCanvasModuleItem(item, canvasModuleItem) ??
    (canvasModuleItem?.type === 'ExternalTool'
      ? null
      : await resolveExternalToolDownload(page, item, canvasModuleItem)) ??
    (await resolveDownloadFromModuleItem(page, item))

  if (!resolvedMaterial) {
    await saveUnresolvedDownloadDebugSnapshot(page, item, canvasModuleItem)
    return null
  }

  return {
    kind: 'resolved',
    material: resolvedMaterial
  }
}

async function withTimeout(promise, timeoutMs, message) {
  let timeoutId

  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs)
  })

  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timeoutId)
  }
}

async function saveUnresolvedDownloadDebugSnapshot(page, item, canvasModuleItem) {
  const debugDirectory = path.join(outputRoot, 'debug')
  const debugPath = path.join(
    debugDirectory,
    `unresolved-${sanitizeFileName(item.courseName || item.courseId)}-${sanitizeFileName(item.title)}.json`
  )

  const frames = []

  for (const frame of page.frames()) {
    try {
      frames.push({
        frameUrl: frame.url(),
        title: await frame.title().catch(() => ''),
        entries: await frame.evaluate(() =>
          [
            ...document.querySelectorAll(
              'a[href],button,iframe[src],embed[src],object[data],source[src],form[action],[role="button"],[title],[aria-label]'
            )
          ]
            .map((element) => ({
              tag: element.tagName,
              className: element.className?.toString?.() || '',
              id: element.id || '',
              title: element.getAttribute('title') || '',
              ariaLabel: element.getAttribute('aria-label') || '',
              text: (element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200),
              href:
                element.getAttribute('href') ||
                element.getAttribute('src') ||
                element.getAttribute('data') ||
                element.getAttribute('action') ||
                ''
            }))
            .slice(0, 300)
        )
      })
    } catch (error) {
      frames.push({
        frameUrl: frame.url(),
        error: error.message
      })
    }
  }

  await mkdir(debugDirectory, { recursive: true })
  await writeFile(
    debugPath,
    JSON.stringify(
      {
        item,
        canvasModuleItem,
        pageUrl: page.url(),
        pageTitle: await page.title().catch(() => ''),
        frames
      },
      null,
      2
    )
  )
}

function createDownloadCandidateFromCanvasModuleItem(item, canvasModuleItem) {
  if (!canvasModuleItem) {
    return null
  }

  if (canvasModuleItem.type === 'File' && canvasModuleItem.content_id) {
    const downloadUrl = `https://khcanvas.khu.ac.kr/courses/${item.courseId}/files/${canvasModuleItem.content_id}/download?download_frd=1`

    return {
      ...item,
      fileId: String(canvasModuleItem.content_id),
      fileName: canvasModuleItem.title || item.title,
      downloadUrl,
      url: downloadUrl
    }
  }

  return createDownloadCandidateFromUrl(
    {
      ...item,
      fileName: canvasModuleItem.title || item.title
    },
    canvasModuleItem.html_url || canvasModuleItem.url || '',
    canvasModuleItem.title || item.title
  )
}

async function downloadExternalToolMaterial(page, item, canvasModuleItem) {
  if (canvasModuleItem?.type !== 'ExternalTool') {
    return null
  }

  const didLaunch = await launchExternalToolPage(page, canvasModuleItem)

  if (didLaunch) {
    await waitForExternalToolContent(page)
    await revealEmbeddedViewerControls(page)

    const directLaunchDownload = await clickEmbeddedViewerDownload(page, item)

    if (directLaunchDownload) {
      return directLaunchDownload
    }
  }

  if (!hasCliFlag('--deep')) {
    return null
  }

  const didLaunchFromWeeklyList = await launchExternalToolFromWeeklyLearningList(page, item)

  if (!didLaunchFromWeeklyList) {
    return null
  }

  await waitForExternalToolContent(page)
  await revealEmbeddedViewerControls(page)

  return clickEmbeddedViewerDownload(page, item)
}

async function launchExternalToolFromWeeklyLearningList(page, item) {
  const moduleItemId = parseModuleItemId(item.url)

  if (!item.sourceUrl || !moduleItemId) {
    return false
  }

  try {
    await page.goto(item.sourceUrl, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(2000)
    await expandWeeklyLearningFrame(page)
  } catch (error) {
    console.log(`- failed to reopen weekly-learning for ${item.title}: ${error.message}`)
    return false
  }

  const moduleBuilderFrame = page
    .frames()
    .find((frame) => frame.url().includes('/learningx/lti/modulebuilder'))

  if (!moduleBuilderFrame) {
    return false
  }

  try {
    const link = moduleBuilderFrame.locator(`a[href*="/modules/items/${moduleItemId}"]`).first()

    if ((await link.count()) === 0) {
      return false
    }

    await link.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {})
    await link.click({ timeout: 8000 })
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {})
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
    await page.waitForTimeout(3000)
    return true
  } catch (error) {
    console.log(`- failed to click weekly-learning item ${item.title}: ${error.message}`)
    return false
  }
}

async function waitForExternalToolContent(page) {
  const maxAttempts = hasCliFlag('--deep') ? 4 : 2

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const hasDownloadCandidate = await pageHasDownloadCandidate(page)

    if (hasDownloadCandidate) {
      return
    }

    await revealEmbeddedViewerControls(page, 250)
    await scrollExternalToolFrames(page)
    await page.waitForTimeout(500)
  }
}

async function pageHasDownloadCandidate(page) {
  for (const frame of page.frames()) {
    try {
      const hasCandidate = await frame.evaluate(() => {
        const selector = [
          'iframe[src]',
          'embed[src]',
          'object[data]',
          'source[src]',
          'a[href*="/download"]',
          'a[href*="/files/"]',
          '.xnbc-file-download-icon',
          '.vc-pctrl-download-btn',
          '.vc-pctrl-download',
          '[class*="download" i]',
          '[title*="download" i]',
          '[aria-label*="download" i]',
          '[title*="다운로드"]',
          '[aria-label*="다운로드"]'
        ].join(',')

        return Boolean(document.querySelector(selector))
      })

      if (hasCandidate) {
        return true
      }
    } catch {
      // Some nested external frames are protected. Other frames can still expose the controls.
    }
  }

  return false
}

async function scrollExternalToolFrames(page) {
  for (const frame of page.frames()) {
    try {
      await frame.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight)
        document.scrollingElement?.scrollTo(0, document.scrollingElement.scrollHeight)
      })
    } catch {
      // Cross-origin frames can reject scrolling.
    }
  }
}

async function revealEmbeddedViewerControls(page, initialDelay = 1000) {
  await page.waitForTimeout(initialDelay)

  try {
    const viewport = page.viewportSize() ?? { width: 1280, height: 720 }

    await page.mouse.move(viewport.width / 2, viewport.height / 2)
    await page.mouse.move(viewport.width - 120, 80)
    await page.waitForTimeout(500)
  } catch {
    // Viewer controls are still discovered by selectors below if mouse movement is unavailable.
  }

  for (const frame of page.frames()) {
    try {
      await frame.evaluate(() => {
        window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }))
        document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }))
      })
    } catch {
      // Cross-origin frames can reject injected events.
    }
  }
}

async function clickEmbeddedViewerDownload(page, item) {
  const downloadSelectors = [
    '.xnbc-file-download-icon',
    '.vc-pctrl-download-btn',
    '.vc-pctrl-download',
    '[class*="download-btn" i]',
    '[class*="download_button" i]',
    '[class*="download-button" i]',
    '[title*="download" i]',
    '[aria-label*="download" i]',
    '[title*="다운로드"]',
    '[aria-label*="다운로드"]',
    'button:has-text("다운로드")',
    'a:has-text("다운로드")',
    '[role="button"]:has-text("다운로드")',
    'button:has-text("Download")',
    'a:has-text("Download")',
    '[role="button"]:has-text("Download")'
  ]

  for (const frame of prioritizeDownloadFrames(page.frames())) {
    for (const selector of downloadSelectors) {
      const material = await clickFirstDownloadMatch(page, frame, selector, item)

      if (material) {
        return material
      }
    }
  }

  return null
}

function prioritizeDownloadFrames(frames) {
  return [...frames].sort((a, b) => getFrameDownloadPriority(b) - getFrameDownloadPriority(a))
}

function getFrameDownloadPriority(frame) {
  const url = frame.url()

  if (url.includes('commons.khu.ac.kr')) {
    return 3
  }

  if (url.includes('/learningx/')) {
    return 2
  }

  return 1
}

async function clickFirstDownloadMatch(page, frame, selector, item) {
  let locator
  let count

  try {
    locator = frame.locator(selector)
    count = Math.min(await locator.count(), 2)
  } catch {
    return null
  }

  for (let index = 0; index < count; index += 1) {
    const candidate = locator
      .nth(index)
      .locator('xpath=ancestor-or-self::*[self::button or self::a or @role="button"][1]')
      .or(locator.nth(index))
      .first()

    try {
      const downloadPromise = page.waitForEvent('download', {
        timeout: hasCliFlag('--deep') ? 3500 : 1500
      })

      await candidate.click({ force: true, timeout: 1500 })

      const download = await downloadPromise
      const material = {
        ...item,
        fileName: download.suggestedFilename() || item.title,
        downloadUrl: download.url(),
        url: download.url()
      }
      const targetPath = createDownloadedFilePath(material)

      await mkdir(path.dirname(targetPath), { recursive: true })
      await download.saveAs(targetPath)

      return {
        ...material,
        savedPath: targetPath
      }
    } catch {
      // Keep trying other download-looking controls in the same launched viewer.
    }
  }

  return null
}

async function resolveExternalToolDownload(page, item, canvasModuleItem) {
  if (!canvasModuleItem?.url || canvasModuleItem.type !== 'ExternalTool') {
    return null
  }

  const didLaunch = await launchExternalToolPage(page, canvasModuleItem)

  if (!didLaunch) {
    return null
  }

  await waitForExternalToolContent(page)

  const currentPageCandidate = createDownloadCandidateFromUrl(item, page.url(), item.title)

  if (currentPageCandidate) {
    return currentPageCandidate
  }

  const candidates = []

  for (const frame of page.frames()) {
    try {
      candidates.push(...(await collectDownloadCandidatesFromFrame(frame, item)))
    } catch {
      // External tool pages can include protected preview frames.
    }
  }

  return chooseBestDownloadCandidate(candidates)
}

async function launchExternalToolPage(page, canvasModuleItem) {
  if (!canvasModuleItem?.url) {
    return false
  }

  let launchUrl

  try {
    if (!page.url().startsWith('https://khcanvas.khu.ac.kr')) {
      await page.goto(dashboardUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    }

    const launch = await page.evaluate(async (sessionlessLaunchUrl) => {
      const response = await fetch(sessionlessLaunchUrl, {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' }
      })

      if (!response.ok) {
        return null
      }

      return response.json()
    }, canvasModuleItem.url)

    launchUrl = launch?.url
  } catch {
    return false
  }

  if (!launchUrl) {
    return false
  }

  try {
    await page.goto(launchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
    await page.waitForTimeout(hasCliFlag('--deep') ? 2500 : 800)
    return true
  } catch (error) {
    console.log(`- failed to launch ${canvasModuleItem.title}: ${error.message}`)
    return false
  }
}

async function resolveDownloadFromModuleItem(page, item) {
  const directCandidate = createDownloadCandidateFromUrl(item, item.url, item.title)

  if (directCandidate?.downloadUrl !== item.url) {
    return directCandidate
  }

  try {
    await page.goto(item.url, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)
  } catch (error) {
    console.log(`- failed to open ${item.title}: ${error.message}`)
    return null
  }

  const currentPageCandidate = createDownloadCandidateFromUrl(item, page.url(), item.title)

  if (currentPageCandidate) {
    return currentPageCandidate
  }

  const candidates = []

  for (const frame of page.frames()) {
    try {
      candidates.push(...(await collectDownloadCandidatesFromFrame(frame, item)))
    } catch {
      // Some cross-origin preview frames can be inaccessible. Other frames usually contain the link.
    }
  }

  return chooseBestDownloadCandidate(candidates)
}

async function collectDownloadCandidatesFromFrame(frame, item) {
  const urls = await frame.evaluate(() => {
    const elements = [
      ...document.querySelectorAll('a[href], iframe[src], embed[src], object[data], source[src]')
    ]

    return [
      {
        title: document.title || '',
        url: location.href
      },
      ...elements.map((element) => ({
        title:
          element.textContent?.replace(/\s+/g, ' ').trim() ||
          element.getAttribute('title') ||
          element.getAttribute('aria-label') ||
          element.getAttribute('download') ||
          '',
        url:
          element.getAttribute('href') ||
          element.getAttribute('src') ||
          element.getAttribute('data') ||
          ''
      }))
    ]
      .filter((entry) => entry.url)
      .map((entry) => ({
        title: entry.title,
        url: new URL(entry.url, location.href).href
      }))
  })

  return urls
    .map((entry) => createDownloadCandidateFromUrl(item, entry.url, entry.title))
    .filter(Boolean)
}

function chooseBestDownloadCandidate(candidates) {
  const uniqueCandidates = uniqueBy(candidates, (candidate) => candidate.downloadUrl)

  return (
    uniqueCandidates.find((candidate) => candidate.downloadUrl.includes('/download')) ??
    uniqueCandidates[0] ??
    null
  )
}

// resolvedMaterials(직접 URL로 받는 파일들)는 지금까지 매번 무조건
// browserContext.request.get()으로 다시 받아썼다 — 이미 받아둔 파일이어도
// 확인 없이 재다운로드/덮어쓰기했다는 뜻. createDownloadedFilePath로 나오는
// 저장 경로가 courseName/courseId/title로부터 결정적으로 정해지므로, 그 경로에
// 파일이 이미 있으면 새로 받지 않고 건너뛴다(기록 문서에도 남겨 두 다운로드
// 경로의 "이미 받음" 판정을 하나로 통일한다)
async function downloadMaterials(
  browserContext,
  materials,
  downloadedMaterials = [],
  downloadedMaterialsPath = null
) {
  console.log(`Downloading ${materials.length} files...`)

  for (const material of materials) {
    const targetPath = createDownloadedFilePath(material)

    if (existsSync(targetPath)) {
      console.log(`- skipped existing ${material.title}`)
      if (downloadedMaterialsPath) {
        downloadedMaterials.push({ ...material, savedPath: targetPath, skipped: true })
        await writeFile(downloadedMaterialsPath, JSON.stringify(downloadedMaterials, null, 2))
      }
      continue
    }

    await mkdir(path.dirname(targetPath), { recursive: true })

    const response = await browserContext.request.get(material.downloadUrl ?? material.url)

    if (!response.ok()) {
      console.log(`- failed ${material.title}: HTTP ${response.status()}`)
      continue
    }

    await writeFile(targetPath, await response.body())
    console.log(`- saved ${targetPath}`)

    if (downloadedMaterialsPath) {
      downloadedMaterials.push({ ...material, savedPath: targetPath })
      await writeFile(downloadedMaterialsPath, JSON.stringify(downloadedMaterials, null, 2))
    }
  }
}

export { collectLinksWithFallback, downloadWeeklyMaterials, isWeeklyMaterialItem }
