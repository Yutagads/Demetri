import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, Calendar,
  Megaphone, ClipboardList, BarChart2, FileText, Settings, CalendarDays, ShieldCheck
} from 'lucide-react'
import PortalLayout from '../../components/layout/PortalLayout'
import AdminDashboard from './AdminDashboard'
import AdminStudents from './AdminStudents'
import AdminTeachers from './AdminTeachers'
import AdminAcademicStructure from './AdminAcademicStructure'
import AdminAnnouncements from './AdminAnnouncements'
import AdminAttendance from './AdminAttendance'
import AdminSettings from './AdminSettings'
import AdminSchedule from './AdminSchedule'
import AdminStudentProfile from './AdminStudentProfile'
import AdminTeacherProfile from './AdminTeacherProfile'
import AdminGradeReset from './AdminGradeReset'
import AdminStudentAccountStatus from './AdminStudentAccountStatus'

const navItems = [
  { label: 'Dashboard', path: '/admin', icon: <LayoutDashboard className="w-5 h-5" />, exact: true },
  { label: 'Students', path: '/admin/students', icon: <GraduationCap className="w-5 h-5" /> },
  { label: 'Teachers', path: '/admin/teachers', icon: <Users className="w-5 h-5" /> },
  { label: 'Academic Structure', path: '/admin/structure', icon: <BookOpen className="w-5 h-5" /> },
  { label: 'Class Schedules', path: '/admin/schedules', icon: <CalendarDays className="w-5 h-5" /> },
  { label: 'Announcements', path: '/admin/announcements', icon: <Megaphone className="w-5 h-5" /> },
  { label: 'Attendance', path: '/admin/attendance', icon: <ClipboardList className="w-5 h-5" /> },
  { label: 'System Settings', path: '/admin/settings', icon: <Settings className="w-5 h-5" /> },
]

export default function AdminPortal() {
  return (
    <PortalLayout navItems={navItems}>
      <Routes>
        <Route index element={<AdminDashboard />} />
        <Route path="students" element={<AdminStudents />} />
        <Route path="students/:id" element={<AdminStudentProfile />} />
        <Route path="student-account-status" element={<Navigate to="/admin/students" replace />} />
        <Route path="teachers" element={<AdminTeachers />} />
        <Route path="teachers/:id" element={<AdminTeacherProfile />} />
        <Route path="structure" element={<AdminAcademicStructure />} />
        <Route path="schedules" element={<AdminSchedule />} />
        <Route path="announcements" element={<AdminAnnouncements />} />
        <Route path="attendance" element={<AdminAttendance />} />
        <Route path="grade-reset" element={<AdminGradeReset />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </PortalLayout>
  )
}
