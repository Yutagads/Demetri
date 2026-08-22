/**
 * Validation and formatting utilities for Philippine SmartClass system
 */

export interface ValidationResult {
  valid: boolean
  error?: string
  hint?: string
}

/**
 * Format a Philippine phone number as the user types.
 * Standard format: +63 9XX XXX XXXX (10 digits after +63)
 */
export function formatPhilippinePhone(input: string): string {
  if (!input) return ''
  
  // Clean all characters except digits and plus
  let cleaned = input.trim()
  
  // If it starts with +63, remove the prefix to get the raw numbers
  if (cleaned.startsWith('+63')) {
    cleaned = cleaned.substring(3)
  } else if (cleaned.startsWith('63') && cleaned.length > 2) {
    cleaned = cleaned.substring(2)
  }

  // Extract only digits
  let digits = cleaned.replace(/\D/g, '')

  // If user typed leading 0 (e.g. 0917...), remove it since +63 replaces 0
  if (digits.startsWith('0')) {
    digits = digits.substring(1)
  }

  // Limit to 10 digits (Philippine mobile standard after country code)
  digits = digits.substring(0, 10)

  if (digits.length === 0) {
    return '+63 '
  }

  // Format as +63 XXX XXX XXXX
  let formatted = '+63 '
  if (digits.length <= 3) {
    formatted += digits
  } else if (digits.length <= 6) {
    formatted += `${digits.slice(0, 3)} ${digits.slice(3)}`
  } else {
    formatted += `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`
  }

  return formatted
}

/**
 * Extract raw digits after +63
 */
export function getPhoneDigits(phone: string): string {
  if (!phone) return ''
  let cleaned = phone.trim()
  if (cleaned.startsWith('+63')) cleaned = cleaned.substring(3)
  else if (cleaned.startsWith('63')) cleaned = cleaned.substring(2)
  let digits = cleaned.replace(/\D/g, '')
  if (digits.startsWith('0')) digits = digits.substring(1)
  return digits
}

/**
 * Validate a Philippine phone number.
 * Must follow +63 9XX XXX XXXX (10 digits, mobile starts with 9).
 */
export function validatePhilippinePhone(phone: string, required = false): ValidationResult {
  const trimmed = (phone || '').trim()
  const digits = getPhoneDigits(trimmed)

  if (!trimmed || trimmed === '+63' || trimmed === '+63 ') {
    if (required) {
      return { valid: false, error: 'Phone number is required (+63 9XX XXX XXXX)' }
    }
    return { valid: true }
  }

  if (digits.length === 0) {
    return { valid: false, error: 'Please enter phone digits after +63' }
  }

  if (!digits.startsWith('9')) {
    return {
      valid: false,
      error: 'PH mobile numbers must start with 9 after +63 (e.g. +63 9XX XXX XXXX)',
    }
  }

  if (digits.length < 10) {
    return {
      valid: false,
      error: `Incomplete number: 10 digits required after +63 (${digits.length}/10 entered)`,
    }
  }

  if (digits.length === 10) {
    return { valid: true, hint: 'Valid Philippine mobile number' }
  }

  return { valid: false, error: 'Too many digits. Standard PH number has 10 digits after +63' }
}

/**
 * Standard Email format validation
 */
export function validateEmail(email: string, required = false): ValidationResult {
  const trimmed = (email || '').trim()

  if (!trimmed) {
    if (required) return { valid: false, error: 'Email address is required' }
    return { valid: true }
  }

  // RFC 5322 standard compliant regex for web forms
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

  if (!emailRegex.test(trimmed)) {
    if (!trimmed.includes('@')) {
      return { valid: false, error: 'Email must contain an "@" symbol (e.g. name@domain.com)' }
    }
    const parts = trimmed.split('@')
    if (!parts[1] || !parts[1].includes('.')) {
      return { valid: false, error: 'Email domain is missing a dot extension (e.g. .com, .edu.ph)' }
    }
    return { valid: false, error: 'Invalid email formatting (e.g. student@school.edu.ph)' }
  }

  return { valid: true, hint: 'Valid email address' }
}

/**
 * Validate Full Name (letters, spaces, hyphens, periods, apostrophes, min 2 chars)
 */
