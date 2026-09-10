import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { teachersApi } from '../../lib/api'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { format } from 'date-fns'
import {
  ArrowLeft, User, Mail, Calendar, Briefcase, KeyRound,
  BookOpen, Clock, Phone, Shield, GraduationCap,
  LayoutGrid, Users,
} from 'lucide-react'
import { LoadingSpinner } from '../../components/ui/EmptyState'

type Tab = 'overview' | 'assignments' | 'schedule'

// ── Shared helpers ─────────────────────────────────────────────────────────────

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

function InfoRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-text-secondary font-inter flex-shrink-0 pt-0.5">{label}</span>
      <span className={`text-sm text-text-primary text-right break-all ${mono ? 'font-mono' : 'font-inter'}`}>{value}</span>
    </div>
  )
}

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// ── Main component ─────────────────────────────────────────────────────────────

export default function AdminTeacherProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [credentials, setCredentials] = useState<{ email: string; tempPassword: string } | null>(null)
  const [resetError, setResetError] = useState('')

  const { data: teacher, isLoading } = useQuery({
    queryKey: ['teacher', id],
    queryFn: () => teachersApi.getOne(id!).then(r => r.data),
    enabled: !!id,
  })

  const resetPasswordMutation = useMutation({
    mutationFn: () => teachersApi.resetPassword(id!),
    onSuccess: response => {
      setResetError('')
      setCredentials({
        email: response.data.email || teacher?.email || '',
        tempPassword: response.data.tempPassword,
      })
    },
    onError: (error: any) => setResetError(error.response?.data?.error || 'Could not reset this teacher password.'),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner />
      </div>
    )
  }
  if (!teacher) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-text-secondary">Teacher not found.</p>
      </div>
    )
  }

  const profile = teacher.profile
  const assignments: any[] = teacher.subjectAssignments || []
  const schedules: any[]   = teacher.classSchedules     || []

  // Group assignments by academic year
  const byYear: Record<string, any[]> = {}
  assignments.forEach(a => {
    const key = a.academicYear?.name || a.academicYearId || 'Unknown Year'
    ;(byYear[key] ??= []).push(a)
  })

  // Stats
  const uniqueSections = new Set(assignments.map(a => a.sectionId)).size
  const uniqueSubjects  = new Set(assignments.map(a => a.subjectId)).size
  const totalYears      = Object.keys(byYear).length

  // Group schedules by day for display
  const byDay: Record<string, any[]> = {}
  schedules.forEach(s => {
    const day = s.dayOfWeek || 'Other'
    ;(byDay[day] ??= []).push(s)
  })
  const sortedDays = Object.keys(byDay).sort(
    (a, b) => (DAY_ORDER.indexOf(a) ?? 99) - (DAY_ORDER.indexOf(b) ?? 99)
  )

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview',     label: 'Overview',            icon: <User       className="w-4 h-4" /> },
    { id: 'assignments',  label: 'Sections & Subjects',  icon: <GraduationCap className="w-4 h-4" /> },
    { id: 'schedule',     label: 'Class Schedule',       icon: <Clock      className="w-4 h-4" /> },
  ]

  return (
    <div className="animate-fade-in">

      {/* ── Hero ── */}
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 pt-6 pb-24 mb-[-4.5rem]">
        <button
          onClick={() => navigate('/admin/teachers')}
          className="flex items-center gap-2 text-white/70 hover:text-white text-sm font-inter transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Teachers
        </button>

        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <Avatar
              name={teacher.fullName}
              src={profile?.profilePicture}
              size="xl"
              className="!w-24 !h-24 sm:!w-28 sm:!h-28 ring-4 ring-white/20 !text-2xl"
            />
            <div className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-gray-800 ${teacher.user?.isFirstLogin ? 'bg-yellow-400' : 'bg-green-400'}`} />
          </div>

          <div className="flex-1 pb-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-white font-poppins font-bold text-2xl sm:text-3xl leading-tight">{teacher.fullName}</h1>
              <Badge variant={teacher.user?.isFirstLogin ? 'warning' : 'success'}>
                {teacher.user?.isFirstLogin ? 'Pending Setup' : 'Active'}
              </Badge>
            </div>
            {teacher.employeeId && (
              <p className="text-white/70 font-mono text-sm mb-2">{teacher.employeeId}</p>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-white/60 text-sm font-inter">
              {teacher.department && (
                <span className="flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 flex-shrink-0" />
                  {teacher.department}
                </span>
              )}
              {teacher.email && (
                <span className="flex items-center gap-1.5 min-w-0">
                  <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{teacher.email}</span>
                </span>
              )}
              {teacher.contactNumber && (
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                  {teacher.contactNumber}
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
                  if (window.confirm(`Reset the password for ${teacher.fullName}? Their current password will stop working.`)) {
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
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Sections Handled',  value: uniqueSections, color: 'text-primary',  bg: 'bg-primary/5',  icon: <Users        className="w-5 h-5" /> },
          { label: 'Subjects Taught',   value: uniqueSubjects, color: 'text-info',     bg: 'bg-info/5',     icon: <BookOpen     className="w-5 h-5" /> },
          { label: 'Academic Years',    value: totalYears,     color: 'text-accent',   bg: 'bg-accent/5',   icon: <LayoutGrid   className="w-5 h-5" /> },
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
                <InfoRow label="Full Name"    value={teacher.fullName} />
                <InfoRow label="Gender"       value={profile?.gender} />
                <InfoRow label="Birth Date"   value={profile?.birthDate ? format(new Date(profile.birthDate), 'MMMM d, yyyy') : undefined} />
                <InfoRow label="Email"        value={teacher.email} />
                <InfoRow label="Contact"      value={teacher.contactNumber} />
              </InfoCard>

              <InfoCard title="Professional Details" icon={<Briefcase className="w-4 h-4" />}>
                <InfoRow label="Employee ID"  value={teacher.employeeId} mono />
                <InfoRow label="Department"   value={teacher.department} />
                <InfoRow label="Subjects"     value={uniqueSubjects > 0 ? `${uniqueSubjects} subject${uniqueSubjects !== 1 ? 's' : ''}` : undefined} />
                <InfoRow label="Sections"     value={uniqueSections > 0 ? `${uniqueSections} section${uniqueSections !== 1 ? 's' : ''} handled` : undefined} />
              </InfoCard>

              <InfoCard title="Account" icon={<Shield className="w-4 h-4" />}>
                <InfoRow label="Status"        value={teacher.user?.isFirstLogin ? 'Pending Setup' : 'Active'} />
                <InfoRow label="Last Login"    value={teacher.user?.lastLogin ? format(new Date(teacher.user.lastLogin), 'MMM d, yyyy h:mm a') : 'Never'} />
                <InfoRow label="Member Since"  value={format(new Date(teacher.createdAt), 'MMMM d, yyyy')} />
              </InfoCard>

              {/* Current subjects summary */}
              {assignments.length > 0 && (
                <InfoCard title="Current Assignments" icon={<BookOpen className="w-4 h-4" />}>
                  {assignments.slice(0, 6).map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0 gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-text-primary truncate">{a.subject?.name || '—'}</p>
                        <p className="text-xs text-text-secondary">{a.section?.gradeLevel?.name} — {a.section?.name}</p>
                      </div>
                      <span className="badge bg-primary-light text-primary-dark text-xs flex-shrink-0">
                        {a.academicYear?.name}
                      </span>
                    </div>
                  ))}
                  {assignments.length > 6 && (
                    <button
                      onClick={() => setActiveTab('assignments')}
                      className="text-xs text-primary font-inter mt-1 hover:underline"
                    >
                      +{assignments.length - 6} more → View all
                    </button>
                  )}
                </InfoCard>
              )}
            </div>
          )}

          {/* ── ASSIGNMENTS (Sections & Subjects by Year) ── */}
          {activeTab === 'assignments' && (
            <div className="space-y-8">
              {Object.keys(byYear).length === 0 ? (
                <div className="text-center py-14">
                  <GraduationCap className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-text-secondary font-inter">No subject assignments recorded yet.</p>
                </div>
              ) : Object.entries(byYear)
                  .sort(([a], [b]) => b.localeCompare(a)) // newest first
                  .map(([yearName, yearAssignments]) => {
                    // Group by section within each year
                    const bySec: Record<string, any[]> = {}
                    yearAssignments.forEach(a => {
                      const key = a.sectionId
                      ;(bySec[key] ??= []).push(a)
                    })

                    return (
                      <div key={yearName}>
                        <div className="flex items-center gap-2 mb-4">
                          <Calendar className="w-4 h-4 text-primary" />
                          <h3 className="font-poppins font-semibold text-text-primary">{yearName}</h3>
                          <span className="badge bg-primary-light text-primary-dark">
                            {Object.keys(bySec).length} section{Object.keys(bySec).length !== 1 ? 's' : ''}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {Object.entries(bySec).map(([, secAssignments]) => {
                            const sec = secAssignments[0]?.section
                            return (
                              <div
                                key={secAssignments[0].sectionId}
                                className="bg-gray-50 border border-border rounded-xl p-4"
                              >
                                {/* Section header */}
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                    <Users className="w-4 h-4 text-primary" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-poppins font-semibold text-sm text-text-primary truncate">
                                      {sec?.name || '—'}
                                    </p>
                                    <p className="text-xs text-text-secondary">{sec?.gradeLevel?.name}</p>
                                  </div>
                                </div>

                                {/* Subjects list */}
                                <div className="space-y-1.5">
                                  {secAssignments.map((a: any) => (
                                    <div
                                      key={a.id}
                                      className="flex items-center gap-2 bg-white border border-border rounded-lg px-2.5 py-1.5"
                                    >
                                      <BookOpen className="w-3 h-3 text-primary/60 flex-shrink-0" />
                                      <div className="min-w-0">
                                        <p className="text-xs font-inter font-medium text-text-primary truncate">
                                          {a.subject?.name || '—'}
                                        </p>
                                        {a.subject?.code && (
                                          <p className="text-[10px] text-text-secondary font-mono">{a.subject.code}</p>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                {sec?.strand?.name && (
                                  <span className="mt-3 inline-block badge bg-accent/10 text-accent text-xs">
                                    {sec.strand.name}
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })
              }
            </div>
          )}

          {/* ── SCHEDULE ── */}
          {activeTab === 'schedule' && (
            <div className="space-y-5">
              {schedules.length === 0 ? (
                <div className="text-center py-14">
                  <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-text-secondary font-inter">No class schedules recorded yet.</p>
                </div>
              ) : (
                <>
                  {/* Weekly grid view */}
                  <div className="space-y-4">
                    {sortedDays.map(day => (
                      <div key={day}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-inter font-semibold text-text-secondary uppercase tracking-wider w-24 flex-shrink-0">
                            {day}
                          </span>
                          <div className="flex-1 h-px bg-border" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pl-0 sm:pl-26">
                          {byDay[day]
                            .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))
                            .map((s: any) => (
                              <div
                                key={s.id}
                                className="flex items-start gap-3 bg-white border border-border rounded-xl p-3 hover:shadow-sm transition-shadow"
                              >
                                {/* Color swatch */}
                                <div
                                  className="w-1 self-stretch rounded-full flex-shrink-0"
                                  style={{ backgroundColor: s.color || '#6366f1' }}
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="font-inter font-medium text-sm text-text-primary truncate">
                                    {s.subject?.name || '—'}
                                  </p>
                                  <p className="text-xs text-text-secondary mt-0.5">
                                    {s.section?.gradeLevel?.name} — {s.section?.name}
                                  </p>
                                  {(s.startTime || s.endTime) && (
                                    <p className="text-xs text-primary font-mono mt-1">
                                      {s.startTime} – {s.endTime}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Full schedule table */}
                  <div className="mt-6">
                    <h4 className="font-poppins font-semibold text-text-primary text-sm mb-3">All Entries</h4>
                    <div className="overflow-x-auto rounded-xl border border-border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="text-left p-3 font-inter font-semibold text-text-secondary text-xs uppercase tracking-wide">Subject</th>
                            <th className="text-left p-3 font-inter font-semibold text-text-secondary text-xs uppercase tracking-wide hidden sm:table-cell">Section</th>
                            <th className="text-left p-3 font-inter font-semibold text-text-secondary text-xs uppercase tracking-wide">Day</th>
                            <th className="text-left p-3 font-inter font-semibold text-text-secondary text-xs uppercase tracking-wide">Time</th>
                            <th className="text-left p-3 font-inter font-semibold text-text-secondary text-xs uppercase tracking-wide hidden md:table-cell">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {schedules
                            .slice()
                            .sort((a, b) => (DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek)) || (a.startTime || '').localeCompare(b.startTime || ''))
                            .map((s: any) => (
                              <tr key={s.id} className="border-t border-border hover:bg-gray-50/50 transition-colors">
                                <td className="p-3">
                                  <p className="font-medium text-text-primary">{s.subject?.name || '—'}</p>
                                  <p className="text-xs text-text-secondary font-mono hidden sm:block">{s.subject?.code}</p>
                                  {/* Show section on mobile */}
                                  <p className="text-xs text-text-secondary sm:hidden mt-0.5">{s.section?.gradeLevel?.name} — {s.section?.name}</p>
                                </td>
                                <td className="p-3 text-text-secondary hidden sm:table-cell">
                                  <p>{s.section?.gradeLevel?.name} — {s.section?.name}</p>
                                  {s.section?.strand?.name && (
                                    <p className="text-xs text-text-secondary/70">{s.section.strand.name}</p>
                                  )}
                                </td>
                                <td className="p-3 text-text-secondary whitespace-nowrap">{s.dayOfWeek || '—'}</td>
                                <td className="p-3 font-mono text-sm text-text-primary whitespace-nowrap">
                                  {s.startTime && s.endTime ? `${s.startTime} – ${s.endTime}` : '—'}
                                </td>
                                <td className="p-3 hidden md:table-cell">
                                  <span className={`badge ${s.status === 'published' ? 'bg-success/10 text-success' : 'bg-border/50 text-text-secondary'}`}>
                                    {s.status === 'published' ? 'Published' : 'Draft'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
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
              Share these credentials with the teacher. They will be required to change the temporary password after signing in.
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
