import React, { useState, useMemo, useRef } from 'react'
import { useQuery, useQueries } from '@tanstack/react-query'
import { format } from 'date-fns'
import { attendanceApi, structureApi } from '../../lib/api'
import { LoadingSpinner, EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'
import { formatDate } from '../../lib/utils'
import {
  CalendarDays, ChevronRight, ChevronLeft, FolderOpen,
  Users, BookOpen, Download, FileText, ClipboardList,
  CheckCircle2, XCircle, Clock, AlertCircle, GraduationCap,
} from 'lucide-react'

// ─── Status config ────────────────────────────────────────────────────────────
type AttStatus = 'present' | 'absent' | 'late' | 'excused'

const STATUS_STYLES: Record<AttStatus, { bg: string; icon: React.ReactNode; label: string; dot: string; short: string }> = {
  present: { bg: 'bg-success/15 text-success',             icon: <CheckCircle2 className="w-4 h-4" />, label: 'Present', dot: 'bg-success', short: 'P' },
  absent:  { bg: 'bg-danger/15 text-danger',               icon: <XCircle      className="w-4 h-4" />, label: 'Absent',  dot: 'bg-danger',  short: 'A' },
  late:    { bg: 'bg-warning/20 text-yellow-700',           icon: <Clock        className="w-4 h-4" />, label: 'Late',    dot: 'bg-warning', short: 'L' },
  excused: { bg: 'bg-info/15 text-info',                    icon: <AlertCircle  className="w-4 h-4" />, label: 'Excused', dot: 'bg-info',    short: 'E' },
}

// ─── CSV export ───────────────────────────────────────────────────────────────
function exportCSV(
  students: any[],
  sessions: any[],
  subjectName: string,
  sectionName: string,
  yearName: string,
) {
  const headers = ['Student Name', 'Student No.', ...sessions.map(s => format(new Date(s.attendanceDate), 'MMM d yyyy')), 'Present', 'Absent', 'Late', 'Excused', 'Rate']
  const rows = students.map(stu => {
    const statuses = sessions.map(sess => {
      const rec = sess.attendanceRecords?.find((r: any) => r.studentId === stu.id)
      return (rec?.status || 'absent') as AttStatus
    })
    const P = statuses.filter(s => s === 'present').length
    const A = statuses.filter(s => s === 'absent').length
    const L = statuses.filter(s => s === 'late').length
    const E = statuses.filter(s => s === 'excused').length
    const rate = statuses.length > 0 ? Math.round((P / statuses.length) * 100) + '%' : '—'
    return [stu.fullName, stu.studentNumber, ...statuses.map(s => STATUS_STYLES[s].short), P, A, L, E, rate]
  })

  const csv = [
    [`Attendance Report — ${subjectName}`],
    [`Section: ${sectionName} | Academic Year: ${yearName}`],
    [`Exported: ${format(new Date(), 'MMM d yyyy h:mm a')}`],
    [],
    headers,
    ...rows,
  ].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `attendance_${sectionName}_${subjectName}_${yearName}.csv`.replace(/\s+/g, '_')
  a.click()
  URL.revokeObjectURL(url)
}

// ─── PDF export (browser print) ───────────────────────────────────────────────
function exportPDF(
  students: any[],
  sessions: any[],
  subjectName: string,
  sectionName: string,
  yearName: string,
) {
  const headerCells = sessions.map(s =>
    `<th style="min-width:52px;padding:4px 6px;border:1px solid #cbd5e1;font-size:9px;text-align:center;background:#f8fafc">
      ${format(new Date(s.attendanceDate), 'MMM d')}<br/><span style="color:#94a3b8">${format(new Date(s.attendanceDate), 'EEE')}</span>
    </th>`
  ).join('')

  const bodyRows = students.map((stu, i) => {
    const statuses = sessions.map(sess => {
      const rec = sess.attendanceRecords?.find((r: any) => r.studentId === stu.id)
      return (rec?.status || 'absent') as AttStatus
    })
    const P = statuses.filter(s => s === 'present').length
    const tot = statuses.length
    const statusCells = statuses.map(st => {
      const colors: Record<AttStatus, string> = {
        present: '#16a34a', absent: '#dc2626', late: '#d97706', excused: '#0891b2',
      }
      return `<td style="padding:3px;border:1px solid #e2e8f0;text-align:center">
        <span style="display:inline-block;width:20px;height:20px;border-radius:4px;background:${colors[st]}20;color:${colors[st]};font-size:9px;font-weight:700;line-height:20px">${STATUS_STYLES[st].short}</span>
      </td>`
    }).join('')
    return `<tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
      <td style="padding:5px 8px;border:1px solid #e2e8f0;font-size:10px;white-space:nowrap">${stu.fullName}</td>
      <td style="padding:5px 8px;border:1px solid #e2e8f0;font-size:10px;color:#64748b">${stu.studentNumber}</td>
      ${statusCells}
      <td style="padding:5px 8px;border:1px solid #e2e8f0;font-size:10px;text-align:center;font-weight:700">${tot > 0 ? Math.round((P/tot)*100)+'%' : '—'}</td>
    </tr>`
  }).join('')

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(`<!DOCTYPE html><html><head><title>Attendance — ${subjectName}</title>
  <style>
    body{font-family:sans-serif;padding:20px;color:#1e293b}
    h2{margin:0 0 4px;font-size:16px}p{margin:0 0 12px;font-size:11px;color:#64748b}
    table{border-collapse:collapse;width:100%;font-size:10px}
    @media print{@page{size:landscape;margin:12mm}}
  </style></head><body>
  <h2>Attendance Report — ${subjectName}</h2>
  <p>Section: ${sectionName} &nbsp;|&nbsp; Academic Year: ${yearName} &nbsp;|&nbsp; Exported: ${format(new Date(), 'MMM d yyyy h:mm a')}</p>
  <table>
    <thead><tr style="background:#f1f5f9">
      <th style="padding:5px 8px;border:1px solid #cbd5e1;font-size:10px;text-align:left;min-width:140px">Student</th>
      <th style="padding:5px 8px;border:1px solid #cbd5e1;font-size:10px;text-align:left;min-width:80px">Student No.</th>
      ${headerCells}
      <th style="padding:5px 8px;border:1px solid #cbd5e1;font-size:10px;min-width:40px">Rate</th>
    </tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
  <script>window.onload=function(){window.print();window.close()}<\/script>
  </body></html>`)
  win.document.close()
}

// ─── Main Component ────────────────────────────────────────────────────────────
type View = 'years' | 'sections' | 'grid'

export default function AdminAttendance() {
  const [view,             setView]             = useState<View>('years')
  const [selectedYear,     setSelectedYear]     = useState<any>(null)
  const [selectedSection,  setSelectedSection]  = useState<any>(null)
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('')

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: years    = [], isLoading: yearsLoading }    = useQuery({ queryKey: ['academic-years'],  queryFn: () => structureApi.getAcademicYears().then(r => r.data) })
  const { data: sections = [], isLoading: sectionsLoading } = useQuery({ queryKey: ['sections'],         queryFn: () => structureApi.getSections().then(r => r.data) })
  const { data: allSessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ['admin-sessions-full'],
    queryFn: () => attendanceApi.getAdminSessions().then(r => r.data),
    refetchOnWindowFocus: false,
  })

  // Student counts for section cards
  const sectionIds = useMemo(() => (sections as any[]).map((s: any) => s.id), [sections])
  const studentCountQueries = useQueries({
    queries: sectionIds.map(id => ({
      queryKey: ['section-students', id],
      queryFn: () => structureApi.getSectionStudents(id).then(r => r.data),
      enabled: view === 'sections',
    })),
  })
  const studentCounts = useMemo(
    () => Object.fromEntries(sectionIds.map((id, i) => [id, studentCountQueries[i].data?.length ?? 0])),
    [sectionIds, studentCountQueries],
  )

  // Students for grid view
  const { data: students = [], isLoading: loadingStudents } = useQuery({
    queryKey: ['section-students', selectedSection?.id],
    queryFn: () => structureApi.getSectionStudents(selectedSection!.id).then(r => r.data),
    enabled: view === 'grid' && !!selectedSection?.id,
  })

  // ── Derived data ─────────────────────────────────────────────────────────────

  // Sessions for the selected section (all teachers)
  const sectionSessions = useMemo(() => {
    if (!selectedSection) return []
    return (allSessions as any[]).filter((s: any) => s.sectionId === selectedSection.id)
  }, [allSessions, selectedSection])

  // Unique subjects that have sessions in this section
  const subjectsInSection = useMemo(() => {
    const seen = new Set<string>()
    const result: any[] = []
    sectionSessions.forEach((sess: any) => {
      if (sess.subjectId && !seen.has(sess.subjectId)) {
        seen.add(sess.subjectId)
        result.push({ subjectId: sess.subjectId, subject: sess.subject })
      }
    })
    return result
  }, [sectionSessions])

  // Sessions for selected subject tab
  const sessionsForSubject = useMemo(() => {
    if (!selectedSection || !selectedSubjectId) return []
    return sectionSessions
      .filter((s: any) => s.subjectId === selectedSubjectId)
      .sort((a: any, b: any) => new Date(a.attendanceDate).getTime() - new Date(b.attendanceDate).getTime())
  }, [sectionSessions, selectedSection, selectedSubjectId])

  // Status lookup map
  const statusMap = useMemo(() => {
    const m: Record<string, Record<string, { id: string; status: AttStatus }>> = {}
    sessionsForSubject.forEach((sess: any) => {
      m[sess.id] = {}
      sess.attendanceRecords?.forEach((r: any) => {
        m[sess.id][r.studentId] = { id: r.id, status: r.status as AttStatus }
      })
    })
    return m
  }, [sessionsForSubject])

  // Per-session summary
  const sessionSummaries = useMemo(() =>
    sessionsForSubject.map((sess: any) => {
      const recs = sess.attendanceRecords || []
      return {
        present: recs.filter((r: any) => r.status === 'present').length,
        absent:  recs.filter((r: any) => r.status === 'absent').length,
        late:    recs.filter((r: any) => r.status === 'late').length,
        excused: recs.filter((r: any) => r.status === 'excused').length,
        total:   recs.length,
      }
    }),
    [sessionsForSubject],
  )

  // ── Navigation helpers ───────────────────────────────────────────────────────
  function openYear(year: any) {
    setSelectedYear(year)
    setView('sections')
  }

  function openSection(section: any) {
    setSelectedSection(section)
    // Pre-select first subject with sessions (will be resolved after grid loads)
    setSelectedSubjectId('')
    setView('grid')
  }

  // Auto-select first subject when section opens
  React.useEffect(() => {
    if (view === 'grid' && !selectedSubjectId && subjectsInSection.length > 0) {
      setSelectedSubjectId(subjectsInSection[0].subjectId)
    }
  }, [view, subjectsInSection, selectedSubjectId])

  // ── Current subject info ─────────────────────────────────────────────────────
  const currentSubject = useMemo(
    () => subjectsInSection.find(s => s.subjectId === selectedSubjectId),
    [subjectsInSection, selectedSubjectId],
  )

  const isGridLoading = sessionsLoading || loadingStudents

  // ── YEAR CARDS view ──────────────────────────────────────────────────────────
  if (view === 'years') return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">Attendance Management</h1>
        <p className="text-text-secondary font-inter text-sm mt-1">
          Select a school year to browse section attendance records.
        </p>
      </div>

      {yearsLoading ? <LoadingSpinner /> : (years as any[]).length === 0 ? (
        <EmptyState
          title="No School Years"
          description="Create academic years in Academic Structure first."
          icon={<CalendarDays className="w-8 h-8 text-primary" />}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(years as any[]).map((y: any) => {
            const yearSessions = (allSessions as any[]).length
            return (
              <button
                key={y.id}
                onClick={() => openYear(y)}
                className="card text-left group hover:border-primary/40 hover:shadow-md transition-all duration-200 border border-border"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary-light flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                    <CalendarDays className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-poppins font-semibold text-text-primary">{y.name}</p>
                      {y.isCurrent && (
                        <span className="badge bg-success/10 text-success text-[11px]">Current</span>
                      )}
                    </div>
                    <p className="text-xs text-text-secondary font-inter mt-0.5">
                      {(sections as any[]).length} section{(sections as any[]).length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-text-secondary group-hover:text-primary transition-colors flex-shrink-0" />
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )

  // ── SECTION CARDS view ───────────────────────────────────────────────────────
  if (view === 'sections') return (
    <div className="space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm font-inter text-text-secondary">
        <button onClick={() => setView('years')} className="hover:text-primary transition-colors">
          Attendance
        </button>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-text-primary font-medium">{selectedYear?.name}</span>
      </div>

      <div>
        <h1 className="page-title">Sections — {selectedYear?.name}</h1>
        <p className="text-text-secondary font-inter text-sm mt-1">
          Select a section to view its full attendance records.
        </p>
      </div>

      {sectionsLoading ? <LoadingSpinner /> : (sections as any[]).length === 0 ? (
        <EmptyState
          title="No Sections"
          description="Create sections in Academic Structure first."
          icon={<FolderOpen className="w-8 h-8 text-primary" />}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(sections as any[]).map((sec: any) => {
            const secSessions = (allSessions as any[]).filter((s: any) => s.sectionId === sec.id)
            const openCount   = secSessions.filter((s: any) => s.sessionStatus === 'open').length
            const subjectCount = new Set(secSessions.map((s: any) => s.subjectId)).size
            return (
              <button
                key={sec.id}
                onClick={() => openSection(sec)}
                className="card text-left group hover:border-primary/40 hover:shadow-md transition-all duration-200 border border-border"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-primary-light rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                    <FolderOpen className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-poppins font-semibold text-text-primary truncate">{sec.name}</p>
                    <p className="font-inter text-xs text-text-secondary mt-0.5 truncate">
                      {sec.gradeLevel?.name}{sec.strand ? ` · ${sec.strand.name}` : ''}
                    </p>
                    {openCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-inter text-success mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                        {openCount} open session{openCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-text-secondary group-hover:text-primary transition-colors flex-shrink-0" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-background rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="w-3.5 h-3.5 text-primary" />
                      <p className="font-inter text-xs text-text-secondary">Students</p>
                    </div>
                    <p className="font-poppins font-bold text-xl text-text-primary">
                      {studentCounts[sec.id] ?? '—'}
                    </p>
                  </div>
                  <div className="bg-background rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <BookOpen className="w-3.5 h-3.5 text-secondary" />
                      <p className="font-inter text-xs text-text-secondary">Subjects</p>
                    </div>
                    <p className="font-poppins font-bold text-xl text-text-primary">{subjectCount}</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="font-inter text-xs text-text-secondary">
                    {secSessions.length} total session{secSessions.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )

  // ── ATTENDANCE GRID view ─────────────────────────────────────────────────────
  return (
    <div className="space-y-5 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm font-inter text-text-secondary flex-wrap">
        <button onClick={() => setView('years')} className="hover:text-primary transition-colors">
          Attendance
        </button>
        <ChevronRight className="w-3.5 h-3.5" />
        <button onClick={() => setView('sections')} className="hover:text-primary transition-colors">
          {selectedYear?.name}
        </button>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-text-primary font-medium">{selectedSection?.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">
            {selectedSection?.name} — Attendance
          </h1>
          <p className="text-text-secondary font-inter text-sm mt-1">
            Read-only view · All subjects · {selectedYear?.name}
          </p>
        </div>
        {/* Export buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="secondary"
            size="sm"
            icon={<FileText className="w-4 h-4" />}
            onClick={() => exportCSV(
              students as any[],
              sessionsForSubject,
              currentSubject?.subject?.name || selectedSubjectId,
              selectedSection?.name,
              selectedYear?.name,
            )}
            disabled={sessionsForSubject.length === 0 || (students as any[]).length === 0}
          >
            Export CSV
          </Button>
          <Button
            size="sm"
            icon={<Download className="w-4 h-4" />}
            onClick={() => exportPDF(
              students as any[],
              sessionsForSubject,
              currentSubject?.subject?.name || selectedSubjectId,
              selectedSection?.name,
              selectedYear?.name,
            )}
            disabled={sessionsForSubject.length === 0 || (students as any[]).length === 0}
          >
            Export PDF
          </Button>
        </div>
      </div>

      {/* Card */}
      <div className="card">
        {isGridLoading ? (
          <div className="py-16"><LoadingSpinner /></div>
        ) : subjectsInSection.length === 0 ? (
          <EmptyState
            title="No Attendance Sessions"
            description="No attendance sessions have been created for this section yet."
            icon={<ClipboardList className="w-8 h-8 text-primary" />}
          />
        ) : (
          <>
            {/* Subject tabs */}
            <div className="flex items-center flex-wrap border-b border-border mb-5 overflow-x-auto">
              {subjectsInSection.map(a => {
                const count   = sectionSessions.filter((s: any) => s.subjectId === a.subjectId).length
                const hasOpen = sectionSessions.some((s: any) => s.subjectId === a.subjectId && s.sessionStatus === 'open')
                return (
                  <button
                    key={a.subjectId}
                    onClick={() => setSelectedSubjectId(a.subjectId)}
                    className={`relative flex items-center gap-1.5 px-4 py-2.5 font-inter text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                      selectedSubjectId === a.subjectId
                        ? 'border-primary text-primary'
                        : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border'
                    }`}
                  >
                    {a.subject?.name || a.subjectId}
                    <span className="text-[10px] opacity-60">({count})</span>
                    {hasOpen && <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />}
                  </button>
                )
              })}
            </div>

            {/* Summary bar */}
            {sessionsForSubject.length > 0 && (
              <div className="flex items-center gap-4 mb-4 text-xs font-inter text-text-secondary flex-wrap">
                <span>{sessionsForSubject.length} session{sessionsForSubject.length !== 1 ? 's' : ''}</span>
                <span>·</span>
                <span>{(students as any[]).length} student{(students as any[]).length !== 1 ? 's' : ''}</span>
                {/* Session teacher breakdown */}
                {(() => {
                  const teachers = [...new Set(sessionsForSubject.map((s: any) => s.teacher?.fullName).filter(Boolean))]
                  return teachers.length > 0 ? (
                    <>
                      <span>·</span>
                      <span className="text-text-secondary/70">
                        Teacher{teachers.length > 1 ? 's' : ''}: {teachers.join(', ')}
                      </span>
                    </>
                  ) : null
                })()}
                <span className="ml-auto text-[11px] bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded-lg font-medium">
                  👁 View-only — export to save
                </span>
              </div>
            )}

            {/* Spreadsheet */}
            {sessionsForSubject.length === 0 ? (
              <EmptyState
                title="No Sessions for This Subject"
                description="No attendance sessions have been recorded for this subject yet."
              />
            ) : (students as any[]).length === 0 ? (
              <EmptyState title="No Students in This Section" description="Students will appear once enrolled." />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table
                  className="border-collapse w-full"
                  style={{ minWidth: Math.max(320, 180 + sessionsForSubject.length * 80) }}
                >
                  {/* Column headers */}
                  <thead>
                    <tr className="bg-surface">
                      <th className="sticky left-0 z-20 bg-surface px-4 py-3 text-left border-b border-r border-border min-w-[170px]">
                        <span className="font-poppins font-semibold text-[11px] text-text-secondary uppercase tracking-wider">
                          Student
                        </span>
                      </th>
                      {sessionsForSubject.map((sess: any, colIdx: number) => {
                        const isOpen   = sess.sessionStatus === 'open'
                        const summary  = sessionSummaries[colIdx]
                        const pct      = summary.total > 0 ? Math.round((summary.present / summary.total) * 100) : null
                        return (
                          <th
                            key={sess.id}
                            className="px-2 py-2 border-b border-r border-border text-center min-w-[72px]"
                            title={`${sess.teacher?.fullName || 'Unknown teacher'} · ${formatDate(sess.attendanceDate)}`}
                          >
                            <div className="space-y-1">
                              <p className="font-poppins font-semibold text-[11px] text-text-primary">
                                {format(new Date(sess.attendanceDate), 'MMM d')}
                              </p>
                              <p className="font-inter text-[10px] text-text-secondary">
                                {format(new Date(sess.attendanceDate), 'EEE')}
                              </p>
                              {isOpen ? (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-success">
                                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                                  Open
                                </span>
                              ) : (
                                <span className="text-[9px] text-text-secondary/60 font-inter">Closed</span>
                              )}
                              {pct !== null && (
                                <p className="font-inter text-[9px] text-text-secondary">{pct}%</p>
                              )}
                            </div>
                          </th>
                        )
                      })}
                      {/* Rate column */}
                      <th className="px-3 py-3 border-b border-border text-center min-w-[56px] bg-surface">
                        <span className="font-poppins font-semibold text-[11px] text-text-secondary uppercase tracking-wider">
                          Rate
                        </span>
                      </th>
                    </tr>
                  </thead>

                  {/* Student rows */}
                  <tbody>
                    {(students as any[]).map((student: any, rowIdx: number) => {
                      const rowBg = rowIdx % 2 === 0 ? 'bg-white' : 'bg-background/40'
                      const rowStatuses = sessionsForSubject.map((sess: any) =>
                        statusMap[sess.id]?.[student.id]?.status || 'absent'
                      ) as AttStatus[]
                      const P   = rowStatuses.filter(s => s === 'present').length
                      const tot = rowStatuses.length
                      const pct = tot > 0 ? Math.round((P / tot) * 100) : null

                      return (
                        <tr key={student.id} className={`border-b border-border ${rowBg}`}>
                          {/* Sticky name */}
                          <td className={`sticky left-0 z-10 ${rowBg} px-4 py-2 border-r border-border`}>
                            <p className="font-inter text-sm font-medium text-text-primary leading-tight">{student.fullName}</p>
                            <p className="font-inter text-[11px] text-text-secondary">
                              {student.studentNumber}
                              {tot > 0 && (
                                <span className="ml-1.5 text-text-secondary/60">{P}/{tot}</span>
                              )}
                            </p>
                          </td>

                          {/* Status cells — read-only (no onClick) */}
                          {sessionsForSubject.map((sess: any) => {
                            const entry  = statusMap[sess.id]?.[student.id]
                            const status = (entry?.status || 'absent') as AttStatus
                            const style  = STATUS_STYLES[status]
                            return (
                              <td key={sess.id} className="border-r border-border p-1 text-center">
                                <div
                                  title={style.label}
                                  className={`w-full h-9 rounded-lg flex items-center justify-center select-none pointer-events-none ${style.bg}`}
                                >
                                  {style.icon}
                                </div>
                              </td>
                            )
                          })}

                          {/* Rate */}
                          <td className="px-3 py-2 text-center">
                            {pct !== null ? (
                              <div className="flex flex-col items-center gap-1">
                                <span className={`font-poppins font-bold text-xs ${
                                  pct >= 75 ? 'text-success' : pct >= 50 ? 'text-warning' : 'text-danger'
                                }`}>{pct}%</span>
                                <div className="w-8 h-1 bg-border rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${pct >= 75 ? 'bg-success' : pct >= 50 ? 'bg-warning' : 'bg-danger'}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            ) : <span className="text-text-secondary/40 text-xs">—</span>}
                          </td>
                        </tr>
                      )
                    })}

                    {/* Summary totals row */}
                    <tr className="border-t-2 border-primary/20 bg-primary-light/20">
                      <td className="sticky left-0 z-10 bg-primary-light/30 px-4 py-2 border-r border-border">
                        <span className="font-inter text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                          Summary
                        </span>
                      </td>
                      {sessionsForSubject.map((sess: any, colIdx: number) => {
                        const s = sessionSummaries[colIdx]
                        return (
                          <td key={sess.id} className="border-r border-border px-1 py-2 text-center">
                            <p className="font-poppins font-bold text-xs text-success">{s.present}P</p>
                            <p className="font-inter text-[10px] text-danger">{s.absent}A</p>
                            {(s.late > 0 || s.excused > 0) && (
                              <p className="font-inter text-[10px] text-text-secondary">
                                {s.late > 0 ? `${s.late}L` : ''}{s.late > 0 && s.excused > 0 ? ' ' : ''}{s.excused > 0 ? `${s.excused}E` : ''}
                              </p>
                            )}
                          </td>
                        )
                      })}
                      <td className="bg-primary-light/10" />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Legend */}
            {sessionsForSubject.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center gap-6 flex-wrap">
                  <p className="font-inter text-xs font-semibold text-text-secondary uppercase tracking-wider">Legend</p>
                  {(Object.entries(STATUS_STYLES) as [AttStatus, typeof STATUS_STYLES[AttStatus]][]).map(([status, st]) => (
                    <div key={status} className="flex items-center gap-1.5">
                      <div className={`w-2.5 h-2.5 rounded-full ${st.dot}`} />
                      <span className="font-inter text-xs text-text-secondary">{st.label}</span>
                    </div>
                  ))}
                  <p className="font-inter text-[11px] text-text-secondary/60 ml-auto italic">
                    Hover date column to see teacher name
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