export function validateFullName(name: string, label = 'Full Name', required = true): ValidationResult {
  const trimmed = (name || '').trim()

  if (!trimmed) {
    if (required) return { valid: false, error: `${label} is required` }
    return { valid: true }
  }

  if (trimmed.length < 2) {
    return { valid: false, error: `${label} must be at least 2 characters long` }
  }

  // Check for allowed characters: letters, spaces, hyphens, dots, apostrophes, commas
  const nameRegex = /^[a-zA-Z\u00C0-\u024F\s.\-,'’]+$/
  if (!nameRegex.test(trimmed)) {
    return { valid: false, error: `${label} can only contain letters, spaces, hyphens, and periods` }
  }

  return { valid: true }
}

/**
 * Validate Student Number (e.g. 2024-00001 or alphanumeric with dashes)
 */
export function validateStudentNumber(num: string, required = true): ValidationResult {
  const trimmed = (num || '').trim()

  if (!trimmed) {
    if (required) return { valid: false, error: 'Student number is required' }
    return { valid: true }
  }

  if (trimmed.length < 4 || trimmed.length > 25) {
    return { valid: false, error: 'Student number must be between 4 and 25 characters' }
  }

  const validRegex = /^[a-zA-Z0-9\-_/]+$/
  if (!validRegex.test(trimmed)) {
    return { valid: false, error: 'Student number contains invalid characters' }
  }

  return { valid: true }
}

/**
 * Validate Employee ID
 */
export function validateEmployeeId(id: string, required = false): ValidationResult {
  const trimmed = (id || '').trim()

  if (!trimmed) {
    if (required) return { valid: false, error: 'Employee ID is required' }
    return { valid: true }
  }

  if (trimmed.length < 3 || trimmed.length > 25) {
    return { valid: false, error: 'Employee ID must be between 3 and 25 characters' }
  }

  const validRegex = /^[a-zA-Z0-9\-_/]+$/
  if (!validRegex.test(trimmed)) {
    return { valid: false, error: 'Employee ID contains invalid characters' }
  }

  return { valid: true }
}

/**
 * Validate Birth Date (not in future, reasonable age range 3 to 100)
 */
export function validateBirthDate(dateStr: string, required = false): ValidationResult {
  const trimmed = (dateStr || '').trim()

  if (!trimmed) {
    if (required) return { valid: false, error: 'Birth date is required' }
    return { valid: true }
  }

  const birthDate = new Date(trimmed)
  if (isNaN(birthDate.getTime())) {
    return { valid: false, error: 'Invalid date format' }
  }

  const now = new Date()
  if (birthDate > now) {
    return { valid: false, error: 'Birth date cannot be in the future' }
  }

  const ageYears = (now.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
  if (ageYears < 2) {
    return { valid: false, error: 'Birth date indicates an age under 2 years old' }
  }
  if (ageYears > 110) {
    return { valid: false, error: 'Birth date indicates an age over 110 years old' }
  }

  return { valid: true }
}

/**
 * Validate numeric measure (weight / height)
 */
export function validateMeasurement(val: string | number, label: string, min: number, max: number, unit: string): ValidationResult {
  if (val === '' || val == null) return { valid: true }
  const num = Number(val)
  if (isNaN(num)) {
    return { valid: false, error: `${label} must be a valid number` }
  }
  if (num < min || num > max) {
    return { valid: false, error: `${label} must be between ${min} and ${max} ${unit}` }
  }
  return { valid: true }
}

/** Strong password policy shared by password-change UI. */
export function validatePassword(password: string, required = true): ValidationResult {
  const value = password || ''
  if (!value) return required ? { valid: false, error: 'Password is required' } : { valid: true }
  if (value.length < 8) return { valid: false, error: 'Password must be at least 8 characters long' }
  if (value.length > 128) return { valid: false, error: 'Password must not exceed 128 characters' }
  if (!/[A-Z]/.test(value)) return { valid: false, error: 'Password must contain at least one uppercase letter' }
  if (!/[a-z]/.test(value)) return { valid: false, error: 'Password must contain at least one lowercase letter' }
  if (!/\d/.test(value)) return { valid: false, error: 'Password must contain at least one number' }
  if (!/[^A-Za-z0-9]/.test(value)) return { valid: false, error: 'Password must contain at least one special character' }
  return { valid: true }
}
