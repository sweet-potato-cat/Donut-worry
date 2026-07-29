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

  // Sub 도넛의 과목 목록을 앱이 뜨자마자 미리 불러온다(각 SubDonut이 열릴 때마다
  // 자체적으로 fetch하며 로딩을 기다리던 예전 방식은, Main 도넛과 달리 로딩 중에
  // 단축키를 떼면 아직 반영되지 않은 호버 상태로 판정되어 창이 그냥 닫혀버리는
  // 문제가 있었다. 미리 불러와 두면 사용자가 실제로 단축키를 누를 때는 이미
  // 데이터가 준비되어 있어 Main 도넛과 동일하게 즉시 판정할 수 있다)
  const [lectureCourses, setLectureCourses] = useState(null)
  const [assignmentCourses, setAssignmentCourses] = useState(null)
  const [videoCourses, setVideoCourses] = useState(null)

  const fetchLectureCourses = () =>
    window.electron?.ipcRenderer.invoke('course:list').then((list) => setLectureCourses(list ?? []))
  const fetchAssignmentCourses = () =>
    window.electron?.ipcRenderer
      .invoke('assignment:listCourses')
      .then((list) => setAssignmentCourses(list ?? []))
  const fetchVideoCourses = () =>
    window.electron?.ipcRenderer
      .invoke('video:listCourses')
      .then((list) => setVideoCourses(list ?? []))

  useEffect(() => {
    fetchLectureCourses()
    fetchAssignmentCourses()
    fetchVideoCourses()
  }, [])

  // 새로고침(개별/전체)이 끝나면 Sub 도넛에 미리 불러와 둔 과목 목록도 다시
  // 가져온다. 안 그러면 메인 도넛 페이지에서 새로고침해 최신 데이터를 받아도
  // 앱이 켜질 때 캐시해 둔 예전(또는 빈) 목록이 Sub 도넛에 계속 남아 있게 된다
  useEffect(() => {
    const handler = (_e, event) => {
      if (event.type !== 'done' || !event.success) return
      if (event.category === 'all' || event.category === 'materials') fetchLectureCourses()
      if (event.category === 'all' || event.category === 'assignments') fetchAssignmentCourses()
      if (event.category === 'all' || event.category === 'videos') fetchVideoCourses()
    }
    window.electron?.ipcRenderer.on('course:syncEvent', handler)
    return () => window.electron?.ipcRenderer.removeListener('course:syncEvent', handler)
  }, [])

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
  const activeSubDonutCourses =
    activeSubDonut !== null
      ? [lectureCourses, assignmentCourses, videoCourses][activeSubDonut]
      : null

  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        overflow: 'hidden',
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: page !== null ? '#f5f5f5' : 'transparent',
        WebkitAppRegion: 'drag' // 창 드래그 이동
      }}
    >
      {ActivePage ? (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: '#f5f5f5'
          }}
        >
          {/* 페이지 콘텐츠가 창 전체를 채우면 드래그 가능한 영역이 하나도 남지 않아
              창을 옮길 수 없게 되므로, 상단에 드래그 전용 손잡이를 항상 남겨둔다 */}
          <div style={{ height: 28, flexShrink: 0, WebkitAppRegion: 'drag' }} />
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', WebkitAppRegion: 'no-drag' }}>
            <ActivePage />
          </div>
        </div>
      ) : ActiveSubDonut ? (
        <div style={{ WebkitAppRegion: 'no-drag' }}>
          <ActiveSubDonut
            courses={activeSubDonutCourses}
            openSeq={subDonutOpenSeq}
            initialCursor={subDonutCursor}
          />
        </div>
      ) : (
        <div style={{ WebkitAppRegion: 'no-drag' }}>
          <Donut onHoverChange={handleHoverChange} initialCursor={donutCursor} />
        </div>
      )}
    </div>
  )
}
