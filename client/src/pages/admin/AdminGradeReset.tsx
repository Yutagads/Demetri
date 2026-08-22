import React, { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { academicApi, settingsApi, structureApi } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { LoadingSpinner } from '../../components/ui/EmptyState'
import { RotateCcw, Search, ShieldAlert } from 'lucide-react'

const PERIODS = ['1st', '2nd', '3rd', '4th']

export default function AdminGradeReset() {
  const qc = useQueryClient()
  const [sectionId, setSectionId] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [academicYearId, setAcademicYearId] = useState('')
  const [gradingPeriod, setGradingPeriod] = useState('1st')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const { data: settings = {} } = useQuery({
    queryKey: ['public-settings'],
    queryFn: () => settingsApi.getPublic().then(r => r.data as Record<string, string>),
  })
  const { data: sections = [], isLoading: sectionsLoading } = useQuery({
    queryKey: ['sections'],
    queryFn: () => structureApi.getSections().then(r => r.data),
  })
  const { data: years = [] } = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => structureApi.getAcademicYears().then(r => r.data),
  })
  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => structureApi.getSubjects().then(r => r.data),
  })
  const { data: grades = [], isLoading: gradesLoading } = useQuery({
    queryKey: ['admin-grades', sectionId, academicYearId, gradingPeriod, subjectId],
    queryFn: () => academicApi.getGrades({ sectionId, academicYearId, gradingPeriod, subjectId }).then(r => r.data),
    enabled: Boolean(sectionId && academicYearId && subjectId),
  })

  const periodCount = Math.min(4, Math.max(1, Number(settings.gradingPeriods) || 4))
  const selectedSection = (sections as any[]).find(s => s.id === sectionId)
  const selectedSubject = (subjects as any[]).find(s => s.id === subjectId)
  const selectedYear = (years as any[]).find(y => y.id === academicYearId)
  const releasedCount = (grades as any[]).length
  const averageGrade = releasedCount
    ? ((grades as any[]).reduce((sum, grade) => sum + Number(grade.grade), 0) / releasedCount).toFixed(2)
    : null

  const resetMutation = useMutation({
    mutationFn: () => academicApi.resetSectionGrades({ subjectId, sectionId, academicYearId, gradingPeriod }),
    onSuccess: (response) => {
      const count = response.data.reset
      setNotice(`${count} released grade${count === 1 ? '' : 's'} reset for the selected section. Teachers can submit replacement grades.`)
      setError('')
      qc.invalidateQueries({ queryKey: ['admin-grades'] })
    },
    onError: (e: any) => setError(e.response?.data?.error || 'Could not reset the section grades.'),
  })

  const resetSection = () => {
    setNotice('')
    setError('')
    const sectionName = selectedSection?.name || 'this section'
    const subjectName = selectedSubject?.name || 'this subject'
    if (window.confirm(`Reset all released ${subjectName} grades for ${sectionName}, ${gradingPeriod} Quarter? This will affect ${releasedCount} student${releasedCount === 1 ? '' : 's'} and cannot be undone.`)) {
      resetMutation.mutate()
    }
  }

  if (sectionsLoading) return <LoadingSpinner />
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">Release Grade Reset</h1>
        <p className="text-text-secondary font-inter text-sm mt-1">Reset released grades for an entire section in one academic subject and grading period.</p>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800 font-inter">This removes the selected final-grade records for every student in the section. Activity scores are not deleted and teachers can submit replacement grades afterward.</p>
      </div>

      {(notice || error) && <div className={`rounded-xl px-4 py-3 text-sm font-inter ${error ? 'bg-danger/10 border border-danger/20 text-danger' : 'bg-success/10 border border-success/20 text-success'}`}>{error || notice}</div>}

      <div className="card w-full max-w-3xl space-y-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center text-primary"><Search className="w-5 h-5" /></div>
          <div>
            <h2 className="section-heading">Select Section Grades</h2>
            <p className="text-xs text-text-secondary font-inter">Choose one section, academic year, subject, and grading period.</p>
          </div>
        </div>

        <div className="space-y-4">
          <label className="block text-sm font-inter text-text-primary">Section
            <select className="input mt-1.5" value={sectionId} onChange={e => setSectionId(e.target.value)}>
              <option value="">Select section</option>
              {(sections as any[]).map(s => <option key={s.id} value={s.id}>{s.gradeLevel?.name ? `${s.gradeLevel.name} — ` : ''}{s.name}</option>)}
            </select>
          </label>
          <label className="block text-sm font-inter text-text-primary">Academic Year
            <select className="input mt-1.5" value={academicYearId} onChange={e => setAcademicYearId(e.target.value)}>
              <option value="">Select academic year</option>
              {(years as any[]).map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </label>
          <label className="block text-sm font-inter text-text-primary">Subject
            <select className="input mt-1.5" value={subjectId} onChange={e => setSubjectId(e.target.value)}>
              <option value="">Select subject</option>
              {(subjects as any[]).map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
            </select>
          </label>
          <label className="block text-sm font-inter text-text-primary">Grading Period
            <select className="input mt-1.5" value={gradingPeriod} onChange={e => setGradingPeriod(e.target.value)}>
              {PERIODS.slice(0, periodCount).map(p => <option key={p} value={p}>{p} Quarter</option>)}
            </select>
          </label>
        </div>

        {gradesLoading && <LoadingSpinner />}
        {sectionId && academicYearId && subjectId && !gradesLoading && (
          <div className="rounded-xl border border-border bg-background p-4 space-y-3">
            <div>
              <p className="font-poppins font-semibold text-text-primary">Section reset preview</p>
              <p className="text-xs text-text-secondary font-inter mt-1">
                {selectedSection?.name} · {selectedSubject?.name} · {gradingPeriod} Quarter · {selectedYear?.name}
              </p>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm font-inter">
              <span><strong className="font-poppins text-text-primary">{releasedCount}</strong> released grade{releasedCount === 1 ? '' : 's'} found</span>
              {averageGrade && <span>Average: <strong className="font-poppins text-text-primary">{averageGrade}</strong></span>}
            </div>
            <Button
              variant="danger"
              icon={<RotateCcw className="w-4 h-4" />}
              loading={resetMutation.isPending}
              disabled={releasedCount === 0}
              onClick={resetSection}
            >
              Reset All Grades in Section
            </Button>
            {releasedCount === 0 && <p className="text-xs text-text-secondary font-inter">No released grades match this selection.</p>}
          </div>
        )}
      </div>
    </div>
  )
}