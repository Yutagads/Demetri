import React, { useState, useMemo } from 'react'
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { useAuth } from '../../lib/auth'
import { attendanceApi, structureApi } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { LoadingSpinner, EmptyState } from '../../components/ui/EmptyState'
import { formatDate } from '../../lib/utils'
import {
  Plus, Key, Lock, CheckCircle2, XCircle, Clock, AlertCircle,
  ChevronLeft, ChevronRight, Users, BookOpen, FolderOpen, Minus,
} from 'lucide-react'

// ─── Status helpers ───────────────────────────────────────────────────────────

type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'

const STATUS_CYCLE: AttendanceStatus[] = ['absent', 'present', 'late', 'excused']

const STATUS_STYLES: Record<AttendanceStatus, { bg: string; icon: React.ReactNode; label: string; dot: string }> = {
  present: {
    bg:    'bg-success/15 hover:bg-success/25 text-success',
    icon:  <CheckCircle2 className="w-4 h-4" />,
    label: 'Present',
    dot:   'bg-success',
  },
  absent: {
    bg:    'bg-danger/15 hover:bg-danger/25 text-danger',
    icon:  <XCircle className="w-4 h-4" />,
    label: 'Absent',
    dot:   'bg-danger',
  },
  late: {
    bg:    'bg-warning/20 hover:bg-warning/30 text-yellow-700',
    icon:  <Clock className="w-4 h-4" />,
    label: 'Late',
    dot:   'bg-warning',
  },
  excused: {
    bg:    'bg-info/15 hover:bg-info/25 text-info',
    icon:  <AlertCircle className="w-4 h-4" />,
    label: 'Excused',
    dot:   'bg-info',
  },
}

