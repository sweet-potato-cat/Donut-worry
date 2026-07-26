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
  const [subDonutCursor, setSubDonutCursor] = useState(null) // Sub 도넛이 다시 보일 때의 창 기준 커서 좌표
  const [subDonutOpenSeq, setSubDonutOpenSeq] = useState(0) // Sub 도넛을 열 때마다 증가 — 과목 목록은 유지한 채 이전 드릴다운/호버 상태만 초기화하는 신호
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

  // cmd+1~3 → Sub 도넛 열기 (매번 새로 마운트시켜 이전 드릴다운 상태가 남지 않도록 함)
  // Main 도넛에서 선택해 페이지(page)가 떠 있던 상태였을 수 있으므로 함께 리셋한다
  // (안 그러면 ActivePage 우선순위에 가려 Sub 도넛이 렌더되지 않음)
  useEffect(() => {
    const handler = (_e, { index, cursor }) => {
      setPage(null)
      setActiveSubDonut(index)
      setSubDonutCursor(cursor ?? null)
      setSubDonutOpenSeq((n) => n + 1)
    }
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
          <ActiveSubDonut openSeq={subDonutOpenSeq} initialCursor={subDonutCursor} />
        </div>
      ) : (
        <div style={{ WebkitAppRegion: 'no-drag' }}>
          <Donut onHoverChange={handleHoverChange} initialCursor={donutCursor} />
        </div>
      )}
    </div>
  )
}
