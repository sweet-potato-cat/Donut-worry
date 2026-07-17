function createCourseOrderMap(courses) {
  return new Map(courses.map((course, index) => [String(course.courseId), index]))
}

function compareByCourseOrder(a, b, courseOrderMap) {
  const aOrder = courseOrderMap.get(String(a.courseId)) ?? Number.POSITIVE_INFINITY
  const bOrder = courseOrderMap.get(String(b.courseId)) ?? Number.POSITIVE_INFINITY

  if (aOrder !== bOrder) {
    return aOrder - bOrder
  }

  const courseNameCompare = String(a.courseName ?? '').localeCompare(
    String(b.courseName ?? ''),
    'ko'
  )

  if (courseNameCompare !== 0) {
    return courseNameCompare
  }

  return String(a.courseId ?? '').localeCompare(String(b.courseId ?? ''), 'ko')
}

function compareByDateAsc(aDate, bDate) {
  const aTime = aDate ? Date.parse(aDate) : Number.POSITIVE_INFINITY
  const bTime = bDate ? Date.parse(bDate) : Number.POSITIVE_INFINITY

  return aTime - bTime
}

function compareByDateDesc(aDate, bDate) {
  const aTime = aDate ? Date.parse(aDate) : 0
  const bTime = bDate ? Date.parse(bDate) : 0

  return bTime - aTime
}

function compareWeeklyLearningOrder(a, b) {
  const weekCompare = compareTextNumber(a.week, b.week)

  if (weekCompare !== 0) {
    return weekCompare
  }

  const lessonCompare = compareTextNumber(a.lesson, b.lesson)

  if (lessonCompare !== 0) {
    return lessonCompare
  }

  return String(a.title ?? '').localeCompare(String(b.title ?? ''), 'ko')
}

function compareTextNumber(a, b) {
  const aNumber = parseFirstNumber(a)
  const bNumber = parseFirstNumber(b)

  if (aNumber !== bNumber) {
    return aNumber - bNumber
  }

  return String(a ?? '').localeCompare(String(b ?? ''), 'ko')
}

function parseFirstNumber(value) {
  const match = String(value ?? '').match(/\d+/)

  return match ? Number(match[0]) : Number.POSITIVE_INFINITY
}

export {
  compareByCourseOrder,
  compareByDateAsc,
  compareByDateDesc,
  compareWeeklyLearningOrder,
  createCourseOrderMap
}
