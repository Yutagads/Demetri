import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, GraduationCap } from 'lucide-react'

interface ToolLayoutProps {
  title: string
  subtitle?: string
  icon: React.ReactNode
  children: React.ReactNode
  actions?: React.ReactNode
  fullHeight?: boolean
}

export default function ToolLayout({ title, subtitle, icon, children, actions, fullHeight }: ToolLayoutProps) {
  const navigate = useNavigate()

  return (
    <div className={`min-h-screen bg-gray-50 flex flex-col select-none ${fullHeight ? 'h-screen overflow-hidden' : ''}`}>
      {/* Header */}
      <header className="flex items-center gap-3 px-4 sm:px-6 py-3 sm:py-4 bg-primary-dark border-b border-white/10 flex-shrink-0">
        <button
          onClick={() => navigate('/')}
          className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0"
          aria-label="Back to home"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
          <span className="text-white">{icon}</span>
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-white font-poppins font-bold text-base sm:text-lg leading-none truncate">{title}</h1>
          {subtitle && <p className="text-white/50 font-inter text-xs mt-0.5 truncate">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {actions}
          <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-white/20">
            <GraduationCap className="w-4 h-4 text-white/30" />
            <span className="text-white/30 font-inter text-xs">SMARTCLASS</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className={fullHeight ? 'flex-1 overflow-hidden flex flex-col min-h-0' : 'flex-1'}>
        {children}
      </div>
    </div>
  )
}
