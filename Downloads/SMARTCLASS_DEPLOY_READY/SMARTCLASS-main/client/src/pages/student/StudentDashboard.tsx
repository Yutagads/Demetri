import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, getDay } from 'date-fns'
import { useAuth } from '../../lib/auth'
import { Avatar } from '../../components/ui/Avatar'
import { studentsApi, announcementsApi, structureApi } from '../../lib/api'
import { LoadingSpinner } from '../../components/ui/EmptyState'
import {
  User, BookOpen, CalendarDays, TrendingUp, Megaphone,
  CheckSquare, AlertCircle, Clock, GraduationCap,
} from 'lucide-react'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function slotTime(time: string) {
  const [h = '0', m = '0'] = time.split(':')
  const hh = parseInt(h, 10), mm = parseInt(m, 10)
  const ap = hh >= 12 ? 'PM' : 'AM'
  const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh
  return `${h12}:${mm.toString().padStart(2, '0')} ${ap}`
}

export default function StudentDashboard() {
  const { user } = useAuth()
  const studentId = user?.profile?.id
  const currentAssignment = user?.profile?.sectionAssignments?.[0]

  // Core data fetches — all keyed to this student's own ID
  const { data: studentData } = useQuery({
    queryKey: ['student', studentId],
    queryFn: () => studentsApi.getOne(studentId!).then(r => r.data),
    enabled: !!studentId,
  })

  const { data: attendance = [] } = useQuery({
    queryKey: ['student-attendance', studentId],
    queryFn: () => studentsApi.getAttendance(studentId!).then(r => r.data),
    enabled: !!studentId,
  })

  const { data: grades = [] } = useQuery({
    queryKey: ['student-grades', studentId],
    queryFn: () => studentsApi.getGrades(studentId!).then(r => r.data),
    enabled: !!studentId,
  })

  const { data: announcements = [] } = useQuery({
    queryKey: ['public-announcements'],
    queryFn: () => announcementsApi.getPublic().then(r => r.data),
    refetchInterval: 60_000,
  })

  // Academic years — needed for schedule year resolution
  const { data: years = [] } = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => structureApi.getAcademicYears().then(r => r.data),
  })

  // Today's schedule — fetch published schedules for the student's section
  const resolvedYearId = useMemo(() => {
    const sorted = [...(years as any[])].sort((a, b) => {
      if (a.isCurrent) return -1
      if (b.isCurrent) return 1
      return b.name.localeCompare(a.name)
    })
    return sorted[0]?.id || ''
  }, [years])

  const { data: schedules = [] } = useQuery({
    queryKey: ['student-schedules-dashboard', currentAssignment?.sectionId, resolvedYearId],
    queryFn: () => structureApi.getSchedules({
      sectionId: currentAssignment?.sectionId,
      academicYearId: resolvedYearId || undefined,
      status: 'published',
    }).then(r => r.data),
    enabled: !!currentAssignment?.sectionId && !!resolvedYearId,
  })

  // ── Derived stats ──────────────────────────────────────────────────────────

  const attendanceStats = useMemo(() => {
    const att = attendance as any[]
    const present = att.filter(r => r.status === 'present').length
    const late    = att.filter(r => r.status === 'late').length
    const absent  = att.filter(r => r.status === 'absent').length
    const total   = att.length
    const rate    = total > 0 ? Math.round(((present + late) / total) * 100) : null
    return { present, late, absent, total, rate }
  }, [attendance])

  const gradeAvg = useMemo(() => {
    const g = grades as any[]
    if (g.length === 0) return null
    return (g.reduce((sum, gr) => sum + gr.grade, 0) / g.length).toFixed(1)
  }, [grades])

  // Unique subjects from published schedule
  const subjectCount = useMemo(() => {
    return new Set((schedules as any[]).map((s: any) => s.subjectId)).size
  }, [schedules])

  // Today's classes (sorted by start time)
  const todayClasses = useMemo(() => {
    const todayName = DAYS[getDay(new Date())]
    return (schedules as any[])
      .filter((s: any) => s.dayOfWeek === todayName)
      .sort((a: any, b: any) => a.startTime.localeCompare(b.startTime))
  }, [schedules])

  // Latest published announcement
  const latestAnn = useMemo(() => {
    return (announcements as any[])
      .flatMap((c: any) => c.announcements)
      .sort((a: any, b: any) =>
        new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime()
      )[0] || null
  }, [announcements])

  if (!studentData) return <LoadingSpinner />

  const assignment = studentData?.sectionAssignments?.[0]
  const bannerUrl = studentData?.profile?.bannerImage || (studentId ? localStorage.getItem(`smartclass_student_banner_${studentId}`) : null) || null
  const avatarUrl = studentData?.profile?.profilePicture || null

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="text-text-secondary font-inter text-sm mt-1">
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      {/* ── Student Identity Card with Banner ──────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary-dark text-white shadow-card-hover p-6 min-h-[140px] flex items-center border border-white/10">
        {bannerUrl ? (
          <>
            <img
              src={bannerUrl}
              alt="Student Banner"
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

        <div className="relative z-10 flex items-center gap-4 w-full">
          <div className="flex-shrink-0">
            <Avatar
              name={studentData.fullName}
              src={avatarUrl}
              size="lg"
              className="ring-2 ring-white/40 shadow-md"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-poppins font-bold text-xl text-white leading-tight truncate drop-shadow-sm">
              {studentData.fullName}
            </h2>
            <p className="font-mono text-white/75 text-sm mt-0.5">{studentData.studentNumber}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {assignment && (
                <>
                  <span className="px-2.5 py-0.5 rounded-full bg-white/20 border border-white/25 backdrop-blur-sm text-white text-xs font-inter font-medium">
                    {assignment.section?.gradeLevel?.name}
                  </span>
                  {assignment.section?.strand && (
                    <span className="px-2.5 py-0.5 rounded-full bg-white/20 border border-white/25 backdrop-blur-sm text-white text-xs font-inter font-medium">
                      {assignment.section.strand.name}
                    </span>
                  )}
                  <span className="px-2.5 py-0.5 rounded-full bg-white/20 border border-white/25 backdrop-blur-sm text-white text-xs font-inter font-medium">
                    {assignment.section?.name}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-white/15 border border-white/20 backdrop-blur-sm text-white/80 text-xs font-inter">
                    S.Y. {assignment.academicYear?.name}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Live Summary Stats ────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Attendance Rate */}
        <div className="card text-center">
          <div className={`w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center
            ${attendanceStats.rate === null ? 'bg-border' : attendanceStats.rate >= 80 ? 'bg-success/10' : 'bg-danger/10'}`}>
            <CheckSquare className={`w-5 h-5
              ${attendanceStats.rate === null ? 'text-text-secondary' : attendanceStats.rate >= 80 ? 'text-success' : 'text-danger'}`} />
          </div>
          <p className={`text-2xl font-poppins font-bold
            ${attendanceStats.rate === null ? 'text-text-secondary' : attendanceStats.rate >= 80 ? 'text-success' : 'text-danger'}`}>
            {attendanceStats.rate !== null ? `${attendanceStats.rate}%` : '—'}
          </p>
          <p className="text-text-secondary font-inter text-xs mt-0.5">Attendance Rate</p>
          {attendanceStats.total > 0 && (
            <p className="text-text-secondary font-inter text-[11px] mt-0.5">
              {attendanceStats.present + attendanceStats.late}/{attendanceStats.total} sessions
            </p>
          )}
        </div>

        {/* Grade Average */}
        <div className="card text-center">
          <div className={`w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center
            ${gradeAvg === null ? 'bg-border' : parseFloat(gradeAvg) >= 75 ? 'bg-info/10' : 'bg-danger/10'}`}>
            <GraduationCap className={`w-5 h-5
              ${gradeAvg === null ? 'text-text-secondary' : parseFloat(gradeAvg) >= 75 ? 'text-info' : 'text-danger'}`} />
          </div>
          <p className={`text-2xl font-poppins font-bold
            ${gradeAvg === null ? 'text-text-secondary' : parseFloat(gradeAvg) >= 75 ? 'text-info' : 'text-danger'}`}>
            {gradeAvg ?? '—'}
          </p>
          <p className="text-text-secondary font-inter text-xs mt-0.5">Grade Average</p>
          {(grades as any[]).length > 0 && (
            <p className="text-text-secondary font-inter text-[11px] mt-0.5">
              {(grades as any[]).length} grade{(grades as any[]).length !== 1 ? 's' : ''} released
            </p>
          )}
        </div>

        {/* Subjects */}
        <div className="card text-center">
          <div className="w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center bg-accent/10">
            <BookOpen className="w-5 h-5 text-accent" />
          </div>
          <p className="text-2xl font-poppins font-bold text-accent">{subjectCount || '—'}</p>
          <p className="text-text-secondary font-inter text-xs mt-0.5">Subjects</p>
          {assignment && (
            <p className="text-text-secondary font-inter text-[11px] mt-0.5">
              {assignment.section?.name}
            </p>
          )}
        </div>

        {/* Absences */}
        <div className="card text-center">
          <div className={`w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center
            ${attendanceStats.absent === 0 ? 'bg-success/10' : 'bg-warning/10'}`}>
            <AlertCircle className={`w-5 h-5
              ${attendanceStats.absent === 0 ? 'text-success' : 'text-warning'}`} />
          </div>
          <p className={`text-2xl font-poppins font-bold
            ${attendanceStats.absent === 0 ? 'text-success' : 'text-warning'}`}>
            {attendanceStats.total > 0 ? attendanceStats.absent : '—'}
          </p>
          <p className="text-text-secondary font-inter text-xs mt-0.5">Absences</p>
          {attendanceStats.late > 0 && (
            <p className="text-text-secondary font-inter text-[11px] mt-0.5">
              {attendanceStats.late} late
            </p>
          )}
        </div>
      </div>

      {/* ── Bottom row: Today's Schedule + Latest Announcement ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Today's Schedule */}
        <div className="card">
          <h3 className="font-poppins font-semibold text-text-primary mb-4 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-info" />
            Today — {format(new Date(), 'EEEE')}
          </h3>

          {!currentAssignment?.sectionId ? (
            <div className="text-center py-6">
              <BookOpen className="w-8 h-8 mx-auto mb-2 text-border" />
              <p className="text-text-secondary font-inter text-sm">No section assigned yet.</p>
            </div>
          ) : todayClasses.length === 0 ? (
            <div className="text-center py-6">
              <CalendarDays className="w-8 h-8 mx-auto mb-2 text-border" />
              <p className="text-text-secondary font-inter text-sm">No classes today.</p>
              <p className="text-text-secondary font-inter text-xs mt-1">Enjoy your free day!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {todayClasses.map((s: any) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-background border border-border"
                >
                  <div
                    className="w-2.5 h-10 rounded-full flex-shrink-0"
                    style={{ background: s.color || '#6366f1' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-inter font-semibold text-sm text-text-primary truncate">
                      {s.subject?.name}
                    </p>
                    <p className="font-inter text-xs text-text-secondary truncate">
                      {s.teacher?.fullName || 'Unassigned'}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-inter text-xs font-medium text-text-primary flex items-center gap-1">
                      <Clock className="w-3 h-3 text-text-secondary" />
                      {slotTime(s.startTime)}
                    </p>
                    <p className="font-inter text-[11px] text-text-secondary mt-0.5">
                      to {slotTime(s.endTime)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Latest Announcement */}
        <div className="card">
          <h3 className="font-poppins font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-accent" />
            Latest Announcement
          </h3>
          {latestAnn ? (
            <div className="space-y-2">
              <h4 className="font-poppins font-semibold text-text-primary leading-snug line-clamp-2">
                {latestAnn.title}
              </h4>
              {latestAnn.description && (
                <p className="text-text-secondary font-inter text-sm line-clamp-4 leading-relaxed">
                  {latestAnn.description}
                </p>
              )}
              {latestAnn.publishedAt && (
                <p className="text-xs text-text-secondary font-inter pt-1">
                  {format(new Date(latestAnn.publishedAt), 'MMMM d, yyyy')}
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-6">
              <Megaphone className="w-8 h-8 mx-auto mb-2 text-border" />
              <p className="text-text-secondary font-inter text-sm">No announcements yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
