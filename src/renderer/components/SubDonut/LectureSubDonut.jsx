import { useEffect, useRef, useState } from 'react'
import { BiLoaderAlt, BiBookAlt } from 'react-icons/bi'
import SubDonut from './SubDonut'
import CourseFileList from './CourseFileList'

const COLOR = '#fcf39d'

export default function LectureSubDonut({ initialCursor, openSeq }) {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [prevOpenSeq, setPrevOpenSeq] = useState(openSeq)
  const hoveredIndexRef = useRef(null)
  const pendingConfirmRef = useRef(false)

  // Sub 도넛을 다시 열 때마다(과목 목록은 그대로 두고) 이전 드릴다운 상태만 초기화
  // (useEffect 대신 렌더 중 조정: openSeq가 바뀐 프레임에 바로 반영되어 깜빡임 없음)
  // 호버 상태는 아래 key={openSeq}로 새로 마운트되는 SubDonut이 자체적으로 다시 동기화한다
  if (openSeq !== prevOpenSeq) {
    setPrevOpenSeq(openSeq)
    setSelectedCourse(null)
  }

  useEffect(() => {
    let cancelled = false
    window.electron?.ipcRenderer
      .invoke('course:list')
      .then((list) => {
        if (!cancelled) setCourses(list ?? [])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 단축키를 놓는 순간 → 마우스가 올라가 있던 과목으로 확정 진입
  // (courses가 아직 로딩 중이면 SubDonut 섹터 자체가 렌더되지 않아 호버가
  //  발생할 기회가 없었으므로, 즉시 hide하지 않고 로딩이 끝날 때까지 판정을
  //  미룬다. 로딩이 끝나면 SubDonut이 마운트되며 커서 위치 기반 초기 호버가
  //  hoveredIndexRef에 반영된 뒤 아래 두 번째 effect에서 판정을 이어간다.)
  //
  // selectedCourse가 이미 세팅된 상태(=드릴다운 화면에서 "이전" 버튼 등으로
  // 마우스만 조작 중인 상태)라면 이 이벤트는 무시한다. 섹터 화면이 아닌
  // 동안 단축키를 늦게 떼서 도착한 confirm이 오래된 hoveredIndexRef 값으로
  // 화면을 다시 바꾸거나 창을 hide시키는 것을 막기 위함
  const confirmSelection = () => {
    if (selectedCourse) return
    const index = hoveredIndexRef.current
    if (index !== null && courses[index]) {
      setSelectedCourse(courses[index].name)
    } else {
      window.electron?.ipcRenderer.send('window:hide')
    }
  }

  useEffect(() => {
    const handler = () => {
      if (loading) {
        pendingConfirmRef.current = true
        return
      }
      confirmSelection()
    }
    window.electron?.ipcRenderer.on('subdonut:confirm', handler)
    return () => window.electron?.ipcRenderer.removeListener('subdonut:confirm', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses, loading, selectedCourse])

  useEffect(() => {
    if (loading || !pendingConfirmRef.current) return
    pendingConfirmRef.current = false
    confirmSelection()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, courses])

  if (selectedCourse) {
    return (
      <CourseFileList
        courseName={selectedCourse}
        color={COLOR}
        onBack={() => setSelectedCourse(null)}
      />
    )
  }

  if (loading) {
    return (
      <div style={{ ...centerStyle, color: '#bbb' }}>
        <BiLoaderAlt size={28} style={{ animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (courses.length === 0) {
    return (
      <div style={{ ...centerStyle, color: '#bbb', fontSize: 13 }}>
        다운로드된 강의자료가 없습니다
      </div>
    )
  }

  return (
    <SubDonut
      key={openSeq}
      subjects={courses.map((course) => course.name)}
      color={COLOR}
      centerIcon={BiBookAlt}
      onHoverChange={(index) => {
        hoveredIndexRef.current = index
      }}
      initialCursor={initialCursor}
    />
  )
}

const centerStyle = {
  width: 400,
  height: 400,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10
}
