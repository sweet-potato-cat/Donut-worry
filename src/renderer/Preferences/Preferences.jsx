import { useState } from 'react'
import { BiCog, BiKey, BiCalendarWeek, BiCalculator, BiLock } from 'react-icons/bi'
import GeneralTab from './GeneralTab'
import ShortcutsTab from './ShortcutsTab'
import TimetableTab from './TimetableTab'
import GradingCalculatorTab from './GradingCalculatorTab'
import AccountTab from './AccountTab'

const ACCENT = '#fe748a'
const BG = '#170f12'
const BORDER = '#5a2f3c'
const TEXT = '#f2f2f3'
const MUTED = '#b09098'

const TABS = [
  { id: 'general', label: '일반', icon: BiCog, Component: GeneralTab },
  { id: 'shortcuts', label: '단축키', icon: BiKey, Component: ShortcutsTab },
  { id: 'timetable', label: '시간표', icon: BiCalendarWeek, Component: TimetableTab },
  { id: 'grading', label: '성적계산기', icon: BiCalculator, Component: GradingCalculatorTab },
  { id: 'account', label: '계정', icon: BiLock, Component: AccountTab }
]

export default function Preferences() {
  const [activeTab, setActiveTab] = useState('general')
  const ActiveComponent = TABS.find((tab) => tab.id === activeTab)?.Component

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        background: `radial-gradient(ellipse at 15% 0%, ${ACCENT}59 0%, ${ACCENT}00 65%), radial-gradient(ellipse at 100% 100%, ${ACCENT}47 0%, ${ACCENT}00 65%), linear-gradient(160deg, #2d131c 0%, ${BG} 60%)`,
        color: TEXT,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', 'Segoe UI', sans-serif",
        overflow: 'hidden'
      }}
    >
      {/* 도넛 핑크 글로우 (우상단 메인 + 좌하단 보조) — 검정보다 핑크가 더 많이 보이도록 크고 진하게 */}
      <div
        style={{
          position: 'absolute',
          top: -180,
          right: -140,
          width: 620,
          height: 620,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${ACCENT}73 0%, ${ACCENT}00 72%)`,
          filter: 'blur(10px)',
          pointerEvents: 'none'
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -200,
          left: -160,
          width: 560,
          height: 560,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${ACCENT}59 0%, ${ACCENT}00 72%)`,
          filter: 'blur(10px)',
          pointerEvents: 'none'
        }}
      />

      <div
        style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100vh' }}
      >
        <div style={{ WebkitAppRegion: 'drag', paddingTop: 14 }}>
          <div
            style={{
              textAlign: 'center',
              fontSize: 13,
              fontWeight: 700,
              color: MUTED,
              marginBottom: 14
            }}
          >
            환경설정
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              paddingBottom: 14
            }}
          >
            {TABS.map((tab) => {
              const Icon = tab.icon
              const isActive = tab.id === activeTab
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    WebkitAppRegion: 'no-drag',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 16px',
                    borderRadius: 10,
                    border: 'none',
                    background: isActive ? `${ACCENT}59` : 'transparent',
                    color: isActive ? ACCENT : MUTED,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'background 0.15s ease, color 0.15s ease'
                  }}
                >
                  <Icon size={15} />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${BORDER}` }} />

        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
          {ActiveComponent && <ActiveComponent accent={ACCENT} border={BORDER} muted={MUTED} />}
        </div>
      </div>
    </div>
  )
}
