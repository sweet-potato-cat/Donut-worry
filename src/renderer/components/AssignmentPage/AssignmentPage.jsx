import { useEffect, useRef, useState } from 'react'
import {
  BiChevronDown,
  BiChevronUp,
  BiLoaderAlt,
  BiRefresh,
  BiCheckCircle,
  BiErrorCircle,
  BiTimeFive
} from 'react-icons/bi'

const TITLE_COLOR = '#fea443'
const ACCENT = '#ffe2c0'

function formatDueDate(dueAt) {
  if (!dueAt) return '마감일 없음'
  const date = new Date(dueAt)
  if (Number.isNaN(date.getTime())) return '마감일 없음'
  return date.toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function statusInfo(assignment) {
  if (assignment.submissionStatus === 'submitted') {
    return assignment.late
      ? { label: '지각 제출', color: '#e0a03c' }
      : { label: '제출완료', color: '#4caf50' }
  }
  if (assignment.isOverdue || assignment.missing) {
    return { label: '기한초과', color: '#e05263' }
  }
  return { label: '미제출', color: '#999' }
}

export default function AssignmentPage() {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(() => new Set())
  const [itemsByCourse, setItemsByCourse] = useState({})
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState(null)
  const expandedRef = useRef(expanded)
  useEffect(() => {
    expandedRef.current = expanded
  }, [expanded])

  const fetchCourses = () => {
    return window.electron?.ipcRenderer.invoke('assignment:listCourses').then((list) => {
      setCourses(list ?? [])
    })
  }

  const loadItems = (courseName) => {
    setItemsByCourse((prev) => ({ ...prev, [courseName]: 'loading' }))
    window.electron?.ipcRenderer.invoke('assignment:listByCourse', { courseName }).then((list) => {
      setItemsByCourse((prev) => ({ ...prev, [courseName]: list ?? [] }))
    })
  }

  useEffect(() => {
    let cancelled = false
    Promise.resolve(fetchCourses()).finally(() => {
      if (!cancelled) setLoading(false)
    })

    window.electron?.ipcRenderer.invoke('course:syncStatus').then((state) => {
      if (!cancelled) setSyncing(!!state?.running)
    })

    const handler = (_e, event) => {
      if (event.type === 'start') {
        setSyncing(true)
        setSyncMessage(null)
      } else if (event.type === 'done') {
        setSyncing(false)
        if (event.success) {
          setSyncMessage({ type: 'success', text: '새로고침 완료' })
          fetchCourses().then(() => {
            expandedRef.current.forEach((name) => loadItems(name))
          })
        } else {
          setSyncMessage({ type: 'error', text: event.error ?? '새로고침에 실패했습니다' })
        }
      }
    }
    window.electron?.ipcRenderer.on('course:syncEvent', handler)
    return () => {
      cancelled = true
      window.electron?.ipcRenderer.removeListener('course:syncEvent', handler)
    }
  }, [])

  useEffect(() => {
    if (!syncMessage) return
    const timer = setTimeout(() => setSyncMessage(null), 4000)
    return () => clearTimeout(timer)
  }, [syncMessage])

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

  const openAssignment = (url) => {
    window.electron?.ipcRenderer.invoke('assignment:open', { url })
  }

  const handleSync = () => {
    if (syncing) return
    window.electron?.ipcRenderer.invoke('course:sync')
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
        과제
      </div>

      <div style={{ width: '100%', maxWidth: 560, flex: 1, overflowY: 'auto', padding: '0 24px' }}>
        {loading ? (
          <CenterState>
            <BiLoaderAlt size={22} style={{ animation: 'spin 0.8s linear infinite' }} />
            <span>불러오는 중…</span>
          </CenterState>
        ) : courses.length === 0 ? (
          <CenterState>과제 정보가 없습니다</CenterState>
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
                <button onClick={() => toggleCourse(course.name)} style={toggleHeaderStyle(isOpen)}>
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
                  {isOpen ? <BiChevronUp size={18} /> : <BiChevronDown size={18} />}
                </button>

                {isOpen && (
                  <div style={{ padding: 6, background: '#fff' }}>
                    {items === 'loading' || items === undefined ? (
                      <div style={itemPlaceholderStyle}>불러오는 중…</div>
                    ) : items.length === 0 ? (
                      <div style={itemPlaceholderStyle}>과제가 없습니다</div>
                    ) : (
                      items.map((item) => {
                        const status = statusInfo(item)
                        return (
                          <div
                            key={item.assignmentId}
                            onClick={() => openAssignment(item.htmlUrl)}
                            style={itemRowStyle}
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#f7f7f7')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 8
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 13,
                                  color: '#3a3a3a',
                                  fontWeight: 600,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  flex: 1
                                }}
                              >
                                {item.title}
                              </span>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: status.color,
                                  flexShrink: 0
                                }}
                              >
                                {status.label}
                              </span>
                            </div>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                marginTop: 3,
                                color: '#999',
                                fontSize: 11.5
                              }}
                            >
                              <BiTimeFive size={13} />
                              <span>{formatDueDate(item.dueAt)}</span>
                              {typeof item.pointsPossible === 'number' && (
                                <span>· {item.pointsPossible}점</span>
                              )}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <div
        style={{
          position: 'fixed',
          right: 24,
          bottom: 20,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 6
        }}
      >
        {syncing && (
          <div style={{ fontSize: 11, color: '#999' }}>새 창에서 로그인이 필요할 수 있어요</div>
        )}
        {syncMessage && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12,
              color: syncMessage.type === 'success' ? '#4caf50' : '#e05263'
            }}
          >
            {syncMessage.type === 'success' ? (
              <BiCheckCircle size={14} />
            ) : (
              <BiErrorCircle size={14} />
            )}
            {syncMessage.text}
          </div>
        )}
        <button
          onClick={handleSync}
          disabled={syncing}
          style={syncButtonStyle(syncing)}
          title="새로고침"
        >
          <BiRefresh
            size={16}
            style={syncing ? { animation: 'spin 0.8s linear infinite' } : undefined}
          />
        </button>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function CenterState({ children }) {
  return <div style={{ ...centerStateStyle }}>{children}</div>
}

function toggleHeaderStyle(isOpen) {
  return {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '14px 16px',
    border: 'none',
    background: isOpen ? ACCENT : '#fff6ea',
    color: '#3a3a3a',
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

function syncButtonStyle(syncing) {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: 'none',
    background: syncing ? '#eee' : TITLE_COLOR,
    color: syncing ? '#999' : '#fff',
    cursor: syncing ? 'default' : 'pointer',
    boxShadow: syncing ? 'none' : '0 4px 12px rgba(254,164,67,0.4)'
  }
}

const itemRowStyle = {
  padding: '9px 10px',
  borderRadius: 10,
  cursor: 'pointer',
  transition: 'background 0.1s ease'
}
