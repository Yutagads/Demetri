import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { settingsApi, announcementsApi } from '../../lib/api'
import { formatDate } from '../../lib/utils'
import { LoadingSpinner } from '../../components/ui/EmptyState'
import {
  GraduationCap, Users, BookOpen, LayoutGrid,
  Plus, UserPlus, Megaphone, Calendar, Shield
} from 'lucide-react'

export default function AdminDashboard() {
  const navigate = useNavigate()

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => settingsApi.getDashboardStats().then(r => r.data),
  })

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.getAll().then(r => r.data),
  })

  const { data: announcements = [] } = useQuery({
    queryKey: ['all-announcements'],
    queryFn: () => announcementsApi.getAll().then(r => r.data),
  })

  const recentAnnouncements = (announcements as any[]).slice(0, 3)

  const quickActions = [
    { label: 'Add Student', icon: <GraduationCap className="w-5 h-5" />, path: '/admin/students', color: 'bg-primary-light text-primary' },
    { label: 'Add Teacher', icon: <UserPlus className="w-5 h-5" />, path: '/admin/teachers', color: 'bg-info/10 text-info' },
    { label: 'Create Announcement', icon: <Megaphone className="w-5 h-5" />, path: '/admin/announcements', color: 'bg-accent/10 text-accent' },
    { label: 'Manage Structure', icon: <BookOpen className="w-5 h-5" />, path: '/admin/structure', color: 'bg-secondary/10 text-secondary' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Admin Dashboard</h1>
        <p className="text-text-secondary font-inter text-sm mt-1">
          SMARTCLASS Management Portal — {settings?.schoolName || 'Exequiel R. Lina High School'}
        </p>
      </div>

      {/* School Overview */}
      <div className="card bg-gradient-to-br from-primary-dark to-primary text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="font-poppins font-bold text-xl">{settings?.schoolName || 'Exequiel R. Lina High School'}</h2>
            <div className="flex flex-wrap gap-3 mt-2">
              <span className="text-white/70 font-inter text-sm">
                AY: <strong className="text-white">{settings?.currentAcademicYear || '—'}</strong>
              </span>
              <span className="text-white/70 font-inter text-sm">
                Semester: <strong className="text-white">{settings?.currentSemester || '—'}</strong>
              </span>
              <span className="text-white/70 font-inter text-sm">
                Version: <strong className="text-white">{settings?.systemVersion || 'v1.0'}</strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      {statsLoading ? <LoadingSpinner /> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Students', value: stats?.totalStudents || 0, icon: <GraduationCap className="w-6 h-6" />, color: 'bg-primary text-white', path: '/admin/students' },
            { label: 'Total Teachers', value: stats?.totalTeachers || 0, icon: <Users className="w-6 h-6" />, color: 'bg-info text-white', path: '/admin/teachers' },
            { label: 'Total Sections', value: stats?.totalSections || 0, icon: <LayoutGrid className="w-6 h-6" />, color: 'bg-secondary text-white', path: '/admin/structure' },
            { label: 'Total Subjects', value: stats?.totalSubjects || 0, icon: <BookOpen className="w-6 h-6" />, color: 'bg-accent text-white', path: '/admin/structure' },
          ].map(({ label, value, icon, color, path }) => (
            <div key={label} className="stat-card" onClick={() => navigate(path)}>
              <div className={`w-12 h-12 ${color} rounded-2xl flex items-center justify-center flex-shrink-0`}>
                {icon}
              </div>
              <div>
                <p className="text-2xl font-poppins font-bold text-text-primary">{value}</p>
                <p className="text-text-secondary font-inter text-sm">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="card">
          <h2 className="section-heading mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map(({ label, icon, path, color }) => (
              <button
                key={label}
                onClick={() => navigate(path)}
                className="flex flex-col items-center gap-2 p-4 bg-background hover:bg-primary-light rounded-xl transition-colors"
              >
                <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center`}>
                  {icon}
                </div>
                <span className="font-inter text-sm font-medium text-text-primary text-center">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Latest Announcements */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-heading">Latest Announcements</h2>
            <button
              onClick={() => navigate('/admin/announcements')}
              className="text-primary text-sm font-inter hover:underline"
            >
              View all
            </button>
          </div>
          {recentAnnouncements.length === 0 ? (
            <p className="text-text-secondary font-inter text-sm py-4">No announcements yet.</p>
          ) : (
            <div className="space-y-3">
              {recentAnnouncements.map((a: any) => (
                <div key={a.id} className="flex items-start gap-3 p-3 bg-background rounded-xl">
                  <div className="flex-1 min-w-0">
                    <p className="font-inter text-sm font-medium text-text-primary line-clamp-1">{a.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="badge bg-primary-light text-primary-dark">{a.category?.name}</span>
                      <span className={`badge ${a.publishStatus === 'published' ? 'bg-success/10 text-success' : 'bg-border text-text-secondary'}`}>
                        {a.publishStatus}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-text-secondary font-inter flex-shrink-0">
                    {a.publishedAt ? formatDate(a.publishedAt, 'MMM d') : '—'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
