import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { studentsApi, structureApi } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Avatar } from '../../components/ui/Avatar'
import { Modal } from '../../components/ui/Modal'
import { LoadingSpinner, EmptyState } from '../../components/ui/EmptyState'
import {
  Users, ChevronRight, ArrowLeft, UserMinus, ArrowRightLeft,
  GraduationCap, BookOpen, RotateCcw, Archive, Eye
} from 'lucide-react'

// ─── Section Card Grid ─────────────────────────────────────────────────────────

interface SectionCardProps {
  section: any
  studentCount: number
  onClick: () => void
}

function SectionCard({ section, studentCount, onClick }: SectionCardProps) {
  return (
    <button
      onClick={onClick}
      className="group w-full text-left bg-white border border-gray-200 rounded-2xl p-5 hover:border-primary hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-poppins font-semibold text-text-primary text-base truncate group-hover:text-primary transition-colors">
              {section.name}
            </h3>
          </div>

          <div className="space-y-1 ml-11">
            <p className="text-sm text-text-secondary font-inter">
              {section.gradeLevel?.name || '—'}
              {section.strand && (
                <span className="ml-1 text-primary font-medium">· {section.strand.name}</span>
              )}
            </p>
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-text-secondary" />
              <span className="text-sm text-text-secondary font-inter">
                {studentCount} {studentCount === 1 ? 'student' : 'students'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <Badge variant={section.status === 'active' ? 'success' : 'default'}>
            {section.status}
          </Badge>
          <ChevronRight className="w-4 h-4 text-text-secondary group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>
    </button>
  )
}

// ─── Section Detail (student roster) ─────────────────────────────────────────

interface SectionDetailProps {
  section: any
  sections: any[]
  academicYears: any[]
  onBack: () => void
}

function SectionDetail({ section, sections, academicYears, onBack }: SectionDetailProps) {
  const qc = useQueryClient()
  const [moveStudent, setMoveStudent] = useState<any>(null)
  const [moveTarget, setMoveTarget] = useState({ sectionId: '', academicYearId: '', gradeLevelId: '' })
  const [viewStudent, setViewStudent] = useState<any>(null)
  const [confirmRemove, setConfirmRemove] = useState<any>(null)

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['students', 'section', section.id],
    queryFn: () => studentsApi.getAll({ sectionId: section.id, status: 'active' }).then(r => r.data),
  })

  const reassignMutation = useMutation({
    mutationFn: ({ studentId, data }: { studentId: string; data: any }) =>
      studentsApi.reassignSection(studentId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] })
      setMoveStudent(null)
      setMoveTarget({ sectionId: '', academicYearId: '', gradeLevelId: '' })
    },
  })

  const removeMutation = useMutation({
    mutationFn: (studentId: string) => studentsApi.removeFromSection(studentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] })
      setConfirmRemove(null)
    },
  })

  const resetPwMutation = useMutation({
    mutationFn: (id: string) => studentsApi.resetPassword(id),
    onSuccess: (res, id) => {
      const s = (students as any[]).find((st: any) => st.id === id)
      setViewStudent({ ...viewStudent, _tempPw: res.data.tempPassword })
    },
  })

  const otherSections = sections.filter(s => s.id !== section.id)

  const handleMoveOpen = (student: any) => {
    setMoveStudent(student)
    const ay = academicYears.find((y: any) => y.isCurrent)
    setMoveTarget({
      sectionId: '',
      academicYearId: ay?.id || '',
      gradeLevelId: section.gradeLevelId,
    })
  }

  const handleMoveConfirm = () => {
    if (!moveTarget.sectionId || !moveStudent) return
    const targetSection = sections.find(s => s.id === moveTarget.sectionId)
    reassignMutation.mutate({
      studentId: moveStudent.id,
      data: {
        sectionId: moveTarget.sectionId,
        academicYearId: moveTarget.academicYearId,
        gradeLevelId: targetSection?.gradeLevelId || section.gradeLevelId,
      },
    })
  }

  if (isLoading) return <LoadingSpinner />

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-text-secondary hover:text-primary transition-colors font-inter text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          All Sections
        </button>
        <ChevronRight className="w-4 h-4 text-text-secondary" />
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-primary" />
          </div>
          <span className="font-poppins font-semibold text-text-primary">{section.name}</span>
          {section.gradeLevel && (
            <span className="text-sm text-text-secondary font-inter">
              — {section.gradeLevel.name}{section.strand ? ` · ${section.strand.name}` : ''}
            </span>
          )}
        </div>
        <Badge variant="success" className="ml-auto">{(students as any[]).length} Students</Badge>
      </div>

      {/* Student Table */}
      {(students as any[]).length === 0 ? (
        <EmptyState
          title="No Students in This Section"
          description="Students assigned to this section will appear here."
          icon={<GraduationCap className="w-8 h-8 text-primary" />}
        />
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Student No.</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(students as any[]).map((s: any) => (
                <tr key={s.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <Avatar name={s.fullName} src={s.profile?.profilePicture} size="sm" />
                      <span className="font-medium">{s.fullName}</span>
                    </div>
                  </td>
                  <td className="font-mono text-sm">{s.studentNumber}</td>
                  <td>
                    <Badge variant={s.user?.isFirstLogin ? 'warning' : 'success'}>
                      {s.user?.isFirstLogin ? 'Pending Setup' : 'Active'}
                    </Badge>
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setViewStudent(s)}
                        className="p-1.5 hover:bg-info/10 text-info rounded-lg transition-colors"
                        title="View"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleMoveOpen(s)}
                        className="p-1.5 hover:bg-primary/10 text-primary rounded-lg transition-colors"
                        title="Move to another section"
                      >
                        <ArrowRightLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => resetPwMutation.mutate(s.id)}
                        className="p-1.5 hover:bg-warning/10 text-warning rounded-lg transition-colors"
                        title="Reset password"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setConfirmRemove(s)}
                        className="p-1.5 hover:bg-danger/10 text-danger rounded-lg transition-colors"
                        title="Remove from section"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Move Section Modal */}
      <Modal
        open={!!moveStudent}
        onClose={() => setMoveStudent(null)}
        title="Move to Another Section"
        size="sm"
        footer={
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setMoveStudent(null)}>Cancel</Button>
            <Button
              loading={reassignMutation.isPending}
              onClick={handleMoveConfirm}
              disabled={!moveTarget.sectionId}
            >
              Move Student
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary font-inter">
            Moving <span className="font-semibold text-text-primary">{moveStudent?.fullName}</span> from{' '}
            <span className="text-primary font-medium">{section.name}</span> to:
          </p>
          <div>
            <label className="block text-sm font-medium font-inter text-text-primary mb-1.5">
              Target Section
            </label>
            <select
              className="input-field"
              value={moveTarget.sectionId}
              onChange={e => setMoveTarget(t => ({ ...t, sectionId: e.target.value }))}
            >
              <option value="">Select section…</option>
              {otherSections.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.gradeLevel?.name ? `${s.gradeLevel.name} – ` : ''}{s.name}
                  {s.strand ? ` (${s.strand.name})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium font-inter text-text-primary mb-1.5">
              Academic Year
            </label>
            <select
              className="input-field"
              value={moveTarget.academicYearId}
              onChange={e => setMoveTarget(t => ({ ...t, academicYearId: e.target.value }))}
            >
              {(academicYears as any[]).map((y: any) => (
                <option key={y.id} value={y.id}>{y.name}{y.isCurrent ? ' (current)' : ''}</option>
              ))}
            </select>
          </div>
        </div>
      </Modal>

      {/* Remove Confirmation Modal */}
      <Modal
        open={!!confirmRemove}
        onClose={() => setConfirmRemove(null)}
        title="Remove from Section"
        size="sm"
        footer={
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setConfirmRemove(null)}>Cancel</Button>
            <Button
              variant="danger"
              loading={removeMutation.isPending}
              onClick={() => removeMutation.mutate(confirmRemove.id)}
            >
              Remove
            </Button>
          </div>
        }
      >
        <p className="text-sm text-text-secondary font-inter">
          Remove <span className="font-semibold text-text-primary">{confirmRemove?.fullName}</span> from{' '}
          <span className="text-primary font-medium">{section.name}</span>?
          They will no longer appear in this section's roster. You can reassign them later.
        </p>
      </Modal>

      {/* View Student Modal */}
      <Modal
        open={!!viewStudent}
        onClose={() => setViewStudent(null)}
        title="Student Details"
        size="sm"
      >
        {viewStudent && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar name={viewStudent.fullName} src={viewStudent.profile?.profilePicture} size="lg" />
              <div>
                <p className="font-poppins font-semibold text-text-primary">{viewStudent.fullName}</p>
                <p className="text-sm text-text-secondary font-mono">{viewStudent.studentNumber}</p>
              </div>
            </div>
            <div className="divide-y divide-gray-100 text-sm">
              {[
                ['Email', viewStudent.email],
                ['Gender', viewStudent.gender || '—'],
                ['Contact', viewStudent.contactNumber || '—'],
                ['Blood Type', viewStudent.profile?.bloodType || '—'],
                ['Weight', viewStudent.profile?.weight != null ? `${viewStudent.profile.weight} kg` : '—'],
                ['Height', viewStudent.profile?.height != null ? `${viewStudent.profile.height} cm` : '—'],
                ['Guardian', viewStudent.profile?.guardianName || '—'],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between py-2">
                  <span className="text-text-secondary font-inter">{label}</span>
                  <span className="font-inter text-text-primary">{val}</span>
                </div>
              ))}
              {viewStudent._tempPw && (
                <div className="flex justify-between py-2">
                  <span className="text-text-secondary font-inter">Temp Password</span>
                  <span className="font-mono text-primary font-semibold">{viewStudent._tempPw}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ─── Main Sections Tab ────────────────────────────────────────────────────────

export default function AdminSections() {
  const [selected, setSelected] = useState<any>(null)

  const { data: sections = [], isLoading: loadingSections } = useQuery({
    queryKey: ['sections'],
    queryFn: () => structureApi.getSections().then(r => r.data),
  })

  const { data: allStudents = [], isLoading: loadingStudents } = useQuery({
    queryKey: ['students', 'active-all'],
    queryFn: () => studentsApi.getAll({ status: 'active' }).then(r => r.data),
  })

  const { data: academicYears = [] } = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => structureApi.getAcademicYears().then(r => r.data),
  })

  if (loadingSections) return <LoadingSpinner />

  // Count students per section (best-effort — shows 0 while allStudents still loads)
  const countMap: Record<string, number> = {}
  ;(allStudents as any[]).forEach((s: any) => {
    s.sectionAssignments?.forEach((a: any) => {
      countMap[a.sectionId] = (countMap[a.sectionId] || 0) + 1
    })
  })

  if (selected) {
    return (
      <SectionDetail
        section={selected}
        sections={sections as any[]}
        academicYears={academicYears as any[]}
        onBack={() => setSelected(null)}
      />
    )
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="font-poppins font-semibold text-text-primary text-lg">All Sections</h2>
        <p className="text-sm text-text-secondary font-inter mt-0.5">
          {(sections as any[]).length} sections · click any card to view its students
        </p>
      </div>

      {(sections as any[]).length === 0 ? (
        <EmptyState
          title="No Sections Yet"
          description="Create sections under Academic Structure to get started."
          icon={<BookOpen className="w-8 h-8 text-primary" />}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(sections as any[]).map((s: any) => (
            <SectionCard
              key={s.id}
              section={s}
              studentCount={countMap[s.id] || 0}
              onClick={() => setSelected(s)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
