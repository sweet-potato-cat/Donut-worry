import { useEffect, useState } from 'react'
import {
  BiChevronDown,
  BiChevronUp,
  BiLoaderAlt,
  BiRefresh,
  BiCheckCircle,
  BiErrorCircle,
  BiBookAlt,
  BiListUl,
  BiPin
} from 'react-icons/bi'

const TITLE_COLOR = '#c983fe'
const ACCENT = '#ecdcff'

const TYPE_META = [
  { key: 'exam', label: '시험' },
  { key: 'assignment', label: '과제' },
  { key: 'attendance', label: '출석' },
  { key: 'etc', label: '기타' }
]

function formatPostedAt(postedAt) {
  if (!postedAt) return ''
  const date = new Date(postedAt)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function groupBySubject(notices) {
  const byCourse = new Map()
  for (const notice of notices) {
    const name = notice.courseName ?? '기타'
    if (!byCourse.has(name)) byCourse.set(name, [])
    byCourse.get(name).push(notice)
  }
  return Array.from(byCourse.entries())
    .sort((a, b) => a[0].localeCompare(b[0], 'ko'))
    .map(([name, items]) => ({ key: name, label: name, items }))
}

function groupByType(notices) {
  return TYPE_META.map(({ key, label }) => ({
    key,
    label,
    items: notices.filter((notice) => notice.types?.includes(key))
  })).filter((group) => group.items.length > 0)
}

export default function NoticePage() {
  const [notices, setNotices] = useState([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState('subject') // 'subject' | 'type'
  const [expanded, setExpanded] = useState(() => new Set())
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState(null)

  const fetchNotices = () => {
    return window.electron?.ipcRenderer.invoke('notice:list').then((list) => {
      setNotices(list ?? [])
    })
  }

  useEffect(() => {
    let cancelled = false
    Promise.resolve(fetchNotices()).finally(() => {
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
          fetchNotices()
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

  const switchMode = (nextMode) => {
    if (nextMode === mode) return
    setMode(nextMode)
    setExpanded(new Set())
  }

  const toggleGroup = (key) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const openNotice = (url) => {
    window.electron?.ipcRenderer.invoke('notice:open', { url })
  }

  const handleSync = () => {
    if (syncing) return
    window.electron?.ipcRenderer.invoke('course:sync')
  }

  const groups = mode === 'subject' ? groupBySubject(notices) : groupByType(notices)

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
      <div style={{ fontSize: 22, fontWeight: 700, color: TITLE_COLOR }}>공지</div>
      <div style={{ fontSize: 12, color: '#999', marginBottom: 14 }}>Esc로 도넛으로 돌아가기</div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        <ModeButton
          active={mode === 'subject'}
          icon={BiBookAlt}
          label="과목별"
          onClick={() => switchMode('subject')}
        />
        <ModeButton
          active={mode === 'type'}
          icon={BiListUl}
          label="유형별"
          onClick={() => switchMode('type')}
        />
      </div>

      <div style={{ width: '100%', maxWidth: 560, flex: 1, overflowY: 'auto', padding: '0 24px' }}>
        {loading ? (
          <CenterState>
            <BiLoaderAlt size={22} style={{ animation: 'spin 0.8s linear infinite' }} />
            <span>불러오는 중…</span>
          </CenterState>
        ) : groups.length === 0 ? (
          <CenterState>공지가 없습니다</CenterState>
        ) : (
          groups.map((group) => {
            const isOpen = expanded.has(group.key)

            return (
              <div
                key={group.key}
                style={{
                  marginBottom: 10,
                  borderRadius: 14,
                  overflow: 'hidden',
                  border: '1px solid #eee'
                }}
              >
                <button onClick={() => toggleGroup(group.key)} style={toggleHeaderStyle(isOpen)}>
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      textAlign: 'left'
                    }}
                  >
                    {group.label}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={countBadgeStyle}>{group.items.length}</span>
                    {isOpen ? <BiChevronUp size={18} /> : <BiChevronDown size={18} />}
                  </div>
                </button>

                {isOpen && (
                  <div style={{ padding: 6, background: '#fff' }}>
                    {group.items.map((notice) => (
                      <div
                        key={notice.noticeId}
                        onClick={() => openNotice(notice.htmlUrl)}
                        style={itemRowStyle}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#f7f7f7')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            minWidth: 0
                          }}
                        >
                          {notice.isPinned && (
                            <BiPin size={13} color={TITLE_COLOR} style={{ flexShrink: 0 }} />
                          )}
                          <span
                            style={{
                              fontSize: 13,
                              color: '#3a3a3a',
                              fontWeight: notice.isRead ? 500 : 700,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {notice.title}
                          </span>
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            marginTop: 3,
                            color: '#999',
                            fontSize: 11.5
                          }}
                        >
                          {mode === 'type' && <span>{notice.courseName}</span>}
                          {mode === 'type' && <span>·</span>}
                          <span>{formatPostedAt(notice.postedAt)}</span>
                        </div>
                      </div>
                    ))}
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
        <button onClick={handleSync} disabled={syncing} style={syncButtonStyle(syncing)}>
          <BiRefresh
            size={16}
            style={syncing ? { animation: 'spin 0.8s linear infinite' } : undefined}
          />
          {syncing ? '새로고침 중…' : '새로고침'}
        </button>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function ModeButton({ active, icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '6px 12px',
        borderRadius: 999,
        border: 'none',
        background: active ? TITLE_COLOR : '#f3ebff',
        color: active ? '#fff' : '#8a5fc2',
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer',
        transition: 'background 0.15s ease'
      }}
    >
      <Icon size={14} />
      {label}
    </button>
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
    background: isOpen ? ACCENT : '#f8f2ff',
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

const countBadgeStyle = {
  fontSize: 10.5,
  fontWeight: 700,
  color: TITLE_COLOR,
  background: '#fff',
  borderRadius: 999,
  padding: '2px 8px'
}

function syncButtonStyle(syncing) {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '9px 16px',
    borderRadius: 999,
    border: 'none',
    background: syncing ? '#eee' : TITLE_COLOR,
    color: syncing ? '#999' : '#fff',
    fontSize: 13,
    fontWeight: 700,
    cursor: syncing ? 'default' : 'pointer',
    boxShadow: syncing ? 'none' : '0 4px 12px rgba(201,131,254,0.4)'
  }
}

const itemRowStyle = {
  padding: '9px 10px',
  borderRadius: 10,
  cursor: 'pointer',
  transition: 'background 0.1s ease'
}
