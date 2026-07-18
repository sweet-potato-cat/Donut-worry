import { useState, useEffect, useRef } from 'react'
import Donut from './components/Donut/Donut'
import LecturePage from './components/LecturePage/LecturePage'
import AssignmentPage from './components/AssignmentPage/AssignmentPage'
import VideoPage from './components/VideoPage/VideoPage'
import NoticePage from './components/NoticePage/NoticePage'
import LectureSubDonut from './components/SubDonut/LectureSubDonut'
import AssignmentSubDonut from './components/SubDonut/AssignmentSubDonut'
import VideoSubDonut from './components/SubDonut/VideoSubDonut'
import './assets/main.css'

const PAGES = [LecturePage, AssignmentPage, VideoPage, NoticePage]
const SUB_DONUTS = [LectureSubDonut, AssignmentSubDonut, VideoSubDonut]

export default function App() {
  const [activeSubDonut, setActiveSubDonut] = useState(null) // null | 0(강의자료) | 1(과제) | 2(동영상)
  const [page, setPage] = useState(null) // null | 0~3 (Option+Space 떼는 순간 확정된 페이지)
  const [donutCursor, setDonutCursor] = useState(null) // 도넛이 다시 보일 때의 창 기준 커서 좌표
  const hoveredIndexRef = useRef(null)

  const handleHoverChange = (index) => {
    hoveredIndexRef.current = index
  }

  // Main 도넛이 다시 열릴 때 상태 초기화
  useEffect(() => {
    const handler = (_e, cursor) => {
      setActiveSubDonut(null)
      setPage(null)
      hoveredIndexRef.current = null
      setDonutCursor(cursor ?? null)
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

  // Esc → 창을 닫고, 다시 열 때는 Option+Space로 새로 호출
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== 'Escape') return
      if (page !== null || activeSubDonut !== null) {
        setPage(null)
        setActiveSubDonut(null)
        window.electron?.ipcRenderer.send('window:hide')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [page, activeSubDonut])

  const ActiveSubDonut = activeSubDonut !== null ? SUB_DONUTS[activeSubDonut] : null
  const ActivePage = page !== null ? PAGES[page] : null

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
      {ActivePage ? (
        <div style={{ width: '100%', height: '100%', WebkitAppRegion: 'no-drag' }}>
          <ActivePage />
        </div>
      ) : ActiveSubDonut ? (
        <div style={{ WebkitAppRegion: 'no-drag' }}>
          <ActiveSubDonut onSelect={() => {}} />
        </div>
      ) : (
        <div style={{ WebkitAppRegion: 'no-drag' }}>
          <Donut onHoverChange={handleHoverChange} initialCursor={donutCursor} />
        </div>
      )}
    </div>
  )
}
