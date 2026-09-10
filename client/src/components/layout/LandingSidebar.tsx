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
          open ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0',
        )}
      >
        <div className="ml-4 pl-3 pr-2 pb-2 border-l border-white/10">
          <p className="px-3 pt-1 pb-3 text-white/45 font-inter text-xs leading-relaxed">
            {enabled
              ? 'Kiosk mode is on for this browser. Touch keyboards will be available when needed.'
              : 'Use a touch-friendly layout with an on-screen keyboard for this device.'}
          </p>
          <KioskSlider enabled={enabled} onToggle={onToggleMode} />
        </div>
      </div>
    </div>
  )
}

function KioskSlider({
  enabled,
  onToggle,
}: {
  enabled: boolean
  onToggle: () => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [maxSlide, setMaxSlide] = useState(160)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState<number | null>(null)
  const startXRef = useRef<number>(0)
  const hasMovedRef = useRef<boolean>(false)

  // Measure track width accurately
  useEffect(() => {
    if (!trackRef.current) return
    const updateWidth = () => {
      if (trackRef.current) {
        const width = trackRef.current.clientWidth
        // 34px handle + 8px horizontal padding (4px each side)
        setMaxSlide(Math.max(20, width - 34 - 8))
      }
    }
    updateWidth()

    const observer = new ResizeObserver(updateWidth)
    observer.observe(trackRef.current)
    return () => observer.disconnect()
  }, [])

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
    startXRef.current = e.clientX
    hasMovedRef.current = false
    setDragOffset(0)
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !trackRef.current) return
    const deltaX = e.clientX - startXRef.current
    if (Math.abs(deltaX) > 3) {
      hasMovedRef.current = true
    }

    if (enabled) {
      // Starting at maxSlide (right), dragging left deltaX is negative
      const clamped = Math.max(-maxSlide, Math.min(0, deltaX))
      setDragOffset(clamped)
    } else {
      // Starting at 0 (left), dragging right deltaX is positive
      const clamped = Math.max(0, Math.min(maxSlide, deltaX))
      setDragOffset(clamped)
    }
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return
    setIsDragging(false)
    try {
      ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
    } catch {
      // ignore
    }

    const currentOffset = dragOffset ?? 0

    if (!hasMovedRef.current) {
      // Tap / click toggle
      onToggle()
    } else if (enabled) {
      // If dragged > 30% to the left, turn off
      if (Math.abs(currentOffset) > maxSlide * 0.3) {
        onToggle()
      }
    } else {
      // If dragged > 30% to the right, turn on
      if (currentOffset > maxSlide * 0.3) {
        onToggle()
      }
    }

    setDragOffset(null)
  }

  // Calculate current translation in px
  let knobX = enabled ? maxSlide : 0
  if (isDragging && dragOffset !== null) {
    knobX = enabled ? Math.max(0, Math.min(maxSlide, maxSlide + dragOffset)) : Math.max(0, Math.min(maxSlide, dragOffset))
  }

  return (
    <div
      ref={trackRef}
      role="switch"
      aria-checked={enabled}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onToggle()
        }
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        setIsDragging(false)
        setDragOffset(null)
      }}
      className={cn(
        'relative flex items-center w-full h-11 p-1 rounded-full cursor-pointer select-none touch-none border transition-colors duration-300 group',
        enabled
          ? 'bg-gradient-to-r from-emerald-600 to-teal-500 border-emerald-400/40 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
          : 'bg-slate-900/90 hover:bg-slate-800/90 border-white/15 hover:border-white/25 shadow-inner'
      )}
    >
      {/* Background Track Label */}
      <div
        className={cn(
          'w-full flex items-center justify-center px-4 text-xs font-poppins font-semibold transition-all duration-300 pointer-events-none',
          enabled ? 'text-white' : 'text-white/70 group-hover:text-white'
        )}
      >
        <span className={cn('transition-all duration-300', enabled ? 'pr-7' : 'pl-7')}>
          {enabled ? 'Turn off kiosk mode' : 'Turn on kiosk mode'}
        </span>
      </div>

      {/* Sliding Knob with ">" icon */}
      <div
        style={{
          transform: `translateX(${knobX}px)`,
          transition: isDragging ? 'none' : 'transform 320ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className={cn(
          'absolute left-1 top-1 w-[34px] h-[34px] rounded-full flex items-center justify-center shadow-md',
          enabled
            ? 'bg-white text-emerald-700 ring-2 ring-emerald-300/60 shadow-[0_2px_10px_rgba(0,0,0,0.3)]'
            : 'bg-white text-slate-800 ring-2 ring-white/80 shadow-[0_2px_8px_rgba(0,0,0,0.4)]',
          isDragging ? 'scale-105 shadow-xl cursor-grabbing' : 'group-hover:scale-102 cursor-grab'
        )}
      >
        <ChevronRight
          className={cn(
            'w-4 h-4 transition-transform duration-300',
            enabled ? 'text-emerald-600' : 'text-slate-800'
          )}
        />
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
