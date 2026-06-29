import { useState, useEffect } from 'react'
import Donut from './components/Donut/Donut'
import LectureSubDonut from './components/SubDonut/LectureSubDonut'
import AssignmentSubDonut from './components/SubDonut/AssignmentSubDonut'
import VideoSubDonut from './components/SubDonut/VideoSubDonut'
import './assets/main.css'

const VIEW_LABELS = ['강의자료', '과제', '동영상', '공지']
const SUB_DONUTS = [LectureSubDonut, AssignmentSubDonut, VideoSubDonut]

export default function App() {
  const [selectedIndex, setSelectedIndex] = useState(null)
  const [activeSubDonut, setActiveSubDonut] = useState(null) // null | 0(강의자료) | 1(과제) | 2(동영상)

  // Main 도넛이 다시 열릴 때 상태 초기화
  useEffect(() => {
    const handler = () => {
      setSelectedIndex(null)
      setActiveSubDonut(null)
    }
    window.electron?.ipcRenderer.on('main:show', handler)
    return () => window.electron?.ipcRenderer.removeListener('main:show', handler)
  }, [])

  // cmd+1~3 → Sub 도넛 열기
  useEffect(() => {
    const handler = (_e, { index }) => setActiveSubDonut(index)
    window.electron?.ipcRenderer.on('subdonut:open', handler)
    return () => window.electron?.ipcRenderer.removeListener('subdonut:open', handler)
  }, [])

  // Esc → Sub 도넛에서 Main 도넛으로 복귀
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') setActiveSubDonut(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const ActiveSubDonut = activeSubDonut !== null ? SUB_DONUTS[activeSubDonut] : null

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
      {ActiveSubDonut ? (
        <ActiveSubDonut onSelect={() => {}} />
      ) : (
        <Donut onSelect={setSelectedIndex} />
      )}

      {/* 선택된 섹터 표시 (추후 각 View 컴포넌트로 교체) */}
      {!ActiveSubDonut && selectedIndex !== null && (
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
