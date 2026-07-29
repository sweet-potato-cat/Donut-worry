import { useEffect, useState } from 'react'

export default function GeneralTab({ accent, border, muted }) {
  const [openAtLogin, setOpenAtLogin] = useState(null)

  useEffect(() => {
    window.electron?.ipcRenderer.invoke('settings:getLoginItem').then((s) => {
      setOpenAtLogin(!!s?.openAtLogin)
    })
  }, [])

  const handleToggle = () => {
    if (openAtLogin === null) return
    const next = !openAtLogin
    setOpenAtLogin(next)
    window.electron?.ipcRenderer.invoke('settings:setLoginItem', { enabled: next })
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: '4px 0 16px'
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>로그인 시 자동 실행</div>
          <div style={{ fontSize: 12, color: muted, marginTop: 4, lineHeight: 1.6 }}>
            맥을 껐다 켜도 도넛 워리가 자동으로 다시 실행돼요.
          </div>
        </div>

        <button
          onClick={handleToggle}
          disabled={openAtLogin === null}
          role="switch"
          aria-checked={!!openAtLogin}
          style={{
            width: 44,
            height: 26,
            padding: 0,
            borderRadius: 13,
            border: `1px solid ${openAtLogin ? accent : border}`,
            background: openAtLogin ? accent : '#2e1c22',
            position: 'relative',
            flexShrink: 0,
            cursor: openAtLogin === null ? 'default' : 'pointer',
            transition: 'background 0.15s ease, border-color 0.15s ease'
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 1,
              left: openAtLogin ? 19 : 1,
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: openAtLogin ? '#170f12' : '#f2f2f3',
              transition: 'left 0.15s ease'
            }}
          />
        </button>
      </div>
    </div>
  )
}
