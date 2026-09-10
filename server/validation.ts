import { z } from 'zod'

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(128, 'Password must not exceed 128 characters.')
  .refine(value => /[A-Z]/.test(value), 'Password must contain at least one uppercase letter.')
  .refine(value => /[a-z]/.test(value), 'Password must contain at least one lowercase letter.')
  .refine(value => /\d/.test(value), 'Password must contain at least one number.')
  .refine(value => /[^A-Za-z0-9]/.test(value), 'Password must contain at least one special character.')

export const nameSchema = (label = 'Name') => z
  .string()
  .trim()
  .min(2, `${label} must be at least 2 characters.`)
  .max(100, `${label} must not exceed 100 characters.`)
  .regex(/^[A-Za-zÀ-ÖØ-öø-ÿ\s.'’,-]+$/, `${label} contains invalid characters.`)

export const emailSchema = z
  .string()
  .trim()
  .email('Please enter a valid email address.')
  .max(254, 'Email address is too long.')

export const studentNumberSchema = z
  .string()
  .trim()
  .min(4, 'Student number must be at least 4 characters.')
  .max(25, 'Student number must not exceed 25 characters.')
  .regex(/^[A-Za-z0-9_-]+$/, 'Student number contains invalid characters.')

export const employeeIdSchema = z
  .string()
  .trim()
  .min(3, 'Employee ID must be at least 3 characters.')
  .max(25, 'Employee ID must not exceed 25 characters.')
  .regex(/^[A-Za-z0-9_-]+$/, 'Employee ID contains invalid characters.')

export const optionalPhoneSchema = z
  .string()
  .trim()
  .max(20, 'Phone number is too long.')
  .refine(value => {
    if (!value) return true
    const digits = value.replace(/\D/g, '')
    if (value.startsWith('+63')) return /^63\d{10}$/.test(digits)
    return /^09\d{9}$/.test(digits)
  }, 'Use an 11-digit Philippine mobile number (09XXXXXXXXX) or +63 9XX XXX XXXX.')
  .optional()

export const optionalDateSchema = (label = 'Date') => z
  .string()
  .trim()
  .refine(value => {
    if (!value) return true
    const date = new Date(value)
    return !Number.isNaN(date.getTime())
  }, `${label} is invalid.`)
  .refine(value => {
    if (!value) return true
    return new Date(value) <= new Date()
  }, `${label} cannot be in the future.`)
  .refine(value => {
    if (!value) return true
    const date = new Date(value)
    const age = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24 * 365.2425)
    return age <= 110 && age >= 2
  }, `${label} must represent an age between 2 and 110 years.`)
  .optional()

export const optionalText = (label: string, max: number) => z
  .string()
  .trim()
  .max(max, `${label} must not exceed ${max} characters.`)
  .optional()

export const optionalMeasurement = (label: string, min: number, max: number) => z.preprocess(
  value => value === '' || value === null || value === undefined ? null : Number(value),
  z.number().finite().min(min, `${label} must be at least ${min}.`).max(max, `${label} must not exceed ${max}.`).nullable().optional(),
)

export const scheduleDaySchema = z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'])
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must use HH:mm format.')
export const colorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a 6-digit hexadecimal value.')

export function validateScheduleTimes(startTime?: string, endTime?: string) {
  if (!startTime || !endTime) return null
  return startTime >= endTime ? 'Start time must be earlier than end time.' : null
}
