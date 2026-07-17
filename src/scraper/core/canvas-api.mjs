import { weeklyLearningToolId } from './constants.mjs'
import { removeUrlQuery, uniqueBy } from '../utils/file-utils.mjs'

async function collectCanvasCoursesApi(page) {
  return page.evaluate(async (currentToolId) => {
    async function fetchAllPages(firstUrl) {
      const results = []
      let nextUrl = firstUrl

      while (nextUrl) {
        const response = await fetch(nextUrl, {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' }
        })

        if (!response.ok) {
          break
        }

        results.push(...(await response.json()))

        const linkHeader = response.headers.get('link') ?? ''
        const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/)
        nextUrl = nextMatch?.[1] ?? null
      }

      return results
    }

    const courses = await fetchAllPages(
      '/api/v1/courses?enrollment_state=active&include[]=term&per_page=100'
    )

    return courses
      .filter((course) => course.id && course.name)
      .map((course) => {
        const courseUrl = `${location.origin}/courses/${course.id}`

        return {
          courseId: String(course.id),
          courseName: course.name,
          courseCode: course.course_code ?? '',
          termName: course.term?.name ?? '',
          courseUrl,
          weeklyLearningUrl: `${courseUrl}/external_tools/${currentToolId}`
        }
      })
  }, weeklyLearningToolId)
}

async function collectCanvasModuleItemsApi(page, weeklyMaterialItems) {
  const courseIds = uniqueBy(
    weeklyMaterialItems.map((item) => item.courseId).filter(Boolean),
    (courseId) => courseId
  )
  const moduleItems = await page.evaluate(async (currentCourseIds) => {
    async function fetchAllPages(firstUrl) {
      const results = []
      let nextUrl = firstUrl

      while (nextUrl) {
        const response = await fetch(nextUrl, {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' }
        })

        if (!response.ok) {
          break
        }

        results.push(...(await response.json()))

        const linkHeader = response.headers.get('link') ?? ''
        const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/)
        nextUrl = nextMatch?.[1] ?? null
      }

      return results
    }

    const results = []

    for (const courseId of currentCourseIds) {
      const modules = await fetchAllPages(
        `/api/v1/courses/${courseId}/modules?include[]=items&per_page=100`
      )

      for (const module of modules) {
        for (const item of module.items ?? []) {
          results.push({
            ...item,
            courseId,
            moduleId: module.id,
            moduleName: module.name ?? ''
          })
        }
      }
    }

    return results
  }, courseIds)
  const moduleItemsByHtmlUrl = new Map()

  for (const item of moduleItems) {
    if (item.html_url) {
      moduleItemsByHtmlUrl.set(removeUrlQuery(item.html_url), item)
    }
  }

  return new Map(
    weeklyMaterialItems
      .map((item) => [item.url, moduleItemsByHtmlUrl.get(removeUrlQuery(item.url))])
      .filter((entry) => entry[1])
  )
}

async function collectCanvasAssignmentsApi(page, courses) {
  const courseSummaries = courses.map((course) => ({
    courseId: course.courseId,
    courseName: course.courseName,
    courseCode: course.courseCode ?? ''
  }))

  return page.evaluate(async (currentCourses) => {
    async function fetchAllPages(firstUrl) {
      const results = []
      let nextUrl = firstUrl

      while (nextUrl) {
        const response = await fetch(nextUrl, {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' }
        })

        if (!response.ok) {
          break
        }

        results.push(...(await response.json()))

        const linkHeader = response.headers.get('link') ?? ''
        const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/)
        nextUrl = nextMatch?.[1] ?? null
      }

      return results
    }

    const results = []

    for (const course of currentCourses) {
      const assignments = await fetchAllPages(
        `/api/v1/courses/${course.courseId}/assignments?include[]=submission&per_page=100`
      )

      results.push(
        ...assignments.map((assignment) => ({
          ...assignment,
          courseId: course.courseId,
          courseName: course.courseName,
          courseCode: course.courseCode
        }))
      )
    }

    return results
  }, courseSummaries)
}

async function collectCanvasAnnouncementsApi(page, courses) {
  const courseSummaries = courses.map((course) => ({
    courseId: course.courseId,
    courseName: course.courseName,
    courseCode: course.courseCode ?? ''
  }))

  return page.evaluate(async (currentCourses) => {
    async function fetchAllPages(firstUrl) {
      const results = []
      let nextUrl = firstUrl

      while (nextUrl) {
        const response = await fetch(nextUrl, {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' }
        })

        if (!response.ok) {
          break
        }

        results.push(...(await response.json()))

        const linkHeader = response.headers.get('link') ?? ''
        const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/)
        nextUrl = nextMatch?.[1] ?? null
      }

      return results
    }

    const results = []

    for (const course of currentCourses) {
      const globalAnnouncements = await fetchAllPages(
        `/api/v1/announcements?context_codes[]=course_${course.courseId}&per_page=100`
      )
      const courseAnnouncements = await fetchAllPages(
        `/api/v1/courses/${course.courseId}/discussion_topics?only_announcements=true&per_page=100`
      )
      const seenAnnouncementIds = new Set()
      const announcements = [...globalAnnouncements, ...courseAnnouncements].filter(
        (announcement) => {
          const key = String(announcement.id ?? announcement.html_url ?? announcement.title ?? '')

          if (!key || seenAnnouncementIds.has(key)) {
            return false
          }

          seenAnnouncementIds.add(key)
          return true
        }
      )

      results.push(
        ...announcements.map((announcement) => ({
          ...announcement,
          courseId: course.courseId,
          courseName: course.courseName,
          courseCode: course.courseCode
        }))
      )
    }

    return results
  }, courseSummaries)
}

export {
  collectCanvasAnnouncementsApi,
  collectCanvasAssignmentsApi,
  collectCanvasCoursesApi,
  collectCanvasModuleItemsApi
}
