import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X, LogIn, Heart, ChevronDown, GraduationCap,
  PenLine, LayoutTemplate, Calculator,
  LayoutDashboard, LogOut, User, ChevronRight,
  Activity, Droplets, Moon, Sparkles, Monitor,
} from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { setKioskMode, useKioskMode } from '../../lib/kiosk'
import { cn } from '../../lib/utils'
import smartclassLogo from '../../assets/smartclass-logo.png'

interface LandingSidebarProps {
  open: boolean
  onClose: () => void
}

const ROLE_DASHBOARD: Record<string, string> = {
  ADMIN: '/admin/dashboard',
  TEACHER: '/teacher/dashboard',
  STUDENT: '/student/dashboard',
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Administrator',
  TEACHER: 'Teacher',
  STUDENT: 'Student',
}

const ROLE_COLOR: Record<string, string> = {
  ADMIN:   'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  TEACHER: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  STUDENT: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
}

export default function LandingSidebar({ open, onClose }: LandingSidebarProps) {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const kioskMode = useKioskMode()
  const [learningOpen, setLearningOpen] = useState(false)
  const [healthOpen, setHealthOpen]     = useState(false)
  const [kioskOpen, setKioskOpen]       = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const goTo = (path: string) => { onClose(); navigate(path) }
  const handleLogout = async () => { onClose(); await logout() }

  const healthItems = [
    { label: 'Health Tips',  icon: <Heart    className="w-4 h-4" />, path: '/health?tab=tips',  color: 'text-rose-400'   },
    { label: 'BMI',          icon: <Activity className="w-4 h-4" />, path: '/health?tab=bmi',   color: 'text-orange-400' },
    { label: 'Water Intake', icon: <Droplets className="w-4 h-4" />, path: '/health?tab=water', color: 'text-sky-400'    },
    { label: 'Sleep',        icon: <Moon     className="w-4 h-4" />, path: '/health?tab=sleep', color: 'text-violet-400' },
  ]

  const learningItems = [
    { label: 'SMARTBOARD',             icon: <PenLine        className="w-4 h-4" />, path: '/smartboard', color: 'text-emerald-400' },
    { label: 'Canvas Mode',            icon: <LayoutTemplate className="w-4 h-4" />, path: '/canvas',     color: 'text-blue-400'    },
    { label: 'Formula / Graph Finder', icon: <Calculator     className="w-4 h-4" />, path: '/formula',    color: 'text-amber-400'   },
  ]

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 backdrop-blur-md transition-opacity duration-300',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        ref={sidebarRef}
        role="dialog"
        aria-modal="true"
        aria-label="SMARTCLASS Menu"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col',
          'w-72 sm:w-80',
          'transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        style={{
          background: 'linear-gradient(160deg, #1a3d1c 0%, #1e3320 40%, #141f15 100%)',
          boxShadow: '8px 0 40px rgba(0,0,0,0.4)',
        }}
      >
        {/* Decorative top glow */}
        <div
          className="absolute top-0 left-0 right-0 h-40 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 50% 0%, rgba(78,125,75,0.35) 0%, transparent 70%)',
          }}
        />

        {/* ── Header ── */}
        <div className="relative flex items-center gap-3 px-5 py-5 border-b border-white/10 flex-shrink-0">
          <img
            src={smartclassLogo}
            alt="SMARTCLASS Logo"
            className="w-11 h-11 object-contain flex-shrink-0 drop-shadow-lg"
          />
          <div className="flex-1 min-w-0">
            <p
              className="font-poppins font-black text-lg leading-none tracking-widest"
              style={{
                background: 'linear-gradient(135deg, #6fcf6b 0%, #C89A2B 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              SMARTCLASS
            </p>
            <p className="text-white/35 font-inter text-[11px] mt-1 leading-none tracking-wider uppercase">
              ERLHS · Navigation
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-white/30 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all touch-manipulation"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="relative flex-1 overflow-y-auto py-4 px-3 space-y-1">

          {/* Login / User section */}
          {!user ? (
            <NavButton
              icon={<LogIn className="w-4.5 h-4.5" />}
              iconBg="bg-primary/20"
              iconColor="text-emerald-400"
              label="Sign In"
              onClick={() => goTo('/login')}
              suffix={<ChevronRight className="w-4 h-4 text-white/25" />}
            />
          ) : (
            <div className="rounded-2xl overflow-hidden mb-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/10">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #4E7D4B, #2F5D34)' }}
                >
                  <User className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-poppins font-semibold text-sm leading-none truncate">{user.name}</p>
                  <span className={cn('inline-block text-[10px] px-2 py-0.5 rounded-full font-inter mt-1.5 leading-none font-medium', ROLE_COLOR[user.role] || 'bg-white/15 text-white/60')}>
                    {ROLE_LABEL[user.role] || user.role}
                  </span>
                </div>
              </div>
              <button
                onClick={() => goTo(ROLE_DASHBOARD[user.role] || '/')}
                className="flex items-center gap-3 w-full px-4 py-3 text-sm text-white/65 hover:bg-white/8 hover:text-white font-inter transition-colors touch-manipulation"
              >
                <LayoutDashboard className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                Go to Dashboard
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full px-4 py-3 text-sm text-rose-400/80 hover:bg-rose-500/10 hover:text-rose-300 font-inter transition-colors touch-manipulation border-t border-white/8"
              >
                <LogOut className="w-4 h-4 flex-shrink-0" />
                Sign Out
              </button>
            </div>
          )}

          {/* Section label */}
          <p className="px-3 pt-2 pb-1 text-white/25 font-inter text-[10px] uppercase tracking-widest font-medium">
            Features
          </p>

          {/* Kiosk mode */}
          <KioskNav
            open={kioskOpen}
            onToggle={() => setKioskOpen(o => !o)}
            enabled={kioskMode}
            onToggleMode={() => {
              const nextEnabled = !kioskMode
              setKioskMode(nextEnabled)
              if (nextEnabled) {
                document.documentElement.requestFullscreen?.().catch(() => {})
              } else if (document.fullscreenElement) {
                document.exitFullscreen?.().catch(() => {})
              }
              onClose()
            }}
          />

          {/* Health dropdown */}
          <CollapsibleNav
            icon={<Heart className="w-4 h-4" />}
            iconColor="text-rose-400"
            iconBg="bg-rose-500/15"
            label="Wellness"
            open={healthOpen}
            onToggle={() => setHealthOpen(o => !o)}
          >
            {healthItems.map(item => (
              <SubNavButton
                key={item.path}
                icon={item.icon}
                iconColor={item.color}
                label={item.label}
                onClick={() => goTo(item.path)}
              />
            ))}
          </CollapsibleNav>

          {/* Interactive Learning dropdown */}
          <CollapsibleNav
            icon={<Sparkles className="w-4 h-4" />}
            iconColor="text-amber-400"
            iconBg="bg-amber-500/15"
            label="Interactive Learning"
            open={learningOpen}
            onToggle={() => setLearningOpen(o => !o)}
          >
            {learningItems.map(item => (
              <SubNavButton
                key={item.path}
                icon={item.icon}
                iconColor={item.color}
                label={item.label}
                onClick={() => goTo(item.path)}
              />
            ))}
          </CollapsibleNav>
        </div>

        {/* ── Footer ── */}
        <div className="relative px-5 py-4 border-t border-white/8 flex-shrink-0">
          <p className="text-white/20 font-inter text-[10px] text-center tracking-widest uppercase">
            SMARTCLASS · Exequiel R. Lina High School
          </p>
        </div>
      </aside>
    </>
  )
}

