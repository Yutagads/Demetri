import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../lib/auth'
import { studentsApi } from '../../lib/api'
import { formatDate, formatTime } from '../../lib/utils'
import { ClipboardList } from 'lucide-react'
import { LoadingSpinner, EmptyState } from '../../components/ui/EmptyState'
import { AttendanceBadge } from '../../components/ui/Badge'

export default function StudentAttendance() {
  const { user } = useAuth()
  const studentId = user?.profile?.id

  const [selectedSubject, setSelectedSubject] = useState<string>('all')

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['student-attendance', studentId],
    queryFn: () => studentsApi.getAttendance(studentId!).then(r => r.data),
    enabled: !!studentId,
  })

  // Summary counts
  const stats = useMemo(() => {
    const counts = { present: 0, absent: 0, late: 0, excused: 0 }
    ;(records as any[]).forEach((r: any) => {
      if (r.status in counts) counts[r.status as keyof typeof counts]++
    })
    return counts
  }, [records])

  // Unique subjects from records
  const subjects = useMemo(() => {
    const map = new Map<string, string>()
    ;(records as any[]).forEach((r: any) => {
      const subj = r.session?.subject
      if (subj?.id && !map.has(subj.id)) map.set(subj.id, subj.name)
    })
    return Array.from(map.entries()) // [id, name]
  }, [records])

  // Filtered records
  const filtered = useMemo(() => {
    if (selectedSubject === 'all') return records as any[]
    return (records as any[]).filter((r: any) => r.session?.subject?.id === selectedSubject)
  }, [records, selectedSubject])

  // Per-subject stats for the selected tab
  const filteredStats = useMemo(() => {
    const counts = { present: 0, absent: 0, late: 0, excused: 0 }
    filtered.forEach((r: any) => {
      if (r.status in counts) counts[r.status as keyof typeof counts]++
    })
    return counts
  }, [filtered])

  const displayStats = selectedSubject === 'all' ? stats : filteredStats

  if (isLoading) return <LoadingSpinner />

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Attendance</h1>
        <p className="text-text-secondary font-inter text-sm mt-1">Your attendance history and summary</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Present',  value: displayStats.present,  color: 'text-success',      bg: 'bg-success/10'  },
          { label: 'Absent',   value: displayStats.absent,   color: 'text-danger',       bg: 'bg-danger/10'   },
          { label: 'Late',     value: displayStats.late,     color: 'text-yellow-700',   bg: 'bg-warning/10'  },
          { label: 'Excused',  value: displayStats.excused,  color: 'text-info',         bg: 'bg-info/10'     },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className="card text-center">
            <p className={`text-3xl font-poppins font-bold ${color}`}>{value}</p>
            <p className="text-text-secondary font-inter text-sm mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Subject subtabs */}
      {subjects.length > 0 && (
        <div className="flex gap-1.5 flex-wrap border-b border-border pb-0">
          <button
            onClick={() => setSelectedSubject('all')}
            className={`px-4 py-2.5 font-poppins font-medium text-sm border-b-2 transition-colors -mb-px whitespace-nowrap ${
              selectedSubject === 'all'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            All Subjects
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-inter ${selectedSubject === 'all' ? 'bg-primary/10 text-primary' : 'bg-border text-text-secondary'}`}>
              {(records as any[]).length}
            </span>
          </button>
          {subjects.map(([id, name]) => {
            const count = (records as any[]).filter((r: any) => r.session?.subject?.id === id).length
            return (
              <button
                key={id}
                onClick={() => setSelectedSubject(id)}
                className={`px-4 py-2.5 font-poppins font-medium text-sm border-b-2 transition-colors -mb-px whitespace-nowrap ${
                  selectedSubject === id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                {name}
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-inter ${selectedSubject === id ? 'bg-primary/10 text-primary' : 'bg-border text-text-secondary'}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Records table */}
      <div className="card">
        <h2 className="section-heading mb-4">
          Attendance Records
          {selectedSubject !== 'all' && (
            <span className="ml-2 text-sm font-inter font-normal text-text-secondary">
              — {subjects.find(([id]) => id === selectedSubject)?.[1]}
            </span>
          )}
        </h2>
        {filtered.length === 0 ? (
          <EmptyState
            title="No Records Yet"
            description="Attendance records will appear here once your teacher conducts sessions."
            icon={<ClipboardList className="w-8 h-8 text-primary" />}
          />
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Subject</th>
                  <th>Section</th>
                  <th>Status</th>
                  <th>Time Recorded</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r: any) => (
                  <tr key={r.id}>
                    <td className="font-medium">{formatDate(r.session?.attendanceDate)}</td>
                    <td>{r.session?.subject?.name}</td>
                    <td>{r.session?.section?.name}</td>
                    <td><AttendanceBadge status={r.status} /></td>
                    <td className="text-text-secondary">{formatTime(r.timeRecorded)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
