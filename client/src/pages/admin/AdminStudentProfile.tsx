import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { studentsApi } from '../../lib/api'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { format } from 'date-fns'
import {
  ArrowLeft, User, Mail, GraduationCap, Calendar, KeyRound, RotateCcw,
  ClipboardList, TrendingUp, BookOpen, Shield,
  Heart, Phone, MapPin,
} from 'lucide-react'
import { LoadingSpinner } from '../../components/ui/EmptyState'

type Tab = 'overview' | 'grades' | 'attendance' | 'performance'

const PERIODS = ['1st', '2nd', '3rd', '4th']

function gradeColor(g: number) {
  if (g >= 90) return 'text-green-600'
  if (g >= 80) return 'text-blue-600'
  if (g >= 75) return 'text-yellow-600'
  return 'text-red-600'
}
function gradeBg(g: number) {
  if (g >= 90) return 'bg-green-50 border-green-200'
  if (g >= 80) return 'bg-blue-50 border-blue-200'
  if (g >= 75) return 'bg-yellow-50 border-yellow-200'
  return 'bg-red-50 border-red-200'
}

function InfoCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 sm:p-5 border border-border">
      <h4 className="font-poppins font-semibold text-text-primary text-sm mb-4 flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        {title}
      </h4>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function InfoRow({ label, value, mono, showEmpty = false }: { label: string; value?: string | null; mono?: boolean; showEmpty?: boolean }) {
  if (!value && !showEmpty) return null
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-text-secondary font-inter flex-shrink-0 pt-0.5">{label}</span>
      <span className={`text-sm text-right break-all ${value ? 'text-text-primary' : 'text-text-secondary/60 italic'} ${mono ? 'font-mono' : 'font-inter'}`}>
        {value || 'Not set'}
      </span>
    </div>
  )
}

