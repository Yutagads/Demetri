import React, { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../lib/auth'
import { teachersApi } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Avatar } from '../../components/ui/Avatar'
import { X, Camera, CheckCircle2 } from 'lucide-react'
import { validateBirthDate } from '../../lib/validation'

const GENDER_OPTIONS = ['Male', 'Female', 'Prefer not to say']

interface Props {
  onClose: () => void
}

export default function TeacherProfileModal({ onClose }: Props) {
  const { user, refetch } = useAuth() as any
  const qc = useQueryClient()
  const teacherId = user?.profile?.id
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: teacher, isLoading } = useQuery({
    queryKey: ['teacher-profile', teacherId],
    queryFn: () => teachersApi.getOne(teacherId!).then(r => r.data),
    enabled: !!teacherId,
  })

  const [saved, setSaved] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [form, setForm] = useState({ gender: '', birthDate: '' })
  const [birthDateError, setBirthDateError] = useState('')

  useEffect(() => {
    if (teacher) {
      setForm({
        gender: teacher.profile?.gender || '',
        birthDate: teacher.profile?.birthDate ? teacher.profile.birthDate.split('T')[0] : '',
      })
    }
  }, [teacher])

  const avatarMut = useMutation({
    mutationFn: (file: File) => teachersApi.uploadAvatar(teacherId!, file),
  })

  const updateMut = useMutation({
    mutationFn: (data: any) => teachersApi.updateProfile(teacherId!, data),
    onSuccess: async () => {
      if (avatarFile) await avatarMut.mutateAsync(avatarFile)
      await qc.invalidateQueries({ queryKey: ['teacher-profile', teacherId] })
      await qc.invalidateQueries({ queryKey: ['teacher', teacherId] })
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

  const currentPic = avatarPreview || user?.profile?.profile?.profilePicture || null
  const name = teacher?.fullName || user?.profile?.fullName || 'Teacher'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-surface rounded-2xl shadow-xl w-full max-w-sm flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-poppins font-bold text-text-primary text-lg">Edit Profile</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-primary-light text-text-secondary hover:text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
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
                  <p className="font-inter text-text-secondary text-sm">{teacher?.email}</p>
                </div>
              </div>

              {/* Gender */}
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

              {/* Birthday */}
              <div>
                <label className="block text-sm font-medium font-inter text-text-primary mb-1.5">Date of Birth</label>
                <input
                  type="date"
                  className={`input-field ${birthDateError ? 'border-danger focus:ring-danger' : ''}`}
                  value={form.birthDate}
                  onChange={e => {
                    setForm(f => ({ ...f, birthDate: e.target.value }))
                    if (birthDateError) setBirthDateError('')
                  }}
                />
                {birthDateError && <p className="mt-1 text-xs text-danger font-inter">{birthDateError}</p>}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3">
          {saved ? (
            <span className="flex items-center gap-2 text-success text-sm font-inter font-medium">
              <CheckCircle2 className="w-4 h-4" /> Saved!
            </span>
          ) : <span />}
          <div className="flex gap-3 ml-auto">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button
              loading={updateMut.isPending || avatarMut.isPending}
              onClick={() => {
                if (form.birthDate) {
                  const res = validateBirthDate(form.birthDate, false)
                  if (!res.valid && res.error) {
                    setBirthDateError(res.error)
                    return
                  }
                }
                updateMut.mutate(form)
              }}
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
