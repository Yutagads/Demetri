import React, { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../lib/auth'
import { studentsApi, authApi } from '../../lib/api'
import { Input } from '../../components/ui/Input'
import { PhoneInput } from '../../components/ui/PhoneInput'
import { Button } from '../../components/ui/Button'
import { Avatar } from '../../components/ui/Avatar'
import { LoadingSpinner } from '../../components/ui/EmptyState'
import { User, Users, BookOpen, CheckCircle2, KeyRound, Eye, EyeOff, Camera, ImagePlus, AlertCircle } from 'lucide-react'
import { validatePassword, validatePhilippinePhone, validateFullName, validateBirthDate, validateMeasurement } from '../../lib/validation'

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

export default function StudentProfile() {
  const { user, refetch } = useAuth() as any
  const qc = useQueryClient()
  const studentId = user?.profile?.id

  const avatarInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)

  const { data: student, isLoading } = useQuery({
    queryKey: ['student-profile', studentId],
    queryFn: () => studentsApi.getOne(studentId!).then(r => r.data),
    enabled: !!studentId,
  })

  // ── Profile edit state ─────────────────────────────────────
  const [editing, setEditing]   = useState(false)
  const [saved, setSaved]       = useState(false)
  const [form, setForm] = useState({
    contactNumber: '', gender: '', birthDate: '',
    address: '', guardianName: '', guardianContact: '',
    emergencyContact: '', biography: '', bloodType: '', weight: '', height: '',
  })

  // Image previews (local blob URLs before upload)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [bannerPreview, setBannerPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile]       = useState<File | null>(null)
  const [bannerFile, setBannerFile]       = useState<File | null>(null)
  const [localBanner, setLocalBanner]     = useState<string | null>(() => (studentId ? localStorage.getItem(`smartclass_student_banner_${studentId}`) : null))

  useEffect(() => {
    if (student) {
      setForm({
        contactNumber:  student.contactNumber        || '',
        gender:         student.gender               || '',
        birthDate:      student.birthDate ? student.birthDate.split('T')[0] : '',
        address:        student.profile?.address     || '',
        guardianName:   student.profile?.guardianName    || '',
        guardianContact:student.profile?.guardianContact || '',
        emergencyContact:student.profile?.emergencyContact || '',
        biography:      student.profile?.biography   || '',
        bloodType:     student.profile?.bloodType     || '',
        weight:        student.profile?.weight != null ? String(student.profile.weight) : '',
        height:        student.profile?.height != null ? String(student.profile.height) : '',
      })
    }
  }, [student])

  // Revoke object URLs on unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview)
      if (bannerPreview) URL.revokeObjectURL(bannerPreview)
    }
  }, []) // eslint-disable-line

  const handleAvatarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (editing) {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview)
      setAvatarFile(file)
      setAvatarPreview(URL.createObjectURL(file))
    } else {
      avatarMut.mutate(file)
    }
  }

  const handleBannerPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (editing) {
      if (bannerPreview) URL.revokeObjectURL(bannerPreview)
      setBannerFile(file)
      setBannerPreview(URL.createObjectURL(file))
    } else {
      bannerMut.mutate(file)
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string' && studentId) {
        localStorage.setItem(`smartclass_student_banner_${studentId}`, reader.result)
        setLocalBanner(reader.result)
      }
    }
    reader.readAsDataURL(file)
  }

  const avatarMut = useMutation({
    mutationFn: (f: File) => studentsApi.uploadAvatar(studentId!, f),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ['student-profile', studentId] })
      qc.invalidateQueries({ queryKey: ['student', studentId] })
      if (refetch) await refetch()
      setAvatarFile(null)
      setAvatarPreview(null)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  const bannerMut = useMutation({
    mutationFn: (f: File) => studentsApi.uploadBanner(studentId!, f),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ['student-profile', studentId] })
      qc.invalidateQueries({ queryKey: ['student', studentId] })
      if (refetch) await refetch()
      setBannerFile(null)
      setBannerPreview(null)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  const updateMut = useMutation({
    mutationFn: (data: any) => studentsApi.updateProfile(studentId!, data),
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
      qc.invalidateQueries({ queryKey: ['student-profile', studentId] })
      qc.invalidateQueries({ queryKey: ['student', studentId] })
      if (refetch) await refetch()
      setEditing(false)
      setAvatarFile(null); setAvatarPreview(null)
      setBannerFile(null); setBannerPreview(null)
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

    if (form.guardianContact) {
      const guardPhoneRes = validatePhilippinePhone(form.guardianContact)
      if (!guardPhoneRes.valid && guardPhoneRes.error) errors.guardianContact = guardPhoneRes.error
    }

    if (form.guardianName) {
      const guardNameRes = validateFullName(form.guardianName, 'Guardian Name', false)
      if (!guardNameRes.valid && guardNameRes.error) errors.guardianName = guardNameRes.error
    }

    if (form.birthDate) {
      const dateRes = validateBirthDate(form.birthDate)
      if (!dateRes.valid && dateRes.error) errors.birthDate = dateRes.error
    }

    if (form.weight) {
      const weightRes = validateMeasurement(form.weight, 'Weight', 10, 300, 'kg')
      if (!weightRes.valid && weightRes.error) errors.weight = weightRes.error
    }

    if (form.height) {
      const heightRes = validateMeasurement(form.height, 'Height', 50, 250, 'cm')
      if (!heightRes.valid && heightRes.error) errors.height = heightRes.error
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSaveProfile = () => {
    if (!validateForm()) return
    updateMut.mutate(form)
  }

  // ── Change password state ──────────────────────────────────
  const [pwForm, setPwForm]     = useState({ current: '', next: '', confirm: '' })
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext]       = useState(false)
  const [pwSaved, setPwSaved]   = useState(false)
  const [pwError, setPwError]   = useState('')

  const changePwMut = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) => authApi.changePassword(data),
    onSuccess: () => {
      setPwSaved(true); setPwError('')
      setPwForm({ current: '', next: '', confirm: '' })
      setTimeout(() => setPwSaved(false), 4000)
    },
    onError: (err: any) => setPwError(err.response?.data?.error || 'Failed to change password.'),
  })

  const handleChangePw = () => {
    setPwError('')
    if (!pwForm.current)        { setPwError('Current password is required.'); return }
    const passwordResult = validatePassword(pwForm.next)
    if (!passwordResult.valid) { setPwError(passwordResult.error || 'Invalid password.'); return }
    if (pwForm.next !== pwForm.confirm) { setPwError('New passwords do not match.'); return }
    changePwMut.mutate({ currentPassword: pwForm.current, newPassword: pwForm.next })
  }

  if (isLoading) return <LoadingSpinner />

  const assignment    = student?.sectionAssignments?.[0]
  const savedAvatar   = student?.profile?.profilePicture || null
  const savedBanner   = student?.profile?.bannerImage    || null

  // What to show in the header right now
  const currentAvatar = avatarPreview || savedAvatar
  const currentBanner = bannerPreview || savedBanner || localBanner

  return (
    <div className="space-y-6 animate-fade-in w-full">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">My Profile</h1>
          <p className="text-text-secondary font-inter text-sm mt-1">View and update your personal information</p>
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
          style={currentBanner
            ? { backgroundImage: `url(${currentBanner})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : undefined}
        >
          {!currentBanner && (
            <div className="absolute inset-0 bg-gradient-to-br from-primary-dark via-primary to-primary/80" />
          )}
          {/* Decorative circles (only when no banner) */}
          {!currentBanner && (
            <>
              <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none" />
            </>
          )}
          {/* Slight overlay when banner is set for readability */}
          {currentBanner && (
            <div className="absolute inset-0 bg-black/30" />
          )}

          {/* Change Banner button */}
          <button
            type="button"
            onClick={() => bannerInputRef.current?.click()}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 flex items-center gap-1.5 px-3 py-1.5 bg-black/40 hover:bg-black/60 text-white text-xs font-inter font-medium rounded-xl transition-colors backdrop-blur-sm border border-white/20"
            title="Change banner image"
          >
            <ImagePlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{currentBanner ? 'Change Banner' : 'Add Banner'}</span>
          </button>
          <input ref={bannerInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleBannerPick} />
        </div>

        {/* Profile info row */}
        <div className="bg-surface px-6 pb-6">
          <div className="flex items-end gap-4 -mt-10 sm:-mt-12 mb-4">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <Avatar
                name={student?.fullName || ''}
                src={currentAvatar}
                size="xl"
                className="!w-24 !h-24 sm:!w-28 sm:!h-28 ring-4 ring-surface !text-2xl shadow-md"
              />
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center shadow-md hover:bg-primary-dark transition-colors border-2 border-surface"
                title="Change photo"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarPick} />
            </div>

            <div className="flex-1 min-w-0 pt-12">
              <h2 className="font-poppins font-bold text-2xl text-text-primary leading-tight truncate">{student?.fullName}</h2>
              <p className="font-inter text-text-secondary text-sm mt-0.5">{student?.email}</p>
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1 rounded-lg bg-primary-light text-primary text-xs font-inter font-medium">
              Student ID: #{student?.studentNumber}
            </span>
            {assignment && (
              <span className="px-3 py-1 rounded-lg bg-primary-light text-primary text-xs font-inter font-medium">
                Section: {assignment.section?.name}
              </span>
            )}
            {assignment && (
              <span className="px-3 py-1 rounded-lg bg-border text-text-secondary text-xs font-inter">
                S.Y. {assignment.academicYear?.name}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Profile info / edit ── */}
      {!editing ? (
        <div className="space-y-6 w-full">
          <div className="card w-full">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                <h2 className="font-poppins font-semibold text-base text-text-primary">Personal Information</h2>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>Edit Profile</Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-5">
              <Field label="Gender" value={student?.gender} />
              <Field label="Date of Birth" value={student?.birthDate
                ? new Date(student.birthDate).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
                : undefined} />
              <Field label="Contact Number" value={student?.contactNumber} />
              <Field label="Blood Type" value={student?.profile?.bloodType} />
              <Field label="Weight" value={student?.profile?.weight != null ? `${student.profile.weight} kg` : undefined} />
              <Field label="Height" value={student?.profile?.height != null ? `${student.profile.height} cm` : undefined} />
              <div className="col-span-2 sm:col-span-3 lg:col-span-6"><Field label="Address" value={student?.profile?.address} /></div>
              {student?.profile?.biography && (
                <div className="col-span-2 sm:col-span-3 lg:col-span-6"><Field label="About Me" value={student.profile.biography} /></div>
              )}
            </div>
          </div>

          <div className="card w-full">
            <div className="flex items-center gap-2 mb-5">
              <Users className="w-5 h-5 text-secondary" />
              <h2 className="font-poppins font-semibold text-base text-text-primary">Guardian & Emergency Contact</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-3 gap-x-6 gap-y-5">
              <Field label="Guardian Name"    value={student?.profile?.guardianName} />
              <Field label="Guardian Contact" value={student?.profile?.guardianContact} />
              <Field label="Emergency Contact" value={student?.profile?.emergencyContact} />
            </div>
          </div>

          <div className="card w-full">
            <div className="flex items-center gap-2 mb-5">
              <BookOpen className="w-5 h-5 text-accent" />
              <h2 className="font-poppins font-semibold text-base text-text-primary">Academic Information</h2>
              <span className="text-xs text-text-secondary font-inter italic ml-1">(managed by admin)</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-5">
              <Field label="Student Number" value={student?.studentNumber} />
              <Field label="Student Code"   value={student?.studentCode} />
              <Field label="Email"          value={student?.email} />
              <Field label="Section"        value={assignment?.section?.name} />
              <Field label="Grade Level"    value={assignment?.section?.gradeLevel?.name} />
              <Field label="Academic Year"  value={assignment?.academicYear?.name} />
            </div>
          </div>
        </div>
      ) : (
        <div className="card space-y-6 w-full">
          <div className="flex items-center justify-between">
            <h2 className="font-poppins font-semibold text-base text-text-primary">Edit Profile</h2>
            <p className="text-xs text-text-secondary font-inter">
              Use the banner and avatar buttons above to update your photos
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium font-inter text-text-primary mb-1.5">Gender</label>
              <select className="input-field" value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
                <option value="">Select gender</option>
                {GENDER_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
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
              hint="Philippine mobile format (e.g. +63 912 345 6789)"
            />
            <div>
              <label className="block text-sm font-medium font-inter text-text-primary mb-1.5">Blood Type</label>
              <select className="input-field" value={form.bloodType} onChange={e => setForm(f => ({ ...f, bloodType: e.target.value }))}>
                <option value="">Select blood type</option>
                {['A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−', 'Unknown'].map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <Input
              label="Weight (kg)"
              type="number"
              min="10"
              max="300"
              step="0.1"
              placeholder="e.g. 55"
              value={form.weight}
              onChange={e => {
                setForm(f => ({ ...f, weight: e.target.value }))
                if (formErrors.weight) setFormErrors(errs => ({ ...errs, weight: '' }))
              }}
              error={formErrors.weight}
            />
            <Input
              label="Height (cm)"
              type="number"
              min="50"
              max="250"
              step="0.1"
              placeholder="e.g. 165"
              value={form.height}
              onChange={e => {
                setForm(f => ({ ...f, height: e.target.value }))
                if (formErrors.height) setFormErrors(errs => ({ ...errs, height: '' }))
              }}
              error={formErrors.height}
            />
            <div className="sm:col-span-2 lg:col-span-3">
              <Input
                label="Home Address"
                placeholder="Street, Barangay, City, Province"
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              />
            </div>
          </div>

          <hr className="border-border" />
          <h3 className="font-poppins font-medium text-text-primary text-sm">Guardian & Emergency Contact</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Input
              label="Guardian / Parent Name"
              placeholder="Full name"
              value={form.guardianName}
              onChange={e => {
                setForm(f => ({ ...f, guardianName: e.target.value }))
                if (formErrors.guardianName) setFormErrors(errs => ({ ...errs, guardianName: '' }))
              }}
              error={formErrors.guardianName}
            />
            <PhoneInput
              label="Guardian Contact Number"
              value={form.guardianContact}
              onChange={val => {
                setForm(f => ({ ...f, guardianContact: val }))
                if (formErrors.guardianContact) setFormErrors(errs => ({ ...errs, guardianContact: '' }))
              }}
              error={formErrors.guardianContact}
              hint="Philippine mobile number (+63 9XX XXX XXXX)"
            />
            <div className="sm:col-span-2 lg:col-span-3">
              <Input
                label="Emergency Contact Info"
                placeholder="e.g. Maria Santos (+63 917 123 4567) - Mother"
                value={form.emergencyContact}
                onChange={e => setForm(f => ({ ...f, emergencyContact: e.target.value }))}
                hint="Name, relationship, and contact number for emergency situations"
              />
            </div>
          </div>

          <hr className="border-border" />
          <div>
            <label className="block text-sm font-medium font-inter text-text-primary mb-1.5">
              About Me <span className="text-text-secondary font-normal">(optional)</span>
            </label>
            <textarea className="input-field resize-none" rows={3} placeholder="A short bio about yourself..."
              value={form.biography} onChange={e => setForm(f => ({ ...f, biography: e.target.value }))} />
          </div>

          <div className="flex gap-3 justify-end pt-1">
            <Button variant="secondary" onClick={() => {
              setEditing(false)
              setAvatarFile(null); setAvatarPreview(null)
              setBannerFile(null); setBannerPreview(null)
              setFormErrors({})
            }}>Cancel</Button>
            <Button
              loading={updateMut.isPending || avatarMut.isPending || bannerMut.isPending}
              onClick={handleSaveProfile}
            >
              Save Changes
            </Button>
          </div>
          {updateMut.isError && (
            <p className="text-sm text-danger font-inter text-right">
              {(updateMut.error as any)?.response?.data?.error || (updateMut.error as any)?.message || 'Failed to save. Please check information and try again.'}
            </p>
          )}
        </div>
      )}

      {/* ── Change Password ── */}
      <div className="card space-y-4 w-full">
        <div className="flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-warning" />
          <h2 className="font-poppins font-semibold text-base text-text-primary">Change Password</h2>
        </div>
        <p className="text-text-secondary font-inter text-sm">
          Update your login password. You'll need your current password to make changes.
        </p>

        {pwSaved && (
          <div className="flex items-center gap-2 px-3 py-2 bg-success/10 text-success rounded-xl text-sm font-inter font-medium">
            <CheckCircle2 className="w-4 h-4" /> Password changed successfully!
          </div>
        )}

        <div className="space-y-4 max-w-lg">
          <div>
            <label className="block text-sm font-medium font-inter text-text-primary mb-1.5">Current Password</label>
            <div className="relative">
              <input type={showCurrent ? 'text' : 'password'} className="input-field pr-10"
                placeholder="Enter your current password" value={pwForm.current}
                onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))} autoComplete="current-password" />
              <button type="button" onClick={() => setShowCurrent(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors">
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium font-inter text-text-primary mb-1.5">New Password</label>
            <div className="relative">
              <input type={showNext ? 'text' : 'password'} className="input-field pr-10"
                placeholder="At least 6 characters" value={pwForm.next}
                onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))} autoComplete="new-password" />
              <button type="button" onClick={() => setShowNext(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors">
                {showNext ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium font-inter text-text-primary mb-1.5">Confirm New Password</label>
            <input type="password" className="input-field" placeholder="Re-enter new password"
              value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} autoComplete="new-password" />
          </div>

          {pwError && <p className="text-sm text-danger font-inter">{pwError}</p>}

          <Button loading={changePwMut.isPending} onClick={handleChangePw}
            disabled={!pwForm.current || !pwForm.next || !pwForm.confirm}
            icon={<KeyRound className="w-4 h-4" />}>
            Update Password
          </Button>
        </div>
      </div>
    </div>
  )
}