function AttendancePill({ status }: { status: string }) {
  const map: Record<string, string> = {
    present: 'bg-green-100 text-green-700',
    absent:  'bg-red-100 text-red-700',
    late:    'bg-yellow-100 text-yellow-700',
    excused: 'bg-blue-100 text-blue-700',
  }
  return (
    <span className={`px-2.5 py-1 rounded-lg text-xs font-inter font-semibold capitalize ${map[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}

export default function AdminStudentProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [credentials, setCredentials] = useState<{ email: string; tempPassword: string } | null>(null)
  const [resetError, setResetError] = useState('')

  const { data: student, isLoading } = useQuery({
    queryKey: ['student', id],
    queryFn: () => studentsApi.getOne(id!).then(r => r.data),
    enabled: !!id,
  })

  const { data: grades = [] } = useQuery({
    queryKey: ['student-grades', id],
    queryFn: () => studentsApi.getGrades(id!).then(r => r.data),
    enabled: !!id,
  })

  const { data: attendance = [] } = useQuery({
    queryKey: ['student-attendance', id],
    queryFn: () => studentsApi.getAttendance(id!).then(r => r.data),
    enabled: !!id,
  })

  const { data: scores = [] } = useQuery({
    queryKey: ['student-scores', id],
    queryFn: () => studentsApi.getScores(id!).then(r => r.data),
    enabled: !!id,
  })

  const resetPasswordMutation = useMutation({
    mutationFn: () => studentsApi.resetPassword(id!),
    onSuccess: response => {
      setResetError('')
      setCredentials({
        email: response.data.email || student?.email || '',
        tempPassword: response.data.tempPassword,
      })
    },
    onError: (error: any) => setResetError(error.response?.data?.error || 'Could not reset this student password.'),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner />
      </div>
    )
  }
  if (!student) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-text-secondary">Student not found.</p>
      </div>
    )
  }

  const section  = (student.sectionAssignments as any[])?.[0]
  const profile  = student.profile

  // Attendance stats
  const att = attendance as any[]
  const stats = {
    present: att.filter(r => r.status === 'present').length,
    absent:  att.filter(r => r.status === 'absent').length,
    late:    att.filter(r => r.status === 'late').length,
    excused: att.filter(r => r.status === 'excused').length,
    total:   att.length,
  }
  const rate = stats.total > 0 ? Math.round(((stats.present + stats.late) / stats.total) * 100) : 0

  // Grades grouped by year → subject
  const gradesByYear: Record<string, any[]> = {}
  ;(grades as any[]).forEach(g => {
    const key = g.academicYear?.name || g.academicYearId
    ;(gradesByYear[key] ??= []).push(g)
  })

  const uniqueSubjects = new Set((grades as any[]).map(g => g.subjectId)).size

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview',     label: 'Overview',     icon: <User         className="w-4 h-4" /> },
    { id: 'grades',       label: 'Grades',        icon: <BookOpen     className="w-4 h-4" /> },
    { id: 'attendance',   label: 'Attendance',    icon: <ClipboardList className="w-4 h-4" /> },
    { id: 'performance',  label: 'Performance',   icon: <TrendingUp   className="w-4 h-4" /> },
  ]

  return (
    <div className="animate-fade-in">
      {/* ── Hero ── */}
      <div className="bg-gradient-to-br from-primary-dark via-primary to-primary/80 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 pt-6 pb-24 mb-[-4.5rem]">
        <button
          onClick={() => navigate('/admin/students')}
          className="flex items-center gap-2 text-white/70 hover:text-white text-sm font-inter transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Students
        </button>

        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <Avatar
              name={student.fullName}
              src={profile?.profilePicture}
              size="xl"
              className="!w-24 !h-24 sm:!w-28 sm:!h-28 ring-4 ring-white/30 !text-2xl"
            />
            <div className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-white ${student.user?.isFirstLogin ? 'bg-yellow-400' : 'bg-green-400'}`} />
          </div>

          <div className="flex-1 pb-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-white font-poppins font-bold text-2xl sm:text-3xl leading-tight">{student.fullName}</h1>
              <Badge variant={student.user?.isFirstLogin ? 'warning' : 'success'}>
                {student.user?.isFirstLogin ? 'Pending Setup' : 'Active'}
              </Badge>
            </div>
            <p className="text-white/70 font-mono text-sm mb-2">{student.studentNumber}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-white/60 text-sm font-inter">
              {section && (
                <span className="flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 flex-shrink-0" />
                  {section.section?.gradeLevel?.name} — {section.section?.name}
                </span>
              )}
              {section?.academicYear && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                  {section.academicYear.name}
                </span>
              )}
              {student.email && (
                <span className="flex items-center gap-1.5 min-w-0">
                  <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{student.email}</span>
                </span>
              )}
            </div>
            <div className="mt-4">
              <Button
                size="sm"
                variant="secondary"
                icon={<KeyRound className="w-4 h-4" />}
                loading={resetPasswordMutation.isPending}
                onClick={() => {
                  setResetError('')
                  if (window.confirm(`Reset the password for ${student.fullName}? Their current password will stop working.`)) {
                    resetPasswordMutation.mutate()
                  }
                }}
              >
                Reset Password
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Attendance Rate',      value: `${rate}%`,        color: rate >= 80 ? 'text-green-600' : 'text-red-600', bg: rate >= 80 ? 'bg-green-50' : 'bg-red-50', icon: <ClipboardList className="w-5 h-5" /> },
          { label: 'Sessions Attended',    value: stats.present,     color: 'text-primary',    bg: 'bg-primary/5',   icon: <Calendar     className="w-5 h-5" /> },
          { label: 'Subjects w/ Grades',   value: uniqueSubjects,    color: 'text-info',       bg: 'bg-info/5',      icon: <BookOpen     className="w-5 h-5" /> },
          { label: 'Activities Graded',    value: (scores as any[]).length, color: 'text-accent', bg: 'bg-accent/5', icon: <TrendingUp   className="w-5 h-5" /> },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm border border-border flex items-center gap-3">
            <div className={`p-2 rounded-xl ${s.bg} ${s.color} flex-shrink-0`}>{s.icon}</div>
            <div className="min-w-0">
              <p className={`font-poppins font-bold text-xl leading-none ${s.color}`}>{s.value}</p>
              <p className="text-text-secondary font-inter text-xs mt-1 leading-tight">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="flex border-b border-border overflow-x-auto scrollbar-none">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-inter font-medium whitespace-nowrap transition-all border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-gray-50'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-5 sm:p-6">

          {/* ── OVERVIEW ── */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <InfoCard title="Personal Information" icon={<User className="w-4 h-4" />}>
                <InfoRow label="Full Name"   value={student.fullName} />
                <InfoRow label="Gender"      value={student.gender} />
                <InfoRow label="Birth Date"  value={student.birthDate ? format(new Date(student.birthDate), 'MMMM d, yyyy') : undefined} />
                <InfoRow label="Email"       value={student.email} />
                <InfoRow label="Contact"     value={student.contactNumber} />
                <InfoRow label="Address"     value={profile?.address} />
                <InfoRow label="Blood Type"  value={profile?.bloodType} showEmpty />
                <InfoRow label="Weight"      value={profile?.weight != null ? `${profile.weight} kg` : undefined} showEmpty />
                <InfoRow label="Height"      value={profile?.height != null ? `${profile.height} cm` : undefined} showEmpty />
                {profile?.biography && (
                  <div className="pt-2">
                    <p className="text-xs text-text-secondary font-inter mb-1">About</p>
                    <p className="text-sm text-text-primary font-inter leading-relaxed">{profile.biography}</p>
                  </div>
                )}
              </InfoCard>

              <InfoCard title="Guardian / Emergency Contact" icon={<Heart className="w-4 h-4" />}>
                <InfoRow label="Guardian Name"      value={profile?.guardianName    || student.guardianName} />
                <InfoRow label="Guardian Contact"   value={profile?.guardianContact || student.guardianContact} />
                <InfoRow label="Emergency Contact"  value={profile?.emergencyContact} />
              </InfoCard>

              <InfoCard title="Enrollment History" icon={<GraduationCap className="w-4 h-4" />}>
                {(student.sectionAssignments as any[])?.length > 0 ? (
                  (student.sectionAssignments as any[]).map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                      <div>
                        <p className="font-medium text-sm text-text-primary">{a.section?.gradeLevel?.name} — {a.section?.name}</p>
                        <p className="text-xs text-text-secondary">{a.academicYear?.name}</p>
                      </div>
                      <span className="badge bg-primary-light text-primary-dark text-xs">
                        {a.section?.strand?.name || 'General'}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-text-secondary text-sm">Not assigned to any section.</p>
                )}
              </InfoCard>

              <InfoCard title="Account" icon={<Shield className="w-4 h-4" />}>
                <InfoRow label="Student Number"  value={student.studentNumber} mono />
                <InfoRow label="Status"          value={student.user?.isFirstLogin ? 'Pending Setup' : 'Active'} />
                <InfoRow label="Last Login"      value={student.user?.lastLogin ? format(new Date(student.user.lastLogin), 'MMM d, yyyy h:mm a') : 'Never'} />
                <InfoRow label="Enrolled Since"  value={format(new Date(student.createdAt), 'MMMM d, yyyy')} />
              </InfoCard>
            </div>
          )}

          {/* ── GRADES ── */}
          {activeTab === 'grades' && (
            <div className="space-y-8">
              {Object.keys(gradesByYear).length === 0 ? (
                <div className="text-center py-14">
                  <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-text-secondary font-inter">No grades recorded yet.</p>
                </div>
              ) : Object.entries(gradesByYear).map(([yearName, yearGrades]) => {
                const bySubject: Record<string, any[]> = {}
                yearGrades.forEach(g => { (bySubject[g.subjectId] ??= []).push(g) })

                return (
                  <div key={yearName}>
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar className="w-4 h-4 text-primary" />
                      <h3 className="font-poppins font-semibold text-text-primary">{yearName}</h3>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="text-left p-3 font-inter font-semibold text-text-secondary text-xs uppercase tracking-wide">Subject</th>
                            {PERIODS.map(p => (
                              <th key={p} className="text-center p-3 font-inter font-semibold text-text-secondary text-xs uppercase tracking-wide whitespace-nowrap">{p} Qtr</th>
                            ))}
                            <th className="text-center p-3 font-inter font-semibold text-text-secondary text-xs uppercase tracking-wide">Final Avg</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(bySubject).map(([subjectId, subGrades]) => {
                            const subject = subGrades[0]?.subject
                            const pm: Record<string, number> = {}
                            subGrades.forEach(g => { pm[g.gradingPeriod] = g.grade })
                            const all  = PERIODS.map(p => pm[p]).filter(v => v != null)
                            const avg  = all.length ? Math.round(all.reduce((a, b) => a + b, 0) / all.length) : null
                            return (
                              <tr key={subjectId} className="border-t border-border hover:bg-gray-50/50 transition-colors">
                                <td className="p-3">
                                  <p className="font-medium text-text-primary">{subject?.name || '—'}</p>
                                  <p className="text-xs text-text-secondary font-mono">{subject?.code}</p>
                                </td>
                                {PERIODS.map(p => (
                                  <td key={p} className="p-3 text-center">
                                    {pm[p] != null ? (
                                      <span className={`inline-block px-2.5 py-1 rounded-lg text-sm font-poppins font-bold border ${gradeBg(pm[p])} ${gradeColor(pm[p])}`}>
                                        {pm[p]}
                                      </span>
                                    ) : <span className="text-gray-300">—</span>}
                                  </td>
                                ))}
                                <td className="p-3 text-center">
                                  {avg != null ? (
                                    <span className={`inline-block px-3 py-1 rounded-lg text-sm font-poppins font-bold border ${gradeBg(avg)} ${gradeColor(avg)}`}>
                                      {avg}
                                    </span>
                                  ) : <span className="text-gray-300">—</span>}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── ATTENDANCE ── */}
          {activeTab === 'attendance' && (
            <div className="space-y-5">
              {/* Summary pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Present', count: stats.present, cls: 'bg-green-50  text-green-700  border border-green-200' },
                  { label: 'Absent',  count: stats.absent,  cls: 'bg-red-50    text-red-700    border border-red-200' },
                  { label: 'Late',    count: stats.late,    cls: 'bg-yellow-50 text-yellow-700 border border-yellow-200' },
                  { label: 'Excused', count: stats.excused, cls: 'bg-blue-50   text-blue-700   border border-blue-200' },
                ].map(s => (
                  <div key={s.label} className={`rounded-xl p-4 text-center ${s.cls}`}>
                    <p className="font-poppins font-bold text-2xl">{s.count}</p>
                    <p className="font-inter text-xs mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Attendance rate bar */}
              <div className="bg-gray-50 rounded-xl p-4 border border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-inter text-text-secondary">Attendance Rate</span>
                  <span className={`font-poppins font-bold text-lg ${rate >= 80 ? 'text-green-600' : 'text-red-600'}`}>{rate}%</span>
                </div>
                <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${rate >= 80 ? 'bg-green-500' : rate >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${rate}%` }}
                  />
                </div>
              </div>

              {/* Records table */}
              {att.length === 0 ? (
                <div className="text-center py-10">
                  <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-text-secondary font-inter">No attendance records yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left p-3 font-inter font-semibold text-text-secondary text-xs uppercase tracking-wide">Date</th>
                        <th className="text-left p-3 font-inter font-semibold text-text-secondary text-xs uppercase tracking-wide">Subject</th>
                        <th className="text-left p-3 font-inter font-semibold text-text-secondary text-xs uppercase tracking-wide hidden sm:table-cell">Section</th>
                        <th className="text-center p-3 font-inter font-semibold text-text-secondary text-xs uppercase tracking-wide">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {att.slice(0, 60).map((r: any) => (
                        <tr key={r.id} className="border-t border-border hover:bg-gray-50/50 transition-colors">
                          <td className="p-3 text-text-secondary whitespace-nowrap">
                            {r.session?.attendanceDate ? format(new Date(r.session.attendanceDate), 'MMM d, yyyy') : '—'}
                          </td>
                          <td className="p-3 font-medium text-text-primary">{r.session?.subject?.name || '—'}</td>
                          <td className="p-3 text-text-secondary hidden sm:table-cell">{r.session?.section?.name || '—'}</td>
                          <td className="p-3 text-center"><AttendancePill status={r.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── PERFORMANCE ── */}
          {activeTab === 'performance' && (
            <div>
              {(scores as any[]).length === 0 ? (
                <div className="text-center py-14">
                  <TrendingUp className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-text-secondary font-inter">No activity scores recorded yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left p-3 font-inter font-semibold text-text-secondary text-xs uppercase tracking-wide">Activity</th>
                        <th className="text-left p-3 font-inter font-semibold text-text-secondary text-xs uppercase tracking-wide hidden sm:table-cell">Subject</th>
                        <th className="text-left p-3 font-inter font-semibold text-text-secondary text-xs uppercase tracking-wide hidden md:table-cell">Category</th>
                        <th className="text-center p-3 font-inter font-semibold text-text-secondary text-xs uppercase tracking-wide">Score</th>
                        <th className="text-center p-3 font-inter font-semibold text-text-secondary text-xs uppercase tracking-wide">%</th>
                        <th className="text-left p-3 font-inter font-semibold text-text-secondary text-xs uppercase tracking-wide hidden sm:table-cell">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(scores as any[]).map((s: any) => {
                        const pct = s.totalScore > 0 ? Math.round((s.scoreObtained / s.totalScore) * 100) : 0
                        return (
                          <tr key={s.id} className="border-t border-border hover:bg-gray-50/50 transition-colors">
                            <td className="p-3 font-medium text-text-primary">{s.activity?.title || '—'}</td>
                            <td className="p-3 text-text-secondary hidden sm:table-cell">{s.activity?.subject?.name || '—'}</td>
                            <td className="p-3 hidden md:table-cell">
                              <span className="badge bg-primary-light text-primary-dark">{s.activity?.category}</span>
                            </td>
                            <td className="p-3 text-center font-mono font-semibold text-text-primary">{s.scoreObtained}/{s.totalScore}</td>
                            <td className="p-3 text-center">
                              <span className={`font-poppins font-bold ${pct >= 80 ? 'text-green-600' : pct >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                                {pct}%
                              </span>
                            </td>
                            <td className="p-3 text-text-secondary whitespace-nowrap hidden sm:table-cell">
                              {s.dateRecorded ? format(new Date(s.dateRecorded), 'MMM d, yyyy') : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      <Modal open={!!credentials} onClose={() => setCredentials(null)} title="Temporary Password Generated" size="sm">
        {credentials && (
          <div className="space-y-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-success/10 flex items-center justify-center">
              <KeyRound className="w-7 h-7 text-success" />
            </div>
            <p className="text-sm text-text-secondary font-inter text-center">
              Share these credentials with the student. They will be required to change the temporary password after signing in.
            </p>
            <div className="rounded-xl border border-border bg-primary-light/40 p-4 space-y-3">
              <div>
                <p className="text-xs text-text-secondary font-inter">Email</p>
                <p className="font-poppins font-semibold text-primary break-all">{credentials.email || 'No email on file'}</p>
              </div>
              <div>
                <p className="text-xs text-text-secondary font-inter">New Temporary Password</p>
                <p className="font-poppins font-semibold text-primary font-mono break-all">{credentials.tempPassword}</p>
              </div>
            </div>
            {resetError && <p className="text-sm text-danger font-inter">{resetError}</p>}
            <Button className="w-full" onClick={() => setCredentials(null)}>Done</Button>
          </div>
        )}
      </Modal>
      {resetError && !credentials && (
        <div className="fixed bottom-5 right-5 z-40 max-w-sm rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger font-inter shadow-lg">
          {resetError}
        </div>
      )}
    </div>
  )
}
