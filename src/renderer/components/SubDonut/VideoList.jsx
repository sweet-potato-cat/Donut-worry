import { useEffect, useState } from 'react'
import { BiLoaderAlt, BiSolidCaretRightCircle } from 'react-icons/bi'

const PANEL_SIZE = 400
const INCOMPLETE_COLOR = '#e05263'

function weekLabel(item) {
  const parts = [item.week, item.lesson].filter(Boolean)
  return parts.join(' ')
}

export default function VideoList({ courseName, color }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    window.electron?.ipcRenderer
      .invoke('video:listByCourse', { courseName })
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

  const openVideo = (url) => {
    window.electron?.ipcRenderer.invoke('video:open', { url })
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
          <div style={emptyStateStyle}>동영상이 없습니다</div>
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
                color={item.isCompleted ? color : INCOMPLETE_COLOR}
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
                <div style={{ fontSize: 11.5, color: '#999', marginTop: 2 }}>{weekLabel(item)}</div>
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
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '9px 10px',
  borderRadius: 10,
  cursor: 'pointer',
  transition: 'background 0.1s ease'
}
