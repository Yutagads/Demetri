import React from 'react'
import { cn } from '../../lib/utils'
import { Loader2 } from 'lucide-react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'accent' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: React.ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-2 font-poppins font-medium rounded-xl transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2'

  const variants = {
    primary: 'bg-primary hover:bg-primary-dark text-white focus:ring-primary',
    secondary: 'bg-surface hover:bg-primary-light text-primary border border-border focus:ring-primary',
    danger: 'bg-danger hover:bg-red-700 text-white focus:ring-danger',
    accent: 'bg-accent hover:bg-orange-600 text-white focus:ring-accent',
    ghost: 'bg-transparent hover:bg-primary-light text-primary focus:ring-primary',
  }

  const sizes = {
    sm: 'text-sm px-3 py-2',
    md: 'text-nav px-5 py-2.5',
    lg: 'text-nav px-7 py-3.5',
  }

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {children}
    </button>
  )
}