function nextStatus(current: AttendanceStatus): AttendanceStatus {
  const idx = STATUS_CYCLE.indexOf(current)
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TeacherAttendance() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const teacher = user?.profile
  const assignments: any[] = useMemo(() => teacher?.subjectAssignments || [], [teacher])

  // ── Navigation ──────────────────────────────────────────────────────────────
  const [selectedSection,   setSelectedSection]   = useState<any>(null)
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('')
  const [viewingStudent, setViewingStudent] = useState<any>(null)

  // ── Session management modal ────────────────────────────────────────────────
  const [managingSession, setManagingSession] = useState<any>(null)
  const [showCodePanel,   setShowCodePanel]   = useState(false)
  const [codePassword,    setCodePassword]    = useState('')
  const [codeResult,      setCodeResult]      = useState<any>(null)
  const [codeError,       setCodeError]       = useState('')

  // ── Create session modal ────────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    subjectId: '',
    sectionId: '',
    attendanceDate: format(new Date(), 'yyyy-MM-dd'),
  })

  // ── Pending cell updates (for optimistic loading) ───────────────────────────
  const [pendingCells, setPendingCells] = useState<Set<string>>(new Set())

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: sessions = [], isLoading: loadingSessions } = useQuery({
    queryKey: ['teacher-sessions'],
    queryFn: () => attendanceApi.getSessions().then(r => r.data),
  })

  // ── Section groups ──────────────────────────────────────────────────────────
  const sectionGroups = useMemo(() => {
    const map: Record<string, { section: any; subjects: any[] }> = {}
    assignments.forEach(a => {
      if (!a.sectionId) return
      if (!map[a.sectionId]) map[a.sectionId] = { section: a.section, subjects: [] }
      if (!map[a.sectionId].subjects.find((s: any) => s.subjectId === a.subjectId))
        map[a.sectionId].subjects.push(a)
    })
    return Object.values(map)
  }, [assignments])

  // ── Student counts per section (for landing cards) ──────────────────────────
  const sectionIds = useMemo(() => [...new Set(assignments.map(a => a.sectionId))], [assignments])
  const studentCountQueries = useQueries({
    queries: sectionIds.map(id => ({
      queryKey: ['section-students', id],
      queryFn: () => structureApi.getSectionStudents(id).then(r => r.data),
    })),
  })
  const studentCounts = useMemo(
    () => Object.fromEntries(sectionIds.map((id, i) => [id, studentCountQueries[i].data?.length ?? 0])),
    [sectionIds, studentCountQueries],
  )

  // ── Students in selected section (for spreadsheet rows) ────────────────────
  const { data: students = [], isLoading: loadingStudents } = useQuery({
    queryKey: ['section-students', selectedSection?.id],
    queryFn: () => structureApi.getSectionStudents(selectedSection!.id).then(r => r.data),
    enabled: !!selectedSection?.id,
  })

  // ── Subjects in selected section ────────────────────────────────────────────
  const subjectsInSection = useMemo(() => {
    if (!selectedSection) return []
    const seen = new Set<string>()
    return assignments.filter(a => {
      if (a.sectionId !== selectedSection.id) return false
      if (seen.has(a.subjectId)) return false
      seen.add(a.subjectId)
      return true
    })
  }, [selectedSection, assignments])

  // ── Sessions for selected subject + section (spreadsheet columns) ───────────
  const sessionsForSubject = useMemo(() => {
    if (!selectedSection || !selectedSubjectId) return []
    return (sessions as any[])
      .filter(s => s.sectionId === selectedSection.id && s.subjectId === selectedSubjectId)
      .sort((a: any, b: any) => new Date(a.attendanceDate).getTime() - new Date(b.attendanceDate).getTime())
  }, [sessions, selectedSection, selectedSubjectId])

  // ── Mutations ───────────────────────────────────────────────────────────────
  const updateRecord = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      attendanceApi.updateRecord(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teacher-sessions'] }),
  })

  const createMutation = useMutation({
    mutationFn: (d: any) => attendanceApi.createSession(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teacher-sessions'] })
      setShowCreate(false)
    },
  })

  const closeMutation = useMutation({
    mutationFn: (id: string) => attendanceApi.closeSession(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teacher-sessions'] })
      setManagingSession(null)
    },
  })

  // ── Cell click: cycle status ────────────────────────────────────────────────
  async function handleCellClick(session: any, studentId: string) {
    const record = session.attendanceRecords?.find((r: any) => r.studentId === studentId)
    if (!record) return
    const key = `${session.id}_${studentId}`
    if (pendingCells.has(key)) return
    const next = nextStatus(record.status as AttendanceStatus)
    setPendingCells(prev => new Set(prev).add(key))
    try {
      await updateRecord.mutateAsync({ id: record.id, status: next })
    } finally {
      setPendingCells(prev => { const n = new Set(prev); n.delete(key); return n })
    }
  }

  // ── Generate session code ───────────────────────────────────────────────────
  async function generateCode() {
    setCodeError('')
    try {
      const res = await attendanceApi.generateCode(managingSession.id, { password: codePassword })
      setCodeResult(res.data)
      // Refresh sessions so the managing panel shows updated code
      qc.invalidateQueries({ queryKey: ['teacher-sessions'] })
    } catch (err: any) {
      setCodeError(err.response?.data?.error || 'Failed to generate code')
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function openCreateModal() {
    setForm({
      subjectId: selectedSubjectId,
      sectionId: selectedSection?.id || '',
      attendanceDate: format(new Date(), 'yyyy-MM-dd'),
    })
    setShowCreate(true)
  }

  function openManageSession(session: any) {
    setManagingSession(session)
    setShowCodePanel(false)
    setCodePassword('')
    setCodeResult(null)
    setCodeError('')
  }

  function selectSection(section: any) {
    setSelectedSection(section)
    const group = sectionGroups.find(g => g.section?.id === section.id)
    setSelectedSubjectId(group?.subjects[0]?.subjectId || '')
  }

  // ── Derived data (must be above all early returns — Rules of Hooks) ─────────

  // Status lookup: sessionId → studentId → { id, status }
  const statusMap = useMemo(() => {
    const m: Record<string, Record<string, { id: string; status: AttendanceStatus }>> = {}
    sessionsForSubject.forEach((sess: any) => {
      m[sess.id] = {}
      sess.attendanceRecords?.forEach((r: any) => {
        m[sess.id][r.studentId] = { id: r.id, status: r.status as AttendanceStatus }
      })
    })
    return m
  }, [sessionsForSubject])

  // Summary counts per session column
  const sessionSummaries = useMemo(() =>
    sessionsForSubject.map((sess: any) => {
      const records = sess.attendanceRecords || []
      return {
        present: records.filter((r: any) => r.status === 'present').length,
        absent:  records.filter((r: any) => r.status === 'absent').length,
        late:    records.filter((r: any) => r.status === 'late').length,
        excused: records.filter((r: any) => r.status === 'excused').length,
        total:   records.length,
      }
    }),
    [sessionsForSubject],
  )

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loadingSessions) return <LoadingSpinner />

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER: Section card landing
  // ────────────────────────────────────────────────────────────────────────────
  if (!selectedSection) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="page-title">Attendance</h1>
          <p className="text-text-secondary font-inter text-sm mt-1">
            Select a section to view and manage attendance.
          </p>
        </div>

        {sectionGroups.length === 0 ? (
          <EmptyState
            title="No Assigned Sections"
            description="Contact your administrator to get sections assigned."
            icon={<FolderOpen className="w-8 h-8 text-primary" />}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sectionGroups.map(({ section, subjects }) => {
              const sectionSessions = (sessions as any[]).filter(s => s.sectionId === section?.id)
              const openCount = sectionSessions.filter(s => s.sessionStatus === 'open').length
              return (
                <div
                  key={section?.id}
                  onClick={() => selectSection(section)}
                  className="card cursor-pointer hover:shadow-card-hover hover:ring-1 hover:ring-primary/30 transition-all duration-200 select-none"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-primary-light rounded-xl flex items-center justify-center flex-shrink-0">
                      <FolderOpen className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-poppins font-semibold text-text-primary truncate">{section?.name}</p>
                      {openCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-inter text-success">
                          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                          {openCount} open session{openCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-text-secondary flex-shrink-0" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-background rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Users className="w-3.5 h-3.5 text-primary" />
                        <p className="font-inter text-xs text-text-secondary">Students</p>
                      </div>
                      <p className="font-poppins font-bold text-xl text-text-primary">
                        {studentCounts[section?.id] ?? '—'}
                      </p>
                    </div>
                    <div className="bg-background rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <BookOpen className="w-3.5 h-3.5 text-secondary" />
                        <p className="font-inter text-xs text-text-secondary">Subjects</p>
                      </div>
                      <p className="font-poppins font-bold text-xl text-text-primary">{subjects.length}</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="font-inter text-xs text-text-secondary">
                      {sectionSessions.length} total session{sectionSessions.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER: Section detail — subject tabs + attendance spreadsheet
  // ────────────────────────────────────────────────────────────────────────────
  const isSheetLoading = loadingStudents || loadingSessions

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Attendance</h1>
          <p className="text-text-secondary font-inter text-sm mt-1 flex items-center gap-1.5">
            <FolderOpen className="w-3.5 h-3.5" /> {selectedSection.name}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedSection(null)}
            className="flex items-center gap-1.5 text-text-secondary font-inter text-sm hover:text-text-primary transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <Button onClick={openCreateModal} icon={<Plus className="w-4 h-4" />}>
            New Session
          </Button>
        </div>
      </div>

      <div className="card">
        {/* Subject tabs */}
        <div className="flex items-center flex-wrap border-b border-border mb-5">
          {subjectsInSection.map(a => {
            const subjectSessions = (sessions as any[]).filter(
              s => s.sectionId === selectedSection.id && s.subjectId === a.subjectId
            )
            const openCount = subjectSessions.filter(s => s.sessionStatus === 'open').length
            return (
              <button
                key={a.subjectId}
                onClick={() => setSelectedSubjectId(a.subjectId)}
                className={`relative px-4 py-2.5 font-inter text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                  selectedSubjectId === a.subjectId
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border'
                }`}
              >
                {a.subject?.name}
                {openCount > 0 && (
                  <span className="ml-1.5 inline-flex w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                )}
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
            <span className="ml-auto text-[11px] text-text-secondary/70 italic">
              Click any cell to cycle: Absent → Present → Late → Excused
            </span>
          </div>
        )}

        {/* Spreadsheet */}
        {isSheetLoading ? (
          <LoadingSpinner />
        ) : sessionsForSubject.length === 0 ? (
          <EmptyState
            title="No Sessions Yet"
            description="Create an attendance session for this subject to start tracking."
            action={<Button onClick={openCreateModal} icon={<Plus className="w-4 h-4" />}>New Session</Button>}
          />
        ) : (students as any[]).length === 0 ? (
          <EmptyState title="No Students in This Section" description="Students will appear once enrolled." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table
              className="border-collapse w-full"
              style={{ minWidth: Math.max(320, 180 + sessionsForSubject.length * 80) }}
            >
              {/* ── Column headers (dates) ───────────────────────────────────── */}
              <thead>
                <tr className="bg-surface">
                  {/* Student column */}
                  <th className="sticky left-0 z-20 bg-surface px-4 py-3 text-left border-b border-r border-border min-w-[170px]">
                    <span className="font-poppins font-semibold text-[11px] text-text-secondary uppercase tracking-wider">
                      Student
                    </span>
                  </th>

                  {/* Session date columns */}
                  {sessionsForSubject.map((sess: any, colIdx: number) => {
                    const isOpen = sess.sessionStatus === 'open'
                    const summary = sessionSummaries[colIdx]
                    const pct = summary.total > 0 ? Math.round((summary.present / summary.total) * 100) : null
                    return (
                      <th
                        key={sess.id}
                        className="px-2 py-2 border-b border-r border-border text-center min-w-[72px] cursor-pointer hover:bg-primary-light/20 transition-colors group"
                        onClick={() => openManageSession(sess)}
                        title="Click to manage this session"
                      >
                        <div className="space-y-1">
                          {/* Date */}
                          <p className="font-poppins font-semibold text-[11px] text-text-primary">
                            {format(new Date(sess.attendanceDate), 'MMM d')}
                          </p>
                          <p className="font-inter text-[10px] text-text-secondary">
                            {format(new Date(sess.attendanceDate), 'EEE')}
                          </p>
                          {/* Status indicator */}
                          {isOpen ? (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-success">
                              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                              Open
                            </span>
                          ) : (
                            <span className="text-[9px] text-text-secondary/60 font-inter">Closed</span>
                          )}
                          {/* Attendance pct */}
                          {pct !== null && (
                            <p className="font-inter text-[9px] text-text-secondary">{pct}%</p>
                          )}
                        </div>
                      </th>
                    )
                  })}

                  {/* + New session column */}
                  <th className="px-2 py-3 border-b border-border min-w-[48px] text-center">
                    <button
                      onClick={openCreateModal}
                      title="Add new session"
                      className="w-7 h-7 rounded-lg bg-primary-light text-primary hover:bg-primary hover:text-white transition-colors flex items-center justify-center mx-auto"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </th>
                </tr>
              </thead>

              {/* ── Student rows ──────────────────────────────────────────────── */}
              <tbody>
                {(students as any[]).map((student: any, rowIdx: number) => {
                  const rowBg = rowIdx % 2 === 0 ? 'bg-white' : 'bg-background/40'

                  // Row summary
                  const rowStatuses = sessionsForSubject.map((sess: any) =>
                    statusMap[sess.id]?.[student.id]?.status
                  ).filter(Boolean) as AttendanceStatus[]
                  const presentCount = rowStatuses.filter(s => s === 'present').length
                  const totalSess    = rowStatuses.length

                  return (
                    <tr key={student.id} className={`border-b border-border ${rowBg}`}>
                      {/* Sticky name */}
                      <td className={`sticky left-0 z-10 ${rowBg} px-4 py-2 border-r border-border`}>
                        <button
                          type="button"
                          onClick={() => setViewingStudent(student)}
                          className="text-left font-inter text-sm font-medium text-text-primary leading-tight hover:text-primary transition-colors"
                          title="View student profile"
                        >
                          {student.fullName}
                        </button>
                        <p className="font-inter text-[11px] text-text-secondary">
                          {student.studentNumber}
                          {totalSess > 0 && (
                            <span className="ml-1.5 text-text-secondary/60">
                              {presentCount}/{totalSess}
                            </span>
                          )}
                        </p>
                        {(student.profile?.bloodType || student.profile?.weight != null || student.profile?.height != null) && (
                          <p className="font-inter text-[10px] text-text-secondary/70">
                            Health: {student.profile?.bloodType || '—'} · {student.profile?.weight != null ? `${student.profile.weight} kg` : '—'} · {student.profile?.height != null ? `${student.profile.height} cm` : '—'}
                          </p>
                        )}
                      </td>

                      {/* Status cells */}
                      {sessionsForSubject.map((sess: any) => {
                        const entry   = statusMap[sess.id]?.[student.id]
                        const status  = (entry?.status || 'absent') as AttendanceStatus
                        const cellKey = `${sess.id}_${student.id}`
                        const pending = pendingCells.has(cellKey)
                        const style   = STATUS_STYLES[status]

                        return (
                          <td key={sess.id} className="border-r border-border p-1 text-center">
                            <button
                              onClick={() => handleCellClick(sess, student.id)}
                              disabled={pending || !entry}
                              title={`${student.fullName}: ${style.label} — click to change`}
                              className={`w-full h-9 rounded-lg flex items-center justify-center transition-all duration-150 ${style.bg} ${pending ? 'opacity-50' : ''}`}
                            >
                              {pending
                                ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                : style.icon
                              }
                            </button>
                          </td>
                        )
                      })}

                      {/* Spacer */}
                      <td className="bg-background/20" />
                    </tr>
                  )
                })}

                {/* ── Column totals row ──────────────────────────────────────── */}
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

        {/* ── Legend ──────────────────────────────────────────────────────────── */}
        {sessionsForSubject.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center gap-6 flex-wrap">
              <p className="font-inter text-xs font-semibold text-text-secondary uppercase tracking-wider">Legend</p>
              {(Object.entries(STATUS_STYLES) as [AttendanceStatus, typeof STATUS_STYLES[AttendanceStatus]][]).map(([status, st]) => (
                <div key={status} className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${st.dot}`} />
                  <span className="font-inter text-xs text-text-secondary">{st.label}</span>
                </div>
              ))}
              <p className="font-inter text-[11px] text-text-secondary/60 ml-auto italic">
                Click date header to manage session · Click cell to cycle status
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Shared student profile ─────────────────────────────────────────── */}
      <Modal
        open={!!viewingStudent}
        onClose={() => setViewingStudent(null)}
        title="Student Profile"
        size="sm"
      >
        {viewingStudent && (
          <div className="space-y-4">
            <div>
              <p className="font-poppins font-semibold text-text-primary">{viewingStudent.fullName}</p>
              <p className="font-mono text-xs text-text-secondary mt-1">{viewingStudent.studentNumber}</p>
            </div>
            <div className="divide-y divide-border text-sm">
              {[
                ['Blood Type', viewingStudent.profile?.bloodType],
                ['Weight', viewingStudent.profile?.weight != null ? `${viewingStudent.profile.weight} kg` : undefined],
                ['Height', viewingStudent.profile?.height != null ? `${viewingStudent.profile.height} cm` : undefined],
                ['Guardian', viewingStudent.profile?.guardianName],
                ['Guardian Contact', viewingStudent.profile?.guardianContact],
                ['Emergency Contact', viewingStudent.profile?.emergencyContact],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 py-2">
                  <span className="text-text-secondary font-inter">{label}</span>
                  <span className={`font-inter text-right ${value ? 'text-text-primary' : 'text-text-secondary/60 italic'}`}>
                    {value || 'Not set'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* ── Create Session Modal ───────────────────────────────────────────────── */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="New Attendance Session"
        footer={
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              loading={createMutation.isPending}
              onClick={() => createMutation.mutate(form)}
              disabled={!form.subjectId || !form.sectionId}
            >
              Create Session
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="p-3 bg-primary-light/30 rounded-xl flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-primary flex-shrink-0" />
            <p className="font-inter text-sm font-medium text-text-primary">{selectedSection.name}</p>
          </div>
          <div>
            <label className="block text-sm font-medium font-inter text-text-primary mb-1.5">Subject</label>
            <select
              className="input-field"
              value={form.subjectId}
              onChange={e => setForm(f => ({ ...f, subjectId: e.target.value }))}
            >
              <option value="">Select Subject</option>
              {subjectsInSection.map((a: any) => (
                <option key={a.subjectId} value={a.subjectId}>{a.subject?.name}</option>
              ))}
            </select>
          </div>
          <Input
            label="Attendance Date"
            type="date"
            value={form.attendanceDate}
            onChange={e => setForm(f => ({ ...f, attendanceDate: e.target.value }))}
          />
        </div>
      </Modal>

      {/* ── Session Management Modal ───────────────────────────────────────────── */}
      <Modal
        open={!!managingSession}
        onClose={() => { setManagingSession(null); setShowCodePanel(false); setCodeResult(null) }}
        title="Manage Session"
        size="sm"
        footer={
          managingSession?.sessionStatus === 'open' && !showCodePanel ? (
            <div className="flex gap-3 flex-wrap">
              <Button
                variant="secondary"
                icon={<Key className="w-4 h-4" />}
                onClick={() => setShowCodePanel(true)}
              >
                Generate Code
              </Button>
              <Button
                variant="danger"
                onClick={() => closeMutation.mutate(managingSession.id)}
                loading={closeMutation.isPending}
              >
                Close Session
              </Button>
            </div>
          ) : undefined
        }
      >
        {managingSession && (
          <>
            {/* Session info */}
            <div className="space-y-3 mb-4">
              <div className="p-4 bg-background rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-inter text-sm text-text-secondary">Date</p>
                  <p className="font-poppins font-semibold text-text-primary">
                    {formatDate(managingSession.attendanceDate)}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="font-inter text-sm text-text-secondary">Status</p>
                  <span className={`badge ${managingSession.sessionStatus === 'open'
                    ? 'bg-success/10 text-success'
                    : 'bg-border text-text-secondary'}`}>
                    {managingSession.sessionStatus === 'open' ? '● Open' : '✓ Closed'}
                  </span>
                </div>
                {managingSession.sessionCode && (
                  <div className="flex items-center justify-between">
                    <p className="font-inter text-sm text-text-secondary">Session Code</p>
                    <p className="font-poppins font-bold text-lg text-primary tracking-widest">
                      {managingSession.sessionCode}
                    </p>
                  </div>
                )}
              </div>

              {/* Attendance summary */}
              {(() => {
                const records = managingSession.attendanceRecords || []
                const present = records.filter((r: any) => r.status === 'present').length
                const absent  = records.filter((r: any) => r.status === 'absent').length
                const late    = records.filter((r: any) => r.status === 'late').length
                const excused = records.filter((r: any) => r.status === 'excused').length
                const pct     = records.length > 0 ? Math.round((present / records.length) * 100) : 0
                return (
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: 'Present', value: present, color: 'text-success' },
                      { label: 'Absent',  value: absent,  color: 'text-danger' },
                      { label: 'Late',    value: late,    color: 'text-yellow-600' },
                      { label: 'Excused', value: excused, color: 'text-info' },
                    ].map(item => (
                      <div key={item.label} className="bg-background rounded-xl p-2.5 text-center">
                        <p className={`font-poppins font-bold text-lg ${item.color}`}>{item.value}</p>
                        <p className="font-inter text-[10px] text-text-secondary">{item.label}</p>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>

            {/* Generate code panel */}
            {showCodePanel && (
              <div className="space-y-3 border-t border-border pt-4">
                <p className="font-inter text-sm text-text-secondary">
                  Confirm your password to generate a session code for student self-attendance.
                </p>
                <Input
                  label="Your Password"
                  type="password"
                  placeholder="Enter your password"
                  icon={<Lock className="w-4 h-4" />}
                  value={codePassword}
                  onChange={e => setCodePassword(e.target.value)}
                />
                {codeError && <p className="text-danger text-sm font-inter">{codeError}</p>}
                {codeResult ? (
                  <div className="p-5 bg-primary-light rounded-2xl text-center">
                    <p className="text-xs text-text-secondary font-inter uppercase tracking-wider mb-2">Session Code</p>
                    <p className="text-5xl font-poppins font-bold text-primary tracking-widest">{codeResult.sessionCode}</p>
                    <p className="text-xs text-text-secondary mt-3 font-inter">
                      Expires: {format(new Date(codeResult.expiresAt), 'h:mm a')}
                    </p>
                  </div>
                ) : (
                  <Button onClick={generateCode} className="w-full">Generate Code</Button>
                )}
                <Button
                  variant="secondary"
                  onClick={() => { setShowCodePanel(false); setCodeResult(null); setCodePassword('') }}
                  className="w-full"
                >
                  Back
                </Button>
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  )
}
