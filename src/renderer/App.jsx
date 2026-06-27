import { useState, useEffect } from 'react'
import Donut from './components/Donut/Donut'
import './assets/main.css'

const VIEW_LABELS = ['강의자료', '과제', '동영상', '공지']

export default function App() {
  const [selectedIndex, setSelectedIndex] = useState(null)

  // 단축키 (cmd+1~4) 수신
  useEffect(() => {
    const handler = (_e, { index }) => setSelectedIndex(index)
    window.electron?.ipcRenderer.on('donut:select', handler)
    return () => window.electron?.ipcRenderer.removeListener('donut:select', handler)
  }, [])

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f5f5',
        WebkitAppRegion: 'drag', // 창 드래그 이동
      }}
    >
      <Donut onSelect={setSelectedIndex} />

      {/* 선택된 섹터 표시 (추후 각 View 컴포넌트로 교체) */}
      {selectedIndex !== null && (
        <div
          style={{
            marginTop: 16,
            padding: '8px 20px',
            background: 'rgba(254,116,138,0.15)',
            borderRadius: 20,
            color: '#fe748a',
            fontWeight: 700,
            fontSize: 14,
            backdropFilter: 'blur(8px)',
          }}
        >
          {VIEW_LABELS[selectedIndex]} 선택됨
        </div>
      )}
    </div>
  )
}
