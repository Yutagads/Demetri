import React, { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../lib/auth'
import { teachersApi, authApi } from '../../lib/api'
import { Input } from '../../components/ui/Input'
import { PhoneInput } from '../../components/ui/PhoneInput'
import { Button } from '../../components/ui/Button'
import { Avatar } from '../../components/ui/Avatar'
import { LoadingSpinner } from '../../components/ui/EmptyState'
import {
  User,
  Users,
  BookOpen,
  Calendar,
  CheckCircle2,
  KeyRound,
  Eye,
  EyeOff,
  Camera,
  ImagePlus,
  Clock,
  Briefcase,
  Mail,
  Shield,
  GraduationCap,
  AlertCircle
} from 'lucide-react'
import { validatePassword, validatePhilippinePhone, validateBirthDate } from '../../lib/validation'
import { format } from 'date-fns'

const GENDER_OPTIONS = ['Male', 'Female', 'Prefer not to say']

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs font-inter text-text-secondary mb-0.5">{label}</p>
      <p className="font-inter text-text-primary text-sm font-medium">
        {value || <span className="text-text-secondary/60 italic">Not set</span>}
      </p>
    </div>
  )
}

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function TeacherProfile() {
  const { user, refetch } = useAuth() as any
  const qc = useQueryClient()
  const teacherId = user?.profile?.id

  const avatarInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)

  const { data: teacher, isLoading } = useQuery({
    queryKey: ['teacher-profile', teacherId],
    queryFn: () => teachersApi.getOne(teacherId!).then(r => r.data),
    enabled: !!teacherId,
  })

  // ── Profile edit state ─────────────────────────────────────
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    gender: '',
    birthDate: '',
    contactNumber: '',
    department: '',
  })

  // Banner persistence in local storage for teacher customization
  const [savedBanner, setSavedBanner] = useState<string | null>(() => {
    if (!teacherId) return null
    return localStorage.getItem(`smartclass_teacher_banner_${teacherId}`) || null
  })

  // Image previews (local blob URLs before upload)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [bannerPreview, setBannerPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [bannerFile, setBannerFile] = useState<File | null>(null)

  useEffect(() => {
    if (teacher) {
      setForm({
        gender: teacher.profile?.gender || '',
        birthDate: teacher.profile?.birthDate ? teacher.profile.birthDate.split('T')[0] : '',
        contactNumber: teacher.contactNumber || '',
        department: teacher.department || '',
      })
      if (teacherId) {
        const localBanner = localStorage.getItem(`smartclass_teacher_banner_${teacherId}`)
        if (localBanner) setSavedBanner(localBanner)
      }
    }
  }, [teacher, teacherId])

  // Revoke object URLs on unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview)
      if (bannerPreview) URL.revokeObjectURL(bannerPreview)
    }
  }, []) // eslint-disable-line

  const avatarMut = useMutation({
    mutationFn: (f: File) => teachersApi.uploadAvatar(teacherId!, f),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ['teacher-profile', teacherId] })
      qc.invalidateQueries({ queryKey: ['teacher', teacherId] })
      if (refetch) await refetch()
      setAvatarFile(null)
      setAvatarPreview(null)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  const bannerMut = useMutation({
    mutationFn: (f: File) => teachersApi.uploadBanner(teacherId!, f),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ['teacher-profile', teacherId] })
      qc.invalidateQueries({ queryKey: ['teacher', teacherId] })
      if (refetch) await refetch()
      setBannerFile(null)
      setBannerPreview(null)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  const handleAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (editing) {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview)
      setAvatarFile(file)
      setAvatarPreview(URL.createObjectURL(file))
    } else {
      // Direct instant upload
      avatarMut.mutate(file)
    }
  }

  const handleBannerPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (editing) {
      if (bannerPreview) URL.revokeObjectURL(bannerPreview)
      setBannerFile(file)
      const previewUrl = URL.createObjectURL(file)
      setBannerPreview(previewUrl)
    } else {
      // Direct instant upload
      bannerMut.mutate(file)
    }

    // Save as local base64 or object URL for instant banner persistence fallback
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string' && teacherId) {
        localStorage.setItem(`smartclass_teacher_banner_${teacherId}`, reader.result)
        setSavedBanner(reader.result)
      }
    }
    reader.readAsDataURL(file)
  }

  const updateMut = useMutation({
    mutationFn: (data: any) => teachersApi.updateProfile(teacherId!, data),
    onSuccess: async () => {
      try {
        if (avatarFile) await avatarMut.mutateAsync(avatarFile)
      } catch (err) {
        console.error('Avatar upload error:', err)
      }
      try {
        if (bannerFile) await bannerMut.mutateAsync(bannerFile)
      } catch (err) {
        console.error('Banner upload error:', err)
      }
      qc.invalidateQueries({ queryKey: ['teacher-profile', teacherId] })
      qc.invalidateQueries({ queryKey: ['teacher', teacherId] })
      if (refetch) await refetch()
      setEditing(false)
      setAvatarFile(null)
      setAvatarPreview(null)
      setBannerFile(null)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  // ── Form validation errors ─────────────────────────────────
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const validateForm = () => {
    const errors: Record<string, string> = {}

    if (form.contactNumber) {
      const phoneRes = validatePhilippinePhone(form.contactNumber)
      if (!phoneRes.valid && phoneRes.error) errors.contactNumber = phoneRes.error
    }

    if (form.birthDate) {
      const dateRes = validateBirthDate(form.birthDate)
      if (!dateRes.valid && dateRes.error) errors.birthDate = dateRes.error
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSaveProfile = () => {
    if (!validateForm()) return
    updateMut.mutate(form)
  }

  // ── Change password state ──────────────────────────────────
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext] = useState(false)
  const [pwSaved, setPwSaved] = useState(false)
  const [pwError, setPwError] = useState('')

  const changePwMut = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) => authApi.changePassword(data),
    onSuccess: () => {
      setPwSaved(true)
      setPwError('')
      setPwForm({ current: '', next: '', confirm: '' })
      setTimeout(() => setPwSaved(false), 4000)
    },
    onError: (err: any) => setPwError(err.response?.data?.error || 'Failed to change password.'),
  })

  const handleChangePw = () => {
    setPwError('')
    if (!pwForm.current) {
      setPwError('Current password is required.')
      return
    }
    const passwordResult = validatePassword(pwForm.next)
    if (!passwordResult.valid) {
      setPwError(passwordResult.error || 'Invalid password.')
      return
    }
    if (pwForm.next !== pwForm.confirm) {
      setPwError('New passwords do not match.')
      return
    }
    changePwMut.mutate({ currentPassword: pwForm.current, newPassword: pwForm.next })
  }

  if (isLoading) return <LoadingSpinner />

  const savedAvatar = teacher?.profile?.profilePicture || null
  const currentAvatar = avatarPreview || savedAvatar
  const currentBanner = bannerPreview || savedBanner

  const assignments = teacher?.subjectAssignments || []
  const schedules = teacher?.classSchedules || []

  // Group schedules by day of week
  const groupedSchedules = schedules.reduce((acc: Record<string, any[]>, curr: any) => {
    const day = curr.dayOfWeek || 'Other'
    if (!acc[day]) acc[day] = []
    acc[day].push(curr)
    return acc
  }, {})

  return (
    <div className="space-y-6 animate-fade-in w-full">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">My Profile</h1>
          <p className="text-text-secondary font-inter text-sm mt-1">View and update your faculty information</p>
        </div>
        {saved && (
          <div className="flex items-center gap-2 px-3 py-2 bg-success/10 text-success rounded-xl text-sm font-inter font-medium">
            <CheckCircle2 className="w-4 h-4" /> Saved successfully
          </div>
        )}
      </div>

      {/* ── Identity / Banner card ── */}
      <div className="rounded-2xl overflow-hidden border border-border shadow-sm w-full bg-surface">
        {/* Banner */}
        <div
          className="relative h-36 sm:h-48 md:h-56 w-full"
          style={
            currentBanner
              ? { backgroundImage: `url(${currentBanner})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : undefined
          }
        >
          {!currentBanner && (
            <div className="absolute inset-0 bg-gradient-to-br from-primary-dark via-primary to-primary/80" />
          )}
          {!currentBanner && (
            <>
              <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none" />
            </>
          )}
          {currentBanner && <div className="absolute inset-0 bg-black/25 pointer-events-none" />}

          {/* Change banner button */}
          <button
            onClick={() => bannerInputRef.current?.click()}
            title="Change banner image"
            className="absolute top-3 right-3 sm:top-4 sm:right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/40 hover:bg-black/60 text-white text-xs font-inter font-medium backdrop-blur-sm transition-colors"
          >
            <ImagePlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Change Banner</span>
          </button>
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleBannerPick}
          />
        </div>

        {/* Content beneath banner */}
        <div className="px-5 sm:px-8 pb-6 pt-0 relative">
          {/* Avatar overlap */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-10 sm:-mt-12 mb-4">
            <div className="relative inline-block w-fit">
              <Avatar
                name={teacher?.fullName || 'Teacher'}
                src={currentAvatar}
                size="xl"
                className="border-4 border-surface shadow-md ring-2 ring-primary/20"
              />
              <button
                onClick={() => avatarInputRef.current?.click()}
                title="Change photo"
                className="absolute bottom-1 right-1 p-2 bg-primary text-white rounded-full shadow-lg hover:bg-primary-dark transition-colors"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarPick}
              />
            </div>

            {/* Role / quick info badges */}
            <div className="flex flex-wrap gap-2 sm:mb-2">
              <span className="badge bg-primary-light text-primary font-mono text-xs">
                #{teacher?.employeeId || 'FACULTY'}
              </span>
              <span className="badge bg-secondary-light text-secondary text-xs">
                {teacher?.department || 'Academic Faculty'}
              </span>
              <span className="badge bg-success/15 text-success text-xs">
                Active
              </span>
            </div>
          </div>

          {/* Name & quick stats */}
          <div>
            <h2 className="text-xl sm:text-2xl font-poppins font-bold text-text-primary">
              {teacher?.fullName}
            </h2>
            <p className="text-sm text-text-secondary font-inter mt-0.5">{teacher?.email}</p>
          </div>

          {/* Pending photo upload notices */}
          {(avatarPreview || bannerPreview) && (
            <div className="mt-3 p-3 bg-warning/10 border border-warning/30 rounded-xl flex items-center justify-between gap-3 text-xs font-inter text-warning-dark">
              <span>You have selected new photo(s). Click &quot;Edit Profile&quot; &rarr; &quot;Save Changes&quot; to apply.</span>
              <button
                onClick={() => {
                  setAvatarFile(null); setAvatarPreview(null)
                  setBannerFile(null); setBannerPreview(null)
                }}
                className="underline hover:no-underline flex-shrink-0"
              >
                Discard
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Personal Info Card ── */}
      <div className="card w-full">
        <div className="flex items-center justify-between pb-4 border-b border-border mb-6">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-poppins font-semibold text-text-primary text-base">Personal Information</h3>
              <p className="text-xs text-text-secondary font-inter">Faculty identity and contact details</p>
            </div>
          </div>
          {!editing ? (
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              Edit Profile
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          )}
        </div>

        {!editing ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-5">
              <Field label="Full Name" value={teacher?.fullName} />
              <Field label="Gender" value={teacher?.profile?.gender} />
              <Field
                label="Date of Birth"
                value={teacher?.profile?.birthDate ? format(new Date(teacher.profile.birthDate), 'MMM d, yyyy') : undefined}
              />
              <Field label="Contact Number" value={teacher?.contactNumber} />
              <Field label="Department" value={teacher?.department} />
              <Field label="Employee ID" value={teacher?.employeeId} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 pt-4 border-t border-border/60">
              <Field label="Email Address" value={teacher?.email} />
              <Field label="Account Status" value={teacher?.status || 'Active'} />
              <Field
                label="Last Login"
                value={teacher?.user?.lastLogin ? format(new Date(teacher.user.lastLogin), 'MMM d, yyyy h:mm a') : 'Recent'}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium font-inter text-text-primary mb-1.5">Gender</label>
                <select
                  className="input-field"
                  value={form.gender}
                  onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                >
                  <option value="">Select Gender</option>
                  {GENDER_OPTIONS.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium font-inter text-text-primary mb-1.5">Date of Birth</label>
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
                <Input
                  label="Department"
                  placeholder="e.g. Science Department"
                  value={form.department}
                  onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button variant="secondary" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button loading={updateMut.isPending} onClick={handleSaveProfile}>
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Teaching Assignments Card ── */}
      <div className="card w-full">
        <div className="flex items-center gap-2.5 pb-4 border-b border-border mb-5">
          <div className="p-2 rounded-xl bg-secondary/10 text-secondary">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-poppins font-semibold text-text-primary text-base">Subject & Section Assignments</h3>
            <p className="text-xs text-text-secondary font-inter">Current active teaching load</p>
          </div>
        </div>

        {assignments.length === 0 ? (
          <p className="text-text-secondary font-inter text-sm italic py-2">No subject assignments registered for this academic period.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {assignments.map((a: any) => (
              <div key={a.id} className="p-4 rounded-xl bg-gray-50 border border-border/80 hover:border-primary/40 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">
                    {a.subject?.code || 'SUBJ'}
                  </span>
                  {a.academicYear?.name && (
                    <span className="badge bg-secondary-light text-secondary text-xs">
                      {a.academicYear.name}
                    </span>
                  )}
                </div>
                <h4 className="font-poppins font-semibold text-text-primary text-sm mb-1">
                  {a.subject?.name}
                </h4>
                <p className="text-xs text-text-secondary font-inter flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-primary" />
                  {a.section?.gradeLevel?.name} — {a.section?.name}
                  {a.section?.strand?.code && ` (${a.section.strand.code})`}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Weekly Class Schedule ── */}
      <div className="card w-full">
        <div className="flex items-center gap-2.5 pb-4 border-b border-border mb-5">
          <div className="p-2 rounded-xl bg-accent/10 text-accent">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-poppins font-semibold text-text-primary text-base">Weekly Class Schedule</h3>
            <p className="text-xs text-text-secondary font-inter">Room assignments and teaching periods</p>
          </div>
        </div>

        {schedules.length === 0 ? (
          <p className="text-text-secondary font-inter text-sm italic py-2">No scheduled classes found.</p>
        ) : (
          <div className="space-y-4">
            {DAY_ORDER.filter(day => groupedSchedules[day]?.length > 0).map(day => (
              <div key={day} className="rounded-xl border border-border overflow-hidden">
                <div className="bg-gray-50 px-4 py-2.5 font-poppins font-semibold text-xs text-text-primary uppercase tracking-wider border-b border-border">
                  {day}
                </div>
                <div className="divide-y divide-border/60">
                  {groupedSchedules[day].map((item: any) => (
                    <div key={item.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-primary/5 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                          <BookOpen className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-poppins font-medium text-sm text-text-primary">
                            {item.subject?.name} <span className="font-mono text-xs text-text-secondary">({item.subject?.code})</span>
                          </p>
                          <p className="text-xs text-text-secondary font-inter">
                            {item.section?.gradeLevel?.name} — {item.section?.name}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs font-inter text-text-secondary">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-primary" />
                          {item.startTime} – {item.endTime}
                        </span>
                        {item.room && (
                          <span className="badge bg-gray-100 text-text-primary font-mono text-xs">
                            Room {item.room}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Change Password Card ── */}
      <div className="card w-full">
        <div className="flex items-center gap-2.5 pb-4 border-b border-border mb-6">
          <div className="p-2 rounded-xl bg-danger/10 text-danger">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-poppins font-semibold text-text-primary text-base">Change Password</h3>
            <p className="text-xs text-text-secondary font-inter">Keep your faculty account safe and secure</p>
          </div>
        </div>

        {pwSaved && (
          <div className="mb-4 p-3 bg-success/10 text-success rounded-xl text-sm font-inter flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Password changed successfully!
          </div>
        )}

        {pwError && (
          <div className="mb-4 p-3 bg-danger/10 text-danger rounded-xl text-sm font-inter flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {pwError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl">
          <div className="relative">
            <Input
              label="Current Password"
              type={showCurrent ? 'text' : 'password'}
              placeholder="••••••••"
              value={pwForm.current}
              onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))}
            />
            <button
              type="button"
              onClick={() => setShowCurrent(v => !v)}
              className="absolute right-3 top-9 text-text-secondary hover:text-text-primary"
            >
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div className="relative">
            <Input
              label="New Password"
              type={showNext ? 'text' : 'password'}
              placeholder="Min. 8 characters"
              value={pwForm.next}
              onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))}
            />
            <button
              type="button"
              onClick={() => setShowNext(v => !v)}
              className="absolute right-3 top-9 text-text-secondary hover:text-text-primary"
            >
              {showNext ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div>
            <Input
              label="Confirm New Password"
              type="password"
              placeholder="Re-enter password"
              value={pwForm.confirm}
              onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <Button
            variant="primary"
            loading={changePwMut.isPending}
            onClick={handleChangePw}
            disabled={!pwForm.current || !pwForm.next || !pwForm.confirm}
          >
            Update Password
          </Button>
        </div>
      </div>
    </div>
  )
}
