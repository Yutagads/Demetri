import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { teachersApi } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { PhoneInput } from '../../components/ui/PhoneInput'
import { EmailInput } from '../../components/ui/EmailInput'
import { Modal } from '../../components/ui/Modal'
import { Badge } from '../../components/ui/Badge'
import { Avatar } from '../../components/ui/Avatar'
import { LoadingSpinner, EmptyState } from '../../components/ui/EmptyState'
import { formatDate } from '../../lib/utils'
import { format } from 'date-fns'
import {
  Plus, Search, RotateCcw, Archive, Users, Filter,
  X, Mail, Phone, BookOpen, Briefcase, ChevronRight, Calendar, Eye, AlertCircle,
} from 'lucide-react'
import {
  validatePhilippinePhone,
  validateEmail,
  validateFullName,
  validateEmployeeId,
} from '../../lib/validation'

export default function AdminTeachers() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  // ── Search & filters ──────────────────────────────────────
  const [search,         setSearch]         = useState('')
  const [filterDept,     setFilterDept]     = useState('')
  const [filterStatus,   setFilterStatus]   = useState('')
  const [showFilters,    setShowFilters]     = useState(false)

  // ── Modals ────────────────────────────────────────────────
  const [showAdd,        setShowAdd]        = useState(false)
  const [quickView,      setQuickView]      = useState<any>(null)
  const [createdCreds,   setCreatedCreds]   = useState<any>(null)

  const [form, setForm] = useState({
    fullName: '', email: '', employeeId: '', department: '', contactNumber: '',
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const validateTeacherForm = () => {
    const errors: Record<string, string> = {}

    const nameRes = validateFullName(form.fullName, 'Full Name', true)
    if (!nameRes.valid && nameRes.error) errors.fullName = nameRes.error

    const emailRes = validateEmail(form.email, true)
    if (!emailRes.valid && emailRes.error) errors.email = emailRes.error

    if (form.employeeId) {
      const empRes = validateEmployeeId(form.employeeId, false)
      if (!empRes.valid && empRes.error) errors.employeeId = empRes.error
    }

    if (form.contactNumber) {
      const phoneRes = validatePhilippinePhone(form.contactNumber, false)
      if (!phoneRes.valid && phoneRes.error) errors.contactNumber = phoneRes.error
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleCreateTeacher = () => {
    if (!validateTeacherForm()) return
    createMutation.mutate(form)
  }

  const { data: teachers = [], isLoading } = useQuery({
    queryKey: ['teachers', search],
    queryFn: () => teachersApi.getAll({ search: search || undefined, status: 'active' }).then(r => r.data),
  })

  // Derive unique departments for filter
  const departments = useMemo(() => {
    const depts = new Set<string>()
    ;(teachers as any[]).forEach(t => { if (t.department) depts.add(t.department) })
    return Array.from(depts).sort()
  }, [teachers])

  // Client-side filtering
  const filtered = useMemo(() => {
    let list = teachers as any[]
    if (filterDept) list = list.filter(t => t.department === filterDept)
    if (filterStatus === 'active')  list = list.filter(t => !t.user?.isFirstLogin)
    if (filterStatus === 'pending') list = list.filter(t => t.user?.isFirstLogin)
    return list
  }, [teachers, filterDept, filterStatus])

  const hasFilters = filterDept || filterStatus
  const clearFilters = () => { setFilterDept(''); setFilterStatus('') }

  // Mutations
  const createMutation = useMutation({
    mutationFn: (d: any) => teachersApi.create(d),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['teachers'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      setCreatedCreds(res.data)
      setShowAdd(false)
      setForm({ fullName: '', email: '', employeeId: '', department: '', contactNumber: '' })
    },
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => teachersApi.archive(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teachers'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })

  const resetPwMutation = useMutation({
    mutationFn: (id: string) => teachersApi.resetPassword(id),
    onSuccess: (res) => setCreatedCreds({ teacher: quickView, tempPassword: res.data.tempPassword }),
  })

  if (isLoading) return <LoadingSpinner />

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Teachers</h1>
          <p className="text-text-secondary font-inter text-sm mt-1">{(teachers as any[]).length} active teacher{(teachers as any[]).length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => setShowAdd(true)} icon={<Plus className="w-4 h-4" />}>Add Teacher</Button>
      </div>

      {/* ── Search + filter bar ── */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
            <input
              className="input-field pl-10"
              placeholder="Search by name, email, or employee ID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-inter font-medium transition-all ${
              showFilters || hasFilters
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-text-secondary border-border hover:border-primary hover:text-primary'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">Filters</span>
            {hasFilters && (
              <span className="bg-white/30 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {[filterDept, filterStatus].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>

        {/* Filter row */}
        {showFilters && (
          <div className="bg-gray-50 border border-border rounded-xl p-4 flex flex-wrap gap-3 items-end animate-fade-in">
            {/* Department */}
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-inter font-medium text-text-secondary mb-1">Department</label>
              <select
                className="input-field text-sm py-2"
                value={filterDept}
                onChange={e => setFilterDept(e.target.value)}
              >
                <option value="">All Departments</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            {/* Status */}
            <div className="flex-1 min-w-[130px]">
              <label className="block text-xs font-inter font-medium text-text-secondary mb-1">Status</label>
              <select
                className="input-field text-sm py-2"
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="pending">Pending Setup</option>
              </select>
            </div>

            {hasFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-inter text-danger hover:bg-danger/10 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />Clear
              </button>
            )}
          </div>
        )}

        {/* Active filter chips */}
        {hasFilters && !showFilters && (
          <div className="flex flex-wrap gap-2">
            {filterDept   && <FilterChip label={filterDept}  onRemove={() => setFilterDept('')} />}
            {filterStatus && <FilterChip label={filterStatus === 'active' ? 'Active' : 'Pending Setup'} onRemove={() => setFilterStatus('')} />}
          </div>
        )}
      </div>

      {/* Results count */}
      <p className="text-text-secondary font-inter text-sm">
        {filtered.length} teacher{filtered.length !== 1 ? 's' : ''}
        {hasFilters || search ? ' found' : ''}
      </p>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No Teachers Found"
          description={search || hasFilters ? 'Try adjusting your search or filters.' : 'Add your first teacher to get started.'}
          action={!search && !hasFilters ? <Button onClick={() => setShowAdd(true)}>Add Teacher</Button> : undefined}
          icon={<Users className="w-8 h-8 text-primary" />}
        />
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Teacher</th>
                <th>Employee ID</th>
                <th>Department</th>
                <th>Subjects</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t: any) => (
                <tr
                  key={t.id}
                  className="cursor-pointer hover:bg-primary/5 transition-colors"
                  onClick={() => setQuickView(t)}
                >
                  <td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={t.fullName} size="sm" />
                      <div>
                        <p className="font-medium text-text-primary">{t.fullName}</p>
                        <p className="text-xs text-text-secondary">{t.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-text-secondary">{t.employeeId || '—'}</td>
                  <td>{t.department || '—'}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {t.subjectAssignments?.slice(0, 2).map((a: any) => (
                        <span key={a.id} className="badge bg-primary-light text-primary-dark">{a.subject?.name}</span>
                      ))}
                      {(t.subjectAssignments?.length || 0) > 2 && (
                        <span className="badge bg-border text-text-secondary">+{t.subjectAssignments.length - 2}</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <Badge variant={t.user?.isFirstLogin ? 'warning' : 'success'}>
                      {t.user?.isFirstLogin ? 'Pending' : 'Active'}
                    </Badge>
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <button
                        onClick={() => navigate(`/admin/teachers/${t.id}`)}
                        className="p-1.5 hover:bg-info/10 text-info rounded-lg transition-colors"
                        title="View Full Profile"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => resetPwMutation.mutate(t.id)}
                        className="p-1.5 hover:bg-warning/10 text-warning rounded-lg transition-colors"
                        title="Reset Password"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => archiveMutation.mutate(t.id)}
                        className="p-1.5 hover:bg-danger/10 text-danger rounded-lg transition-colors"
                        title="Archive"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Quick View Modal ── */}
      <Modal open={!!quickView} onClose={() => setQuickView(null)} title="" size="md">
        {quickView && (
          <div>
            {/* Header */}
            <div className="bg-gradient-to-br from-gray-800 to-gray-700 px-6 pt-6 pb-8 rounded-t-2xl relative">
              <button
                onClick={() => setQuickView(null)}
                className="absolute top-4 right-4 p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-end gap-4">
                <Avatar name={quickView.fullName} size="lg" className="ring-4 ring-white/20" />
                <div className="pb-1 min-w-0">
                  <h3 className="text-white font-poppins font-bold text-xl leading-tight">{quickView.fullName}</h3>
                  {quickView.employeeId && (
                    <p className="text-white/70 font-mono text-sm">{quickView.employeeId}</p>
                  )}
                  <div className="mt-1.5">
                    <Badge variant={quickView.user?.isFirstLogin ? 'warning' : 'success'}>
                      {quickView.user?.isFirstLogin ? 'Pending Setup' : 'Active'}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="px-6 py-5 space-y-3">
              {quickView.email && (
                <InfoItem icon={<Mail className="w-4 h-4" />} label="Email">{quickView.email}</InfoItem>
              )}
              {quickView.contactNumber && (
                <InfoItem icon={<Phone className="w-4 h-4" />} label="Contact">{quickView.contactNumber}</InfoItem>
              )}
              {quickView.department && (
                <InfoItem icon={<Briefcase className="w-4 h-4" />} label="Department">{quickView.department}</InfoItem>
              )}
              {quickView.subjectAssignments?.length > 0 && (
                <InfoItem icon={<BookOpen className="w-4 h-4" />} label="Subjects">
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {quickView.subjectAssignments.map((a: any) => (
                      <span key={a.id} className="badge bg-primary-light text-primary-dark text-xs">
                        {a.subject?.name}
                        {a.section && <span className="opacity-60 ml-1">· {a.section?.gradeLevel?.name} {a.section?.name}</span>}
                      </span>
                    ))}
                  </div>
                </InfoItem>
              )}
              {quickView.user?.lastLogin && (
                <InfoItem icon={<Calendar className="w-4 h-4" />} label="Last Login">
                  {format(new Date(quickView.user.lastLogin), 'MMM d, yyyy h:mm a')}
                </InfoItem>
              )}
            </div>

            {/* Footer actions */}
            <div className="px-6 pb-6 flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => { resetPwMutation.mutate(quickView.id); setQuickView(null) }}
              >
                <span className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4" />Reset Password
                </span>
              </Button>
              <Button
                variant="secondary"
                className="text-danger hover:bg-danger/10 hover:border-danger"
                onClick={() => { archiveMutation.mutate(quickView.id); setQuickView(null) }}
              >
                <Archive className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Add Teacher Modal ── */}
      <Modal
        open={showAdd}
        onClose={() => {
          setShowAdd(false)
          setFormErrors({})
        }}
        title="Add New Teacher"
        size="md"
        footer={
          <div className="flex items-center justify-between w-full">
            {createMutation.isError && (
              <p className="text-xs text-danger font-inter">
                {(createMutation.error as any)?.response?.data?.error || 'Failed to create teacher.'}
              </p>
            )}
            <div className="flex gap-3 justify-end ml-auto">
              <Button variant="secondary" onClick={() => { setShowAdd(false); setFormErrors({}) }}>
                Cancel
              </Button>
              <Button
                loading={createMutation.isPending}
                onClick={handleCreateTeacher}
              >
                Create Teacher
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Full Name *"
            placeholder="Maria Santos"
            value={form.fullName}
            onChange={e => {
              setForm(f => ({ ...f, fullName: e.target.value }))
              if (formErrors.fullName) setFormErrors(errs => ({ ...errs, fullName: '' }))
            }}
            error={formErrors.fullName}
          />
          <EmailInput
            label="Email Address"
            required
            placeholder="maria@erlhs.edu.ph"
            value={form.email}
            onChange={val => {
              setForm(f => ({ ...f, email: val }))
              if (formErrors.email) setFormErrors(errs => ({ ...errs, email: '' }))
            }}
            error={formErrors.email}
          />
          <Input
            label="Employee ID"
            placeholder="e.g. EMP-001"
            value={form.employeeId}
            onChange={e => {
              setForm(f => ({ ...f, employeeId: e.target.value }))
              if (formErrors.employeeId) setFormErrors(errs => ({ ...errs, employeeId: '' }))
            }}
            error={formErrors.employeeId}
            hint="Optional unique alphanumeric identifier"
          />
          <Input
            label="Department"
            placeholder="Science Department"
            value={form.department}
            onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
          />
          <PhoneInput
            label="Contact Number"
            value={form.contactNumber}
            onChange={val => {
              setForm(f => ({ ...f, contactNumber: val }))
              if (formErrors.contactNumber) setFormErrors(errs => ({ ...errs, contactNumber: '' }))
            }}
            error={formErrors.contactNumber}
            hint="Philippine mobile format (e.g. 912 345 6789)"
          />
        </div>
      </Modal>

      {/* ── Credentials Modal ── */}
      <Modal open={!!createdCreds} onClose={() => setCreatedCreds(null)} title="Teacher Account Created" size="sm">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto">
            <Users className="w-8 h-8 text-success" />
          </div>
          <p className="font-inter text-sm text-text-secondary">Share these credentials with the teacher:</p>
          <div className="p-4 bg-primary-light rounded-xl text-left space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-text-secondary font-inter">Email:</span>
              <span className="font-poppins font-semibold text-primary text-sm">{createdCreds?.teacher?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-text-secondary font-inter">Temp Password:</span>
              <span className="font-poppins font-semibold text-primary font-mono">{createdCreds?.tempPassword}</span>
            </div>
          </div>
          <Button variant="primary" className="w-full" onClick={() => setCreatedCreds(null)}>Done</Button>
        </div>
      </Modal>
    </div>
  )
}

// ── Small helpers ──────────────────────────────────────────────────────────────

function FilterChip({ label, onRemove }: { label?: string; onRemove: () => void }) {
  if (!label) return null
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary text-xs font-inter font-medium rounded-lg">
      {label}
      <button onClick={onRemove} className="hover:text-primary-dark transition-colors">
        <X className="w-3 h-3" />
      </button>
    </span>
  )
}

function InfoItem({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-border last:border-0">
      <span className="text-text-secondary mt-0.5 flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-text-secondary font-inter mb-0.5">{label}</p>
        <div className="text-sm text-text-primary font-inter break-words">{children}</div>
      </div>
    </div>
  )
}
