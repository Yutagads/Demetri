import React, { useEffect, useState, useRef } from 'react'
import { Phone, CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from '../../lib/utils'
import { formatPhilippinePhone, getPhoneDigits, validatePhilippinePhone } from '../../lib/validation'

interface PhoneInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label?: string
  value: string
  onChange: (formattedValue: string) => void
  error?: string
  hint?: string
  required?: boolean
  showValidationState?: boolean
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
      placeholder = '+63 9XX XXX XXXX',
      ...props
    },
    ref
  ) => {
    const [touched, setTouched] = useState(false)
    const [isFocused, setIsFocused] = useState(false)
    const innerRef = useRef<HTMLInputElement | null>(null)

    const digits = getPhoneDigits(value)
    const validation = validatePhilippinePhone(value, required)
    const isComplete = digits.length === 10 && digits.startsWith('9')
    const hasError = externalError || (touched && !validation.valid ? validation.error : null)

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true)
      if (!value || value.trim() === '') {
        onChange('+63 ')
      }
      props.onFocus?.(e)
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false)
      setTouched(true)
      // If only "+63" or "+63 " was left without any digits, clear it if not required
      if (digits.length === 0) {
        onChange('')
      }
      props.onBlur?.(e)
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value
      // Format as Philippine phone
      const formatted = formatPhilippinePhone(raw)
      onChange(formatted)
    }

    // Set cursor position after formatting if needed
    const handleKeyUp = () => {
      if (innerRef.current && innerRef.current.value.startsWith('+63 ') && innerRef.current.selectionStart! < 4) {
        innerRef.current.setSelectionRange(4, 4)
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
          <div className="absolute left-3 flex items-center gap-1.5 pointer-events-none text-text-secondary">
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
            value={value}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyUp={handleKeyUp}
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
