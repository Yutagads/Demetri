import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date, fmt = 'MMM d, yyyy') {
  return format(new Date(date), fmt)
}

export function formatTime(date: string | Date) {
  return format(new Date(date), 'h:mm a')
}

export function formatDateTime(date: string | Date) {
  return format(new Date(date), 'MMM d, yyyy h:mm a')
}

export function timeAgo(date: string | Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

export function getRoleBadgeColor(role: string) {
  switch (role) {
    case 'ADMIN': return 'bg-accent/10 text-accent'
    case 'TEACHER': return 'bg-info/10 text-info'
    case 'STUDENT': return 'bg-primary/10 text-primary'
    default: return 'bg-border text-text-secondary'
  }
}

export function getStatusColor(status: string) {
  switch (status) {
    case 'active': return 'bg-success/10 text-success'
    case 'inactive': return 'bg-warning/10 text-warning'
    case 'archived': return 'bg-danger/10 text-danger'
    default: return 'bg-border text-text-secondary'
  }
}

export function computeBMI(height: number, weight: number) {
  const h = height / 100
  return +(weight / (h * h)).toFixed(1)
}

export function getBMIClassification(bmi: number) {
  if (bmi < 18.5) return 'Underweight'
  if (bmi < 25) return 'Normal'
  if (bmi < 30) return 'Overweight'
  return 'Obese'
}

export function calculatePerformance(scores: { scoreObtained: number; totalScore: number }[]) {
  if (!scores.length) return { completed: 0, totalEarned: 0, totalPossible: 0, percentage: 0 }
  const totalEarned = scores.reduce((s, r) => s + r.scoreObtained, 0)
  const totalPossible = scores.reduce((s, r) => s + r.totalScore, 0)
  const percentage = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0
  return { completed: scores.length, totalEarned, totalPossible, percentage }
}
