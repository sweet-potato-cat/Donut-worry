import { readdir } from 'node:fs/promises'
import path from 'node:path'

import { ignoredDownloadExtensions, outputRoot, weeklyMaterialTypes } from '../core/constants.mjs'

function getFileExtensionFromValue(value) {
  const match = value.match(/\.([a-z0-9][a-z0-9_-]{0,15})(?=$|[?#])/i)

  if (!match) {
    return ''
  }

  const extension = match[1].toLowerCase()

  return ignoredDownloadExtensions.has(extension) ? '' : `.${extension}`
}

function stripFileExtension(value) {
  return value.replace(/\.[a-z0-9][a-z0-9_-]{0,15}$/i, '')
}

function sanitizeFileName(value) {
  return value
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
}

function createCourseFilePrefix(courseName, courseId) {
  const courseLabel = sanitizeFileName(courseName || `course-${courseId || 'unknown'}`)
    .replace(/\s+[A-Z]?\d+\s*분반$/i, '')
    .trim()

  return `[${courseLabel}]`
}

function parseModuleItemId(url) {
  return url.match(/\/modules\/items\/(\d+)/)?.[1] ?? null
}

function createDownloadedFilePath(material) {
  const courseDirectory = createDownloadedCourseDirectory(material)
  const fileName = createDownloadFileName(material)

  return path.join(courseDirectory, fileName)
}

function createDownloadedCourseDirectory(material) {
  return path.join(
    outputRoot,
    'courses',
    sanitizeFileName(material.courseName || `course-${material.courseId}`)
  )
}

function createDownloadFileName(material) {
  const title = material.title || material.fileName || path.basename(new URL(material.url).pathname)
  const extension = inferFileExtension(material)
  const sanitizedTitle = stripFileExtension(sanitizeFileName(title))
  const coursePrefix = createCourseFilePrefix(material.courseName, material.courseId)

  if (sanitizedTitle.startsWith(coursePrefix)) {
    return `${sanitizedTitle}${extension}`
  }

  return `${coursePrefix} ${sanitizedTitle}${extension}`
}

function inferFileExtension(material) {
  const values = [material.fileName, material.title, material.downloadUrl, material.url]
    .filter(Boolean)
    .map((value) => {
      try {
        return decodeURIComponent(value)
      } catch {
        return value
      }
    })

  for (const value of values) {
    const extension = getFileExtensionFromValue(value)

    if (extension) {
      return extension
    }
  }

  if (weeklyMaterialTypes.has(material.type) && material.type !== 'file') {
    return `.${material.type}`
  }

  return ''
}

function createUnprefixedDownloadBaseName(material) {
  const title = material.title || material.fileName || path.basename(new URL(material.url).pathname)

  return stripFileExtension(sanitizeFileName(title))
}

function createDownloadBaseNames(material) {
  const unprefixedBaseName = createUnprefixedDownloadBaseName(material)
  const coursePrefix = createCourseFilePrefix(material.courseName, material.courseId)

  return new Set([
    unprefixedBaseName,
    unprefixedBaseName.startsWith(coursePrefix)
      ? unprefixedBaseName
      : `${coursePrefix} ${unprefixedBaseName}`
  ])
}

async function findExistingDownloadedFile(material, directoryFileCache) {
  const courseDirectory = createDownloadedCourseDirectory(material)
  const expectedBaseNames = createDownloadBaseNames(material)

  if (!directoryFileCache.has(courseDirectory)) {
    try {
      directoryFileCache.set(courseDirectory, await readdir(courseDirectory))
    } catch {
      directoryFileCache.set(courseDirectory, [])
    }
  }

  const fileNames = directoryFileCache.get(courseDirectory)
  const matchedFileName = fileNames.find((fileName) =>
    expectedBaseNames.has(stripFileExtension(sanitizeFileName(fileName)))
  )

  return matchedFileName ? path.join(courseDirectory, matchedFileName) : null
}

function uniqueBy(items, getKey) {
  const seen = new Set()

  return items.filter((item) => {
    const key = getKey(item)

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function createDownloadCandidateFromUrl(item, rawUrl, title = '') {
  if (!rawUrl) {
    return null
  }

  let url

  try {
    url = new URL(rawUrl)
  } catch {
    return null
  }

  const fileMatch = url.pathname.match(/\/(?:courses\/\d+\/)?files\/(\d+)(?:\/download)?/i)
  const fileExtension = getFileExtensionFromValue(url.pathname)

  if (fileMatch) {
    const coursePrefix = item.courseId ? `/courses/${item.courseId}` : ''
    const downloadUrl = `${url.origin}${coursePrefix}/files/${fileMatch[1]}/download?download_frd=1`

    return {
      ...item,
      fileId: fileMatch[1],
      fileName: title || item.title,
      downloadUrl,
      url: downloadUrl
    }
  }

  if (fileExtension) {
    return {
      ...item,
      fileName: title || path.basename(url.pathname),
      downloadUrl: url.href,
      url: url.href
    }
  }

  return null
}

function addDownloadedFileToCache(savedPath, directoryFileCache) {
  const directory = path.dirname(savedPath)
  const fileName = path.basename(savedPath)

  if (!directoryFileCache.has(directory)) {
    directoryFileCache.set(directory, [])
  }

  directoryFileCache.get(directory).push(fileName)
}

function removeUrlQuery(url) {
  try {
    const parsedUrl = new URL(url)
    parsedUrl.search = ''
    parsedUrl.hash = ''
    return parsedUrl.href
  } catch {
    return url
  }
}

export {
  addDownloadedFileToCache,
  createDownloadCandidateFromUrl,
  createDownloadedFilePath,
  findExistingDownloadedFile,
  getFileExtensionFromValue,
  parseModuleItemId,
  removeUrlQuery,
  sanitizeFileName,
  uniqueBy
}
