import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../lib/auth'
import { structureApi, presentationsApi } from '../../lib/api'
import { BookOpen, User, ChevronDown, FileText, Image, Film, FileSpreadsheet, File, Download, ExternalLink, X, Calendar } from 'lucide-react'
import { LoadingSpinner, EmptyState } from '../../components/ui/EmptyState'
import { Modal } from '../../components/ui/Modal'

// ─── File icon helper ─────────────────────────────────────────────────────────
function FileIcon({ type }: { type: string }) {
  if (type === 'image') return <Image className="w-5 h-5 text-blue-500" />
  if (type === 'pdf') return <FileText className="w-5 h-5 text-red-500" />
  if (type === 'pptx') return <FileSpreadsheet className="w-5 h-5 text-orange-500" />
  if (type === 'doc') return <FileText className="w-5 h-5 text-blue-600" />
  if (type === 'video') return <Film className="w-5 h-5 text-purple-500" />
  return <File className="w-5 h-5 text-text-secondary" />
}

function typeLabel(type: string) {
  const map: Record<string, string> = { image: 'Image', pdf: 'PDF', pptx: 'Presentation', doc: 'Document', video: 'Video' }
  return map[type] || 'File'
}

// ─── Subject color from code ──────────────────────────────────────────────────
const SUBJECT_COLORS = [
  'bg-primary-light text-primary', 'bg-info/10 text-info', 'bg-success/10 text-success',
  'bg-accent/10 text-accent', 'bg-secondary/10 text-secondary', 'bg-warning/10 text-yellow-700',
]
function subjectColor(idx: number) { return SUBJECT_COLORS[idx % SUBJECT_COLORS.length] }

