import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, getDay, parse, isWithinInterval } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { Avatar } from '../../components/ui/Avatar'
import { announcementsApi, structureApi, teachersApi } from '../../lib/api'
import { formatDate } from '../../lib/utils'
import {
  ClipboardList, BookOpen, LayoutDashboard,
  Megaphone, Calendar, ChevronRight, GraduationCap, Clock,
} from 'lucide-react'

// Day names matching DB values
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const SUBJECT_COLORS = [
  { bg: 'bg-primary',   text: 'text-white',  light: 'bg-primary-light',   accent: 'text-primary-dark' },
  { bg: 'bg-accent',    text: 'text-white',  light: 'bg-orange-50',        accent: 'text-accent' },
  { bg: 'bg-secondary', text: 'text-white',  light: 'bg-yellow-50',        accent: 'text-secondary' },
  { bg: 'bg-info',      text: 'text-white',  light: 'bg-blue-50',          accent: 'text-info' },
  { bg: 'bg-success',   text: 'text-white',  light: 'bg-green-50',         accent: 'text-success' },
]

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

/** Returns true if current time is between startTime and endTime ("HH:mm") */
function isCurrentClass(startTime: string, endTime: string): boolean {
  try {
    const now   = new Date()
    const base  = format(now, 'yyyy-MM-dd')
    const start = parse(`${base} ${startTime}`, 'yyyy-MM-dd HH:mm', new Date())
    const end   = parse(`${base} ${endTime}`,   'yyyy-MM-dd HH:mm', new Date())
    return isWithinInterval(now, { start, end })
  } catch { return false }
}

