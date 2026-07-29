import { useEffect, useRef, useState } from 'react'
import { BiChevronDown, BiChevronUp, BiLoaderAlt } from 'react-icons/bi'
import { iconForFile } from '../../utils/fileIcons'
import SyncButton from '../common/SyncButton'

const TITLE_COLOR = '#fe748a'
const ACCENT = '#fcf39d'

export default function LecturePage() {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(() => new Set())
  const [filesByCourse, setFilesByCourse] = useState({})
  const expandedRef = useRef(expanded)
  useEffect(() => {
    expandedRef.current = expanded
  }, [expanded])

  const fetchCourses = () => {
    return window.electron?.ipcRenderer.invoke('course:list').then((list) => {
      setCourses(list ?? [])
    })
  }

  const loadFiles = (courseName) => {
    setFilesByCourse((prev) => ({ ...prev, [courseName]: 'loading' }))
    window.electron?.ipcRenderer.invoke('course:listFiles', { courseName }).then((list) => {
      setFilesByCourse((prev) => ({ ...prev, [courseName]: list ?? [] }))
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
        if (!filesByCourse[courseName]) loadFiles(courseName)
      }
      return next
    })
  }

  const openFile = (filePath) => {
    window.electron?.ipcRenderer.invoke('course:openFile', { filePath })
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
        강의자료
      </div>

      <div style={{ width: '100%', maxWidth: 560, flex: 1, overflowY: 'auto', padding: '0 24px' }}>
        {loading ? (
          <CenterState>
            <BiLoaderAlt size={22} style={{ animation: 'spin 0.8s linear infinite' }} />
            <span>불러오는 중…</span>
          </CenterState>
        ) : courses.length === 0 ? (
          <CenterState>다운로드된 강의자료가 없습니다</CenterState>
        ) : (
          courses.map((course) => {
            const isOpen = expanded.has(course.name)
            const files = filesByCourse[course.name]

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
                    {files === 'loading' || files === undefined ? (
                      <div style={filePlaceholderStyle}>불러오는 중…</div>
                    ) : files.length === 0 ? (
                      <div style={filePlaceholderStyle}>다운로드된 파일이 없습니다</div>
                    ) : (
                      files.map((file) => {
                        const Icon = iconForFile(file.name)
                        return (
                          <div
                            key={file.path}
                            onClick={() => openFile(file.path)}
                            style={fileRowStyle}
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#f7f7f7')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            <Icon size={17} color="#999" style={{ flexShrink: 0 }} />
                            <span
                              style={{
                                fontSize: 13,
                                color: '#3a3a3a',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {file.name}
                            </span>
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

      <SyncButton
        category="materials"
        label="강의자료"
        accentColor={TITLE_COLOR}
        onRefreshed={() => {
          fetchCourses().then(() => {
            expandedRef.current.forEach((name) => loadFiles(name))
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

function toggleHeaderStyle(isOpen) {
  return {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '14px 16px',
    border: 'none',
    background: isOpen ? ACCENT : '#fffbe0',
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

const filePlaceholderStyle = {
  padding: '10px 10px',
  color: '#bbb',
  fontSize: 13
}

const fileRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '9px 10px',
  borderRadius: 10,
  cursor: 'pointer',
  transition: 'background 0.1s ease'
}
