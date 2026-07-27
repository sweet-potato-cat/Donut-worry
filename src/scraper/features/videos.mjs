import {
  compareByCourseOrder,
  compareWeeklyLearningOrder,
  createCourseOrderMap
} from '../utils/sort-utils.mjs'

const videoTypes = new Set(['movie', 'video', 'vod', 'everlec'])
const completedStatuses = new Set(['\ucd9c\uc11d', 'completed', 'complete'])

function isVideoItem(item) {
  return videoTypes.has(item.type?.toLowerCase())
}

function collectVideoRecords(weeklyItems, courses = []) {
  const courseOrderMap = createCourseOrderMap(courses)
  const videos = weeklyItems
    .filter(isVideoItem)
    .map(createVideoRecord)
    .sort((a, b) => compareByCourseOrder(a, b, courseOrderMap) || compareWeeklyLearningOrder(a, b))

  return {
    videos,
    incompleteVideos: videos.filter((video) => video.progressPercent < 100)
  }
}

function createVideoRecord(item) {
  const reportedProgress = normalizeProgressPercent(item.progressPercent)
  const normalizedStatus = item.status?.trim().toLowerCase() ?? ''
  const progressPercent = reportedProgress ?? (completedStatuses.has(normalizedStatus) ? 100 : 0)

  return {
    ...item,
    progressPercent,
    progressSource: reportedProgress === null ? 'attendance-status' : 'page-progress',
    isCompleted: progressPercent === 100
  }
}

function normalizeProgressPercent(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const number = Number(value)

  if (!Number.isFinite(number)) {
    return null
  }

  return Math.min(100, Math.max(0, number))
}

export { collectVideoRecords, isVideoItem }