/* ── Shared sub-components ─────────────────────────────────────────────────── */

function KioskNav({
  open, onToggle, enabled, onToggleMode,
}: {
  open: boolean
  onToggle: () => void
  enabled: boolean
  onToggleMode: () => void
}) {
  return (
    <div className="mb-1">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="flex items-center gap-3 w-full px-3 py-3 rounded-2xl text-white/75 hover:bg-white/8 hover:text-white font-poppins font-semibold text-sm transition-all touch-manipulation group"
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-emerald-500/15 text-emerald-300 transition-colors">
          <Monitor className="w-4 h-4" />
        </div>
        <span className="flex-1 text-left">Kiosk Mode</span>
        <ChevronDown className={cn(
          'w-4 h-4 text-white/30 transition-transform duration-200',
          open ? 'rotate-180 text-emerald-300' : '',
        )} />
      </button>

      <div
        className={cn(
          'overflow-hidden transition-all duration-200 ease-in-out',
          open ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0',
        )}
      >
        <div className="ml-4 pl-3 pr-2 pb-2 border-l border-white/10">
          <p className="px-3 pt-1 pb-3 text-white/45 font-inter text-xs leading-relaxed">
            {enabled
              ? 'Kiosk mode is on for this browser. Touch keyboards will be available when needed.'
              : 'Use a touch-friendly layout with an on-screen keyboard for this device.'}
          </p>
          <button
            type="button"
            onClick={onToggleMode}
            className="group/cta flex items-center justify-between gap-3 w-full rounded-full bg-blue-500 px-3 py-1.5 text-left text-xs font-poppins font-semibold text-white transition-all duration-200 hover:bg-blue-400 hover:shadow-[0_4px_16px_rgba(59,130,246,0.3)] active:scale-[0.98]"
          >
            <span>{enabled ? 'Turn off kiosk mode' : 'Turn on kiosk mode'}</span>
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-white/80 bg-slate-950/15 transition-transform duration-200 group-hover/cta:translate-x-0.5">
              <ChevronRight className="h-3.5 w-3.5" />
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

function NavButton({
  icon, iconBg, iconColor, label, onClick, suffix,
}: {
  icon: React.ReactNode
  iconBg?: string
  iconColor?: string
  label: string
  onClick: () => void
  suffix?: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full px-3 py-3 rounded-2xl text-white/75 hover:bg-white/8 hover:text-white font-poppins font-semibold text-sm transition-all touch-manipulation group"
    >
      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors', iconBg ?? 'bg-white/10', iconColor ?? 'text-white/60')}>
        {icon}
      </div>
      <span className="flex-1 text-left">{label}</span>
      {suffix}
    </button>
  )
}

function CollapsibleNav({
  icon, iconBg, iconColor, label, open, onToggle, children,
}: {
  icon: React.ReactNode
  iconBg?: string
  iconColor?: string
  label: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="flex items-center gap-3 w-full px-3 py-3 rounded-2xl text-white/75 hover:bg-white/8 hover:text-white font-poppins font-semibold text-sm transition-all touch-manipulation group"
      >
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors', iconBg ?? 'bg-white/10', iconColor ?? 'text-white/60')}>
          {icon}
        </div>
        <span className="flex-1 text-left">{label}</span>
        <ChevronDown className={cn('w-4 h-4 text-white/30 transition-transform duration-200', open ? 'rotate-180' : '')} />
      </button>

      <div
        className={cn(
          'overflow-hidden transition-all duration-200 ease-in-out',
          open ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="mt-0.5 ml-4 pl-3 border-l border-white/10 space-y-0.5 pb-1">
          {children}
        </div>
      </div>
    </div>
  )
}

function SubNavButton({
  icon, iconColor, label, onClick,
}: {
  icon: React.ReactNode
  iconColor?: string
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-white/55 hover:bg-white/8 hover:text-white font-inter font-medium text-sm transition-all touch-manipulation group"
    >
      <span className={cn('flex-shrink-0 transition-colors', iconColor ?? 'text-white/35')}>
        {icon}
      </span>
      <span>{label}</span>
    </button>
  )
}
