import React from 'react'
import { cn, getInitials } from '../../lib/utils'

interface AvatarProps {
  name: string
  src?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-base',
    xl: 'w-20 h-20 text-xl',
  }

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn('rounded-full object-cover bg-primary-light', sizes[size], className)}
      />
    )
  }

  return (
    <div
      className={cn(
        'rounded-full bg-primary text-white flex items-center justify-center font-poppins font-semibold flex-shrink-0',
        sizes[size],
        className
      )}
    >
      {getInitials(name)}
    </div>
  )
}
