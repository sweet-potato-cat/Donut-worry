import { collectCanvasAssignmentsApi } from '../core/canvas-api.mjs'
import {
  compareByCourseOrder,
  compareByDateAsc,
  createCourseOrderMap
} from '../utils/sort-utils.mjs'

const submittedStates = new Set(['submitted', 'graded', 'pending_review'])
const nonSubmitTypes = new Set(['none', 'not_graded'])

async function collectAssignmentRecords(page, courses) {
  const courseOrderMap = createCourseOrderMap(courses)
  const assignments = (await collectCanvasAssignmentsApi(page, courses))
    .map(createAssignmentRecord)
    .filter(isActualAssignment)
    .sort((a, b) => compareByCourseOrder(a, b, courseOrderMap) || compareAssignmentsByDueAt(a, b))
  const unsubmittedAssignments = assignments.filter(isUnsubmittedAssignment)

  return {
    assignments,
    unsubmittedAssignments
  }
}

function createAssignmentRecord(assignment) {
  const submission = assignment.submission ?? {}
  const submissionTypes = assignment.submission_types ?? []
  const dueAt = assignment.due_at ?? null
  const lockAt = assignment.lock_at ?? null
  const now = Date.now()
  const dueTime = dueAt ? Date.parse(dueAt) : NaN
  const lockTime = lockAt ? Date.parse(lockAt) : NaN
  const timeRemainingMs = Number.isFinite(dueTime) ? dueTime - now : null
  const isOverdue = Number.isFinite(dueTime) ? dueTime < now : false
  const isLocked = Number.isFinite(lockTime) ? lockTime < now : false

  return {
    courseId: assignment.courseId,
    courseName: assignment.courseName,
    courseCode: assignment.courseCode,
    assignmentId: String(assignment.id),
    title: assignment.name ?? '',
    descriptionText: stripHtml(assignment.description ?? ''),
    htmlUrl: assignment.html_url ?? '',
    dueAt,
    unlockAt: assignment.unlock_at ?? null,
    lockAt,
    pointsPossible: assignment.points_possible ?? null,
    gradingType: assignment.grading_type ?? '',
    submissionTypes,
    allowedExtensions: assignment.allowed_extensions ?? [],
    published: assignment.published ?? true,
    submissionStatus: submission.workflow_state ?? '',
    submittedAt: submission.submitted_at ?? null,
    gradedAt: submission.graded_at ?? null,
    score: submission.score ?? null,
    missing: Boolean(submission.missing),
    late: Boolean(submission.late),
    excused: Boolean(submission.excused),
    isLocked,
    isOverdue,
    timeRemainingMs,
    isUnsubmitted: isSubmissionMissing(submission),
    priority: calculateAssignmentPriority({
      dueAt,
      isOverdue,
      pointsPossible: assignment.points_possible ?? null
    })
  }
}

function isActualAssignment(assignment) {
  if (!assignment.assignmentId || !assignment.title || assignment.published === false) {
    return false
  }

  if (assignment.excused) {
    return false
  }

  return assignment.submissionTypes.some((type) => !nonSubmitTypes.has(String(type).toLowerCase()))
}

function isUnsubmittedAssignment(assignment) {
  return assignment.isUnsubmitted
}

function isSubmissionMissing(submission) {
  if (submission.excused) {
    return false
  }

  const workflowState = String(submission.workflow_state ?? '').toLowerCase()

  if (submission.submitted_at || submittedStates.has(workflowState)) {
    return false
  }

  return true
}

function calculateAssignmentPriority({ dueAt, isOverdue, pointsPossible }) {
  if (isOverdue) {
    return 'overdue'
  }

  if (!dueAt) {
    return 'no-due-date'
  }

  const dueTime = Date.parse(dueAt)

  if (!Number.isFinite(dueTime)) {
    return 'unknown'
  }

  const hoursLeft = (dueTime - Date.now()) / (1000 * 60 * 60)

  if (hoursLeft <= 24) {
    return 'today'
  }

  if (hoursLeft <= 72) {
    return 'soon'
  }

  if (Number(pointsPossible) >= 20) {
    return 'high-points'
  }

  return 'normal'
}

function compareAssignmentsByDueAt(a, b) {
  const dueCompare = compareByDateAsc(a.dueAt, b.dueAt)

  if (dueCompare !== 0) {
    return dueCompare
  }

  return a.title.localeCompare(b.title, 'ko')
}

function stripHtml(value) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export { collectAssignmentRecords, isActualAssignment, isUnsubmittedAssignment }
