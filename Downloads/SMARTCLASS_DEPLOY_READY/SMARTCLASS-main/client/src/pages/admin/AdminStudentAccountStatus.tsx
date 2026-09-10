import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { studentsApi, structureApi } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Avatar } from '../../components/ui/Avatar'
import { Modal } from '../../components/ui/Modal'
import { LoadingSpinner, EmptyState } from '../../components/ui/EmptyState'
import { formatDate } from '../../lib/utils'
import {
  Search, RotateCcw, Eye, Filter, X, CheckCircle2, Clock, Lock,
  ShieldCheck, Copy, Check, Download, AlertTriangle, KeyRound, UserCheck,
} from 'lucide-react'

export default function AdminStudentAccountStatus() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  // ── Filters & Search ────────────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'active' | 'locked'>('all')
  const [gradeFilter, setGradeFilter] = useState('')
  const [sectionFilter, setSectionFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // ── Credential & Modal State ───────────────────────────────────────────────
  const [resetModalData, setResetModalData] = useState<{ student: any; tempPassword?: string } | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // ── Data Fetching ──────────────────────────────────────────────────────────
  const { data: students = [], isLoading } = useQuery({
    queryKey: ['students-account-status'],
    queryFn: () => studentsApi.getAll({ status: 'active' }).then(r => r.data),
  })

  const { data: gradeLevels = [] } = useQuery({
    queryKey: ['grade-levels'],
    queryFn: () => structureApi.getGradeLevels().then(r => r.data),
  })

  // Derive sections from selected grade level
  const availableSections = useMemo(() => {
    if (!gradeFilter) return []
    const gl = (gradeLevels as any[]).find((g: any) => g.id === gradeFilter)
    return gl?.sections || []
  }, [gradeFilter, gradeLevels])

  // ── Mutations ──────────────────────────────────────────────────────────────
  const resetPwMutation = useMutation({
    mutationFn: (id: string) => studentsApi.resetPassword(id),
    onSuccess: (res, id) => {
      qc.invalidateQueries({ queryKey: ['students'] })
      qc.invalidateQueries({ queryKey: ['students-account-status'] })
      const target = (students as any[]).find((s: any) => s.id === id)
      setResetModalData({ student: target, tempPassword: res.data.tempPassword })
    },
  })

  // ── Metrics Calculation ────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const total = (students as any[]).length
    let pending = 0
    let active = 0
    let locked = 0

    ;(students as any[]).forEach((s: any) => {
      const isLocked = s.user?.lockedUntil && new Date(s.user.lockedUntil) > new Date()
      if (isLocked) {
        locked++
      } else if (s.user?.isFirstLogin) {
        pending++
      } else {
        active++
      }
    })

    return { total, pending, active, locked }
  }, [students])

  // ── Filtered Students ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = students as any[]

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((s: any) =>
        s.fullName.toLowerCase().includes(q) ||
        s.studentNumber.toLowerCase().includes(q) ||
        (s.email && s.email.toLowerCase().includes(q))
      )
    }

    if (statusFilter === 'pending') {
      list = list.filter((s: any) => s.user?.isFirstLogin && !(s.user?.lockedUntil && new Date(s.user.lockedUntil) > new Date()))
    } else if (statusFilter === 'active') {
      list = list.filter((s: any) => !s.user?.isFirstLogin && !(s.user?.lockedUntil && new Date(s.user.lockedUntil) > new Date()))
    } else if (statusFilter === 'locked') {
      list = list.filter((s: any) => s.user?.lockedUntil && new Date(s.user.lockedUntil) > new Date())
    }

    if (gradeFilter) {
      list = list.filter((s: any) =>
        s.sectionAssignments?.some((a: any) => a.section?.gradeLevel?.id === gradeFilter || a.gradeLevelId === gradeFilter)
      )
    }

    if (sectionFilter) {
      list = list.filter((s: any) =>
        s.sectionAssignments?.some((a: any) => a.sectionId === sectionFilter)
      )
    }

    return list
  }, [students, search, statusFilter, gradeFilter, sectionFilter])

  // ── Copy Helper ────────────────────────────────────────────────────────────
  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(fieldId)
    setTimeout(() => setCopiedField(null), 2000)
  }

  // ── CSV Export ─────────────────────────────────────────────────────────────
  const exportStatusReport = () => {
    const headers = [
      'Student Number',
      'Full Name',
      'Email Address',
      'Grade & Section',
      'Account Status',
      'First Login Pending',
      'Last Login',
      'Account Created',
    ]

    const rows = filtered.map((s: any) => {
      const section = s.sectionAssignments?.[0]?.section
      const grade = section?.gradeLevel?.name || ''
      const secName = section?.name || ''
      const isLocked = s.user?.lockedUntil && new Date(s.user.lockedUntil) > new Date()
      const accountStatus = isLocked ? 'Locked' : s.user?.isFirstLogin ? 'Pending First Login' : 'Activated'
      const firstLogin = s.user?.isFirstLogin ? 'Yes (Default/Temp Password)' : 'No (Custom Password Set)'
      const lastLogin = s.user?.lastLogin ? formatDate(s.user.lastLogin, 'yyyy-MM-dd HH:mm') : 'Never'
      const created = s.createdAt ? formatDate(s.createdAt, 'yyyy-MM-dd') : ''

      return [
        `"${s.studentNumber}"`,
        `"${s.fullName}"`,
        `"${s.email || ''}"`,
        `"${grade ? `${grade} - ${secName}` : 'Unassigned'}"`,
        `"${accountStatus}"`,
        `"${firstLogin}"`,
        `"${lastLogin}"`,
        `"${created}"`,
      ].join(',')
    })

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `student_account_status_${formatDate(new Date().toISOString(), 'yyyyMMdd')}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const hasActiveFilters = gradeFilter || sectionFilter || statusFilter !== 'all' || search

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Summary Metric Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-border rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-inter font-medium text-text-secondary uppercase tracking-wider">Total Accounts</p>
            <p className="text-2xl font-bold font-inter text-text-primary mt-1">{metrics.total}</p>
            <p className="text-xs font-inter text-text-secondary mt-0.5">Provisioned student users</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        <div
          onClick={() => setStatusFilter('active')}
          className={`bg-white border rounded-xl p-4 shadow-sm flex items-center justify-between cursor-pointer transition-all ${
            statusFilter === 'active' ? 'border-success ring-2 ring-success/20 bg-success/5' : 'border-border hover:border-success/50'
          }`}
        >
          <div>
            <p className="text-xs font-inter font-medium text-success uppercase tracking-wider">Activated / Onboarded</p>
            <p className="text-2xl font-bold font-inter text-text-primary mt-1">{metrics.active}</p>
            <p className="text-xs font-inter text-text-secondary mt-0.5">Password changed & active</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-success/10 text-success flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div
          onClick={() => setStatusFilter('pending')}
          className={`bg-white border rounded-xl p-4 shadow-sm flex items-center justify-between cursor-pointer transition-all ${
            statusFilter === 'pending' ? 'border-warning ring-2 ring-warning/20 bg-warning/5' : 'border-border hover:border-warning/50'
          }`}
        >
          <div>
            <p className="text-xs font-inter font-medium text-warning uppercase tracking-wider">Pending First Login</p>
            <p className="text-2xl font-bold font-inter text-text-primary mt-1">{metrics.pending}</p>
            <p className="text-xs font-inter text-text-secondary mt-0.5">Using default/temp password</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-warning/10 text-warning flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div
          onClick={() => setStatusFilter('locked')}
          className={`bg-white border rounded-xl p-4 shadow-sm flex items-center justify-between cursor-pointer transition-all ${
            statusFilter === 'locked' ? 'border-danger ring-2 ring-danger/20 bg-danger/5' : 'border-border hover:border-danger/50'
          }`}
        >
          <div>
            <p className="text-xs font-inter font-medium text-danger uppercase tracking-wider">Locked / Flagged</p>
            <p className="text-2xl font-bold font-inter text-text-primary mt-1">{metrics.locked}</p>
            <p className="text-xs font-inter text-text-secondary mt-0.5">Exceeded failed attempts</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-danger/10 text-danger flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
            <input
              className="input-field pl-10 pr-4"
              placeholder="Search by student name, student number, or email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(v => !v)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-inter font-medium transition-all ${
                showFilters || gradeFilter || sectionFilter
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-text-secondary border-border hover:border-primary hover:text-primary'
              }`}
            >
              <Filter className="w-4 h-4" />
              <span>Filters</span>
              {(gradeFilter || sectionFilter) && (
                <span className="bg-white/30 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {[gradeFilter, sectionFilter].filter(Boolean).length}
                </span>
              )}
            </button>

            <Button
              variant="secondary"
              onClick={exportStatusReport}
              icon={<Download className="w-4 h-4" />}
              disabled={filtered.length === 0}
            >
              Export CSV
            </Button>
          </div>
        </div>

        {/* Filter Drawer */}
        {showFilters && (
          <div className="bg-gray-50 border border-border rounded-xl p-4 flex flex-wrap gap-3 items-end animate-fade-in">
            {/* Status Filter Tab Dropdown */}
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-inter font-medium text-text-secondary mb-1">Account State</label>
              <select
                className="input-field text-sm py-2"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
              >
                <option value="all">All States</option>
                <option value="pending">Pending First Login</option>
                <option value="active">Activated / Onboarded</option>
                <option value="locked">Locked</option>
              </select>
            </div>

            {/* Grade Level */}
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs font-inter font-medium text-text-secondary mb-1">Grade Level</label>
              <select
                className="input-field text-sm py-2"
                value={gradeFilter}
                onChange={e => { setGradeFilter(e.target.value); setSectionFilter('') }}
              >
                <option value="">All Grades</option>
                {(gradeLevels as any[]).map((g: any) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            {/* Section */}
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs font-inter font-medium text-text-secondary mb-1">Section</label>
              <select
                className="input-field text-sm py-2"
                value={sectionFilter}
                onChange={e => setSectionFilter(e.target.value)}
                disabled={!gradeFilter}
              >
                <option value="">All Sections</option>
                {availableSections.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {hasActiveFilters && (
              <button
                onClick={() => {
                  setGradeFilter('')
                  setSectionFilter('')
                  setStatusFilter('all')
                  setSearch('')
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-inter text-danger hover:bg-danger/10 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" /> Reset Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Results Header */}
      {!isLoading && (
        <div className="flex items-center justify-between text-sm text-text-secondary font-inter">
          <p>
            Showing <strong className="text-text-primary">{filtered.length}</strong> of {metrics.total} accounts
            {statusFilter !== 'all' && (
              <span className="ml-1 text-primary">({statusFilter === 'pending' ? 'Pending First Login' : statusFilter === 'active' ? 'Activated' : 'Locked'})</span>
            )}
          </p>
          {statusFilter !== 'all' && (
            <button
              onClick={() => setStatusFilter('all')}
              className="text-primary hover:underline text-xs"
            >
              Clear status filter
            </button>
          )}
        </div>
      )}

      {/* ── Table ── */}
      {isLoading ? (
        <LoadingSpinner />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No Student Accounts Found"
          description={hasActiveFilters ? 'No accounts match the chosen filters or search criteria.' : 'No student accounts are currently registered.'}
          icon={<ShieldCheck className="w-8 h-8 text-text-secondary" />}
          action={
            hasActiveFilters ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setGradeFilter('')
                  setSectionFilter('')
                  setStatusFilter('all')
                  setSearch('')
                }}
              >
                Clear Filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Student Number (Login ID)</th>
                <th>Grade & Section</th>
                <th>Account Status</th>
                <th>Password State</th>
                <th>Last Login</th>
                <th>Created</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s: any) => {
                const section = s.sectionAssignments?.[0]?.section
                const isLocked = s.user?.lockedUntil && new Date(s.user.lockedUntil) > new Date()
                const isPending = s.user?.isFirstLogin

                return (
                  <tr key={s.id} className="hover:bg-primary/5 transition-colors">
                    <td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={s.fullName} src={s.profile?.profilePicture} size="sm" />
                        <div>
                          <p className="font-medium text-text-primary">{s.fullName}</p>
                          <p className="text-xs text-text-secondary">{s.email || 'No email registered'}</p>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-sm font-semibold text-text-primary bg-gray-100 px-2 py-0.5 rounded">
                          {s.studentNumber}
                        </span>
                        <button
                          onClick={() => copyToClipboard(s.studentNumber, `num-${s.id}`)}
                          className="p-1 text-text-secondary hover:text-primary transition-colors"
                          title="Copy Student Number"
                        >
                          {copiedField === `num-${s.id}` ? (
                            <Check className="w-3.5 h-3.5 text-success" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>

                    <td>
                      {section ? (
                        <span className="badge bg-primary-light text-primary-dark font-medium">
                          {section.gradeLevel?.name} – {section.name}
                        </span>
                      ) : (
                        <span className="text-text-secondary text-xs">Unassigned</span>
                      )}
                    </td>

                    <td>
                      {isLocked ? (
                        <Badge variant="danger">
                          <span className="flex items-center gap-1">
                            <Lock className="w-3 h-3" /> Locked
                          </span>
                        </Badge>
                      ) : isPending ? (
                        <Badge variant="warning">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Pending Setup
                          </span>
                        </Badge>
                      ) : (
                        <Badge variant="success">
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Activated
                          </span>
                        </Badge>
                      )}
                    </td>

                    <td>
                      {isPending ? (
                        <div className="flex items-center gap-1.5 text-xs text-warning font-inter">
                          <KeyRound className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>Default / Temp Active</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-success font-inter">
                          <UserCheck className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>Custom Password Set</span>
                        </div>
                      )}
                    </td>

                    <td className="text-xs font-inter text-text-secondary">
                      {s.user?.lastLogin ? (
                        formatDate(s.user.lastLogin, 'MMM d, yyyy h:mm a')
                      ) : (
                        <span className="italic text-gray-400">Never logged in</span>
                      )}
                    </td>

                    <td className="text-xs font-inter text-text-secondary">
                      {s.createdAt ? formatDate(s.createdAt, 'MMM d, yyyy') : '—'}
                    </td>

                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => resetPwMutation.mutate(s.id)}
                          disabled={resetPwMutation.isPending}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-inter font-medium rounded-lg bg-warning/10 text-warning hover:bg-warning/20 transition-colors"
                          title="Generate new temporary password"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reset Temp Pass</span>
                        </button>

                        <button
                          onClick={() => navigate(`/admin/students/${s.id}`)}
                          className="p-1.5 text-text-secondary hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                          title="View Full Profile"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Generated / Reset Password Modal ── */}
      <Modal
        open={!!resetModalData}
        onClose={() => setResetModalData(null)}
        title="Student Credentials Generated"
        size="md"
        footer={
          <div className="flex justify-end w-full">
            <Button onClick={() => setResetModalData(null)}>Done</Button>
          </div>
        }
      >
        {resetModalData && (
          <div className="space-y-4">
            <div className="p-3.5 bg-success/10 border border-success/30 rounded-xl flex items-start gap-3 text-sm text-text-primary">
              <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-success font-inter">Password Reset Successful</p>
                <p className="text-xs text-text-secondary mt-0.5">
                  The student's account status has been set to <strong>Pending First Login</strong>. They will be required to choose a new password upon signing in.
                </p>
              </div>
            </div>

            <div className="bg-gray-50 border border-border rounded-xl p-4 space-y-3 font-inter">
              <div className="flex justify-between items-center pb-2 border-b border-border text-xs text-text-secondary">
                <span>Account Holder:</span>
                <span className="font-semibold text-text-primary">{resetModalData.student?.fullName}</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Student Number (Login Identifier)</label>
                <div className="flex items-center justify-between bg-white border border-border rounded-lg px-3 py-2">
                  <span className="font-mono font-bold text-sm text-text-primary">{resetModalData.student?.studentNumber}</span>
                  <button
                    onClick={() => copyToClipboard(resetModalData.student?.studentNumber, 'modal-id')}
                    className="flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                  >
                    {copiedField === 'modal-id' ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedField === 'modal-id' ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">New Temporary Password</label>
                <div className="flex items-center justify-between bg-white border border-border rounded-lg px-3 py-2">
                  <span className="font-mono font-bold text-sm text-warning">{resetModalData.tempPassword}</span>
                  <button
                    onClick={() => copyToClipboard(resetModalData.tempPassword || '', 'modal-pw')}
                    className="flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                  >
                    {copiedField === 'modal-pw' ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedField === 'modal-pw' ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              {resetModalData.student?.email && (
                <div className="flex justify-between items-center pt-2 border-t border-border text-xs text-text-secondary">
                  <span>Registered Email:</span>
                  <span className="font-medium text-text-primary">{resetModalData.student.email}</span>
                </div>
              )}
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-blue-600" />
                Next steps for student onboarding:
              </p>
              <ol className="list-decimal list-inside text-blue-700 space-y-0.5 ml-1">
                <li>Provide the Student Number and Temporary Password to the student.</li>
                <li>Student navigates to the Login page and signs in under the <strong>Student</strong> tab.</li>
                <li>The system will immediately prompt them to set their own permanent password.</li>
              </ol>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
