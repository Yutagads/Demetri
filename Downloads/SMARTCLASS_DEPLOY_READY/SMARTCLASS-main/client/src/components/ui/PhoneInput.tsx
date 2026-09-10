import React, { useState, useRef } from 'react'
import { Phone, CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from '../../lib/utils'
import { getPhoneDigits, validatePhilippinePhone } from '../../lib/validation'

interface PhoneInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label?: string
  value: string
  onChange: (formattedValue: string) => void
  error?: string
  hint?: string
  required?: boolean
  showValidationState?: boolean
}

function formatLocalDigits(digits: string): string {
  if (!digits) return ''
  const d = digits.substring(0, 10)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 10)}`
}

export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  (
    {
      label,
      value,
      onChange,
      error: externalError,
      hint,
      required = false,
      showValidationState = true,
      className,
      disabled,
      placeholder = '9XX XXX XXXX',
      ...props
    },
    ref
  ) => {
    const [touched, setTouched] = useState(false)
    const [isFocused, setIsFocused] = useState(false)
    const innerRef = useRef<HTMLInputElement | null>(null)

    const digits = getPhoneDigits(value || '')
    const displayValue = formatLocalDigits(digits)
    const validation = validatePhilippinePhone(value, required)
    const isComplete = digits.length === 10 && digits.startsWith('9')
    const hasError = externalError || (touched && !validation.valid ? validation.error : null)

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true)
      props.onFocus?.(e)
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false)
      setTouched(true)
      if (digits.length === 0) {
        onChange('')
      }
      props.onBlur?.(e)
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value
      let d = getPhoneDigits(raw)
      if (d.length > 10) d = d.substring(0, 10)

      if (d.length === 0) {
        onChange('')
      } else {
        const formatted = formatLocalDigits(d)
        onChange(`+63 ${formatted}`)
      }
    }

    return (
      <div className="w-full">
        {label && (
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium font-inter text-text-primary">
              {label} {required && <span className="text-danger">*</span>}
            </label>
            {showValidationState && digits.length > 0 && (
              <span
                className={cn(
                  'text-[11px] font-mono font-medium',
                  isComplete ? 'text-success' : 'text-text-secondary'
                )}
              >
                {digits.length}/10 digits
              </span>
            )}
          </div>
        )}

        <div className="relative flex items-center">
          {/* Prefix indicator / Icon */}
          <div className="absolute left-3 flex items-center gap-1.5 pointer-events-none text-text-secondary select-none">
            <Phone className="w-4 h-4 text-primary/70" />
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono">
              🇵🇭 +63
            </span>
          </div>

          <input
            ref={element => {
              innerRef.current = element
              if (typeof ref === 'function') ref(element)
              else if (ref) (ref as any).current = element
            }}
            type="tel"
            inputMode="numeric"
            value={displayValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              'input-field pl-24 pr-10 font-mono tracking-wide',
              hasError && 'border-danger focus:ring-danger focus:border-danger',
              isComplete && !hasError && 'border-success/60 focus:ring-success focus:border-success',
              className
            )}
            {...props}
          />

          {/* Right Status Icon */}
          <div className="absolute right-3 pointer-events-none flex items-center">
            {isComplete && !hasError && (
              <span title="Valid PH number">
                <CheckCircle2 className="w-4 h-4 text-success" />
              </span>
            )}
            {hasError && (
              <span title={hasError}>
                <AlertCircle className="w-4 h-4 text-danger" />
              </span>
            )}
          </div>
        </div>

        {/* Feedback Message */}
        {hasError && <p className="mt-1 text-xs text-danger font-inter">{hasError}</p>}
        {!hasError && isComplete && (
          <p className="mt-1 text-xs text-success font-inter">✓ Valid Philippine mobile number</p>
        )}
        {!hasError && !isComplete && hint && (
          <p className="mt-1 text-xs text-text-secondary font-inter">{hint}</p>
        )}
      </div>
    )
  }
)

PhoneInput.displayName = 'PhoneInput'
