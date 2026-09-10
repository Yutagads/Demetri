import React, { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../lib/auth'
import { studentsApi } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { PhoneInput } from '../../components/ui/PhoneInput'
import { Avatar } from '../../components/ui/Avatar'
import { X, Camera, CheckCircle2, Ruler, Weight } from 'lucide-react'
import { validatePhilippinePhone, validateFullName, validateBirthDate, validateMeasurement } from '../../lib/validation'

const GENDER_OPTIONS = ['Male', 'Female', 'Prefer not to say']

interface Props {
  onClose: () => void
}

export default function StudentProfileModal({ onClose }: Props) {
  const { user, refetch } = useAuth() as any
  const qc = useQueryClient()
  const studentId = user?.profile?.id
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: student, isLoading } = useQuery({
    queryKey: ['student-profile', studentId],
    queryFn: () => studentsApi.getOne(studentId!).then(r => r.data),
    enabled: !!studentId,
  })

  const [saved, setSaved] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [form, setForm] = useState({
    contactNumber: '',
    gender: '',
    birthDate: '',
    address: '',
    guardianName: '',
    guardianContact: '',
    emergencyContact: '',
    biography: '',
    bloodType: '',
    weight: '',
    height: '',
  })

  useEffect(() => {
    if (student) {
      setForm({
        contactNumber: student.contactNumber || '',
        gender: student.gender || '',
        birthDate: student.birthDate ? student.birthDate.split('T')[0] : '',
        address: student.profile?.address || '',
        guardianName: student.profile?.guardianName || '',
        guardianContact: student.profile?.guardianContact || '',
        emergencyContact: student.profile?.emergencyContact || '',
        biography: student.profile?.biography || '',
        bloodType: student.profile?.bloodType || '',
        weight: student.profile?.weight != null ? String(student.profile.weight) : '',
        height: student.profile?.height != null ? String(student.profile.height) : '',
      })
    }
  }, [student])

  const avatarMut = useMutation({
    mutationFn: (file: File) => studentsApi.uploadAvatar(studentId!, file),
  })

  const updateMut = useMutation({
    mutationFn: (data: any) => studentsApi.updateProfile(studentId!, data),
    onSuccess: async () => {
      if (avatarFile) {
        await avatarMut.mutateAsync(avatarFile)
      }
      await qc.invalidateQueries({ queryKey: ['student-profile', studentId] })
      await qc.invalidateQueries({ queryKey: ['student', studentId] })
      if (refetch) await refetch()
      setSaved(true)
      setTimeout(() => { setSaved(false); onClose() }, 1500)
    },
  })

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    const reader = new FileReader()
    reader.onload = ev => setAvatarPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

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

  const handleSave = () => {
    if (!validateForm()) return
    updateMut.mutate(form)
  }

  const currentPic = avatarPreview || user?.profile?.profile?.profilePicture || null
  const name = student?.fullName || user?.profile?.fullName || 'Student'

  // BMI calc
  const weightNum = parseFloat(form.weight)
  const heightNum = parseFloat(form.height)
  const bmi = (!isNaN(weightNum) && !isNaN(heightNum) && heightNum > 0)
    ? (weightNum / Math.pow(heightNum / 100, 2)).toFixed(1)
    : null
  const bmiLabel = bmi
    ? parseFloat(bmi) < 18.5 ? 'Underweight'
      : parseFloat(bmi) < 25 ? 'Normal weight'
      : parseFloat(bmi) < 30 ? 'Overweight'
      : 'Obese'
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-surface rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <h2 className="font-poppins font-bold text-text-primary text-lg">Edit Profile</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-primary-light text-text-secondary hover:text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Avatar */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <Avatar name={name} src={currentPic} size="xl" />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center shadow-md hover:bg-primary-dark transition-colors"
                    title="Change photo"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
                <div className="text-center">
                  <p className="font-poppins font-bold text-text-primary text-base">{name}</p>
                  <p className="font-inter text-text-secondary text-sm">
                    {student?.studentNumber}
                  </p>
                </div>
              </div>

              {/* Blood type, weight & height */}
              <div>
                <h3 className="font-poppins font-semibold text-text-primary text-sm mb-3 flex items-center gap-2">
                  <Ruler className="w-4 h-4 text-primary" /> Physical Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium font-inter text-text-primary mb-1.5">
                      Blood Type
                    </label>
                    <select
                      className="input-field"
                      value={form.bloodType}
                      onChange={e => setForm(f => ({ ...f, bloodType: e.target.value }))}
                    >
                      <option value="">Select</option>
                      {['A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−', 'Unknown'].map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium font-inter text-text-primary mb-1.5">
                      Weight <span className="text-text-secondary font-normal">(kg)</span>
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="300"
                      step="0.1"
                      placeholder="e.g. 55"
                      className={`input-field ${formErrors.weight ? 'border-danger focus:ring-danger' : ''}`}
                      value={form.weight}
                      onChange={e => {
                        setForm(f => ({ ...f, weight: e.target.value }))
                        if (formErrors.weight) setFormErrors(errs => ({ ...errs, weight: '' }))
                      }}
                    />
                    {formErrors.weight && <p className="mt-1 text-xs text-danger font-inter">{formErrors.weight}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium font-inter text-text-primary mb-1.5">
                      Height <span className="text-text-secondary font-normal">(cm)</span>
                    </label>
                    <input
                      type="number"
                      min="50"
                      max="250"
                      step="0.1"
                      placeholder="e.g. 160"
                      className={`input-field ${formErrors.height ? 'border-danger focus:ring-danger' : ''}`}
                      value={form.height}
                      onChange={e => {
                        setForm(f => ({ ...f, height: e.target.value }))
                        if (formErrors.height) setFormErrors(errs => ({ ...errs, height: '' }))
                      }}
                    />
                    {formErrors.height && <p className="mt-1 text-xs text-danger font-inter">{formErrors.height}</p>}
                  </div>
                </div>
                {bmi && (
                  <p className="mt-2 text-xs font-inter text-text-secondary">
                    BMI: <span className="font-semibold text-text-primary">{bmi}</span>
                    <span className="ml-1 text-primary">({bmiLabel})</span>
                  </p>
                )}
              </div>

              {/* Personal Info */}
              <div>
                <h3 className="font-poppins font-semibold text-text-primary text-sm mb-3">Personal Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium font-inter text-text-primary mb-1.5">Gender</label>
                    <select
                      className="input-field"
                      value={form.gender}
                      onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                    >
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
                  <div className="sm:col-span-2">
                    <PhoneInput
                      label="Contact Number"
                      value={form.contactNumber}
                      onChange={val => {
                        setForm(f => ({ ...f, contactNumber: val }))
                        if (formErrors.contactNumber) setFormErrors(errs => ({ ...errs, contactNumber: '' }))
                      }}
                      error={formErrors.contactNumber}
                      hint="Philippine mobile format (+63 9XX XXX XXXX)"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Input
                      label="Home Address"
                      placeholder="Street, Barangay, City, Province"
                      value={form.address}
                      onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Guardian */}
              <div>
                <h3 className="font-poppins font-semibold text-text-primary text-sm mb-3">Guardian & Emergency Contact</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    hint="Philippine mobile format (+63 9XX XXX XXXX)"
                  />
                  <div className="sm:col-span-2">
                    <Input
                      label="Emergency Contact Info"
                      placeholder="e.g. Maria Santos (+63 917 123 4567) - Mother"
                      value={form.emergencyContact}
                      onChange={e => setForm(f => ({ ...f, emergencyContact: e.target.value }))}
                      hint="Name, relationship, and contact number for emergency situations"
                    />
                  </div>
                </div>
              </div>

              {/* Bio */}
              <div>
                <label className="block text-sm font-medium font-inter text-text-primary mb-1.5">
                  About Me <span className="text-text-secondary font-normal">(optional)</span>
                </label>
                <textarea
                  className="input-field resize-none"
                  rows={3}
                  placeholder="A short bio about yourself..."
                  value={form.biography}
                  onChange={e => setForm(f => ({ ...f, biography: e.target.value }))}
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex-shrink-0 flex items-center justify-between gap-3">
          {saved ? (
            <span className="flex items-center gap-2 text-success text-sm font-inter font-medium">
              <CheckCircle2 className="w-4 h-4" /> Saved!
            </span>
          ) : (
            <span />
          )}
          <div className="flex gap-3 ml-auto">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button
              loading={updateMut.isPending || avatarMut.isPending}
              onClick={handleSave}
              disabled={isLoading}
            >
              Save Changes
            </Button>
          </div>
        </div>
        {updateMut.isError && (
          <p className="px-6 pb-3 text-sm text-danger font-inter text-right -mt-2">
            Failed to save. Please try again.
          </p>
        )}
      </div>
    </div>
  )
}
