import { useEffect, useState } from 'react'
import { BiTrash, BiPlus } from 'react-icons/bi'

// value는 Date.getDay()와 동일한 규칙(0=일 ~ 6=토), 표시 순서만 월요일부터
const DAY_OPTIONS = [
  { value: 1, label: '월' },
  { value: 2, label: '화' },
  { value: 3, label: '수' },
  { value: 4, label: '목' },
  { value: 5, label: '금' },
  { value: 6, label: '토' },
  { value: 0, label: '일' }
]

function dayLabel(day) {
  return DAY_OPTIONS.find((d) => d.value === day)?.label ?? '?'
}

function sortEntries(entries) {
  const order = DAY_OPTIONS.map((d) => d.value)
  return [...entries].sort((a, b) => {
    const dayDiff = order.indexOf(a.day) - order.indexOf(b.day)
    if (dayDiff !== 0) return dayDiff
    return String(a.time).localeCompare(String(b.time))
  })
}

export default function TimetableTab({ accent, border, muted }) {
  const [entries, setEntries] = useState([])
  const [day, setDay] = useState(1)
  const [time, setTime] = useState('09:00')
  const [label, setLabel] = useState('')

  const fetchEntries = () => {
    window.electron?.ipcRenderer.invoke('timetable:list').then((list) => setEntries(list ?? []))
  }

  useEffect(() => {
    fetchEntries()
  }, [])

  const handleAdd = () => {
    if (!time) return
    window.electron?.ipcRenderer
      .invoke('timetable:add', { day, time, label: label.trim() })
      .then(() => {
        setLabel('')
        fetchEntries()
      })
  }

  const handleRemove = (id) => {
    window.electron?.ipcRenderer.invoke('timetable:remove', { id }).then(() => fetchEntries())
  }

  return (
    <div>
      <div style={{ fontSize: 12, color: muted, lineHeight: 1.6, marginBottom: 18 }}>
        수업 시간을 등록하면 시작 10분 전에 자동으로 새로고침해서 최신 자료를 미리 받아둬요.
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: 12,
          borderRadius: 12,
          border: `1px solid ${border}`,
          marginBottom: 20
        }}
      >
        <select
          value={day}
          onChange={(e) => setDay(Number(e.target.value))}
          style={selectStyle(border)}
        >
          {DAY_OPTIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}요일
            </option>
          ))}
        </select>

        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          style={inputStyle(border)}
        />

        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="과목명 (선택)"
          style={{ ...inputStyle(border), flex: 1 }}
        />

        <button onClick={handleAdd} style={addButtonStyle(accent)}>
          <BiPlus size={16} />
          추가
        </button>
      </div>

      {entries.length === 0 ? (
        <div style={{ color: muted, fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
          등록된 시간표가 없습니다
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sortEntries(entries).map((entry) => (
            <div
              key={entry.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                borderRadius: 10,
                border: `1px solid ${border}`
              }}
            >
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: `${accent}26`,
                  color: accent,
                  fontSize: 12,
                  fontWeight: 700,
                  flexShrink: 0
                }}
              >
                {dayLabel(entry.day)}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, width: 52, flexShrink: 0 }}>
                {entry.time}
              </span>
              <span
                style={{
                  flex: 1,
                  fontSize: 13,
                  color: entry.label ? undefined : muted,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {entry.label || '라벨 없음'}
              </span>
              <button onClick={() => handleRemove(entry.id)} style={deleteButtonStyle(muted)}>
                <BiTrash size={15} />
              </button>
            </div>
          ))}
        </div>
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

function addButtonStyle(accent) {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '9px 14px',
    borderRadius: 8,
    border: 'none',
    background: accent,
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    flexShrink: 0
  }
}

function deleteButtonStyle(muted) {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 26,
    height: 26,
    borderRadius: '50%',
    border: 'none',
    background: 'transparent',
    color: muted,
    cursor: 'pointer',
    flexShrink: 0
  }
}
