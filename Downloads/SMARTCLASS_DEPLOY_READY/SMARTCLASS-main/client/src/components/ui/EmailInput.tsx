import React, { useState } from 'react'
import { Mail, CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from '../../lib/utils'
import { validateEmail } from '../../lib/validation'

interface EmailInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label?: string
  value: string
  onChange: (value: string) => void
  error?: string
  hint?: string
  required?: boolean
  showValidationState?: boolean
}

export const EmailInput = React.forwardRef<HTMLInputElement, EmailInputProps>(
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
      placeholder = 'name@domain.com',
      ...props
    },
    ref
  ) => {
    const [touched, setTouched] = useState(false)

    const trimmed = (value || '').trim()
    const validation = validateEmail(trimmed, required)
    const isValid = trimmed.length > 0 && validation.valid
    const hasError = externalError || (touched && !validation.valid ? validation.error : null)

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Lowercase and remove spaces
      const cleaned = e.target.value.replace(/\s+/g, '')
      onChange(cleaned)
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setTouched(true)
      props.onBlur?.(e)
    }

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium font-inter text-text-primary mb-1.5">
            {label} {required && <span className="text-danger">*</span>}
          </label>
        )}

        <div className="relative flex items-center">
          <div className="absolute left-3 flex items-center pointer-events-none text-text-secondary">
            <Mail className="w-4 h-4 text-primary/70" />
          </div>

          <input
            ref={ref}
            type="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={value}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              'input-field pl-10 pr-10 font-inter',
              hasError && 'border-danger focus:ring-danger focus:border-danger',
              isValid && !hasError && 'border-success/60 focus:ring-success focus:border-success',
              className
            )}
            {...props}
          />

          <div className="absolute right-3 pointer-events-none flex items-center">
            {isValid && !hasError && (
              <span title="Valid email format">
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

        {hasError && <p className="mt-1 text-xs text-danger font-inter">{hasError}</p>}
        {!hasError && isValid && showValidationState && (
          <p className="mt-1 text-xs text-success font-inter">✓ Valid email formatting</p>
        )}
        {!hasError && !isValid && hint && (
          <p className="mt-1 text-xs text-text-secondary font-inter">{hint}</p>
        )}
      </div>
    )
  }
)

EmailInput.displayName = 'EmailInput'
