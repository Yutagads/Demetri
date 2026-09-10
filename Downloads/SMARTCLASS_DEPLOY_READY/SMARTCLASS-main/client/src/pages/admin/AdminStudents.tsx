import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { studentsApi, structureApi } from '../../lib/api'
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
  Plus, Search, RotateCcw, Archive, Eye, GraduationCap,
  BookOpen, Upload, Filter, X, Phone, Mail, User, ChevronRight, ArchiveRestore, AlertCircle, ShieldCheck,
} from 'lucide-react'
import {
  validatePhilippinePhone,
  validateEmail,
  validateFullName,
  validateStudentNumber,
  validateBirthDate,
} from '../../lib/validation'
import AdminSections from './AdminSections'
import AdminStudentsImport from './AdminStudentsImport'
import AdminStudentAccountStatus from './AdminStudentAccountStatus'

type Tab = 'students' | 'archived' | 'sections' | 'account-status'

export default function AdminStudents() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('students')
  const qc = useQueryClient()

  // ── Search & filters ──────────────────────────────────────
  const [search,        setSearch]        = useState('')
  const [filterGrade,   setFilterGrade]   = useState('')
  const [filterSection, setFilterSection] = useState('')
  const [filterGender,  setFilterGender]  = useState('')
  const [filterStatus,  setFilterStatus]  = useState('')
  const [showFilters,   setShowFilters]   = useState(false)

  // ── Modals ────────────────────────────────────────────────
  const [showAdd,       setShowAdd]       = useState(false)
  const [quickView,     setQuickView]     = useState<any>(null)
  const [createdCreds,  setCreatedCreds]  = useState<any>(null)
  const [showImport,    setShowImport]    = useState(false)

  const [form, setForm] = useState({
    studentNumber: '', fullName: '', email: '', gender: '',
    birthDate: '', contactNumber: '', guardianName: '', guardianContact: '',
    gradeLevelId: '', strandId: '', sectionId: '', academicYearId: '',
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const validateAddForm = () => {
    const errors: Record<string, string> = {}

    const numRes = validateStudentNumber(form.studentNumber, true)
    if (!numRes.valid && numRes.error) errors.studentNumber = numRes.error

    const nameRes = validateFullName(form.fullName, 'Full Name', true)
    if (!nameRes.valid && nameRes.error) errors.fullName = nameRes.error

    const emailRes = validateEmail(form.email, true)
    if (!emailRes.valid && emailRes.error) errors.email = emailRes.error

    if (form.contactNumber) {
      const phoneRes = validatePhilippinePhone(form.contactNumber, false)
      if (!phoneRes.valid && phoneRes.error) errors.contactNumber = phoneRes.error
    }

    if (form.guardianContact) {
      const guardPhoneRes = validatePhilippinePhone(form.guardianContact, false)
      if (!guardPhoneRes.valid && guardPhoneRes.error) errors.guardianContact = guardPhoneRes.error
    }

    if (form.guardianName) {
      const guardNameRes = validateFullName(form.guardianName, 'Guardian Name', false)
      if (!guardNameRes.valid && guardNameRes.error) errors.guardianName = guardNameRes.error
    }

    if (form.birthDate) {
      const dateRes = validateBirthDate(form.birthDate, false)
      if (!dateRes.valid && dateRes.error) errors.birthDate = dateRes.error
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleCreateStudent = () => {
    if (!validateAddForm()) return
    createMutation.mutate(form)
  }

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['students', search],
    queryFn: () => studentsApi.getAll({ search: search || undefined, status: 'active' }).then(r => r.data),
  })

  const { data: archivedStudents = [], isLoading: archivedLoading } = useQuery({
    queryKey: ['students-archived'],
    queryFn: () => studentsApi.getAll({ status: 'archived' }).then(r => r.data),
    enabled: activeTab === 'archived',
  })

  const { data: gradeLevels = [] } = useQuery({
    queryKey: ['grade-levels'],
    queryFn: () => structureApi.getGradeLevels().then(r => r.data),
  })

  const { data: academicYears = [] } = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => structureApi.getAcademicYears().then(r => r.data),
  })

  // Derive sections from selected grade level (for filter dropdown)
  const filterGradeSections = useMemo(() => {
    if (!filterGrade) return []
    const gl = (gradeLevels as any[]).find((g: any) => g.id === filterGrade)
    return gl?.sections || []
  }, [filterGrade, gradeLevels])

  // Client-side filtering
  const filtered = useMemo(() => {
    let list = students as any[]
    if (filterGrade) {
      list = list.filter(s =>
        s.sectionAssignments?.some((a: any) => a.section?.gradeLevel?.id === filterGrade || a.gradeLevelId === filterGrade)
      )
    }
    if (filterSection) {
      list = list.filter(s =>
        s.sectionAssignments?.some((a: any) => a.sectionId === filterSection)
      )
    }
    if (filterGender) {
      list = list.filter(s => s.gender?.toLowerCase() === filterGender.toLowerCase())
    }
    if (filterStatus === 'pending') {
      list = list.filter(s => s.user?.isFirstLogin)
    } else if (filterStatus === 'active') {
      list = list.filter(s => !s.user?.isFirstLogin)
    }
    return list
  }, [students, filterGrade, filterSection, filterGender, filterStatus])

  const hasFilters = filterGrade || filterSection || filterGender || filterStatus

  const clearFilters = () => {
    setFilterGrade(''); setFilterSection(''); setFilterGender(''); setFilterStatus('')
  }

  // Mutations
  const createMutation = useMutation({
    mutationFn: (d: any) => studentsApi.create(d),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['students'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      setCreatedCreds(res.data)
      setShowAdd(false)
    },
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => studentsApi.archive(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] })
      qc.invalidateQueries({ queryKey: ['students-archived'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })

  const restoreMutation = useMutation({
    mutationFn: (id: string) => studentsApi.restore(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] })
      qc.invalidateQueries({ queryKey: ['students-archived'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })

  const resetPwMutation = useMutation({
    mutationFn: (id: string) => studentsApi.resetPassword(id),
    onSuccess: (res) => setCreatedCreds({ student: quickView, tempPassword: res.data.tempPassword }),
  })

  const selectedLevel   = (gradeLevels as any[]).find((g: any) => g.id === form.gradeLevelId) as any
  const strands         = selectedLevel?.strands || []
  const formSections    = selectedLevel?.sections?.filter((s: any) => !form.strandId || s.strandId === form.strandId) || []

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Students</h1>
          <p className="text-text-secondary font-inter text-sm mt-1">Manage student records and section assignments</p>
        </div>
        {activeTab === 'students' && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowImport(true)} icon={<Upload className="w-4 h-4" />}>Import CSV</Button>
            <Button onClick={() => setShowAdd(true)} icon={<Plus className="w-4 h-4" />}>Add Student</Button>
          </div>
        )}
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {([
          { id: 'students',       label: 'All Students',   icon: <GraduationCap className="w-4 h-4" /> },
          { id: 'archived',       label: 'Archived',       icon: <Archive       className="w-4 h-4" /> },
          { id: 'sections',       label: 'Sections',       icon: <BookOpen      className="w-4 h-4" /> },
          { id: 'account-status', label: 'Account Status', icon: <ShieldCheck   className="w-4 h-4" /> },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-inter font-medium transition-all duration-150 ${
              activeTab === tab.id ? 'bg-white text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'sections' && <AdminSections />}
      {activeTab === 'account-status' && <AdminStudentAccountStatus />}

      {/* ── Archived Students Tab ── */}
      {activeTab === 'archived' && (
        <div className="space-y-4">
          <p className="text-text-secondary font-inter text-sm">
            Archived students cannot log in. Restore them to reactivate their accounts.
          </p>
          {archivedLoading ? <LoadingSpinner /> : (archivedStudents as any[]).length === 0 ? (
            <EmptyState
              title="No Archived Students"
              description="Students you archive will appear here."
              icon={<Archive className="w-8 h-8 text-text-secondary" />}
            />
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Student No.</th>
                    <th>Grade / Section</th>
                    <th>Gender</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(archivedStudents as any[]).map((s: any) => (
                    <tr key={s.id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={s.fullName} src={s.profile?.profilePicture} size="sm" />
                          <span className="font-medium text-text-primary">{s.fullName}</span>
                        </div>
                      </td>
                      <td className="font-mono text-sm">{s.studentNumber}</td>
                      <td>
                        {s.sectionAssignments?.[0] ? (
                          <span className="badge bg-primary-light text-primary-dark">
                            {s.sectionAssignments[0].section?.gradeLevel?.name} – {s.sectionAssignments[0].section?.name}
                          </span>
                        ) : <span className="text-text-secondary">—</span>}
                      </td>
                      <td className="text-text-secondary">{s.gender || '—'}</td>
                      <td>
                        <button
                          onClick={() => restoreMutation.mutate(s.id)}
                          disabled={restoreMutation.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-inter font-medium bg-success/10 text-success hover:bg-success/20 rounded-lg transition-colors disabled:opacity-50"
                          title="Restore student account"
                        >
                          <ArchiveRestore className="w-4 h-4" />
                          Restore
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'students' && (
        <>
          {/* ── Search + filter bar ── */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                <input
                  className="input-field pl-10 pr-4"
                  placeholder="Search by name, student number, or email…"
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
                    {[filterGrade, filterSection, filterGender, filterStatus].filter(Boolean).length}
                  </span>
                )}
              </button>
            </div>

            {/* Filter row */}
            {showFilters && (
              <div className="bg-gray-50 border border-border rounded-xl p-4 flex flex-wrap gap-3 items-end animate-fade-in">
                {/* Grade Level */}
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-xs font-inter font-medium text-text-secondary mb-1">Grade Level</label>
                  <select
                    className="input-field text-sm py-2"
                    value={filterGrade}
                    onChange={e => { setFilterGrade(e.target.value); setFilterSection('') }}
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
                    value={filterSection}
                    onChange={e => setFilterSection(e.target.value)}
                    disabled={!filterGrade}
                  >
                    <option value="">All Sections</option>
                    {filterGradeSections.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {/* Gender */}
                <div className="flex-1 min-w-[120px]">
                  <label className="block text-xs font-inter font-medium text-text-secondary mb-1">Gender</label>
                  <select className="input-field text-sm py-2" value={filterGender} onChange={e => setFilterGender(e.target.value)}>
                    <option value="">All Genders</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Status */}
                <div className="flex-1 min-w-[120px]">
                  <label className="block text-xs font-inter font-medium text-text-secondary mb-1">Status</label>
                  <select className="input-field text-sm py-2" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
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
                {filterGrade && (
                  <FilterChip label={(gradeLevels as any[]).find((g: any) => g.id === filterGrade)?.name} onRemove={() => { setFilterGrade(''); setFilterSection('') }} />
                )}
                {filterSection && (
                  <FilterChip label={filterGradeSections.find((s: any) => s.id === filterSection)?.name} onRemove={() => setFilterSection('')} />
                )}
                {filterGender && <FilterChip label={filterGender} onRemove={() => setFilterGender('')} />}
                {filterStatus && <FilterChip label={filterStatus === 'active' ? 'Active' : 'Pending Setup'} onRemove={() => setFilterStatus('')} />}
              </div>
            )}
          </div>

          {/* Results count */}
          {!isLoading && (
            <p className="text-text-secondary font-inter text-sm">
              {filtered.length} student{filtered.length !== 1 ? 's' : ''}
              {hasFilters || search ? ' found' : ''}
            </p>
          )}

          {/* Table */}
          {isLoading ? <LoadingSpinner /> : filtered.length === 0 ? (
            <EmptyState
              title="No Students Found"
              description={search || hasFilters ? 'Try adjusting your search or filters.' : 'Add your first student to get started.'}
              action={!search && !hasFilters ? <Button onClick={() => setShowAdd(true)}>Add Student</Button> : undefined}
              icon={<GraduationCap className="w-8 h-8 text-primary" />}
            />
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Student No.</th>
                    <th>Grade / Section</th>
                    <th>Gender</th>
                    <th>Status</th>
                    <th>Last Login</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s: any) => (
                    <tr
                      key={s.id}
                      className="cursor-pointer hover:bg-primary/5 transition-colors"
                      onClick={() => setQuickView(s)}
                    >
                      <td>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={s.fullName} src={s.profile?.profilePicture} size="sm" />
                          <span className="font-medium text-text-primary">{s.fullName}</span>
                        </div>
                      </td>
                      <td className="font-mono text-sm">{s.studentNumber}</td>
                      <td>
                        {s.sectionAssignments?.[0] ? (
                          <span className="badge bg-primary-light text-primary-dark">
                            {s.sectionAssignments[0].section?.gradeLevel?.name} – {s.sectionAssignments[0].section?.name}
                          </span>
                        ) : <span className="text-text-secondary">—</span>}
                      </td>
                      <td className="text-text-secondary">{s.gender || '—'}</td>
                      <td>
                        <Badge variant={s.user?.isFirstLogin ? 'warning' : 'success'}>
                          {s.user?.isFirstLogin ? 'Pending' : 'Active'}
                        </Badge>
                      </td>
                      <td className="text-text-secondary">{s.user?.lastLogin ? formatDate(s.user.lastLogin, 'MMM d, yyyy') : '—'}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1">
                          <button
                            onClick={() => navigate(`/admin/students/${s.id}`)}
                            className="p-1.5 hover:bg-info/10 text-info rounded-lg transition-colors"
                            title="View Full Profile"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => resetPwMutation.mutate(s.id)}
                            className="p-1.5 hover:bg-warning/10 text-warning rounded-lg transition-colors"
                            title="Reset Password"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => archiveMutation.mutate(s.id)}
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

          {/* ── Quick Info Modal ── */}
          <Modal open={!!quickView} onClose={() => setQuickView(null)} title="" size="md">
            {quickView && (
              <div>
                {/* Header */}
                <div className="bg-gradient-to-br from-primary-dark to-primary px-6 pt-6 pb-8 -mx-0 rounded-t-2xl relative">
                  <button
                    onClick={() => setQuickView(null)}
                    className="absolute top-4 right-4 p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="flex items-end gap-4">
                    <Avatar
                      name={quickView.fullName}
                      src={quickView.profile?.profilePicture}
                      size="lg"
                      className="ring-4 ring-white/30"
                    />
                    <div className="pb-1 min-w-0">
                      <h3 className="text-white font-poppins font-bold text-xl leading-tight">{quickView.fullName}</h3>
                      <p className="text-white/70 font-mono text-sm">{quickView.studentNumber}</p>
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
                  {quickView.sectionAssignments?.[0] && (
                    <InfoItem icon={<GraduationCap className="w-4 h-4" />} label="Section">
                      {quickView.sectionAssignments[0].section?.gradeLevel?.name} — {quickView.sectionAssignments[0].section?.name}
                      <span className="ml-2 badge bg-primary-light text-primary-dark text-xs">
                        {quickView.sectionAssignments[0].academicYear?.name}
                      </span>
                    </InfoItem>
                  )}
                  {quickView.email && (
                    <InfoItem icon={<Mail className="w-4 h-4" />} label="Email">{quickView.email}</InfoItem>
                  )}
                  {quickView.contactNumber && (
                    <InfoItem icon={<Phone className="w-4 h-4" />} label="Contact">{quickView.contactNumber}</InfoItem>
                  )}
                  {quickView.gender && (
                    <InfoItem icon={<User className="w-4 h-4" />} label="Gender">{quickView.gender}</InfoItem>
                  )}
                  {(quickView.profile?.guardianName || quickView.guardianName) && (
                    <InfoItem icon={<User className="w-4 h-4" />} label="Guardian">
                      {quickView.profile?.guardianName || quickView.guardianName}
                      {(quickView.profile?.guardianContact || quickView.guardianContact) && (
                        <span className="text-text-secondary text-xs ml-2">
                          {quickView.profile?.guardianContact || quickView.guardianContact}
                        </span>
                      )}
                    </InfoItem>
                  )}
                  {quickView.user?.lastLogin && (
                    <InfoItem icon={<BookOpen className="w-4 h-4" />} label="Last Login">
                      {format(new Date(quickView.user.lastLogin), 'MMM d, yyyy h:mm a')}
                    </InfoItem>
                  )}
                </div>

                {/* Footer actions */}
                <div className="px-6 pb-6 flex gap-3">
                  <Button
                    variant="primary"
                    className="flex-1"
                    onClick={() => { setQuickView(null); navigate(`/admin/students/${quickView.id}`) }}
                  >
                    <span className="flex items-center gap-2">
                      View Full Profile
                      <ChevronRight className="w-4 h-4" />
                    </span>
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => { resetPwMutation.mutate(quickView.id); setQuickView(null) }}
                    title="Reset Password"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    className="text-danger hover:bg-danger/10 hover:border-danger"
                    onClick={() => { archiveMutation.mutate(quickView.id); setQuickView(null) }}
                    title="Archive"
                  >
                    <Archive className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </Modal>

          {/* ── Add Student Modal ── */}
          <Modal
            open={showAdd}
            onClose={() => {
              setShowAdd(false)
              setFormErrors({})
            }}
            title="Add New Student"
            size="lg"
            footer={
              <div className="flex items-center justify-between w-full">
                {createMutation.isError && (
                  <p className="text-xs text-danger font-inter">
                    {(createMutation.error as any)?.response?.data?.error || 'Failed to create student.'}
                  </p>
                )}
                <div className="flex gap-3 justify-end ml-auto">
                  <Button variant="secondary" onClick={() => { setShowAdd(false); setFormErrors({}) }}>
                    Cancel
                  </Button>
                  <Button
                    loading={createMutation.isPending}
                    onClick={handleCreateStudent}
                  >
                    Create Student
                  </Button>
                </div>
              </div>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Student Number *"
                placeholder="e.g. 2024-00001"
                value={form.studentNumber}
                onChange={e => {
                  setForm(f => ({ ...f, studentNumber: e.target.value }))
                  if (formErrors.studentNumber) setFormErrors(errs => ({ ...errs, studentNumber: '' }))
                }}
                error={formErrors.studentNumber}
              />
              <Input
                label="Full Name *"
                placeholder="Juan Dela Cruz"
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
                value={form.email}
                onChange={val => {
                  setForm(f => ({ ...f, email: val }))
                  if (formErrors.email) setFormErrors(errs => ({ ...errs, email: '' }))
                }}
                error={formErrors.email}
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
              <div>
                <label className="block text-sm font-medium font-inter text-text-primary mb-1.5">Gender</label>
                <select className="input-field" value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
                  <option value="">Select Gender</option>
                  <option>Male</option><option>Female</option><option>Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium font-inter text-text-primary mb-1.5">Birth Date</label>
                <input
                  type="date"
                  className={`input-field ${formErrors.birthDate ? 'border-danger focus:ring-danger' : ''}`}
                  value={form.birthDate}
                  onChange={e => {
                    setForm(f => ({ ...f, birthDate: e.target.value }))
                    if (formErrors.birthDate) setFormErrors(errs => ({ ...errs, birthDate: '' }))
                  }}
                />
                {formErrors.birthDate && <p className="mt-1 text-xs text-danger font-inter">{formErrors.birthDate}</p>}
              </div>
              <Input
                label="Guardian Name"
                placeholder="Parent/Guardian"
                value={form.guardianName}
                onChange={e => {
                  setForm(f => ({ ...f, guardianName: e.target.value }))
                  if (formErrors.guardianName) setFormErrors(errs => ({ ...errs, guardianName: '' }))
                }}
                error={formErrors.guardianName}
              />
              <PhoneInput
                label="Guardian Contact"
                value={form.guardianContact}
                onChange={val => {
                  setForm(f => ({ ...f, guardianContact: val }))
                  if (formErrors.guardianContact) setFormErrors(errs => ({ ...errs, guardianContact: '' }))
                }}
                error={formErrors.guardianContact}
                hint="Philippine mobile format (e.g. 912 345 6789)"
              />
              <div>
                <label className="block text-sm font-medium font-inter text-text-primary mb-1.5">Academic Year</label>
                <select className="input-field" value={form.academicYearId} onChange={e => setForm(f => ({ ...f, academicYearId: e.target.value }))}>
                  <option value="">Select Academic Year</option>
                  {(academicYears as any[]).map((y: any) => <option key={y.id} value={y.id}>{y.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium font-inter text-text-primary mb-1.5">Grade Level</label>
                <select className="input-field" value={form.gradeLevelId} onChange={e => setForm(f => ({ ...f, gradeLevelId: e.target.value, strandId: '', sectionId: '' }))}>
                  <option value="">Select Grade Level</option>
                  {(gradeLevels as any[]).map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              {strands.length > 0 && (
                <div>
                  <label className="block text-sm font-medium font-inter text-text-primary mb-1.5">Strand</label>
                  <select className="input-field" value={form.strandId} onChange={e => setForm(f => ({ ...f, strandId: e.target.value, sectionId: '' }))}>
                    <option value="">Select Strand</option>
                    {strands.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium font-inter text-text-primary mb-1.5">Section</label>
                <select className="input-field" value={form.sectionId} onChange={e => setForm(f => ({ ...f, sectionId: e.target.value }))}>
                  <option value="">Select Section</option>
                  {formSections.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
          </Modal>

          {/* ── Credentials Modal ── */}
          <Modal open={!!createdCreds} onClose={() => setCreatedCreds(null)} title="Student Account Created" size="sm">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto">
                <GraduationCap className="w-8 h-8 text-success" />
              </div>
              <p className="font-inter text-sm text-text-secondary">Share these credentials with the student:</p>
              <div className="p-4 bg-primary-light rounded-xl text-left space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-text-secondary font-inter">Student Number:</span>
                  <span className="font-poppins font-semibold text-primary">{createdCreds?.student?.studentNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-text-secondary font-inter">Temp Password:</span>
                  <span className="font-poppins font-semibold text-primary font-mono">{createdCreds?.tempPassword}</span>
                </div>
              </div>
              <p className="text-xs text-text-secondary font-inter">The student will be prompted to change this password on first login.</p>
              <Button variant="primary" className="w-full" onClick={() => setCreatedCreds(null)}>Done</Button>
            </div>
          </Modal>
        </>
      )}

      <AdminStudentsImport open={showImport} onClose={() => setShowImport(false)} />
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
        <p className="text-sm text-text-primary font-inter break-words">{children}</p>
      </div>
    </div>
  )
}
