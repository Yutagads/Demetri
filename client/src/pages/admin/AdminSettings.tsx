import React, { useEffect, useRef, useState, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { settingsApi } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { LoadingSpinner } from '../../components/ui/EmptyState'
import {
  Settings, Save, Check, Upload, Trash2, Download, Database,
  ShieldCheck, GraduationCap, Monitor, KeyRound, RotateCcw, ExternalLink,
  Phone, Mail, ArrowLeft, ChevronRight, CheckCircle2, AlertCircle,
  Building2, Sliders, Shield, HardDrive, UserCog
} from 'lucide-react'
import {
  formatPhilippinePhone,
  validatePassword,
  validatePhilippinePhone,
  validateEmail,
  getPhoneDigits
} from '../../lib/validation'

const PERIODS = ['1st', '2nd', '3rd', '4th']

type SectionId = 'branding' | 'academic' | 'kiosk' | 'security' | 'database' | 'account'

interface SectionMeta {
  id: SectionId
  title: string
  shortTitle: string
  description: string
  icon: React.ReactNode
  badge?: string
}

export default function AdminSettings() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const fileRef = useRef<HTMLInputElement>(null)
  const backupRef = useRef<HTMLInputElement>(null)

  // ── Active Container State (null = Minimized Overview) ──────────────────────
  const sectionParam = searchParams.get('section') as SectionId | null
  const [activeSection, setActiveSection] = useState<SectionId | null>(
    sectionParam && ['branding', 'academic', 'kiosk', 'security', 'database', 'account'].includes(sectionParam)
      ? sectionParam
      : null
  )

  const selectSection = (id: SectionId | null) => {
    setActiveSection(id)
    if (id) {
      setSearchParams({ section: id })
    } else {
      setSearchParams({})
    }
  }

  // ── Form State ─────────────────────────────────────────────────────────────
  const [form, setForm] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [adminForm, setAdminForm] = useState({ username: '', currentPassword: '', newPassword: '' })

  // ── Validation States for Branding ─────────────────────────────────────────
  const phoneValidation = useMemo(() => {
    return validatePhilippinePhone(form.schoolContactNumber || '', false)
  }, [form.schoolContactNumber])

  const emailValidation = useMemo(() => {
    return validateEmail(form.schoolContactEmail || '', false)
  }, [form.schoolContactEmail])

  // ── Data Fetching ──────────────────────────────────────────────────────────
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.getAll().then(r => r.data as Record<string, string>),
  })

  useEffect(() => {
    if (settings) {
      setForm(settings)
      setAdminForm(p => ({ ...p, username: '' }))
    }
  }, [settings])

  // ── Mutations ──────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (data: Record<string, string>) => settingsApi.update(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      qc.invalidateQueries({ queryKey: ['public-settings'] })
      setSaved(true)
      setError('')
      setMessage('Settings updated successfully.')
      setTimeout(() => setSaved(false), 2200)
    },
    onError: (e: any) => setError(e.response?.data?.error || 'Could not save settings.'),
  })

  const logoMutation = useMutation({
    mutationFn: (file: File) => settingsApi.uploadLogo(file),
    onSuccess: r => {
      setForm(p => ({ ...p, schoolLogo: r.data.schoolLogo }))
      qc.invalidateQueries({ queryKey: ['settings'] })
      setMessage('School logo uploaded successfully.')
    },
    onError: (e: any) => setError(e.response?.data?.error || 'Could not upload logo.'),
  })

  const removeLogoMutation = useMutation({
    mutationFn: () => settingsApi.removeLogo(),
    onSuccess: () => {
      setForm(p => ({ ...p, schoolLogo: '' }))
      qc.invalidateQueries({ queryKey: ['settings'] })
      setMessage('School logo removed.')
    },
  })

  const accountMutation = useMutation({
    mutationFn: () => settingsApi.updateAdminAccount({
      username: adminForm.username || undefined,
      currentPassword: adminForm.currentPassword,
      newPassword: adminForm.newPassword || undefined,
    }),
    onSuccess: r => {
      setAdminForm({ username: '', currentPassword: '', newPassword: '' })
      setMessage(`Admin account updated${r.data.username ? ` for ${r.data.username}` : ''}.`)
      setError('')
    },
    onError: (e: any) => setError(e.response?.data?.error || 'Could not update admin account.'),
  })

  const importMutation = useMutation({
    mutationFn: (file: File) => settingsApi.importBackup(file),
    onSuccess: () => {
      setMessage('Backup restored. Reloading current data.')
      qc.invalidateQueries()
      setTimeout(() => window.location.reload(), 800)
    },
    onError: (e: any) => setError(e.response?.data?.error || 'Could not restore backup.'),
  })

  const resetMutation = useMutation({
    mutationFn: () => settingsApi.resetDemo(),
    onSuccess: () => {
      setMessage('Demo data restored. Reloading.')
      setTimeout(() => window.location.reload(), 800)
    },
    onError: (e: any) => setError(e.response?.data?.error || 'Could not reset demo data.'),
  })

  const set = (key: string, value: string) => setForm(p => ({ ...p, [key]: value }))

  const handlePhoneChange = (raw: string) => {
    const formatted = formatPhilippinePhone(raw)
    set('schoolContactNumber', formatted)
  }

  const saveBranding = () => {
    setError('')
    setMessage('')
    if (form.schoolContactNumber && !phoneValidation.valid) {
      setError(phoneValidation.error || 'Please enter a valid Philippine contact number (+63 9XX XXX XXXX).')
      return
    }
    if (form.schoolContactEmail && !emailValidation.valid) {
      setError(emailValidation.error || 'Please enter a valid contact email address.')
      return
    }
    saveMutation.mutate(form)
  }

  const saveGeneric = () => {
    setError('')
    setMessage('')
    saveMutation.mutate(form)
  }

  const currentLogo = form.schoolLogo ? `${form.schoolLogo}?v=${settings?.schoolLogo}` : ''

  const downloadBackup = async () => {
    try {
      const response = await settingsApi.exportBackup()
      const url = URL.createObjectURL(response.data)
      const a = document.createElement('a')
      a.href = url
      a.download = 'smartclass-backup.json'
      a.click()
      URL.revokeObjectURL(url)
      setMessage('Database backup downloaded.')
    } catch {
      setError('Could not export the database.')
    }
  }

  // ── Section Metadata List ──────────────────────────────────────────────────
  const sections: SectionMeta[] = [
    {
      id: 'branding',
      title: 'School Branding & Identity',
      shortTitle: 'School Branding',
      description: 'Configure school name, campus address, motto, Philippine contact information, and institutional logo.',
      icon: <Building2 className="w-6 h-6 text-primary" />,
      badge: form.schoolName || 'Default Branding',
    },
    {
      id: 'academic',
      title: 'Grading & Academic Rules',
      shortTitle: 'Grading & Academic',
      description: 'Set DepEd passing grade threshold, grading period count, default active quarter, and grade release resets.',
      icon: <GraduationCap className="w-6 h-6 text-emerald-600" />,
      badge: `Passing: ${form.passingGrade || 75}% • ${form.currentGradingPeriod || '1st'} Quarter`,
    },
    {
      id: 'kiosk',
      title: 'Kiosk & Landing Display',
      shortTitle: 'Kiosk / Landing Screen',
      description: 'Control announcement rotation timers, city weather coordinates, and idle kiosk return behavior.',
      icon: <Monitor className="w-6 h-6 text-blue-600" />,
      badge: `${form.slideRotationInterval || 6}s slides • ${form.weatherLocation || 'Manila'}`,
    },
    {
      id: 'security',
      title: 'Security & Access Policy',
      shortTitle: 'Security Policy',
      description: 'Set mandatory first-login password change rules, max failed login attempts, and temporary account lockout duration.',
      icon: <ShieldCheck className="w-6 h-6 text-amber-600" />,
      badge: form.forceFirstLoginPasswordChange === 'false' ? 'First Login: Optional' : 'First Login: Enforced',
    },
    {
      id: 'database',
      title: 'Data Management & Backups',
      shortTitle: 'Data Management',
      description: 'Download full JSON snapshots of school data, restore previous backups, or reset system to demo dataset.',
      icon: <HardDrive className="w-6 h-6 text-purple-600" />,
      badge: 'Database Utilities',
    },
    {
      id: 'account',
      title: 'Administrator Account',
      shortTitle: 'Admin Account',
      description: 'Change the master administrator username, current password, and secure administrative credentials.',
      icon: <UserCog className="w-6 h-6 text-rose-600" />,
      badge: 'Admin Credentials',
    },
  ]

  if (isLoading) return <LoadingSpinner />

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">System Settings</h1>
          <p className="text-text-secondary font-inter text-sm mt-1">
            Configure school branding, academic rules, kiosk display, and administrator controls.
          </p>
        </div>

        {activeSection && (
          <Button
            variant="secondary"
            icon={<ArrowLeft className="w-4 h-4" />}
            onClick={() => selectSection(null)}
          >
            Return to All Settings
          </Button>
        )}
      </div>

      {/* ── Feedback Banner ── */}
      {(message || error) && (
        <div
          className={`rounded-xl px-4 py-3 text-sm font-inter flex items-start gap-2.5 transition-all ${
            error
              ? 'bg-danger/10 border border-danger/20 text-danger'
              : 'bg-success/10 border border-success/20 text-success'
          }`}
        >
          {error ? <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" /> : <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />}
          <div className="flex-1">{error || message}</div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────
          VIEW 1: HORIZONTAL LIST VIEW (WINDOWS SETTINGS ARCHETYPE)
          ─────────────────────────────────────────────────────────────────────── */}
      {!activeSection && (
        <div className="space-y-2.5 animate-fade-in font-inter">
          {sections.map(sec => (
            <div
              key={sec.id}
              onClick={() => selectSection(sec.id)}
              className="w-full bg-white hover:bg-gray-50/90 active:bg-gray-100 border border-border rounded-xl px-5 py-4 flex items-center justify-between text-left transition-all duration-150 shadow-xs hover:border-gray-300 cursor-pointer group"
            >
              <div className="flex items-center gap-4 min-w-0 pr-4">
                <div className="w-11 h-11 rounded-xl bg-gray-50 border border-border/80 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                  {sec.icon}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-sm sm:text-base font-bold text-text-primary group-hover:text-primary transition-colors truncate">
                      {sec.title}
                    </h3>
                    {sec.badge && (
                      <span className="hidden sm:inline-block text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-text-secondary truncate max-w-[200px]">
                        {sec.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary line-clamp-1 mt-0.5">
                    {sec.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center text-text-secondary/60 group-hover:text-text-primary transition-colors flex-shrink-0 pl-2">
                <ChevronRight className="w-5 h-5" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────
          VIEW 2: EXPANDED FULL CONTAINER VIEW
          ─────────────────────────────────────────────────────────────────────── */}
      {activeSection && (
        <div className="space-y-6 animate-fade-in">
          {/* Clean Breadcrumb (without redundant return button) */}
          <div className="flex items-center gap-2 text-sm font-inter text-text-secondary bg-white border border-border rounded-xl px-4 py-3 shadow-xs">
            <button
              onClick={() => selectSection(null)}
              className="text-text-secondary hover:text-primary hover:underline font-medium transition-colors"
            >
              Settings
            </button>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <span className="text-text-primary font-bold">
              {sections.find(s => s.id === activeSection)?.title}
            </span>
          </div>

          {/* ── 1. School Branding Container ── */}
          {activeSection === 'branding' && (
            <section className="bg-white border border-border rounded-2xl p-6 shadow-sm space-y-6">
              <div className="flex items-center gap-3 pb-5 border-b border-border">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary flex-shrink-0">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold font-inter text-text-primary">School Branding & Identity</h2>
                  <p className="text-text-secondary font-inter text-xs mt-0.5">
                    Shown on the student/teacher login screens, kiosk, report cards, and institutional footers.
                  </p>
                </div>
              </div>

              <div className="space-y-5 max-w-3xl">
                <div>
                  <label className="block text-xs font-inter font-medium text-text-primary mb-1.5">School Name / Website Name</label>
                  <Input
                    className="w-full"
                    placeholder="School Name/Website Name"
                    value={form.schoolName || ''}
                    onChange={e => set('schoolName', e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-inter font-medium text-text-primary mb-1.5">School Address</label>
                  <Input
                    className="w-full"
                    placeholder="Campus address, City, Philippines"
                    value={form.schoolAddress || ''}
                    onChange={e => set('schoolAddress', e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-inter font-medium text-text-primary mb-1.5">Tagline / Motto</label>
                  <Input
                    className="w-full"
                    placeholder="Learning today, leading tomorrow."
                    value={form.schoolTagline || ''}
                    onChange={e => set('schoolTagline', e.target.value)}
                  />
                </div>

                {/* Updated Philippine Contact Number with formatting and validation */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-inter font-medium text-text-primary">
                        Contact Number
                      </label>
                      <span className="text-[11px] font-mono text-text-secondary font-medium">PH Standard (+63)</span>
                    </div>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                      <input
                        type="tel"
                        className={`input-field pl-9 pr-8 text-sm w-full ${
                          form.schoolContactNumber && !phoneValidation.valid
                            ? 'border-danger focus:border-danger focus:ring-danger/20'
                            : form.schoolContactNumber && phoneValidation.valid
                            ? 'border-success focus:border-success focus:ring-success/20'
                            : ''
                        }`}
                        placeholder="+63 9XX XXX XXXX"
                        value={form.schoolContactNumber || ''}
                        onChange={e => handlePhoneChange(e.target.value)}
                      />
                      {form.schoolContactNumber && phoneValidation.valid && (
                        <Check className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-success" />
                      )}
                    </div>
                    {form.schoolContactNumber && !phoneValidation.valid && (
                      <p className="text-xs text-danger font-inter mt-1.5 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {phoneValidation.error}
                      </p>
                    )}
                    {(!form.schoolContactNumber || phoneValidation.valid) && (
                      <p className="text-[11px] text-text-secondary font-inter mt-1">
                        Format: +63 9XX XXX XXXX (10 digits after +63)
                      </p>
                    )}
                  </div>

                  {/* Updated Email Address with validation */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-inter font-medium text-text-primary">
                        Contact Email
                      </label>
                      <span className="text-[11px] text-text-secondary font-medium">Official Inbox</span>
                    </div>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                      <input
                        type="email"
                        className={`input-field pl-9 pr-8 text-sm w-full ${
                          form.schoolContactEmail && !emailValidation.valid
                            ? 'border-danger focus:border-danger focus:ring-danger/20'
                            : form.schoolContactEmail && emailValidation.valid
                            ? 'border-success focus:border-success focus:ring-success/20'
                            : ''
                        }`}
                        placeholder="office@school.edu.ph"
                        value={form.schoolContactEmail || ''}
                        onChange={e => set('schoolContactEmail', e.target.value)}
                      />
                      {form.schoolContactEmail && emailValidation.valid && (
                        <Check className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-success" />
                      )}
                    </div>
                    {form.schoolContactEmail && !emailValidation.valid && (
                      <p className="text-xs text-danger font-inter mt-1.5 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {emailValidation.error}
                      </p>
                    )}
                    {(!form.schoolContactEmail || emailValidation.valid) && (
                      <p className="text-[11px] text-text-secondary font-inter mt-1">
                        Used for system notifications, footers, and official inquiries.
                      </p>
                    )}
                  </div>
                </div>

                {/* School Logo */}
                <div className="pt-3 border-t border-border">
                  <p className="font-inter font-medium text-sm text-text-primary">School Logo</p>
                  <p className="font-inter text-xs text-text-secondary mb-3">
                    PNG, JPG, GIF, WebP, or SVG up to 5 MB. Replaces the default shield icon across the application.
                  </p>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="w-20 h-20 rounded-2xl border border-border bg-gray-50 flex items-center justify-center overflow-hidden p-1 shadow-inner">
                      {currentLogo ? (
                        <img src={currentLogo} alt="School logo" className="w-full h-full object-contain" />
                      ) : (
                        <ShieldCheck className="w-9 h-9 text-primary" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          ref={fileRef}
                          type="file"
                          accept="image/*,.svg"
                          className="hidden"
                          onChange={e => e.target.files?.[0] && logoMutation.mutate(e.target.files[0])}
                        />
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<Upload className="w-4 h-4" />}
                          onClick={() => fileRef.current?.click()}
                          loading={logoMutation.isPending}
                        >
                          Upload Logo
                        </Button>
                        {form.schoolLogo && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-danger hover:bg-danger/10"
                            icon={<Trash2 className="w-4 h-4" />}
                            onClick={() => removeLogoMutation.mutate()}
                            loading={removeLogoMutation.isPending}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                      <p className="text-[11px] text-text-secondary font-inter">Recommended size: 256x256 or 512x512 transparent PNG.</p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex items-center gap-3">
                  <Button
                    onClick={saveBranding}
                    loading={saveMutation.isPending}
                    icon={saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  >
                    {saved ? 'Saved Successfully!' : 'Save School Branding'}
                  </Button>
                  <Button variant="ghost" onClick={() => selectSection(null)}>
                    Cancel & Return
                  </Button>
                </div>
              </div>
            </section>
          )}

          {/* ── 2. Academic & Grading Container ── */}
          {activeSection === 'academic' && (
            <section className="bg-white border border-border rounded-2xl p-6 shadow-sm space-y-6">
              <div className="flex items-center gap-3 pb-5 border-b border-border">
                <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 flex-shrink-0">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold font-inter text-text-primary">Grading & Academic Rules</h2>
                  <p className="text-text-secondary font-inter text-xs mt-0.5">
                    Set passing grade thresholds, active grading quarters, and grade release resets.
                  </p>
                </div>
              </div>

              <div className="space-y-5 max-w-3xl">
                <div>
                  <label className="block text-xs font-inter font-medium text-text-primary mb-1">
                    Passing Grade Threshold
                  </label>
                  <p className="text-xs text-text-secondary font-inter mb-1.5">
                    DepEd standard passing mark is 75. Drives color-coded pass/fail indicators across all report cards.
                  </p>
                  <Input
                    className="w-full"
                    type="number"
                    placeholder="75"
                    value={form.passingGrade || ''}
                    onChange={e => set('passingGrade', e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-inter font-medium text-text-primary mb-1">
                    Grading Periods
                  </label>
                  <p className="text-xs text-text-secondary font-inter mb-1.5">
                    Number of quarters available per academic year (default is 4 quarters).
                  </p>
                  <Input
                    className="w-full"
                    type="number"
                    placeholder="4"
                    value={form.gradingPeriods || ''}
                    onChange={e => set('gradingPeriods', e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-inter font-medium text-text-primary mb-1">
                    Current Active Grading Period
                  </label>
                  <p className="text-xs text-text-secondary font-inter mb-1.5">
                    Default quarter pre-selected when teachers enter grades or view attendance.
                  </p>
                  <select
                    className="input-field w-full text-sm py-2"
                    value={form.currentGradingPeriod || '1st'}
                    onChange={e => set('currentGradingPeriod', e.target.value)}
                  >
                    {PERIODS.slice(0, Number(form.gradingPeriods) || 4).map(p => (
                      <option key={p} value={p}>{p} Quarter</option>
                    ))}
                  </select>
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <Button
                    onClick={saveGeneric}
                    loading={saveMutation.isPending}
                    icon={<Save className="w-4 h-4" />}
                  >
                    Save Academic Settings
                  </Button>
                </div>

                <div className="border-t border-border pt-5 mt-4">
                  <div className="p-4 bg-gray-50 border border-border rounded-xl space-y-3">
                    <div>
                      <p className="font-inter font-semibold text-sm text-text-primary">Administrative Grade Reset</p>
                      <p className="font-inter text-xs text-text-secondary mt-0.5">
                        Reset released grades for a specific subject, section, and grading period if corrections are needed before final approval.
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<ExternalLink className="w-4 h-4" />}
                      onClick={() => navigate('/admin/grade-reset')}
                    >
                      Open Grade Reset Tool
                    </Button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ── 3. Kiosk & Landing Display Container ── */}
          {activeSection === 'kiosk' && (
            <section className="bg-white border border-border rounded-2xl p-6 shadow-sm space-y-6">
              <div className="flex items-center gap-3 pb-5 border-b border-border">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 flex-shrink-0">
                  <Monitor className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold font-inter text-text-primary">Kiosk & Landing Display</h2>
                  <p className="text-text-secondary font-inter text-xs mt-0.5">
                    Control announcement rotation intervals, city weather coordinates, and idle kiosk timeout.
                  </p>
                </div>
              </div>

              <div className="space-y-5 max-w-3xl">
                <div>
                  <label className="block text-xs font-inter font-medium text-text-primary mb-1">
                    Slide Rotation Interval (Seconds)
                  </label>
                  <p className="text-xs text-text-secondary font-inter mb-1.5">
                    How many seconds each school announcement slide remains visible on screen.
                  </p>
                  <Input
                    className="w-full"
                    type="number"
                    placeholder="6"
                    value={form.slideRotationInterval || ''}
                    onChange={e => set('slideRotationInterval', e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-inter font-medium text-text-primary mb-1">
                    Tab Rotation Interval (Seconds)
                  </label>
                  <p className="text-xs text-text-secondary font-inter mb-1.5">
                    How many seconds before auto-cycling between News, Schedules, and Spotlight tabs on unattended kiosks.
                  </p>
                  <Input
                    className="w-full"
                    type="number"
                    placeholder="30"
                    value={form.tabRotationInterval || ''}
                    onChange={e => set('tabRotationInterval', e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-1">
                    <label className="block text-xs font-inter font-medium text-text-primary mb-1.5">
                      Weather City Name
                    </label>
                    <Input
                      placeholder="Manila"
                      value={form.weatherLocation || ''}
                      onChange={e => set('weatherLocation', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-inter font-medium text-text-primary mb-1.5">
                      Latitude
                    </label>
                    <Input
                      placeholder="14.5995"
                      value={form.weatherLatitude || ''}
                      onChange={e => set('weatherLatitude', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-inter font-medium text-text-primary mb-1.5">
                      Longitude
                    </label>
                    <Input
                      placeholder="120.9842"
                      value={form.weatherLongitude || ''}
                      onChange={e => set('weatherLongitude', e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-inter font-medium text-text-primary mb-1">
                    Kiosk Idle Timeout (Minutes)
                  </label>
                  <p className="text-xs text-text-secondary font-inter mb-1.5">
                    Minutes of inactivity before a signed-in user is automatically logged out and returned to the public kiosk.
                  </p>
                  <Input
                    className="w-full"
                    type="number"
                    placeholder="10"
                    value={form.kioskIdleTimeout || ''}
                    onChange={e => set('kioskIdleTimeout', e.target.value)}
                  />
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <Button
                    onClick={saveGeneric}
                    loading={saveMutation.isPending}
                    icon={<Save className="w-4 h-4" />}
                  >
                    Save Kiosk Settings
                  </Button>
                  <Button variant="ghost" onClick={() => selectSection(null)}>
                    Return
                  </Button>
                </div>
              </div>
            </section>
          )}

          {/* ── 4. Security Policy Container ── */}
          {activeSection === 'security' && (
            <section className="bg-white border border-border rounded-2xl p-6 shadow-sm space-y-6">
              <div className="flex items-center gap-3 pb-5 border-b border-border">
                <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 flex-shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold font-inter text-text-primary">Security & Access Policy</h2>
                  <p className="text-text-secondary font-inter text-xs mt-0.5">
                    Manage password change requirements and account lockout thresholds.
                  </p>
                </div>
              </div>

              <div className="space-y-5 max-w-3xl">
                <label className="flex items-start gap-4 rounded-xl border border-border p-4 cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="checkbox"
                    className="w-5 h-5 mt-0.5 accent-primary flex-shrink-0"
                    checked={form.forceFirstLoginPasswordChange !== 'false'}
                    onChange={e => set('forceFirstLoginPasswordChange', String(e.target.checked))}
                  />
                  <div className="space-y-1">
                    <span className="block font-inter font-semibold text-sm text-text-primary">
                      Force First-Login Password Change
                    </span>
                    <span className="block font-inter text-xs text-text-secondary leading-relaxed">
                      Require new students, teachers, and admins to replace their temporary or default password upon their very first sign-in before accessing portals.
                    </span>
                  </div>
                </label>

                <div>
                  <label className="block text-xs font-inter font-medium text-text-primary mb-1">
                    Maximum Failed Login Attempts
                  </label>
                  <p className="text-xs text-text-secondary font-inter mb-1.5">
                    Number of consecutive incorrect password attempts before the account is temporarily locked.
                  </p>
                  <Input
                    className="w-full"
                    type="number"
                    placeholder="5"
                    value={form.maxLoginAttempts || ''}
                    onChange={e => set('maxLoginAttempts', e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-inter font-medium text-text-primary mb-1">
                    Temporary Lockout Duration (Minutes)
                  </label>
                  <p className="text-xs text-text-secondary font-inter mb-1.5">
                    Duration in minutes an account remains locked after reaching max failed attempts.
                  </p>
                  <Input
                    className="w-full"
                    type="number"
                    placeholder="15"
                    value={form.lockoutDuration || ''}
                    onChange={e => set('lockoutDuration', e.target.value)}
                  />
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <Button
                    onClick={saveGeneric}
                    loading={saveMutation.isPending}
                    icon={<Save className="w-4 h-4" />}
                  >
                    Save Security Settings
                  </Button>
                  <Button variant="ghost" onClick={() => selectSection(null)}>
                    Return
                  </Button>
                </div>
              </div>
            </section>
          )}

          {/* ── 5. Data Management Container ── */}
          {activeSection === 'database' && (
            <section className="bg-white border border-border rounded-2xl p-6 shadow-sm space-y-6">
              <div className="flex items-center gap-3 pb-5 border-b border-border">
                <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 flex-shrink-0">
                  <HardDrive className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold font-inter text-text-primary">Data Management & Backups</h2>
                  <p className="text-text-secondary font-inter text-xs mt-0.5">
                    Export full system data backups, restore previous databases, or reset demo dataset.
                  </p>
                </div>
              </div>

              <div className="space-y-6 max-w-3xl">
                <div className="p-4 bg-gray-50 border border-border rounded-xl space-y-3">
                  <h3 className="font-semibold text-sm text-text-primary font-inter">Export Database Backup</h3>
                  <p className="text-xs text-text-secondary font-inter leading-relaxed">
                    Downloads a complete, unencrypted JSON snapshot containing all student records, teacher profiles, sections, subjects, announcements, and settings.
                  </p>
                  <Button
                    variant="secondary"
                    icon={<Download className="w-4 h-4" />}
                    onClick={downloadBackup}
                  >
                    Export Database (.json)
                  </Button>
                </div>

                <div className="p-4 bg-gray-50 border border-border rounded-xl space-y-3">
                  <h3 className="font-semibold text-sm text-text-primary font-inter">Restore Database Snapshot</h3>
                  <p className="text-xs text-text-secondary font-inter leading-relaxed">
                    Restore the entire system state from a previously exported SmartClass JSON backup file. Existing records will be replaced.
                  </p>
                  <input
                    ref={backupRef}
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={e => e.target.files?.[0] && importMutation.mutate(e.target.files[0])}
                  />
                  <Button
                    variant="secondary"
                    icon={<Upload className="w-4 h-4" />}
                    onClick={() => backupRef.current?.click()}
                    loading={importMutation.isPending}
                  >
                    Import & Restore Backup
                  </Button>
                </div>

                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-3">
                  <h3 className="font-semibold text-sm text-danger font-inter">Reset to Default Demo Data</h3>
                  <p className="text-xs text-rose-800 font-inter leading-relaxed">
                    Replaces all current database tables with the original Exequiel R. Lina High School seed data. This action cannot be undone unless you export a backup first.
                  </p>
                  <Button
                    variant="danger"
                    icon={<RotateCcw className="w-4 h-4" />}
                    loading={resetMutation.isPending}
                    onClick={() => {
                      if (window.confirm('Are you sure you want to reset all data to the original demo dataset? This cannot be undone.')) {
                        resetMutation.mutate()
                      }
                    }}
                  >
                    Reset Demo Dataset
                  </Button>
                </div>
              </div>
            </section>
          )}

          {/* ── 6. Administrator Account Container ── */}
          {activeSection === 'account' && (
            <section className="bg-white border border-border rounded-2xl p-6 shadow-sm space-y-6">
              <div className="flex items-center gap-3 pb-5 border-b border-border">
                <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center text-rose-600 flex-shrink-0">
                  <UserCog className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold font-inter text-text-primary">Administrator Account Credentials</h2>
                  <p className="text-text-secondary font-inter text-xs mt-0.5">
                    Update the primary admin username or password. Your current password is required for verification.
                  </p>
                </div>
              </div>

              <div className="space-y-5 max-w-3xl">
                <div>
                  <label className="block text-xs font-inter font-medium text-text-primary mb-1.5">
                    New Admin Username
                  </label>
                  <Input
                    className="w-full"
                    placeholder="Leave blank to keep current username"
                    value={adminForm.username}
                    onChange={e => setAdminForm(p => ({ ...p, username: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-xs font-inter font-medium text-text-primary mb-1.5">
                    Current Password <span className="text-danger">*</span>
                  </label>
                  <Input
                    className="w-full"
                    type="password"
                    placeholder="Enter current password to authorize changes"
                    value={adminForm.currentPassword}
                    onChange={e => setAdminForm(p => ({ ...p, currentPassword: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-xs font-inter font-medium text-text-primary mb-1.5">
                    New Password
                  </label>
                  <Input
                    className="w-full"
                    type="password"
                    placeholder="Leave blank to keep current password"
                    value={adminForm.newPassword}
                    onChange={e => setAdminForm(p => ({ ...p, newPassword: e.target.value }))}
                  />
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <Button
                    onClick={() => {
                      setError('')
                      setMessage('')
                      if (!adminForm.currentPassword) { setError('Current password is required.'); return }
                      if (adminForm.newPassword) {
                        const passwordResult = validatePassword(adminForm.newPassword)
                        if (!passwordResult.valid) { setError(passwordResult.error || 'Invalid password.'); return }
                      }
                      accountMutation.mutate()
                    }}
                    loading={accountMutation.isPending}
                    icon={<KeyRound className="w-4 h-4" />}
                  >
                    Update Admin Credentials
                  </Button>
                  <Button variant="ghost" onClick={() => selectSection(null)}>
                    Return
                  </Button>
                </div>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