export default function StudentSubjects() {
  const { user } = useAuth()
  const currentAssignment = user?.profile?.sectionAssignments?.[0]

  const [selectedYearId, setSelectedYearId] = useState<string>('')
  const [subjectModal, setSubjectModal] = useState<any>(null)

  // Academic years
  const { data: years = [] } = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => structureApi.getAcademicYears().then(r => r.data),
  })

  // Auto-select most recent / current year
  const resolvedYearId = useMemo(() => {
    if (selectedYearId) return selectedYearId
    const sorted = [...(years as any[])].sort((a, b) => {
      if (a.isCurrent) return -1
      if (b.isCurrent) return 1
      return b.name.localeCompare(a.name)
    })
    return sorted[0]?.id || ''
  }, [years, selectedYearId])

  // Schedules for current section + selected year
  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ['student-schedules-subjects', currentAssignment?.sectionId, resolvedYearId],
    queryFn: () => structureApi.getSchedules({
      sectionId: currentAssignment?.sectionId,
      academicYearId: resolvedYearId || undefined,
      status: 'published',
    }).then(r => r.data),
    enabled: !!currentAssignment?.sectionId,
  })

  // Deduplicate by subjectId
  const subjects = useMemo(() => {
    return Array.from(new Map((schedules as any[]).map((s: any) => [s.subjectId, s])).values())
  }, [schedules])

  // Files for open subject
  const { data: files = [], isLoading: filesLoading } = useQuery({
    queryKey: ['subject-files', subjectModal?.subjectId, subjectModal?.sectionId],
    queryFn: () => presentationsApi.getAll({
      subjectId: subjectModal.subjectId,
      sectionId: subjectModal.sectionId,
    }).then(r => r.data),
    enabled: !!subjectModal?.subjectId,
  })

  const selectedYear = (years as any[]).find((y: any) => y.id === resolvedYearId)

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Subjects</h1>
          <p className="text-text-secondary font-inter text-sm mt-1">
            Your enrolled subjects · Click any card to view materials
          </p>
        </div>

        {/* Year filter */}
        {(years as any[]).length > 0 && (
          <div className="relative">
            <select
              className="appearance-none pl-3 pr-8 py-2 bg-surface border border-border rounded-xl text-sm font-inter text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
              value={resolvedYearId}
              onChange={e => setSelectedYearId(e.target.value)}
            >
              {(years as any[]).map((y: any) => (
                <option key={y.id} value={y.id}>
                  {y.isCurrent ? `${y.name} (Current)` : y.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-secondary pointer-events-none" />
          </div>
        )}
      </div>

      {/* Year badge */}
      {selectedYear && (
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-text-secondary" />
          <span className="text-sm font-inter text-text-secondary">
            Academic Year <span className="font-medium text-text-primary">{selectedYear.name}</span>
            {selectedYear.isCurrent && <span className="ml-2 badge bg-success/10 text-success text-[10px]">Current</span>}
          </span>
        </div>
      )}

      {isLoading ? <LoadingSpinner /> : subjects.length === 0 ? (
        <EmptyState
          title="No Subjects Found"
          description={`No published subjects for ${selectedYear?.name || 'this year'}. Contact your teacher or admin.`}
          icon={<BookOpen className="w-8 h-8 text-primary" />}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {subjects.map((s: any, idx: number) => (
            <button
              key={s.subjectId}
              onClick={() => setSubjectModal(s)}
              className="card text-left group hover:border-primary/40 hover:shadow-md transition-all duration-200 border border-border cursor-pointer"
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${subjectColor(idx)}`}>
                  <BookOpen className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-poppins font-semibold text-text-primary group-hover:text-primary transition-colors leading-tight">
                    {s.subject?.name}
                  </h3>
                  <p className="text-xs text-text-secondary font-inter mt-0.5 font-mono">{s.subject?.code}</p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <User className="w-3.5 h-3.5 text-text-secondary flex-shrink-0" />
                    <span className="text-xs text-text-secondary font-inter truncate">
                      {s.teacher?.fullName || 'Unassigned'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <ExternalLink className="w-3 h-3 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity font-inter">View materials</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Subject detail modal */}
      <Modal
        open={!!subjectModal}
        onClose={() => setSubjectModal(null)}
        title=""
        size="lg"
      >
        {subjectModal && (
          <div className="space-y-4">
            {/* Subject header */}
            <div className="flex items-start gap-4 pb-4 border-b border-border">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${subjectColor(subjects.findIndex((s: any) => s.subjectId === subjectModal.subjectId))}`}>
                <BookOpen className="w-7 h-7" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-poppins font-bold text-text-primary text-lg leading-tight">{subjectModal.subject?.name}</h2>
                <p className="text-xs text-text-secondary font-mono mt-0.5">{subjectModal.subject?.code}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <User className="w-3.5 h-3.5 text-text-secondary" />
                  <span className="text-sm text-text-secondary font-inter">{subjectModal.teacher?.fullName || 'Unassigned'}</span>
                </div>
              </div>
            </div>

            {/* Materials */}
            <div>
              <h3 className="font-poppins font-semibold text-text-primary mb-3 text-sm">
                Class Materials <span className="text-text-secondary font-normal font-inter">({(files as any[]).length} file{(files as any[]).length !== 1 ? 's' : ''})</span>
              </h3>

              {filesLoading ? <LoadingSpinner /> : (files as any[]).length === 0 ? (
                <div className="py-10 text-center">
                  <FileText className="w-10 h-10 text-text-secondary/30 mx-auto mb-3" />
                  <p className="font-inter text-sm text-text-secondary">No files uploaded yet</p>
                  <p className="font-inter text-xs text-text-secondary/60 mt-0.5">Your teacher hasn't uploaded any materials for this subject.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {(files as any[]).map((f: any) => (
                    <a
                      key={f.id}
                      href={f.filePath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-xl bg-background hover:bg-primary-light border border-transparent hover:border-primary/20 transition-all group"
                    >
                      <div className="w-9 h-9 rounded-xl bg-surface flex items-center justify-center flex-shrink-0 border border-border group-hover:border-primary/30 transition-colors">
                        <FileIcon type={f.fileType} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-inter font-medium text-sm text-text-primary truncate">{f.title}</p>
                        <p className="font-inter text-xs text-text-secondary mt-0.5">
                          {typeLabel(f.fileType)} · {f.originalName}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-text-secondary group-hover:text-primary transition-colors flex-shrink-0">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
