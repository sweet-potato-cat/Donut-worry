import { collectCanvasAnnouncementsApi } from '../core/canvas-api.mjs'
import {
  compareByCourseOrder,
  compareByDateDesc,
  createCourseOrderMap
} from '../utils/sort-utils.mjs'

async function collectNoticeRecords(page, courses) {
  const courseOrderMap = createCourseOrderMap(courses)

  return (await collectCanvasAnnouncementsApi(page, courses))
    .map(createNoticeRecord)
    .filter((notice) => notice.noticeId && notice.title)
    .sort((a, b) => compareByCourseOrder(a, b, courseOrderMap) || compareNoticesByPostedAt(a, b))
}

function createNoticeRecord(announcement) {
  return {
    courseId: announcement.courseId,
    courseName: announcement.courseName,
    courseCode: announcement.courseCode,
    noticeId: String(announcement.id),
    title: announcement.title ?? '',
    messageText: stripHtml(announcement.message ?? ''),
    htmlUrl: announcement.html_url ?? '',
    postedAt: announcement.posted_at ?? announcement.created_at ?? null,
    delayedPostAt: announcement.delayed_post_at ?? null,
    lastReplyAt: announcement.last_reply_at ?? null,
    authorName: announcement.author?.display_name ?? announcement.user_name ?? '',
    unreadCount: announcement.unread_count ?? 0,
    isRead: announcement.read_state === 'read',
    isPinned: Boolean(announcement.pinned),
    isLocked: Boolean(announcement.locked),
    attachments: (announcement.attachments ?? []).map(createAttachmentRecord)
  }
}

function createAttachmentRecord(attachment) {
  return {
    fileId: attachment.id ? String(attachment.id) : '',
    fileName: attachment.filename ?? attachment.display_name ?? '',
    contentType: attachment['content-type'] ?? attachment.content_type ?? '',
    size: attachment.size ?? null,
    url: attachment.url ?? ''
  }
}

function compareNoticesByPostedAt(a, b) {
  const postedAtCompare = compareByDateDesc(a.postedAt, b.postedAt)

  if (postedAtCompare !== 0) {
    return postedAtCompare
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

export { collectNoticeRecords }
