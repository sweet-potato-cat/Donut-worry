import { useEffect, useRef, useState } from 'react'
import { codeToUiohookKey, comboToLabel } from './keyCombo'

export default function ShortcutsTab({ accent, border, muted }) {
  const [hotkey, setHotkey] = useState(null)
  const [recording, setRecording] = useState(false)
  const [previewKeys, setPreviewKeys] = useState([])
  const pressedRef = useRef(new Set())
  const capturedRef = useRef([])

  useEffect(() => {
    window.electron?.ipcRenderer.invoke('settings:get').then((settings) => {
      setHotkey(settings?.mainHotkey ?? [])
    })
  }, [])

  useEffect(() => {
    if (!recording) return

    pressedRef.current = new Set()
    capturedRef.current = []

    const onKeyDown = (e) => {
      e.preventDefault()
      if (e.code === 'Escape' && pressedRef.current.size === 0) {
        setRecording(false)
        return
      }
      const name = codeToUiohookKey(e.code)
      if (!name) return
      pressedRef.current.add(name)
      capturedRef.current = Array.from(pressedRef.current)
      setPreviewKeys(capturedRef.current)
    }

    const onKeyUp = (e) => {
      e.preventDefault()
      const name = codeToUiohookKey(e.code)
      if (name) pressedRef.current.delete(name)

      if (pressedRef.current.size === 0 && capturedRef.current.length > 0) {
        const keys = capturedRef.current
        setRecording(false)
        window.electron?.ipcRenderer
          .invoke('settings:setMainHotkey', { keys })
          .then((saved) => setHotkey(saved))
      }
    }

    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keyup', onKeyUp, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp, true)
    }
  }, [recording])

  const handleReset = () => {
    window.electron?.ipcRenderer
      .invoke('settings:resetMainHotkey')
      .then((saved) => setHotkey(saved))
  }

  const displayLabel = recording
    ? previewKeys.length > 0
      ? comboToLabel(previewKeys)
      : '키를 눌러주세요…'
    : comboToLabel(hotkey)

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
          <div style={{ fontSize: 14, fontWeight: 700 }}>메인 도넛 열기</div>
          <div style={{ fontSize: 12, color: muted, marginTop: 4 }}>
            누르고 있는 동안 도넛이 나타나고, 떼는 순간 선택이 확정돼요.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => {
              setPreviewKeys([])
              setRecording(true)
            }}
            disabled={hotkey === null}
            style={{
              minWidth: 160,
              padding: '10px 18px',
              borderRadius: 10,
              border: recording ? `1px solid ${accent}` : `1px solid ${border}`,
              background: recording ? `${accent}1f` : '#2e1c22',
              color: recording && previewKeys.length === 0 ? muted : '#fff',
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: 0.5,
              cursor: 'pointer'
            }}
          >
            {displayLabel}
          </button>
          <button
            onClick={handleReset}
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: `1px solid ${border}`,
              background: 'transparent',
              color: muted,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            기본값
          </button>
        </div>
      </div>

      <div style={{ fontSize: 11.5, color: muted, lineHeight: 1.6 }}>
        녹화 버튼을 누른 뒤 원하는 키 조합을 누르고 있다가 손을 떼면 저장돼요. 취소하려면 Esc를
        누르세요.
      </div>
    </div>
  )
}
