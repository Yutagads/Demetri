import React from 'react'
import { InboxIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

interface EmptyStateProps {
  title: string
  description?: string
  icon?: React.ReactNode
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-4 text-center', className)}>
      <div className="w-16 h-16 bg-primary-light rounded-full flex items-center justify-center mb-4">
        {icon || <InboxIcon className="w-8 h-8 text-primary" />}
      </div>
      <h3 className="text-subheading font-poppins font-semibold text-text-primary mb-2">{title}</h3>
      {description && <p className="text-sm text-text-secondary font-inter max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center py-16', className)}>
      <div className="w-8 h-8 border-4 border-primary-light border-t-primary rounded-full animate-spin" />
    </div>
  )
}
