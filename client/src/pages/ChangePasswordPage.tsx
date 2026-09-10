import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { GraduationCap, Lock, Shield } from 'lucide-react'
import { authApi } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { validatePassword } from '../lib/validation'

const schema = z.object({
  currentPassword: z.string().min(1, 'Required'),
  newPassword: z.string().superRefine((value, ctx) => { const result = validatePassword(value); if (!result.valid) ctx.addIssue({ code: 'custom', message: result.error || 'Invalid password' }) }),
  confirmPassword: z.string().min(1, 'Required'),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

type FormData = z.infer<typeof schema>

export default function ChangePasswordPage() {
  const navigate = useNavigate()
  const { user, refetch } = useAuth()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setError('')
    setLoading(true)
    try {
      await authApi.changePassword({ currentPassword: data.currentPassword, newPassword: data.newPassword })
      await refetch()
      if (user?.role === 'STUDENT') navigate('/student')
      else if (user?.role === 'TEACHER') navigate('/teacher')
      else navigate('/admin')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-dark via-primary to-primary/80 flex items-center justify-center p-6">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl">
            <Shield className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-white font-poppins font-bold text-2xl">Set New Password</h1>
          <p className="text-white/60 font-inter text-sm mt-1">
            You must create a new password before continuing.
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <div className="flex items-center gap-3 p-4 bg-primary-light rounded-xl mb-6">
            <Shield className="w-5 h-5 text-primary flex-shrink-0" />
            <p className="text-sm text-primary-dark font-inter">
              This is your first login. Please set a personal password to secure your account.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Temporary Password"
              type="password"
              placeholder="Enter your temporary password"
              icon={<Lock className="w-4 h-4" />}
              error={errors.currentPassword?.message}
              {...register('currentPassword')}
            />
            <Input
              label="New Password"
              type="password"
              placeholder="At least 8 chars, upper/lower/number/symbol"
              icon={<Lock className="w-4 h-4" />}
              error={errors.newPassword?.message}
              hint="Use 8+ chars with uppercase, lowercase, number, and special character"
              {...register('newPassword')}
            />
            <Input
              label="Confirm Password"
              type="password"
              placeholder="Re-enter new password"
              icon={<Lock className="w-4 h-4" />}
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />

            {error && (
              <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-danger text-sm font-inter">
                {error}
              </div>
            )}

            <Button type="submit" variant="primary" className="w-full" size="lg" loading={loading}>
              Set Password & Continue
            </Button>
          </form>
        </div>
      </div>

    </div>
  )
}
