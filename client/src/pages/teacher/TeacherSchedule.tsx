import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getDay } from 'date-fns'
import { useAuth } from '../../lib/auth'
import { structureApi } from '../../lib/api'
import { Calendar } from 'lucide-react'
import { LoadingSpinner, EmptyState } from '../../components/ui/EmptyState'

// ─── Calendar constants ───────────────────────────────────────────────────────
const DAYS        = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_LABELS  = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const HOUR_START  = 6
const HOUR_END    = 18
const SLOT_MIN    = 30
const TOTAL_SLOTS = ((HOUR_END - HOUR_START) * 60) / SLOT_MIN  // 24 slots
const SLOT_H      = 28  // px per 30-min slot

const DEFAULT_COLOR = '#6366f1'

function timeToSlot(time: string): number {
  const [hStr, mStr = '0'] = time.split(':')
  return ((parseInt(hStr, 10) - HOUR_START) * 60 + parseInt(mStr, 10)) / SLOT_MIN
}

function slotLabel(i: number): string {
  const totalMins = i * SLOT_MIN + HOUR_START * 60
  const h  = Math.floor(totalMins / 60)
  const m  = totalMins % 60
  const ap = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${m.toString().padStart(2, '0')} ${ap}`
}

function textColorForBg(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55 ? '#1e293b' : '#ffffff'
}

export default function TeacherSchedule() {
  const { user } = useAuth()
  const teacher  = user?.profile
  const navigate = useNavigate()

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ['teacher-schedules', teacher?.id],
    queryFn:  () => structureApi.getSchedules({ teacherId: teacher?.id, status: 'published' }).then(r => r.data),
    enabled:  !!teacher?.id,
  })

  // Which column is today (0=Mon … 5=Sat)
  const todayIdx = useMemo(() => {
    const d = getDay(new Date())
    if (d >= 1 && d <= 5) return d - 1
    if (d === 6) return 5
    return -1
  }, [])

  function handleBlockClick(s: any) {
    if (s.subjectId && s.sectionId) {
      navigate(`/teacher/subjects?sectionId=${s.sectionId}&subjectId=${s.subjectId}`)
    }
  }

  if (isLoading) return <LoadingSpinner />

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">Class Schedule</h1>
        <p className="text-text-secondary font-inter text-sm mt-1">
          Your weekly teaching schedule. Click any subject block to manage its presentation materials.
        </p>
      </div>

      {(schedules as any[]).length === 0 ? (
        <EmptyState
          title="No Schedule Yet"
          description="Your class schedule will appear here once assigned by the administrator."
          icon={<Calendar className="w-8 h-8 text-primary" />}
        />
      ) : (
        <div className="card">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-poppins font-semibold text-lg text-text-primary">Weekly Timetable</h2>
              <p className="text-text-secondary font-inter text-xs mt-0.5">
                {(schedules as any[])[0]?.academicYear
                  ? `Academic Year ${(schedules as any[])[0].academicYear.name}`
                  : `${(schedules as any[]).length} class${(schedules as any[]).length !== 1 ? 'es' : ''}`}
              </p>
            </div>
            <span className="badge bg-primary-light text-primary-dark text-xs">
              {(schedules as any[]).length} class{(schedules as any[]).length !== 1 ? 'es' : ''}
            </span>
          </div>

          <div className="overflow-x-auto -mx-2">
            <div className="min-w-[680px] px-2">

              {/* Day headers */}
              <div className="flex mb-2 pl-14">
                {DAY_LABELS.map((label, i) => (
                  <div
                    key={label}
                    className={`flex-1 mx-0.5 py-2.5 rounded-xl text-center ${
                      i === todayIdx
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-background text-text-secondary'
                    }`}
                  >
                    <p className="font-poppins font-semibold text-xs">{label}</p>
                    {i === todayIdx && (
                      <p className="font-inter text-[10px] opacity-75 mt-0.5">Today</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Grid body */}
              <div className="flex" style={{ height: TOTAL_SLOTS * SLOT_H }}>

                {/* Time labels — every 30 min */}
                <div className="w-14 flex-shrink-0 relative select-none">
                  {Array.from({ length: TOTAL_SLOTS + 1 }).map((_, i) => (
                    <div
                      key={i}
                      className="absolute right-2 text-right leading-none"
                      style={{ top: i * SLOT_H - 7 }}
                    >
                      {i % 2 === 0 ? (
                        <span className="text-[10px] text-text-secondary font-medium font-inter">
                          {slotLabel(i)}
                        </span>
                      ) : (
                        <span className="text-[9px] text-text-secondary/35 font-inter">
                          {slotLabel(i)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Day columns */}
                {DAYS.map((day, dayIdx) => {
                  const daySched = (schedules as any[]).filter((s: any) => s.dayOfWeek === day)
                  const isToday  = dayIdx === todayIdx

                  return (
                    <div
                      key={day}
                      className={`flex-1 relative mx-0.5 rounded-xl overflow-hidden ${
                        isToday ? 'bg-primary-light/50' : 'bg-background/70'
                      }`}
                    >
                      {/* Grid lines — solid on-the-hour, dashed half-hour */}
                      {Array.from({ length: TOTAL_SLOTS }).map((_, i) => (
                        <div
                          key={i}
                          className="absolute left-0 right-0 pointer-events-none"
                          style={{
                            top: i * SLOT_H,
                            borderTop: i % 2 === 0
                              ? '1px solid rgba(0,0,0,0.08)'
                              : '1px dashed rgba(0,0,0,0.04)',
                          }}
                        />
                      ))}

                      {/* Empty label */}
                      {daySched.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className="text-[10px] text-text-secondary/25 font-inter">no class</span>
                        </div>
                      )}

                      {/* Schedule blocks */}
                      {daySched.map((s: any) => {
                        const rawStart = timeToSlot(s.startTime ?? '06:00')
                        const rawEnd   = timeToSlot(s.endTime   ?? '07:30')

                        // Clamp to visible grid — prevents cards from bleeding above/below
                        const visStart = Math.max(0, Math.min(rawStart, TOTAL_SLOTS - 1))
                        const visEnd   = Math.max(visStart + 1, Math.min(rawEnd, TOTAL_SLOTS))

                        // Pixel height of the rendered card
                        const heightPx = (visEnd - visStart) * SLOT_H - 4

                        // Actual duration in slots (drives which rows to display)
                        const span = Math.max(1, rawEnd - rawStart)

                        const color = s.color || DEFAULT_COLOR
                        const tc    = textColorForBg(color)

                        // Font sizes scale with visible card height
                        const codeFontSize = heightPx < 32 ? '8px' : heightPx < 56 ? '10px' : '11px'
                        const bodyFontSize = heightPx < 56 ? '8px' : '9px'

                        // Row budget: how many text lines actually fit in this card
                        const rowBudget = Math.floor((heightPx - 8) / 13)

                        return (
                          <button
                            key={s.id}
                            onClick={() => handleBlockClick(s)}
                            title={`${s.subject?.name} — click to manage materials`}
                            className="absolute inset-x-1 rounded-xl overflow-hidden select-none cursor-pointer
                              hover:brightness-110 hover:shadow-md active:scale-[0.98]
                              transition-all duration-150 text-left w-[calc(100%-8px)]"
                            style={{
                              top:    visStart * SLOT_H + 2,
                              height: heightPx,
                              background: color,
                              color: tc,
                              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                              zIndex: 10,
                            }}
                          >
                            <div
                              className="h-full flex flex-col justify-center items-center text-center overflow-hidden gap-0.5"
                              style={{ padding: heightPx < 32 ? '2px 4px' : '4px 6px' }}
                            >
                              {/* Subject code — always visible */}
                              <p className="font-poppins font-bold leading-tight truncate w-full"
                                style={{ fontSize: codeFontSize }}>
                                {s.subject?.code}
                              </p>
                              {/* Subject name — ≥1 hr actual AND enough room */}
                              {rowBudget >= 2 && span >= 2 && (
                                <p className="font-inter leading-tight truncate opacity-90 w-full"
                                  style={{ fontSize: bodyFontSize }}>
                                  {s.subject?.name}
                                </p>
                              )}
                              {/* Section — ≥1.5 hr actual AND enough room */}
                              {rowBudget >= 3 && span >= 3 && (
                                <p className="font-inter leading-tight truncate opacity-75 w-full"
                                  style={{ fontSize: bodyFontSize }}>
                                  {s.section?.name}
                                </p>
                              )}
                              {/* Time range — ≥2 hr actual AND enough room */}
                              {rowBudget >= 4 && span >= 4 && (
                                <p className="font-inter leading-tight opacity-60 w-full"
                                  style={{ fontSize: bodyFontSize }}>
                                  {s.startTime} – {s.endTime}
                                </p>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-4 mt-5 pt-4 border-t border-border">
                <p className="w-full text-[11px] text-text-secondary font-inter italic">
                  💡 Click any subject block to go directly to its presentation materials.
                </p>
                {Array.from(new Map((schedules as any[]).map((s: any) => [s.subjectId, s]))).map(([, s]: any) => (
                  <div key={s.subjectId} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ background: s.color || DEFAULT_COLOR }}
                    />
                    <span className="font-inter text-xs text-text-secondary">
                      <span className="font-medium text-text-primary">{s.subject?.code}</span>
                      {' — '}{s.subject?.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
