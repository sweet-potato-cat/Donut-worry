import { useEffect, useState } from 'react'

export default function AccountTab({ accent, border, muted }) {
  const [status, setStatus] = useState(null)
  const [id, setId] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState(null)

  const refreshStatus = () => {
    window.electron?.ipcRenderer.invoke('credentials:get').then((s) => setStatus(s))
  }

  useEffect(() => {
    refreshStatus()
  }, [])

  const handleSave = () => {
    setMessage(null)
    window.electron?.ipcRenderer
      .invoke('credentials:save', { id, password })
      .then((s) => {
        setStatus(s)
        setPassword('')
        setMessage({ type: 'success', text: '저장했어요' })
      })
      .catch((err) => setMessage({ type: 'error', text: err.message ?? '저장에 실패했어요' }))
  }

  const handleClear = () => {
    setMessage(null)
    window.electron?.ipcRenderer.invoke('credentials:clear').then((s) => {
      setStatus(s)
      setId('')
      setPassword('')
      setMessage({ type: 'success', text: '삭제했어요' })
    })
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    border: `1px solid ${border}`,
    background: '#2e1c22',
    color: '#fff',
    fontSize: 14,
    outline: 'none'
  }

  return (
    <div>
      <div style={{ padding: '4px 0 16px' }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>e-campus 자동로그인</div>
        <div style={{ fontSize: 12, color: muted, marginTop: 4, lineHeight: 1.6 }}>
          경희대 계정을 저장해두면 새로고침 시 세션이 만료돼도 로그인 창을 띄우지 않고 자동으로
          로그인해요. 비밀번호는 이 기기의 키체인에 암호화되어 저장되고, 다른 곳으로 전송되지
          않아요.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 320 }}>
        <input
          type="text"
          placeholder={status?.hasCredentials ? status.id : '학번 또는 아이디'}
          value={id}
          onChange={(e) => setId(e.target.value)}
          style={inputStyle}
        />
        <input
          type="password"
          placeholder={status?.hasCredentials ? '••••••••' : '비밀번호'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button
            onClick={handleSave}
            disabled={!id || !password}
            style={{
              padding: '10px 18px',
              borderRadius: 10,
              border: 'none',
              background: !id || !password ? '#3a2530' : accent,
              color: !id || !password ? muted : '#170f12',
              fontSize: 13,
              fontWeight: 700,
              cursor: !id || !password ? 'default' : 'pointer'
            }}
          >
            저장
          </button>
          <button
            onClick={handleClear}
            disabled={!status?.hasCredentials}
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: `1px solid ${border}`,
              background: 'transparent',
              color: muted,
              fontSize: 12,
              fontWeight: 700,
              cursor: status?.hasCredentials ? 'pointer' : 'default'
            }}
          >
            삭제
          </button>
        </div>

        <div style={{ fontSize: 12, color: message?.type === 'error' ? '#ff8a8a' : muted }}>
          {message?.text ?? (status?.hasCredentials ? `저장됨: ${status.id}` : '저장된 계정 없음')}
        </div>
      </div>
    </div>
  )
}
