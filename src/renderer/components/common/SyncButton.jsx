import { useEffect, useRef, useState } from 'react'
import { BiRefresh, BiCheckCircle, BiErrorCircle } from 'react-icons/bi'

// 우측 하단 새로고침 버튼. 클릭하면 "전체 새로고침"/"OOO만 새로고침" 중 고를 수
// 있는 팝업이 뜬다. 4개 메뉴(강의자료/과제/동영상/공지) 페이지가 이 컴포넌트를
// 그대로 재사용하며, category로 자신의 몫만 구분한다.
// 동기화는 백엔드에 카테고리별로 하나만 동시에 돌 수 있어(courses.js의 syncState),
// 다른 카테고리가 진행 중일 땐 버튼을 눌러도 아무 일도 안 일어나는 것처럼 보이지
// 않도록 otherSyncing으로 구분해 비활성화한다
export default function SyncButton({ category, label, accentColor, onRefreshed }) {
  const [syncing, setSyncing] = useState(false)
  const [otherSyncing, setOtherSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState(null) // { type: 'success' | 'error', text }
  const [menuOpen, setMenuOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    window.electron?.ipcRenderer.invoke('course:syncStatus').then((state) => {
      if (!state?.running) return
      if (state.category === category || state.category === 'all') {
        setSyncing(true)
      } else {
        setOtherSyncing(true)
      }
    })

    const handler = (_e, event) => {
      const matches = event.category === category || event.category === 'all'

      if (!matches) {
        setOtherSyncing(event.type === 'start')
        return
      }

      if (event.type === 'start') {
        setSyncing(true)
        setSyncMessage(null)
      } else if (event.type === 'done') {
        setSyncing(false)
        if (event.success) {
          setSyncMessage({ type: 'success', text: '새로고침 완료!' })
          onRefreshed?.()
        } else {
          setSyncMessage({ type: 'error', text: event.error ?? '새로고침에 실패했습니다' })
        }
      }
    }
    window.electron?.ipcRenderer.on('course:syncEvent', handler)
    return () => window.electron?.ipcRenderer.removeListener('course:syncEvent', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category])

  useEffect(() => {
    if (!syncMessage) return
    // 성공 알림은 요청대로 1초만, 실패는 내용을 읽을 시간을 더 준다
    const duration = syncMessage.type === 'success' ? 1000 : 4000
    const timer = setTimeout(() => setSyncMessage(null), duration)
    return () => clearTimeout(timer)
  }, [syncMessage])

  useEffect(() => {
    if (!menuOpen) return
    const handleOutside = (e) => {
      if (!containerRef.current?.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [menuOpen])

  const disabled = syncing || otherSyncing

  const runSync = (targetCategory) => {
    setMenuOpen(false)
    if (disabled) return
    window.electron?.ipcRenderer.invoke('course:sync', { category: targetCategory })
  }

  return (
    <div
      ref={containerRef}
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

      {menuOpen && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            padding: 6,
            borderRadius: 12,
            background: '#fff',
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)'
          }}
        >
          <button
            onClick={() => runSync('all')}
            style={menuItemStyle}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f7f7f7')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            전체 새로고침
          </button>
          <button
            onClick={() => runSync(category)}
            style={menuItemStyle}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f7f7f7')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            {label}만 새로고침
          </button>
        </div>
      )}

      <button
        onClick={() => setMenuOpen((open) => !open)}
        disabled={disabled}
        style={syncButtonStyle(disabled, accentColor)}
        title="새로고침"
      >
        <BiRefresh
          size={16}
          style={syncing ? { animation: 'spin 0.8s linear infinite' } : undefined}
        />
      </button>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

const menuItemStyle = {
  padding: '8px 14px',
  border: 'none',
  background: 'transparent',
  borderRadius: 8,
  fontSize: 12.5,
  fontWeight: 600,
  color: '#3a3a3a',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  textAlign: 'left',
  transition: 'background 0.1s ease'
}

function syncButtonStyle(disabled, accentColor) {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: 'none',
    background: disabled ? '#eee' : accentColor,
    color: disabled ? '#999' : '#fff',
    cursor: disabled ? 'default' : 'pointer',
    boxShadow: disabled ? 'none' : `0 4px 12px ${accentColor}66`
  }
}
