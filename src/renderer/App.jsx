import { useState, useEffect, useRef } from 'react'
import Donut from './components/Donut/Donut'
import LectureSubDonut from './components/SubDonut/LectureSubDonut'
import AssignmentSubDonut from './components/SubDonut/AssignmentSubDonut'
import VideoSubDonut from './components/SubDonut/VideoSubDonut'
import './assets/main.css'

const VIEW_LABELS = ['강의자료', '과제', '동영상', '공지']
const SUB_DONUTS = [LectureSubDonut, AssignmentSubDonut, VideoSubDonut]

export default function App() {
  const [activeSubDonut, setActiveSubDonut] = useState(null) // null | 0(강의자료) | 1(과제) | 2(동영상)
  const [page, setPage] = useState(null) // null | 0~3 (Option+Space 떼는 순간 확정된 페이지)
  const hoveredIndexRef = useRef(null)

  const handleHoverChange = (index) => {
    hoveredIndexRef.current = index
  }

  // Main 도넛이 다시 열릴 때 상태 초기화
  useEffect(() => {
    const handler = () => {
      setActiveSubDonut(null)
      setPage(null)
      hoveredIndexRef.current = null
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

  // Option+Space를 떼는 순간 → 마우스가 올라가 있던 섹터로 확정 이동
  useEffect(() => {
    const handler = () => {
      const index = hoveredIndexRef.current
      if (index !== null) {
        setPage(index)
        window.electron?.ipcRenderer.send('window:show-page')
      } else {
        window.electron?.ipcRenderer.send('window:hide')
      }
    }
    window.electron?.ipcRenderer.on('main:confirm', handler)
    return () => window.electron?.ipcRenderer.removeListener('main:confirm', handler)
  }, [])

  // Esc → 페이지에서 Main 도넛으로, Sub 도넛에서 Main 도넛으로 복귀
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== 'Escape') return
      if (page !== null) {
        setPage(null)
        window.electron?.ipcRenderer.send('window:show-donut')
      } else if (activeSubDonut !== null) {
        setActiveSubDonut(null)
        window.electron?.ipcRenderer.send('window:hide')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [page, activeSubDonut])

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
        background: page !== null ? '#f5f5f5' : 'transparent',
        WebkitAppRegion: 'drag' // 창 드래그 이동
      }}
    >
      {page !== null ? (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 700, color: '#fe748a' }}>{VIEW_LABELS[page]}</div>
          <div style={{ fontSize: 12, color: '#999' }}>Esc로 도넛으로 돌아가기</div>
        </div>
      ) : ActiveSubDonut ? (
        <div style={{ WebkitAppRegion: 'no-drag' }}>
          <ActiveSubDonut onSelect={() => {}} />
        </div>
      ) : (
        <div style={{ WebkitAppRegion: 'no-drag' }}>
          <Donut onHoverChange={handleHoverChange} />
        </div>
      )}
    </div>
  )
}
