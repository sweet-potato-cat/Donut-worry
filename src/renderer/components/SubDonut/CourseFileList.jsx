import { useEffect, useState } from 'react'
import { BiLoaderAlt } from 'react-icons/bi'
import { iconForFile } from '../../utils/fileIcons'

const PANEL_SIZE = 400

export default function CourseFileList({ courseName, color }) {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    window.electron?.ipcRenderer
      .invoke('course:listFiles', { courseName })
      .then((list) => {
        if (!cancelled) setFiles(list ?? [])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [courseName])

  const openFile = (filePath) => {
    window.electron?.ipcRenderer.invoke('course:openFile', { filePath })
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
        ) : files.length === 0 ? (
          <div style={emptyStateStyle}>다운로드된 파일이 없습니다</div>
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
                <Icon size={18} color="#999" style={{ flexShrink: 0 }} />
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

const fileRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 10px',
  borderRadius: 10,
  cursor: 'pointer',
  transition: 'background 0.1s ease'
}
