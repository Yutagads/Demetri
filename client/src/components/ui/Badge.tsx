import React from 'react'
import { cn } from '../../lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'accent'
  className?: string
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  const variants = {
    default: 'bg-border/50 text-text-secondary',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-yellow-700',
    danger: 'bg-danger/10 text-danger',
    info: 'bg-info/10 text-info',
    primary: 'bg-primary/10 text-primary-dark',
    accent: 'bg-accent/10 text-accent',
  }
  return (
    <span className={cn('badge', variants[variant], className)}>
      {children}
    </span>
  )
}

export function AttendanceBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: any }> = {
    present: { label: 'Present', variant: 'success' },
    absent: { label: 'Absent', variant: 'danger' },
    late: { label: 'Late', variant: 'warning' },
    excused: { label: 'Excused', variant: 'info' },
  }
  const { label, variant } = map[status] || { label: status, variant: 'default' }
  return <Badge variant={variant}>{label}</Badge>
}
