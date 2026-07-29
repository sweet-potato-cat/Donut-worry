import { useEffect, useRef, useState } from 'react'
import { BiChevronDown, BiChevronUp, BiLoaderAlt, BiSolidCaretRightCircle } from 'react-icons/bi'
import SyncButton from '../common/SyncButton'

const TITLE_COLOR = '#3a9fe0'
const ACCENT = '#cdeaff'
const INCOMPLETE_COLOR = '#e05263'

function weekLabel(item) {
  const parts = [item.week, item.lesson].filter(Boolean)
  return parts.join(' ')
}

export default function VideoPage() {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(() => new Set())
  const [itemsByCourse, setItemsByCourse] = useState({})
  const expandedRef = useRef(expanded)
  useEffect(() => {
    expandedRef.current = expanded
  }, [expanded])

  const fetchCourses = () => {
    return window.electron?.ipcRenderer.invoke('video:listCourses').then((list) => {
      setCourses(list ?? [])
    })
  }

  const loadItems = (courseName) => {
    setItemsByCourse((prev) => ({ ...prev, [courseName]: 'loading' }))
    window.electron?.ipcRenderer.invoke('video:listByCourse', { courseName }).then((list) => {
      setItemsByCourse((prev) => ({ ...prev, [courseName]: list ?? [] }))
    })
  }

  useEffect(() => {
    let cancelled = false
    Promise.resolve(fetchCourses()).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const toggleCourse = (courseName) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(courseName)) {
        next.delete(courseName)
      } else {
        next.add(courseName)
        if (!itemsByCourse[courseName]) loadItems(courseName)
      }
      return next
    })
  }

  const openVideo = (url) => {
    window.electron?.ipcRenderer.invoke('video:open', { url })
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '28px 0 20px'
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 700, color: TITLE_COLOR, marginBottom: 20 }}>
        동영상
      </div>

      <div style={{ width: '100%', maxWidth: 560, flex: 1, overflowY: 'auto', padding: '0 24px' }}>
        {loading ? (
          <CenterState>
            <BiLoaderAlt size={22} style={{ animation: 'spin 0.8s linear infinite' }} />
            <span>불러오는 중…</span>
          </CenterState>
        ) : courses.length === 0 ? (
          <CenterState>동영상 정보가 없습니다</CenterState>
        ) : (
          courses.map((course) => {
            const isOpen = expanded.has(course.name)
            const items = itemsByCourse[course.name]

            return (
              <div
                key={course.name}
                style={{
                  marginBottom: 10,
                  borderRadius: 14,
                  overflow: 'hidden',
                  border: '1px solid #eee'
                }}
              >
                <button
                  onClick={() => toggleCourse(course.name)}
                  style={toggleHeaderStyle(isOpen, course.incomplete > 0)}
                >
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      textAlign: 'left'
                    }}
                  >
                    {course.name}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {course.incomplete > 0 && (
                      <span style={badgeStyle}>{course.incomplete}개 미완료</span>
                    )}
                    {isOpen ? <BiChevronUp size={18} /> : <BiChevronDown size={18} />}
                  </div>
                </button>

                {isOpen && (
                  <div style={{ padding: 6, background: '#fff' }}>
                    {items === 'loading' || items === undefined ? (
                      <div style={itemPlaceholderStyle}>불러오는 중…</div>
                    ) : items.length === 0 ? (
                      <div style={itemPlaceholderStyle}>동영상이 없습니다</div>
                    ) : (
                      items.map((item, index) => (
                        <div
                          key={`${item.url}-${index}`}
                          onClick={() => openVideo(item.url)}
                          style={itemRowStyle}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#f7f7f7')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <BiSolidCaretRightCircle
                            size={17}
                            color={item.isCompleted ? '#3a9fe0' : INCOMPLETE_COLOR}
                            style={{ flexShrink: 0 }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 13,
                                color: item.isCompleted ? '#3a3a3a' : INCOMPLETE_COLOR,
                                fontWeight: 600,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {item.title}
                            </div>
                            <div style={{ fontSize: 11.5, color: '#999', marginTop: 2 }}>
                              {weekLabel(item)}
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: item.isCompleted ? '#4caf50' : INCOMPLETE_COLOR,
                              flexShrink: 0
                            }}
                          >
                            {item.isCompleted ? '완료' : `${item.progressPercent ?? 0}%`}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <SyncButton
        category="videos"
        label="동영상"
        accentColor={TITLE_COLOR}
        onRefreshed={() => {
          fetchCourses().then(() => {
            expandedRef.current.forEach((name) => loadItems(name))
          })
        }}
      />

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function CenterState({ children }) {
  return <div style={{ ...centerStateStyle }}>{children}</div>
}

function toggleHeaderStyle(isOpen, hasIncomplete) {
  return {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '14px 16px',
    border: 'none',
    background: isOpen ? ACCENT : '#eef8ff',
    color: hasIncomplete ? INCOMPLETE_COLOR : '#3a3a3a',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'background 0.15s ease'
  }
}

const centerStateStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  height: '100%',
  color: '#bbb',
  fontSize: 13,
  paddingTop: 60
}

const itemPlaceholderStyle = {
  padding: '10px 10px',
  color: '#bbb',
  fontSize: 13
}

const badgeStyle = {
  fontSize: 10.5,
  fontWeight: 700,
  color: INCOMPLETE_COLOR,
  background: '#fff',
  borderRadius: 999,
  padding: '2px 8px'
}

const itemRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '9px 10px',
  borderRadius: 10,
  cursor: 'pointer',
  transition: 'background 0.1s ease'
}