function fmt12(time: string): string {
  try {
    const [hStr, mStr = '0'] = time.split(':')
    const h  = parseInt(hStr, 10)
    const m  = parseInt(mStr, 10)
    const ap = h >= 12 ? 'PM' : 'AM'
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${h12}:${m.toString().padStart(2, '0')} ${ap}`
  } catch { return time }
}

export default function TeacherDashboard() {
  const { user }   = useAuth()
  const navigate   = useNavigate()
  const teacherId  = user?.profile?.id

  const { data: teacherData } = useQuery({
    queryKey: ['teacher', teacherId],
    queryFn: () => teachersApi.getOne(teacherId!).then(r => r.data),
    enabled: !!teacherId,
  })

  const teacher = teacherData || user?.profile
  const bannerUrl = teacher?.profile?.bannerImage || (teacherId ? localStorage.getItem(`smartclass_teacher_banner_${teacherId}`) : null) || null
  const avatarUrl = teacher?.profile?.profilePicture || teacher?.profilePicture || null

  const todayName = DAYS[getDay(new Date())] // e.g. "Wednesday"

  const { data: schedules = [] } = useQuery({
    queryKey: ['teacher-schedules-dash', teacher?.id],
    queryFn:  () => structureApi.getSchedules({ teacherId: teacher?.id }).then(r => r.data),
    enabled:  !!teacher?.id,
  })

  const { data: announcements = [] } = useQuery({
    queryKey: ['public-announcements'],
    queryFn:  () => announcementsApi.getPublic().then(r => r.data),
  })

  // Today's classes sorted by start time
  const todaySchedule = useMemo(() =>
    schedules
      .filter((s: any) => s.dayOfWeek === todayName && s.startTime)
      .sort((a: any, b: any) => a.startTime.localeCompare(b.startTime)),
    [schedules, todayName]
  )

  // Stable colour per subject
  const subjectColorMap = useMemo(() => {
    const map: Record<string, number> = {}
    let idx = 0
    schedules.forEach((s: any) => {
      if (s.subjectId && !(s.subjectId in map)) map[s.subjectId] = idx++
    })
    return map
  }, [schedules])

  const recentAnnouncements = announcements.flatMap((c: any) => c.announcements).slice(0, 3)

  const teacherName = teacher?.fullName  || user?.name || 'Teacher'
  const department  = teacher?.department || 'Faculty'
  const employeeId  = teacher?.employeeId
  const assignments = teacher?.subjectAssignments ?? []

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Page header ── */}
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="text-text-secondary font-inter text-sm mt-1">
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      {/* ── Faculty info card ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary-dark text-white shadow-card-hover p-6 min-h-[140px] flex items-center border border-white/10">
        {bannerUrl ? (
          <>
            <img
              src={bannerUrl}
              alt="Faculty Banner"
              className="absolute inset-0 w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/70 to-black/45 backdrop-blur-[0.5px]" />
          </>
        ) : (
          <>
            <div className="pointer-events-none absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/5" />
            <div className="pointer-events-none absolute -bottom-16 -right-4  w-64 h-64 rounded-full bg-white/5" />
          </>
        )}

        <div className="relative z-10 flex items-center gap-5 w-full">
          {/* Profile avatar */}
          <div className="flex-shrink-0">
            <Avatar
              name={teacherName}
              src={avatarUrl}
              size="lg"
              className="ring-2 ring-white/40 shadow-md"
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-poppins font-bold text-xl leading-tight text-white drop-shadow-sm">{teacherName}</h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/20 border border-white/25 backdrop-blur-sm">
                <GraduationCap className="w-3 h-3" /> Teacher
              </span>
            </div>
            <p className="text-white/85 font-inter text-sm mt-0.5 drop-shadow-sm">{department}</p>
            {employeeId && (
              <p className="text-white/65 font-inter text-xs mt-0.5">ID: {employeeId}</p>
            )}
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {assignments.slice(0, 4).map((a: any) => (
                <span
                  key={a.id}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-inter font-medium bg-white/20 border border-white/25 backdrop-blur-sm text-white"
                >
                  {a.subject?.code ?? a.subject?.name}
                </span>
              ))}
              {assignments.length > 4 && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-inter font-medium bg-white/20 border border-white/25 backdrop-blur-sm text-white">
                  +{assignments.length - 4} more
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Three-column row ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Today's Schedule */}
        <div className="card flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-poppins font-semibold flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" /> Today's Schedule
            </h3>
            <button
              onClick={() => navigate('/teacher/schedule')}
              className="flex items-center gap-0.5 text-primary text-xs font-inter font-medium hover:text-primary-dark transition-colors"
            >
              Full <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {todaySchedule.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-6 gap-2">
              <div className="w-10 h-10 bg-primary-light rounded-full flex items-center justify-center">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <p className="font-inter text-sm text-text-secondary">
                {['Saturday', 'Sunday'].includes(todayName) ? 'No classes on weekends' : 'No classes today'}
              </p>
            </div>
          ) : (
            <div className="space-y-2 flex-1">
              {todaySchedule.map((s: any) => {
                const col     = SUBJECT_COLORS[(subjectColorMap[s.subjectId] ?? 0) % SUBJECT_COLORS.length]
                const ongoing = isCurrentClass(s.startTime, s.endTime)

                return (
                  <div
                    key={s.id}
                    className={`flex items-stretch gap-3 p-3 rounded-xl transition-colors ${
                      ongoing ? col.light + ' ring-1 ring-inset ring-current/20' : 'bg-background'
                    }`}
                  >
                    {/* Colour bar */}
                    <div className={`w-1 rounded-full flex-shrink-0 ${col.bg}`} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-poppins font-semibold text-sm text-text-primary truncate">
                          {s.subject?.code}
                        </p>
                        {ongoing && (
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${col.bg} ${col.text}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            Now
                          </span>
                        )}
                      </div>
                      <p className="font-inter text-xs text-text-secondary truncate mt-0.5">
                        {s.subject?.name}
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3 text-text-secondary flex-shrink-0" />
                        <p className="font-inter text-xs text-text-secondary">
                          {fmt12(s.startTime)} – {fmt12(s.endTime)}
                        </p>
                      </div>
                    </div>

                    <div className="flex-shrink-0 flex items-center">
                      <span className="badge bg-border text-text-secondary text-[10px]">
                        {s.section?.name}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card">
          <h3 className="font-poppins font-semibold mb-4">Quick Actions</h3>
          <div className="space-y-2">
            {[
              {
                label:  'Take Attendance',
                sub:    'Open or create a session',
                icon:   <ClipboardList className="w-4 h-4 text-success" />,
                iconBg: 'bg-success/10',
                path:   '/teacher/attendance',
              },
              {
                label:  'Start Presentation',
                sub:    'Display slides for class',
                icon:   <BookOpen className="w-4 h-4 text-info" />,
                iconBg: 'bg-info/10',
                path:   '/teacher/presentation',
              },
              {
                label:  'Record Grades',
                sub:    'Activities & scores',
                icon:   <LayoutDashboard className="w-4 h-4 text-secondary" />,
                iconBg: 'bg-secondary/10',
                path:   '/teacher/academic',
              },
            ].map(action => (
              <button
                key={action.path}
                onClick={() => navigate(action.path)}
                className="w-full flex items-center gap-3 p-3 bg-background hover:bg-primary-light rounded-xl transition-colors text-left group"
              >
                <div className={`w-9 h-9 ${action.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                  {action.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-inter text-sm font-semibold text-text-primary">{action.label}</p>
                  <p className="font-inter text-xs text-text-secondary">{action.sub}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-text-secondary group-hover:text-primary transition-colors flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* Announcements */}
        <div className="card">
          <h3 className="font-poppins font-semibold mb-4 flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-accent" /> Announcements
          </h3>
          {recentAnnouncements.length === 0 ? (
            <p className="text-text-secondary font-inter text-sm">No announcements.</p>
          ) : (
            <div className="space-y-2">
              {recentAnnouncements.map((a: any) => (
                <div key={a.id} className="flex items-start gap-3 p-3 bg-background rounded-xl">
                  <div className="w-2 h-2 mt-1.5 flex-shrink-0 rounded-full bg-accent" />
                  <div className="flex-1 min-w-0">
                    <p className="font-inter text-sm font-medium text-text-primary line-clamp-1">{a.title}</p>
                    {a.publishedAt && (
                      <p className="text-xs text-text-secondary mt-0.5">{formatDate(a.publishedAt)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
