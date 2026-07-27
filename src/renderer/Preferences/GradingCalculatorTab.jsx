import { useEffect, useMemo, useState } from 'react'

function roundTo2(value) {
  return Math.round(value * 100) / 100
}

export default function GradingCalculatorTab({ accent, border, muted }) {
  const [courses, setCourses] = useState([])
  const [courseId, setCourseId] = useState('')
  const [scores, setScores] = useState({})

  useEffect(() => {
    window.electron?.ipcRenderer.invoke('grading:listCourses').then((list) => {
      setCourses(list ?? [])
      if (list?.length) setCourseId(String(list[0].courseId))
    })
  }, [])

  const course = useMemo(
    () => courses.find((c) => String(c.courseId) === courseId),
    [courses, courseId]
  )

  const handleSelectCourse = (id) => {
    setCourseId(id)
    setScores({})
  }

  const handleScoreChange = (index, field, value) => {
    setScores((prev) => ({ ...prev, [index]: { ...prev[index], [field]: value } }))
  }

  const converted = useMemo(() => {
    if (!course) return 0
    return roundTo2(
      course.weights.reduce((sum, weight, index) => {
        const entry = scores[index] ?? {}
        const score = Number(entry.score)
        const max = entry.max === undefined || entry.max === '' ? 100 : Number(entry.max)
        if (!Number.isFinite(score) || !Number.isFinite(max) || max <= 0) return sum
        return sum + (score / max) * weight.percent
      }, 0)
    )
  }, [course, scores])

  if (courses.length === 0) {
    return (
      <div style={{ color: muted, fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
        아직 불러온 성적 반영비율이 없습니다. 메인 도넛에서 새로고침을 한 번 실행해 주세요.
      </div>
    )
  }

  return (
    <div>
      <div style={{ fontSize: 12, color: muted, lineHeight: 1.6, marginBottom: 18 }}>
        과목을 선택하고 항목별 점수와 만점을 입력하면 100점 만점 기준으로 환산해줘요. 만점을
        비워두면 100점 만점으로 계산해요.
      </div>

      <select
        value={courseId}
        onChange={(e) => handleSelectCourse(e.target.value)}
        style={{ ...selectStyle(border), width: '100%', marginBottom: 20 }}
      >
        {courses.map((c) => (
          <option key={c.courseId} value={c.courseId}>
            {c.courseName}
          </option>
        ))}
      </select>

      {course && (
        <>
          {course.totalPercent < 95 || course.totalPercent > 105 ? (
            <div
              style={{
                fontSize: 12,
                color: accent,
                marginBottom: 14,
                lineHeight: 1.5
              }}
            >
              이 과목은 인식된 반영비율 합이 {course.totalPercent}%로 100%와 차이가 있어요. 환산
              결과가 정확하지 않을 수 있습니다.
            </div>
          ) : null}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
            {course.weights.map((weight, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: `1px solid ${border}`
                }}
              >
                <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{weight.label}</span>
                <span style={{ fontSize: 12, color: muted, width: 36, flexShrink: 0 }}>
                  {weight.percent}%
                </span>
                <input
                  type="number"
                  min="0"
                  placeholder="점수"
                  value={scores[index]?.score ?? ''}
                  onChange={(e) => handleScoreChange(index, 'score', e.target.value)}
                  style={{ ...inputStyle(border), width: 60, flexShrink: 0 }}
                />
                <span style={{ fontSize: 12, color: muted, flexShrink: 0 }}>/</span>
                <input
                  type="number"
                  min="0"
                  placeholder="100"
                  value={scores[index]?.max ?? ''}
                  onChange={(e) => handleScoreChange(index, 'max', e.target.value)}
                  style={{ ...inputStyle(border), width: 60, flexShrink: 0 }}
                />
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              borderRadius: 12,
              background: `${accent}26`
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700 }}>환산 점수</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: accent }}>{converted}점</span>
          </div>
        </>
      )}
    </div>
  )
}

function selectStyle(border) {
  return {
    padding: '9px 10px',
    borderRadius: 8,
    border: `1px solid ${border}`,
    background: '#2e1c22',
    color: '#f2f2f3',
    fontSize: 13
  }
}

function inputStyle(border) {
  return {
    padding: '9px 10px',
    borderRadius: 8,
    border: `1px solid ${border}`,
    background: '#2e1c22',
    color: '#f2f2f3',
    fontSize: 13
  }
}
