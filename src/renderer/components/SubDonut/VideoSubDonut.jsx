import { useEffect, useRef, useState } from 'react'
import { BiLoaderAlt, BiSolidCaretRightCircle } from 'react-icons/bi'
import SubDonut from './SubDonut'
import VideoList from './VideoList'

const COLOR = '#90ccfb'

export default function VideoSubDonut({ courses, initialCursor, openSeq }) {
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [prevOpenSeq, setPrevOpenSeq] = useState(openSeq)
  const hoveredIndexRef = useRef(null)

  // Sub 도넛을 다시 열 때마다(과목 목록은 그대로 두고) 이전 드릴다운 상태만 초기화
  // (useEffect 대신 렌더 중 조정: openSeq가 바뀐 프레임에 바로 반영되어 깜빡임 없음)
  // 호버 상태는 아래 key={openSeq}로 새로 마운트되는 SubDonut이 자체적으로 다시 동기화한다
  if (openSeq !== prevOpenSeq) {
    setPrevOpenSeq(openSeq)
    setSelectedCourse(null)
  }

  // 단축키를 놓는 순간 → 마우스가 올라가 있던 과목으로 확정 진입
  // courses는 App에서 미리 불러와 둔 것을 그대로 받으므로(로딩을 기다리는 별도
  // 분기 없이) Main 도넛과 동일하게 곧바로 판정한다. selectedCourse가 이미
  // 세팅된 상태(드릴다운 화면에서 마우스만 조작 중)라면 이 이벤트는 무시한다
  useEffect(() => {
    const handler = () => {
      if (selectedCourse) return

      if (!courses) {
        window.electron?.ipcRenderer.send('window:hide')
        return
      }

      const index = hoveredIndexRef.current
      if (index !== null && courses[index]) {
        setSelectedCourse(courses[index].name)
      } else {
        window.electron?.ipcRenderer.send('window:hide')
      }
    }
    // Vite HMR로 이 컴포넌트가 재실행될 때 이전 클로저를 든 리스너가 정리되지
    // 않고 남아 쌓이는 경우가 있어(개발 중 계속 편집하면서 확인됨), 새로 등록하기
    // 전에 같은 채널의 리스너를 모두 지워 중복 호출을 방지한다
    window.electron?.ipcRenderer.removeAllListeners('subdonut:confirm')
    window.electron?.ipcRenderer.on('subdonut:confirm', handler)
    return () => window.electron?.ipcRenderer.removeListener('subdonut:confirm', handler)
  }, [courses, selectedCourse])

  if (selectedCourse) {
    return <VideoList courseName={selectedCourse} color={COLOR} />
  }

  if (!courses) {
    return (
      <div style={{ ...centerStyle, color: '#bbb' }}>
        <BiLoaderAlt size={28} style={{ animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (courses.length === 0) {
    return <div style={{ ...centerStyle, color: '#bbb', fontSize: 13 }}>동영상 정보가 없습니다</div>
  }

  return (
    <SubDonut
      key={openSeq}
      subjects={courses.map((course) => course.name)}
      alerts={courses.map((course) => (course.incomplete ?? 0) > 0)}
      color={COLOR}
      centerIcon={BiSolidCaretRightCircle}
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
