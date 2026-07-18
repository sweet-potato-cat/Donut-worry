import { useEffect, useState } from 'react'
import { BiLoaderAlt, BiSolidCaretRightCircle } from 'react-icons/bi'
import SubDonut from './SubDonut'
import VideoList from './VideoList'

const COLOR = '#90ccfb'

export default function VideoSubDonut() {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCourse, setSelectedCourse] = useState(null)

  useEffect(() => {
    let cancelled = false
    window.electron?.ipcRenderer
      .invoke('video:listCourses')
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

  if (selectedCourse) {
    return (
      <VideoList courseName={selectedCourse} color={COLOR} onBack={() => setSelectedCourse(null)} />
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
    return <div style={{ ...centerStyle, color: '#bbb', fontSize: 13 }}>동영상 정보가 없습니다</div>
  }

  return (
    <SubDonut
      subjects={courses.map((course) => course.name)}
      color={COLOR}
      centerIcon={BiSolidCaretRightCircle}
      onSelect={(index) => setSelectedCourse(courses[index].name)}
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
