import React, { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { LayoutDashboard, ClipboardList, Monitor, BarChart2, Calendar, BookOpen, FolderOpen } from 'lucide-react'
import PortalLayout from '../../components/layout/PortalLayout'
import TeacherDashboard from './TeacherDashboard'
import TeacherAttendance from './TeacherAttendance'
import TeacherPresentation from './TeacherPresentation'
import TeacherAcademic from './TeacherAcademic'
import TeacherSchedule from './TeacherSchedule'
import TeacherSubjects from './TeacherSubjects'
import TeacherFiles from './TeacherFiles'
import TeacherProfileModal from './TeacherProfileModal'
import { useQuery } from '@tanstack/react-query'
import { settingsApi } from '../../lib/api'

const navItems = [
  { label: 'Dashboard', path: '/teacher', icon: <LayoutDashboard className="w-5 h-5" />, exact: true },
  { label: 'Subjects', path: '/teacher/subjects', icon: <BookOpen className="w-5 h-5" /> },
  { label: 'Attendance', path: '/teacher/attendance', icon: <ClipboardList className="w-5 h-5" /> },
  { label: 'Presentation', path: '/teacher/presentation', icon: <Monitor className="w-5 h-5" /> },
  { label: 'Academic Performance', path: '/teacher/academic', icon: <BarChart2 className="w-5 h-5" /> },
  { label: 'Class Schedule', path: '/teacher/schedule', icon: <Calendar className="w-5 h-5" /> },
  { label: 'Files', path: '/teacher/files', icon: <FolderOpen className="w-5 h-5" /> },
]

export default function TeacherPortal() {
  const [showProfile, setShowProfile] = useState(false)
  const { data: settings = {} } = useQuery({ queryKey: ['public-settings'], queryFn: () => settingsApi.getPublic().then(r => r.data) })

  return (
    <>
      <PortalLayout navItems={navItems} inactivityMinutes={Number(settings.kioskIdleTimeout) || 15} onProfileEdit={() => setShowProfile(true)}>
        <Routes>
          <Route index element={<TeacherDashboard />} />
          <Route path="subjects" element={<TeacherSubjects />} />
          <Route path="attendance" element={<TeacherAttendance />} />
          <Route path="presentation" element={<TeacherPresentation />} />
          <Route path="academic" element={<TeacherAcademic />} />
          <Route path="schedule" element={<TeacherSchedule />} />
          <Route path="files" element={<TeacherFiles />} />
          <Route path="*" element={<Navigate to="/teacher" replace />} />
        </Routes>
      </PortalLayout>
      {showProfile && <TeacherProfileModal onClose={() => setShowProfile(false)} />}
    </>
  )
}
