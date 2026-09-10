import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../lib/auth'
import { studentsApi, structureApi } from '../../lib/api'
import { formatDate, calculatePerformance } from '../../lib/utils'
import { BarChart2, GraduationCap, BookOpen, Printer, ChevronRight, TrendingUp, Award } from 'lucide-react'
import { LoadingSpinner, EmptyState } from '../../components/ui/EmptyState'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'

const GRADING_PERIODS = ['1st', '2nd', '3rd', '4th']
const GRADING_LABELS  = ['1st Grading', '2nd Grading', '3rd Grading', '4th Grading']

// ─── Print grade report in a new window ──────────────────────────────────────
function printGradeReport(
  student: any,
  year: any,
  period: string,
  subjects: any[],
  grades: any[],
) {
  const rows = subjects.map(s => {
    const g = grades.find(gr => gr.subjectId === s.subjectId && gr.gradingPeriod === period)
    return { code: s.subject?.code || '', name: s.subject?.name || s.subject?.code || '', grade: g?.grade ?? null }
  })
  const released = rows.filter(r => r.grade !== null)
  const avg = released.length > 0
    ? (released.reduce((sum, r) => sum + r.grade!, 0) / released.length).toFixed(2)
    : '—'

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Grade Report — ${student?.fullName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; padding: 32px; color: #1e293b; }
    .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #4E7D4B; padding-bottom: 16px; }
    .header h1 { font-size: 20px; font-weight: bold; color: #4E7D4B; }
    .header p  { font-size: 12px; color: #64748b; margin-top: 4px; }
    .meta { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 13px; }
    .meta-block { }
    .meta-block .label { color: #64748b; font-size: 11px; }
    .meta-block .value { font-weight: bold; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #f1f5f9; text-align: left; padding: 10px 12px; font-size: 12px; font-weight: 600; border: 1px solid #e2e8f0; }
    td { padding: 9px 12px; font-size: 13px; border: 1px solid #e2e8f0; }
    tr:nth-child(even) td { background: #fafafa; }
    .grade-cell { text-align: center; font-weight: bold; font-size: 15px; }
    .grade-pass { color: #16a34a; }
    .grade-fail { color: #dc2626; }
    .grade-blank { color: #94a3b8; font-weight: normal; font-style: italic; font-size: 12px; }
    .footer-row td { font-weight: bold; background: #f8fafc; }
    .footer-row .avg-label { text-align: right; font-size: 13px; }
    .footer-row .avg-value { text-align: center; font-size: 17px; color: #4E7D4B; }
    .note { margin-top: 20px; font-size: 11px; color: #94a3b8; text-align: center; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>Exequiel R. Lina High School</h1>
    <p>Official Grade Report — SMARTCLASS v1.0</p>
  </div>
  <div class="meta">
    <div class="meta-block">
      <div class="label">Student Name</div>
      <div class="value">${student?.fullName || '—'}</div>
    </div>
    <div class="meta-block">
      <div class="label">Section</div>
      <div class="value">${student?.sectionAssignments?.[0]?.section?.name || '—'}</div>
    </div>
    <div class="meta-block">
      <div class="label">Academic Year</div>
      <div class="value">${year?.name || '—'}</div>
    </div>
    <div class="meta-block">
      <div class="label">Grading Period</div>
      <div class="value">${period} Quarter</div>
    </div>
  </div>
  <table>
    <thead>
      <tr><th>Subject</th><th>Subject Code</th><th style="text-align:center;width:100px">Grade</th></tr>
    </thead>
    <tbody>
      ${rows.map(r => `
        <tr>
          <td>${r.name}</td>
          <td style="font-family:monospace;font-size:12px">${r.code}</td>
          <td class="grade-cell ${r.grade === null ? 'grade-blank' : r.grade >= 75 ? 'grade-pass' : 'grade-fail'}">
            ${r.grade === null ? 'Not released' : r.grade}
          </td>
        </tr>
      `).join('')}
      <tr class="footer-row">
        <td colspan="2" class="avg-label">General Average</td>
        <td class="avg-value">${avg}</td>
      </tr>
    </tbody>
  </table>
  <p class="note">* Grades shown are as released by subject teachers. Blank entries have not yet been released.</p>
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`

  const w = window.open('', '_blank', 'width=860,height=700')
  if (w) { w.document.write(html); w.document.close() }
}

// ─── Grading card ─────────────────────────────────────────────────────────────
function GradingCard({ period, label, year, count, total, onClick }: {
  period: string; label: string; year: any; count: number; total: number; onClick: () => void
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  const allReleased = count === total && total > 0
  return (
    <button
      onClick={onClick}
      className="card text-left group hover:border-primary/40 hover:shadow-md transition-all duration-200 border border-border w-full"
    >
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors
          ${allReleased ? 'bg-success/10 group-hover:bg-success/15' : 'bg-primary-light group-hover:bg-primary/15'}`}>
          <Award className={`w-6 h-6 ${allReleased ? 'text-success' : 'text-primary'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-poppins font-semibold text-text-primary group-hover:text-primary transition-colors">{label}</p>
          <p className="text-xs text-text-secondary font-inter mt-0.5">S.Y. {year?.name}</p>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-inter text-text-secondary whitespace-nowrap">{count}/{total} released</span>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-text-secondary group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
      </div>
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function StudentPerformance() {
  const { user } = useAuth()
  const studentId = user?.profile?.id
  const student   = user?.profile

  const [activeTab, setActiveTab]   = useState<'grades' | 'scores'>('grades')
  const [gradeModal, setGradeModal] = useState<{ year: any; period: string } | null>(null)

  // Academic years
  const { data: years = [] } = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => structureApi.getAcademicYears().then(r => r.data),
  })

  // Student's final grades
  const { data: finalGrades = [], isLoading: gradesLoading } = useQuery({
    queryKey: ['student-grades', studentId],
    queryFn: () => studentsApi.getGrades(studentId!).then(r => r.data),
    enabled: !!studentId,
  })

  // Activity scores
  const { data: scores = [], isLoading: scoresLoading } = useQuery({
    queryKey: ['student-scores', studentId],
    queryFn: () => studentsApi.getScores(studentId!).then(r => r.data),
    enabled: !!studentId,
  })

  // For grade modal: subjects for the student's section + year
  const modalAssignment = student?.sectionAssignments?.[0]

  // Pre-fetch schedules for the student's section (all years) so card totals are accurate
  const { data: sectionSchedules = [] } = useQuery({
    queryKey: ['section-schedules-all', modalAssignment?.sectionId],
    queryFn: () => structureApi.getSchedules({
      sectionId: modalAssignment?.sectionId,
      status: 'published',
    }).then(r => r.data),
    enabled: !!modalAssignment?.sectionId,
  })

  // Helper: unique subject count for a given year in the section
  const subjectCountForYear = useMemo(() => {
    const map: Record<string, number> = {}
    ;(sectionSchedules as any[]).forEach((s: any) => {
      if (!map[s.academicYearId]) map[s.academicYearId] = 0
    })
    ;(sectionSchedules as any[]).forEach((s: any) => {
      const key = s.academicYearId
      const existing = (sectionSchedules as any[]).filter((x: any) => x.academicYearId === key)
      const unique = new Set(existing.map((x: any) => x.subjectId)).size
      map[key] = unique
    })
    return map
  }, [sectionSchedules])

  const { data: modalSchedules = [] } = useQuery({
    queryKey: ['modal-schedules', modalAssignment?.sectionId, gradeModal?.year?.id],
    queryFn: () => structureApi.getSchedules({
      sectionId: modalAssignment?.sectionId,
      academicYearId: gradeModal?.year?.id,
      status: 'published',
    }).then(r => r.data),
    enabled: !!gradeModal && !!modalAssignment?.sectionId,
  })

  const modalSubjects = useMemo(() => {
    return Array.from(new Map((modalSchedules as any[]).map((s: any) => [s.subjectId, s])).values())
  }, [modalSchedules])

  // Performance stats
  const perf         = useMemo(() => calculatePerformance(scores), [scores])
  const categoryGroups = useMemo(() => {
    return (scores as any[]).reduce((acc: any, s: any) => {
      const cat = s.activity?.category || 'Other'
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(s)
      return acc
    }, {})
  }, [scores])

  // Years where student has section assignments
  const assignedYearIds = useMemo(() => {
    return new Set((student?.sectionAssignments || []).map((a: any) => a.academicYearId))
  }, [student])

  // Build the list of (year, period) cards — only for years with assignments
  const gradingCards = useMemo(() => {
    const cards: Array<{ year: any; period: string; label: string; count: number; total: number }> = []
    ;(years as any[])
      .filter((y: any) => assignedYearIds.has(y.id) || (finalGrades as any[]).some((g: any) => g.academicYearId === y.id))
      .sort((a: any, b: any) => b.name.localeCompare(a.name))
      .forEach((year: any) => {
        GRADING_PERIODS.forEach((period, i) => {
          const yearGrades = (finalGrades as any[]).filter((g: any) => g.academicYearId === year.id && g.gradingPeriod === period)
          const totalSubjects = subjectCountForYear[year.id] ?? yearGrades.length
          cards.push({ year, period, label: GRADING_LABELS[i], count: yearGrades.length, total: totalSubjects })
        })
      })
    return cards
  }, [years, finalGrades, assignedYearIds, subjectCountForYear])

  // Modal data
  const modalGrades = useMemo(() => {
    if (!gradeModal) return []
    return (finalGrades as any[]).filter((g: any) =>
      g.academicYearId === gradeModal.year?.id && g.gradingPeriod === gradeModal.period
    )
  }, [finalGrades, gradeModal])

  const modalAverage = useMemo(() => {
    if (modalGrades.length === 0) return null
    return (modalGrades.reduce((sum: number, g: any) => sum + g.grade, 0) / modalGrades.length).toFixed(2)
  }, [modalGrades])

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Academic Performance</h1>
        <p className="text-text-secondary font-inter text-sm mt-1">Your grades and activity scores</p>
      </div>

      {/* Top tabs */}
      <div className="flex gap-1 border-b border-border pb-0">
        {([['grades', 'Final Grades', GraduationCap], ['scores', 'Activity Scores', BarChart2]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-3 font-poppins font-medium text-sm border-b-2 transition-colors -mb-px whitespace-nowrap ${
              activeTab === key ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── FINAL GRADES TAB ────────────────────────────────────────────────── */}
      {activeTab === 'grades' && (
        gradesLoading ? <LoadingSpinner /> :
        gradingCards.length === 0 ? (
          <EmptyState
            title="No Grade Records"
            description="Your grades will appear here once your teachers release them."
            icon={<GraduationCap className="w-8 h-8 text-primary" />}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-4">
            {gradingCards.map(({ year, period, label, count, total }) => (
              <GradingCard
                key={`${year.id}-${period}`}
                period={period}
                label={label}
                year={year}
                count={count}
                total={total}
                onClick={() => setGradeModal({ year, period })}
              />
            ))}
          </div>
        )
      )}

      {/* ── ACTIVITY SCORES TAB ────────────────────────────────────────────── */}
      {activeTab === 'scores' && (
        scoresLoading ? <LoadingSpinner /> : (
          <>
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="card text-center">
                <p className="text-3xl font-poppins font-bold text-primary">{perf.percentage}%</p>
                <p className="text-text-secondary font-inter text-sm mt-1">Overall Score</p>
              </div>
              <div className="card text-center">
                <p className="text-3xl font-poppins font-bold text-info">{perf.completed}</p>
                <p className="text-text-secondary font-inter text-sm mt-1">Completed</p>
              </div>
              <div className="card text-center">
                <p className="text-3xl font-poppins font-bold text-success">{perf.totalEarned}</p>
                <p className="text-text-secondary font-inter text-sm mt-1">Score Earned</p>
              </div>
              <div className="card text-center">
                <p className="text-3xl font-poppins font-bold text-text-secondary">{perf.totalPossible}</p>
                <p className="text-text-secondary font-inter text-sm mt-1">Total Possible</p>
              </div>
            </div>

            {(scores as any[]).length === 0 ? (
              <EmptyState
                title="No Activity Scores Yet"
                description="Your teacher will record your scores for quizzes, assignments, exams, and other activities."
                icon={<BarChart2 className="w-8 h-8 text-primary" />}
              />
            ) : (
              Object.entries(categoryGroups).map(([category, items]: any) => {
                const catPerf = calculatePerformance(items)
                return (
                  <div key={category} className="card">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="section-heading capitalize">{category}</h2>
                      <div className="flex items-center gap-2">
                        <div className="w-32 h-2 bg-border rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${catPerf.percentage}%` }} />
                        </div>
                        <span className="text-sm font-poppins font-semibold text-primary">{catPerf.percentage}%</span>
                      </div>
                    </div>
                    <div className="table-wrapper">
                      <table className="data-table">
                        <thead>
                          <tr><th>Activity</th><th>Subject</th><th>Date</th><th>Score</th><th>%</th></tr>
                        </thead>
                        <tbody>
                          {items.map((s: any) => {
                            const pct = s.totalScore > 0 ? Math.round((s.scoreObtained / s.totalScore) * 100) : 0
                            return (
                              <tr key={s.id}>
                                <td className="font-medium">{s.activity?.title}</td>
                                <td>{s.activity?.subject?.name}</td>
                                <td className="text-text-secondary">{formatDate(s.activity?.activityDate)}</td>
                                <td>
                                  <span className="font-poppins font-semibold">{s.scoreObtained}</span>
                                  <span className="text-text-secondary">/{s.totalScore}</span>
                                </td>
                                <td>
                                  <span className={`font-semibold ${pct >= 75 ? 'text-success' : pct >= 50 ? 'text-warning' : 'text-danger'}`}>
                                    {pct}%
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })
            )}
          </>
        )
      )}

      {/* ── Grade Modal ────────────────────────────────────────────────────── */}
      <Modal
        open={!!gradeModal}
        onClose={() => setGradeModal(null)}
        title=""
        size="lg"
      >
        {gradeModal && (
          <div className="space-y-4">
            {/* Modal header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-border">
              <div>
                <h2 className="font-poppins font-bold text-xl text-text-primary">
                  {gradeModal.period} Quarter — Grade Report
                </h2>
                <p className="font-inter text-sm text-text-secondary mt-0.5">S.Y. {gradeModal.year?.name}</p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                icon={<Printer className="w-4 h-4" />}
                onClick={() => printGradeReport(student, gradeModal.year, gradeModal.period, modalSubjects, modalGrades)}
              >
                Export PDF
              </Button>
            </div>

            {/* Student meta */}
            <div className="flex gap-4 flex-wrap text-sm font-inter">
              <div>
                <span className="text-text-secondary">Student: </span>
                <span className="font-semibold text-text-primary">{student?.fullName}</span>
              </div>
              <div>
                <span className="text-text-secondary">Section: </span>
                <span className="font-semibold text-text-primary">
                  {student?.sectionAssignments?.[0]?.section?.name || '—'}
                </span>
              </div>
            </div>

            {/* Grade table */}
            {modalSubjects.length === 0 ? (
              <div className="py-8 text-center">
                <BookOpen className="w-10 h-10 text-text-secondary/30 mx-auto mb-2" />
                <p className="font-inter text-sm text-text-secondary">No schedule data for this period.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full">
                  <thead>
                    <tr className="bg-background">
                      <th className="px-4 py-3 text-left text-xs font-poppins font-semibold text-text-secondary uppercase tracking-wide border-b border-border">Subject</th>
                      <th className="px-4 py-3 text-center text-xs font-poppins font-semibold text-text-secondary uppercase tracking-wide border-b border-border w-28">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalSubjects.map((s: any, i: number) => {
                      const g = modalGrades.find((gr: any) => gr.subjectId === s.subjectId)
                      return (
                        <tr key={s.subjectId} className={i % 2 === 0 ? 'bg-surface' : 'bg-background'}>
                          <td className="px-4 py-3 border-b border-border/50">
                            <p className="font-inter font-medium text-text-primary text-sm">{s.subject?.name}</p>
                            <p className="font-mono text-[10px] text-text-secondary mt-0.5">{s.subject?.code}</p>
                          </td>
                          <td className="px-4 py-3 border-b border-border/50 text-center">
                            {g ? (
                              <span className={`font-poppins font-bold text-lg ${g.grade >= 75 ? 'text-success' : 'text-danger'}`}>
                                {g.grade}
                              </span>
                            ) : (
                              <span className="text-xs font-inter text-text-secondary/50 italic">Not released</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                    {/* Average row */}
                    <tr className="bg-primary-light">
                      <td className="px-4 py-3 text-right">
                        <span className="font-poppins font-semibold text-sm text-text-primary">General Average</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {modalAverage ? (
                          <span className={`font-poppins font-bold text-xl ${parseFloat(modalAverage) >= 75 ? 'text-success' : 'text-danger'}`}>
                            {modalAverage}
                          </span>
                        ) : (
                          <span className="text-xs font-inter text-text-secondary/50 italic">—</span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            <p className="text-[11px] font-inter text-text-secondary/60 italic text-center">
              * Only released grades are shown. Blank entries have not yet been submitted by the subject teacher.
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
