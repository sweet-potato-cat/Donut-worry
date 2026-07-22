import { useEffect, useState } from 'react'
import { BiArrowBack, BiLoaderAlt, BiTimeFive } from 'react-icons/bi'

const PANEL_SIZE = 400

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

export default function AssignmentList({ courseName, color, onBack }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    window.electron?.ipcRenderer
      .invoke('assignment:listByCourse', { courseName })
      .then((list) => {
        if (!cancelled) setItems(list ?? [])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [courseName])

  const openAssignment = (url) => {
    window.electron?.ipcRenderer.invoke('assignment:open', { url })
  }

  return (
    <div
      style={{
        width: PANEL_SIZE,
        height: PANEL_SIZE,
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        borderRadius: 24,
        overflow: 'hidden',
        filter: `drop-shadow(0 8px 32px ${color}80)`
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '14px 16px',
          background: color,
          flexShrink: 0
        }}
      >
        <button
          onClick={onBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            border: 'none',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.6)',
            cursor: 'pointer',
            flexShrink: 0
          }}
        >
          <BiArrowBack size={16} color="#3a3a3a" />
        </button>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: '#3a3a3a',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {courseName}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        {loading ? (
          <div style={emptyStateStyle}>
            <BiLoaderAlt
              size={22}
              color="#bbb"
              style={{ animation: 'spin 0.8s linear infinite' }}
            />
            <span>불러오는 중…</span>
          </div>
        ) : items.length === 0 ? (
          <div style={emptyStateStyle}>과제가 없습니다</div>
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
                    style={{ fontSize: 11, fontWeight: 700, color: status.color, flexShrink: 0 }}
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
                </div>
              </div>
            )
          })
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

const emptyStateStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  height: '100%',
  color: '#bbb',
  fontSize: 13
}

const itemRowStyle = {
  padding: '9px 10px',
  borderRadius: 10,
  cursor: 'pointer',
  transition: 'background 0.1s ease'
}
