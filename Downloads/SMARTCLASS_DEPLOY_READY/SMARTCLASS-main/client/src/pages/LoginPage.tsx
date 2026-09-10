import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { GraduationCap, Eye, EyeOff, ArrowLeft, User, Lock } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { settingsApi } from '../lib/api'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

const loginSchema = z.object({
  identifier: z.string().min(1, 'Required'),
  password:   z.string().min(1, 'Required'),
})

type LoginForm = z.infer<typeof loginSchema>
type LoginRole = 'STUDENT' | 'TEACHER'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [role, setRole]               = useState<LoginRole>('STUDENT')
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError]   = useState('')
  const [loading, setLoading]           = useState(false)
  const { data: settings = {} } = useQuery({
    queryKey: ['public-settings'],
    queryFn: () => settingsApi.getPublic().then(r => r.data as Record<string, string>),
    staleTime: 60_000,
  })

  const { register, handleSubmit, formState: { errors }, reset } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const handleRoleSwitch = (r: LoginRole) => {
    setRole(r)
    reset()
    setServerError('')
  }

  const onSubmit = async (data: LoginForm) => {
    setServerError('')
    setLoading(true)
    try {
      const user = await login(data.identifier, data.password, role)
      if (user.role === 'STUDENT') navigate('/student')
      else if (user.role === 'TEACHER') navigate('/teacher')
    } catch (err: any) {
      setServerError(err.response?.data?.error || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-dark via-primary to-primary/80 flex flex-col items-center justify-center p-4 sm:p-6">

      {/* Back link */}
      <Link
        to="/"
        className="absolute top-4 sm:top-6 left-4 sm:left-6 flex items-center gap-2 text-white/70 hover:text-white font-inter text-sm transition-colors touch-manipulation"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="hidden xs:inline">Back to Kiosk</span>
        <span className="xs:hidden">Back</span>
      </Link>

      <div className="w-full max-w-sm sm:max-w-md animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-xl">
             {settings.schoolLogo ? <img src={settings.schoolLogo} alt="" className="w-10 h-10 sm:w-12 sm:h-12 object-contain" /> : <GraduationCap className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />}
          </div>
           <h1 className="text-white font-poppins font-bold text-2xl sm:text-3xl">SMARTCLASS</h1>
           <p className="text-white/60 font-inter text-sm mt-1">{settings.schoolName || 'Exequiel R. Lina High School'}</p>
           {settings.schoolTagline && <p className="text-white/50 font-inter text-xs mt-1">{settings.schoolTagline}</p>}
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Role tabs */}
          <div className="grid grid-cols-2 bg-primary-light">
            {(['STUDENT', 'TEACHER'] as LoginRole[]).map((r) => (
              <button
                key={r}
                onClick={() => handleRoleSwitch(r)}
                className={`py-3.5 sm:py-4 font-poppins font-semibold text-sm transition-all touch-manipulation ${
                  role === r
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-primary/60 hover:text-primary'
                }`}
              >
                {r === 'STUDENT' ? 'Student' : 'Teacher'}
              </button>
            ))}
          </div>

          {/* Form */}
          <div className="p-5 sm:p-8">
            <h2 className="text-card-title font-poppins font-semibold text-text-primary mb-1">
              Welcome back
            </h2>
            <p className="text-text-secondary font-inter text-sm mb-5 sm:mb-6">
              {role === 'STUDENT'
                ? 'Sign in with your student number'
                : 'Sign in with your email address'}
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input
                label={role === 'STUDENT' ? 'Student Number' : 'Email Address'}
                placeholder={role === 'STUDENT' ? 'e.g. 2024-00001' : 'teacher@erlhs.edu.ph'}
                icon={<User className="w-4 h-4" />}
                error={errors.identifier?.message}
                autoComplete="username"
                {...register('identifier')}
              />

              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                icon={<Lock className="w-4 h-4" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-text-secondary hover:text-primary transition-colors touch-manipulation p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
                error={errors.password?.message}
                autoComplete="current-password"
                {...register('password')}
              />

              {serverError && (
                <div className="flex items-center gap-2 p-3 bg-danger/10 border border-danger/20 rounded-xl text-danger text-sm font-inter">
                  <span>⚠️</span>
                  {serverError}
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                className="w-full mt-2"
                size="lg"
                loading={loading}
              >
                Sign In
              </Button>
            </form>

            <div className="mt-4 text-center">
              <p className="text-text-secondary font-inter text-xs">
                Forgot your password? Contact your administrator.
              </p>
            </div>
          </div>
        </div>

        {/* Admin access */}
        <div className="mt-5 text-center">
          <Link
            to="/admin/login"
            className="inline-flex items-center gap-2 text-white/50 hover:text-white/80 font-inter text-xs transition-colors border border-white/20 hover:border-white/40 rounded-xl px-4 py-2.5"
          >
            Admin Login
          </Link>
        </div>

      </div>

    </div>
  )
}
