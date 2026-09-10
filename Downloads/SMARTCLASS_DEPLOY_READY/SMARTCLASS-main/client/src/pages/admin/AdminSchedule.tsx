import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { structureApi, teachersApi } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { LoadingSpinner, EmptyState } from '../../components/ui/EmptyState'
import {
  Plus, ChevronRight, Calendar, LayoutGrid, GraduationCap,
  CalendarDays, Pencil, Trash2, Upload, CheckCircle2, Users,
  AlertTriangle, BookOpen, X,
} from 'lucide-react'

// ─── Calendar constants ────────────────────────────────────────────────────────
const DAYS       = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const HOUR_START  = 6
const HOUR_END    = 18
const SLOT_MIN    = 30
const TOTAL_SLOTS = ((HOUR_END - HOUR_START) * 60) / SLOT_MIN  // 24 slots
const SLOT_H      = 38

const PALETTE = [
  '#6366f1','#8b5cf6','#a855f7','#ec4899',
  '#f43f5e','#f97316','#eab308','#22c55e',
  '#14b8a6','#06b6d4','#3b82f6','#64748b',
]
const DEFAULT_COLOR = PALETTE[0]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeToSlot(t: string): number {
  const [h = '0', m = '0'] = t.split(':')
  return ((parseInt(h, 10) - HOUR_START) * 60 + parseInt(m, 10)) / SLOT_MIN
}
function slotToTime(slot: number): string {
  const total = slot * SLOT_MIN + HOUR_START * 60
  const h = Math.floor(total / 60), m = total % 60
  return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`
}
function slotLabel(i: number): string {
  const total = i * SLOT_MIN + HOUR_START * 60
  const h = Math.floor(total / 60), m = total % 60
  const ap = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${m.toString().padStart(2,'0')} ${ap}`
}
function textColorForBg(hex: string): string {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
  return (0.299*r + 0.587*g + 0.114*b)/255 > 0.55 ? '#1e293b' : '#ffffff'
}
function checkConflict(
  all: any[], teacherId: string, day: string,
  startTime: string, endTime: string, excludeId?: string,
): any | null {
  if (!teacherId || !day || !startTime || !endTime) return null
  const s = timeToSlot(startTime), e = timeToSlot(endTime)
  if (s >= e) return null
  return all.find(x =>
    x.teacherId === teacherId &&
    x.dayOfWeek === day &&
    x.id !== excludeId &&
    timeToSlot(x.startTime ?? '0:0') < e &&
    timeToSlot(x.endTime   ?? '0:0') > s,
  ) ?? null
}

// ─── ColorPicker ──────────────────────────────────────────────────────────────
function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium font-inter text-text-primary mb-2">Block Color</label>
      <div className="flex flex-wrap gap-2">
        {PALETTE.map(c => (
          <button key={c} type="button" onClick={() => onChange(c)}
            className="w-7 h-7 rounded-lg transition-transform hover:scale-110 focus:outline-none"
            style={{ background: c, boxShadow: value === c ? `0 0 0 2px white,0 0 0 4px ${c}` : undefined, transform: value === c ? 'scale(1.15)' : undefined }}
          />
        ))}
      </div>
    </div>
  )
}

// ─── ScheduleBlock ────────────────────────────────────────────────────────────
interface BlockProps { schedule: any; showSection?: boolean; onEdit?: (s: any) => void; onDelete?: (id: string) => void; onDragStart?: (e: React.DragEvent, s: any) => void }
function ScheduleBlock({ schedule, showSection, onEdit, onDelete, onDragStart }: BlockProps) {
  const rawStart = timeToSlot(schedule.startTime ?? '06:00')
  const rawEnd   = timeToSlot(schedule.endTime   ?? '07:30')

  // Clamp to visible grid so cards never bleed above/below
  const visStart = Math.max(0, Math.min(rawStart, TOTAL_SLOTS - 1))
  const visEnd   = Math.max(visStart + 1, Math.min(rawEnd, TOTAL_SLOTS))

  // Actual duration in slots (drives which text rows to show)
  const span     = Math.max(1, rawEnd - rawStart)
  // Pixel height of the rendered card
  const heightPx = (visEnd - visStart) * SLOT_H - 4

  const color    = schedule.color || DEFAULT_COLOR
  const tc       = textColorForBg(color)
  const isDraft  = schedule.status !== 'published'
  const editable = !!onEdit

  // Font sizes scale with visible card height
  const codeFontSize = heightPx < 42 ? '8px' : heightPx < 72 ? '10px' : '11px'
  const bodyFontSize = heightPx < 72 ? '8px' : '9px'

  // Row budget: how many text lines can actually fit (edit buttons take ~20px when present)
  const reservedPx  = editable ? 20 : 0
  const rowBudget   = Math.floor((heightPx - 8 - reservedPx) / 14)

  return (
    <div
      draggable={editable}
      onDragStart={editable && onDragStart ? e => onDragStart(e, schedule) : undefined}
      className={`absolute inset-x-1 rounded-xl overflow-hidden select-none group ${editable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
      style={{
        top: visStart * SLOT_H + 2,
        height: heightPx,
        background: isDraft ? `repeating-linear-gradient(45deg,${color},${color} 4px,${color}dd 4px,${color}dd 8px)` : color,
        color: tc, zIndex: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
        outline: isDraft ? `2px dashed ${tc}40` : undefined,
        outlineOffset: isDraft ? '-3px' : undefined,
      }}
    >
      <div className="h-full flex flex-col overflow-hidden" style={{ padding: heightPx < 42 ? '2px 4px' : '4px 8px' }}>
        {/* Content rows — vertically centered, clipped to visible height */}
        <div className="flex-1 min-h-0 flex flex-col justify-center gap-0.5 overflow-hidden">
          {isDraft && rowBudget >= 2 && (
            <span className="inline-block text-[8px] font-bold px-1 py-0.5 rounded uppercase tracking-wide self-start"
              style={{ background: `${tc}25`, color: tc }}>DRAFT</span>
          )}
          {/* Subject code — always shown */}
          <p className="font-poppins font-bold leading-tight truncate"
            style={{ fontSize: codeFontSize }}>
            {schedule.subject?.code}
          </p>
          {/* Subject name — ≥1 hr actual AND enough room */}
          {rowBudget >= 2 && span >= 2 && (
            <p className="font-inter leading-tight truncate opacity-90" style={{ fontSize: bodyFontSize }}>
              {schedule.subject?.name}
            </p>
          )}
          {/* Teacher or section — ≥1.5 hr actual AND enough room */}
          {rowBudget >= 3 && span >= 3 && (
            <p className="font-inter leading-tight truncate opacity-70" style={{ fontSize: bodyFontSize }}>
              {showSection ? schedule.section?.name : schedule.teacher?.fullName}
            </p>
          )}
          {/* Time range — ≥2 hr actual AND enough room */}
          {rowBudget >= 4 && span >= 4 && (
            <p className="font-inter leading-tight opacity-60" style={{ fontSize: bodyFontSize }}>
              {schedule.startTime}–{schedule.endTime}
            </p>
          )}
        </div>
        {/* Edit/delete actions pinned to bottom, only visible on hover */}
        {editable && (
          <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity pt-0.5">
            <button onClick={e => { e.stopPropagation(); onEdit!(schedule) }} className="p-1 rounded-md hover:bg-black/20 transition-colors"><Pencil className="w-3 h-3" /></button>
            <button onClick={e => { e.stopPropagation(); onDelete!(schedule.id) }} className="p-1 rounded-md hover:bg-black/20 transition-colors"><Trash2 className="w-3 h-3" /></button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Read-only weekly grid (used in teacher modal) ────────────────────────────
function TeacherGrid({ schedules }: { schedules: any[] }) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[680px]">
        <div className="flex mb-2 pl-14">
          {DAY_LABELS.map(l => (
            <div key={l} className="flex-1 mx-0.5 py-2 rounded-xl text-center bg-background">
              <p className="font-poppins font-semibold text-xs text-text-secondary">{l}</p>
            </div>
          ))}
        </div>
        <div className="flex" style={{ height: TOTAL_SLOTS * SLOT_H }}>
          <div className="w-14 flex-shrink-0 relative select-none">
            {Array.from({ length: TOTAL_SLOTS + 1 }).map((_, i) => (
              <div key={i} className="absolute right-2 text-right leading-none" style={{ top: i * SLOT_H - 7 }}>
                {i % 2 === 0
                  ? <span className="text-[10px] text-text-secondary font-medium font-inter">{slotLabel(i)}</span>
                  : <span className="text-[9px] text-text-secondary/30 font-inter">·</span>
                }
              </div>
            ))}
          </div>
          {DAYS.map(day => {
            const daySched = schedules.filter((s: any) => s.dayOfWeek === day)
            return (
              <div key={day} className="flex-1 relative mx-0.5 rounded-xl overflow-hidden bg-background/70">
                {Array.from({ length: TOTAL_SLOTS }).map((_, i) => (
                  <div key={i} className="absolute left-0 right-0 pointer-events-none"
                    style={{ top: i * SLOT_H, borderTop: i % 2 === 0 ? '1px solid rgba(0,0,0,0.07)' : '1px dashed rgba(0,0,0,0.03)' }} />
                ))}
                {daySched.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-[10px] text-text-secondary/20 font-inter">—</span>
                  </div>
                )}
                {daySched.map((s: any) => (
                  <ScheduleBlock key={s.id} schedule={s} showSection />
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────
type View = 'years' | 'sections' | 'grid'
type TopTab = 'sections' | 'teachers'
interface FormState { subjectId: string; teacherId: string; dayOfWeek: string; startTime: string; endTime: string; color: string; description: string }
const EMPTY_FORM: FormState = { subjectId: '', teacherId: '', dayOfWeek: 'Monday', startTime: '07:00', endTime: '08:30', color: DEFAULT_COLOR, description: '' }

// ─── Main Component ────────────────────────────────────────────────────────────
export default function AdminSchedule() {
  const qc = useQueryClient()

  // Top-level tabs
  const [topTab, setTopTab] = useState<TopTab>('sections')

  // Section schedules drill-down
  const [view,            setView]            = useState<View>('years')
  const [selectedYear,    setSelectedYear]    = useState<any>(null)
  const [selectedSection, setSelectedSection] = useState<any>(null)

  // Teacher schedule modal
  const [teacherModal, setTeacherModal] = useState<any>(null)

  // Block modal
  const [modal,            setModal]            = useState<'year' | 'block' | null>(null)
  const [editingSchedule,  setEditingSchedule]  = useState<any>(null)
  const [form,             setForm]             = useState<FormState>(EMPTY_FORM)
  const [yearForm,         setYearForm]         = useState({ name: '', isCurrent: false })
  const [dragOverDay,      setDragOverDay]      = useState<string | null>(null)
  const [confirmDelete,    setConfirmDelete]    = useState<string | null>(null)
  const [dragConflict,     setDragConflict]     = useState<string | null>(null)
  const gridRef   = useRef<HTMLDivElement>(null)
  const dragData  = useRef<{ scheduleId: string; offsetY: number } | null>(null)

  // Clear drag conflict after 4s
  useEffect(() => {
    if (!dragConflict) return
    const t = setTimeout(() => setDragConflict(null), 4000)
    return () => clearTimeout(t)
  }, [dragConflict])

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: years    = [], isLoading: yearsLoading }    = useQuery({ queryKey: ['academic-years'],   queryFn: () => structureApi.getAcademicYears().then(r => r.data) })
  const { data: sections = [], isLoading: sectionsLoading } = useQuery({ queryKey: ['sections'],          queryFn: () => structureApi.getSections().then(r => r.data) })
  const { data: subjects = [] }                             = useQuery({ queryKey: ['subjects'],           queryFn: () => structureApi.getSubjects().then(r => r.data) })
  const { data: teachers = [], isLoading: teachersLoading } = useQuery({ queryKey: ['teachers'],           queryFn: () => teachersApi.getAll().then(r => r.data) })

  // All schedules — used for conflict detection and teacher tab
  const { data: allSchedules = [] } = useQuery({
    queryKey: ['all-schedules-admin'],
    queryFn:  () => structureApi.getSchedules().then(r => r.data),
    staleTime: 15000,
  })

  // Section-specific schedules for the grid view
  const { data: schedules = [], isLoading: schedLoading } = useQuery({
    queryKey: ['schedules', selectedSection?.id, selectedYear?.id],
    queryFn:  () => structureApi.getSchedules({ sectionId: selectedSection?.id, academicYearId: selectedYear?.id }).then(r => r.data),
    enabled:  view === 'grid' && !!selectedSection?.id && !!selectedYear?.id,
  })

  // ── Mutations ────────────────────────────────────────────────────────────────
  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['schedules'] })
    qc.invalidateQueries({ queryKey: ['all-schedules-admin'] })
  }, [qc])

  const createYear     = useMutation({ mutationFn: (d: any) => structureApi.createAcademicYear(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['academic-years'] }); setModal(null); setYearForm({ name: '', isCurrent: false }) } })
  const createSchedule = useMutation({ mutationFn: (d: any) => structureApi.createSchedule(d),     onSuccess: () => { invalidate(); closeBlockModal() } })
  const updateSchedule = useMutation({ mutationFn: ({ id, data }: { id: string; data: any }) => structureApi.updateSchedule(id, data), onSuccess: () => { invalidate(); closeBlockModal() } })
  const deleteSchedule = useMutation({ mutationFn: (id: string) => structureApi.deleteSchedule(id), onSuccess: () => { invalidate(); setConfirmDelete(null) } })
  const publishMut     = useMutation({
    mutationFn: () => structureApi.publishSchedules({ sectionId: selectedSection!.id, academicYearId: selectedYear!.id }),
    onSuccess:  () => { invalidate() },
  })

  // ── Conflict detection ───────────────────────────────────────────────────────
  const conflictInfo = useMemo(
    () => modal === 'block'
      ? checkConflict(allSchedules as any[], form.teacherId, form.dayOfWeek, form.startTime, form.endTime, editingSchedule?.id)
      : null,
    [modal, form.teacherId, form.dayOfWeek, form.startTime, form.endTime, editingSchedule?.id, allSchedules],
  )

  // ── Publish state ────────────────────────────────────────────────────────────
  const unpublishedCount = useMemo(
    () => (schedules as any[]).filter((s: any) => (s.status ?? 'draft') !== 'published').length,
    [schedules],
  )

  // ── Block modal helpers ──────────────────────────────────────────────────────
  function openAddBlock(day?: string, startSlot?: number) {
    setEditingSchedule(null)
    setForm({
      ...EMPTY_FORM,
      dayOfWeek: day || 'Monday',
      startTime: startSlot !== undefined ? slotToTime(startSlot) : '07:00',
      endTime:   startSlot !== undefined ? slotToTime(startSlot + 3) : '08:30',
      subjectId: (subjects as any[])[0]?.id || '',
      teacherId: (teachers as any[])[0]?.id || '',
    })
    setModal('block')
  }
  function openEditBlock(s: any) {
    setEditingSchedule(s)
    setForm({ subjectId: s.subjectId || '', teacherId: s.teacherId || '', dayOfWeek: s.dayOfWeek || 'Monday', startTime: s.startTime || '07:00', endTime: s.endTime || '08:30', color: s.color || DEFAULT_COLOR, description: s.description || '' })
    setModal('block')
  }
  function closeBlockModal() { setModal(null); setEditingSchedule(null); setForm(EMPTY_FORM) }
  function submitBlock() {
    const payload = { subjectId: form.subjectId, teacherId: form.teacherId, sectionId: selectedSection?.id, academicYearId: selectedYear?.id, dayOfWeek: form.dayOfWeek, startTime: form.startTime, endTime: form.endTime, color: form.color, description: form.description }
    if (editingSchedule) updateSchedule.mutate({ id: editingSchedule.id, data: payload })
    else createSchedule.mutate(payload)
  }
  const isBlockValid = !!form.subjectId && !!form.teacherId && !!form.startTime && !!form.endTime

  // ── Drag & Drop ──────────────────────────────────────────────────────────────
  function handleDragStart(e: React.DragEvent, s: any) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    dragData.current = { scheduleId: s.id, offsetY: e.clientY - rect.top }
    e.dataTransfer.effectAllowed = 'move'
  }
  function handleDragOver(e: React.DragEvent, day: string) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverDay(day) }
  function handleDrop(e: React.DragEvent, day: string) {
    e.preventDefault(); setDragOverDay(null)
    if (!dragData.current || !gridRef.current) return
    const { scheduleId, offsetY } = dragData.current
    const relY = e.clientY - gridRef.current.getBoundingClientRect().top - offsetY
    const snapped = Math.round(relY / SLOT_H * 2) / 2
    const clamped = Math.max(0, Math.min(TOTAL_SLOTS - 1, snapped))
    const s = (schedules as any[]).find((x: any) => x.id === scheduleId)
    if (!s) return
    const dur = timeToSlot(s.endTime ?? '0:0') - timeToSlot(s.startTime ?? '0:0')
    const ns = Math.min(clamped, TOTAL_SLOTS - dur)
    const newStart = slotToTime(ns), newEnd = slotToTime(ns + dur)
    const conflict = checkConflict(allSchedules as any[], s.teacherId, day, newStart, newEnd, scheduleId)
    if (conflict) {
      setDragConflict(`⚠️ ${s.teacher?.fullName} already has ${conflict.subject?.name || 'a class'} at this time on ${day}`)
    }
    updateSchedule.mutate({ id: scheduleId, data: { subjectId: s.subjectId, teacherId: s.teacherId, sectionId: s.sectionId, academicYearId: s.academicYearId, dayOfWeek: day, startTime: newStart, endTime: newEnd, color: s.color, description: s.description } })
    dragData.current = null
  }
  function handleColumnClick(e: React.MouseEvent, day: string) {
    if ((e.target as HTMLElement).closest('[data-block]')) return
    if (!gridRef.current) return
    const relY = e.clientY - gridRef.current.getBoundingClientRect().top
    const snapped = Math.round(relY / SLOT_H * 2) / 2
    openAddBlock(day, Math.max(0, Math.min(TOTAL_SLOTS - 3, snapped)))
  }

  // ── Teacher tab data ─────────────────────────────────────────────────────────
  const teachersByDept = useMemo(() => {
    const map: Record<string, any[]> = {}
    ;(teachers as any[]).forEach((t: any) => {
      const dept = t.department || 'General'
      if (!map[dept]) map[dept] = []
      map[dept].push(t)
    })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [teachers])

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: top-level tabs
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 animate-fade-in">
      {/* Top-level tabs */}
      <div className="flex gap-1 border-b border-border pb-0">
        {([['sections','Section Schedules','CalendarDays'],['teachers','Teacher Schedules','Users']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTopTab(key as TopTab)}
            className={`flex items-center gap-2 px-4 py-3 font-poppins font-medium text-sm border-b-2 transition-colors -mb-px whitespace-nowrap ${topTab === key ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}>
            {key === 'sections' ? <CalendarDays className="w-4 h-4" /> : <Users className="w-4 h-4" />}
            {label}
          </button>
        ))}
      </div>

      {/* ── TEACHER SCHEDULES TAB ────────────────────────────────────────────── */}
      {topTab === 'teachers' && (
        <div className="space-y-6">
          <div>
            <h1 className="page-title">Teacher Schedules</h1>
            <p className="text-text-secondary font-inter text-sm mt-1">
              All teacher schedules by department. Changes to section schedules reflect here automatically.
            </p>
          </div>

          {teachersLoading ? <LoadingSpinner /> : teachersByDept.length === 0 ? (
            <EmptyState title="No Teachers" description="Add teachers first." icon={<Users className="w-8 h-8 text-primary" />} />
          ) : (
            <div className="space-y-8">
              {teachersByDept.map(([dept, deptTeachers]) => (
                <div key={dept}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-xl bg-secondary/10 flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-4 h-4 text-secondary" />
                    </div>
                    <h2 className="font-poppins font-semibold text-text-primary">{dept}</h2>
                    <span className="badge bg-border text-text-secondary">{deptTeachers.length} teacher{deptTeachers.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {deptTeachers.map((t: any) => {
                      const tSchedules = (allSchedules as any[]).filter((s: any) => s.teacherId === t.id)
                      const subjectCount = new Set(tSchedules.map((s: any) => s.subjectId)).size
                      return (
                        <button key={t.id} onClick={() => setTeacherModal(t)}
                          className="card text-left group hover:border-primary/40 hover:shadow-md transition-all duration-200 border border-border">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                              <GraduationCap className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-poppins font-semibold text-text-primary text-sm truncate">{t.fullName}</p>
                              <p className="text-xs text-text-secondary font-inter mt-0.5">
                                {tSchedules.length} block{tSchedules.length !== 1 ? 's' : ''} · {subjectCount} subject{subjectCount !== 1 ? 's' : ''}
                              </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-text-secondary group-hover:text-primary transition-colors flex-shrink-0" />
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Teacher schedule modal */}
          <Modal
            open={!!teacherModal}
            onClose={() => setTeacherModal(null)}
            title={teacherModal ? `${teacherModal.fullName} — Schedule` : ''}
            size="xl"
          >
            {teacherModal && (() => {
              const tSchedules = (allSchedules as any[]).filter((s: any) => s.teacherId === teacherModal.id)
              return tSchedules.length === 0 ? (
                <EmptyState title="No Schedule Blocks" description="No schedule has been assigned to this teacher yet." icon={<CalendarDays className="w-8 h-8 text-primary" />} />
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 flex-wrap text-sm font-inter text-text-secondary">
                    <span>{tSchedules.length} block{tSchedules.length !== 1 ? 's' : ''}</span>
                    <span>·</span>
                    <span>{new Set(tSchedules.map((s: any) => s.subjectId)).size} subject{new Set(tSchedules.map((s: any) => s.subjectId)).size !== 1 ? 's' : ''}</span>
                    <span>·</span>
                    <span>{new Set(tSchedules.map((s: any) => s.sectionId)).size} section{new Set(tSchedules.map((s: any) => s.sectionId)).size !== 1 ? 's' : ''}</span>
                    <span className="ml-auto text-[11px] italic opacity-60">Blocks show section name · Striped = draft</span>
                  </div>
                  <TeacherGrid schedules={tSchedules} />
                  {/* Legend */}
                  <div className="flex flex-wrap gap-4 pt-3 border-t border-border">
                    {Array.from(new Map(tSchedules.map((s: any) => [s.subjectId, s]))).map(([, s]: any) => (
                      <div key={s.subjectId} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: s.color || DEFAULT_COLOR }} />
                        <span className="font-inter text-xs text-text-secondary">
                          <span className="font-medium text-text-primary">{s.subject?.code}</span> — {s.subject?.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
          </Modal>
        </div>
      )}

      {/* ── SECTION SCHEDULES TAB ────────────────────────────────────────────── */}
      {topTab === 'sections' && (
        <>
          {/* ── YEARS VIEW ── */}
          {view === 'years' && (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h1 className="page-title">Class Schedules</h1>
                  <p className="text-text-secondary font-inter text-sm mt-1">Select a school year to manage section schedules.</p>
                </div>
                <Button onClick={() => setModal('year')} icon={<Plus className="w-4 h-4" />} size="sm">Add School Year</Button>
              </div>

              {yearsLoading ? <LoadingSpinner /> : (years as any[]).length === 0 ? (
                <EmptyState title="No School Years" description="Add a school year to start building schedules." icon={<CalendarDays className="w-8 h-8 text-primary" />} />
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(years as any[]).map((y: any) => (
                    <button key={y.id} onClick={() => { setSelectedYear(y); setView('sections') }}
                      className="card text-left group hover:border-primary/40 hover:shadow-md transition-all duration-200 border border-border">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary-light flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                          <CalendarDays className="w-6 h-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-poppins font-semibold text-text-primary">{y.name}</p>
                            {y.isCurrent && <span className="badge bg-success/10 text-success text-[11px]">Current</span>}
                          </div>
                          <p className="text-xs text-text-secondary font-inter mt-0.5">{(sections as any[]).length} sections available</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-text-secondary group-hover:text-primary transition-colors flex-shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <Modal open={modal === 'year'} onClose={() => { setModal(null); setYearForm({ name:'', isCurrent:false }) }} title="New School Year" size="sm"
                footer={<div className="flex gap-3 justify-end"><Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button><Button loading={createYear.isPending} onClick={() => createYear.mutate(yearForm)} disabled={!yearForm.name}>Create</Button></div>}>
                <div className="space-y-4">
                  <Input label="Academic Year *" placeholder="2024-2025" value={yearForm.name} onChange={e => setYearForm(f => ({ ...f, name: e.target.value }))} />
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="isCurrent" checked={yearForm.isCurrent} onChange={e => setYearForm(f => ({ ...f, isCurrent: e.target.checked }))} className="w-4 h-4 accent-primary" />
                    <label htmlFor="isCurrent" className="text-sm font-inter text-text-primary">Set as current year</label>
                  </div>
                </div>
              </Modal>
            </div>
          )}

          {/* ── SECTIONS VIEW ── */}
          {view === 'sections' && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-sm font-inter text-text-secondary">
                <button onClick={() => setView('years')} className="hover:text-primary transition-colors">School Years</button>
                <ChevronRight className="w-3.5 h-3.5" />
                <span className="text-text-primary font-medium">{selectedYear?.name}</span>
              </div>
              <div>
                <h1 className="page-title">Sections — {selectedYear?.name}</h1>
                <p className="text-text-secondary font-inter text-sm mt-1">Select a section to view and edit its class schedule.</p>
              </div>
              {sectionsLoading ? <LoadingSpinner /> : (sections as any[]).length === 0 ? (
                <EmptyState title="No Sections" description="Create sections in Academic Structure first." icon={<LayoutGrid className="w-8 h-8 text-primary" />} />
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(sections as any[]).map((sec: any) => (
                    <button key={sec.id} onClick={() => { setSelectedSection(sec); setView('grid') }}
                      className="card text-left group hover:border-primary/40 hover:shadow-md transition-all duration-200 border border-border">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-secondary/20 transition-colors">
                          <GraduationCap className="w-6 h-6 text-secondary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-poppins font-semibold text-text-primary">{sec.name}</p>
                          <p className="text-xs text-text-secondary font-inter mt-0.5 truncate">
                            {sec.gradeLevel?.name}{sec.strand ? ` · ${sec.strand.name}` : ''}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-text-secondary group-hover:text-primary transition-colors flex-shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── GRID VIEW ── */}
          {view === 'grid' && (
            <div className="space-y-4">
              {/* Breadcrumb */}
              <div className="flex items-center gap-2 text-sm font-inter text-text-secondary flex-wrap">
                <button onClick={() => setView('years')} className="hover:text-primary transition-colors">School Years</button>
                <ChevronRight className="w-3.5 h-3.5" />
                <button onClick={() => setView('sections')} className="hover:text-primary transition-colors">{selectedYear?.name}</button>
                <ChevronRight className="w-3.5 h-3.5" />
                <span className="text-text-primary font-medium">{selectedSection?.name}</span>
              </div>

              {/* Header */}
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h1 className="page-title">{selectedSection?.name} — Class Schedule</h1>
                  <p className="text-text-secondary font-inter text-sm mt-1">
                    {selectedYear?.name} · Click empty slot or drag blocks to build the schedule
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                  {/* Publish button */}
                  {(schedules as any[]).length > 0 && (
                    unpublishedCount === 0 ? (
                      <div className="flex items-center gap-1.5 px-3 py-2 bg-success/10 text-success rounded-xl text-sm font-inter font-medium">
                        <CheckCircle2 className="w-4 h-4" />
                        All Published
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        icon={<Upload className="w-4 h-4" />}
                        loading={publishMut.isPending}
                        onClick={() => publishMut.mutate()}
                        className="bg-success hover:bg-success/90 text-white"
                      >
                        Publish Schedule{unpublishedCount > 0 ? ` (${unpublishedCount})` : ''}
                      </Button>
                    )
                  )}
                  <Button onClick={() => openAddBlock()} icon={<Plus className="w-4 h-4" />} size="sm">Add Block</Button>
                </div>
              </div>

              {/* Publish info bar */}
              {unpublishedCount > 0 && (schedules as any[]).length > 0 && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm font-inter text-amber-700">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span><strong>{unpublishedCount}</strong> block{unpublishedCount !== 1 ? 's are' : ' is'} unpublished. Students and teachers won't see them until you publish.</span>
                </div>
              )}

              {/* Drag conflict notification */}
              {dragConflict && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-danger/10 border border-danger/20 rounded-xl text-sm font-inter text-danger">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1">{dragConflict}</span>
                  <button onClick={() => setDragConflict(null)} className="p-1 hover:bg-danger/10 rounded-lg"><X className="w-3.5 h-3.5" /></button>
                </div>
              )}

              {/* Timetable card */}
              <div className="card overflow-hidden">
                {schedLoading ? <div className="py-16"><LoadingSpinner /></div> : (
                  <div className="overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6">
                    <div className="min-w-[700px]">

                      {/* Day headers */}
                      <div className="flex mb-2 pl-14">
                        {DAY_LABELS.map(label => (
                          <div key={label} className="flex-1 mx-0.5 py-2.5 rounded-xl text-center bg-background">
                            <p className="font-poppins font-semibold text-xs text-text-secondary">{label}</p>
                          </div>
                        ))}
                      </div>

                      {/* Grid body */}
                      <div className="flex" ref={gridRef} style={{ height: TOTAL_SLOTS * SLOT_H }}>

                        {/* Time axis — every 30 min labeled */}
                        <div className="w-14 flex-shrink-0 relative select-none">
                          {Array.from({ length: TOTAL_SLOTS + 1 }).map((_, i) => (
                            <div key={i} className="absolute right-2 text-right leading-none" style={{ top: i * SLOT_H - 7 }}>
                              {i % 2 === 0
                                ? <span className="text-[10px] text-text-secondary font-medium font-inter">{slotLabel(i)}</span>
                                : <span className="text-[9px] text-text-secondary/35 font-inter">{slotLabel(i)}</span>
                              }
                            </div>
                          ))}
                        </div>

                        {/* Day columns */}
                        {DAYS.map(day => {
                          const daySched = (schedules as any[]).filter((s: any) => s.dayOfWeek === day)
                          const isOver   = dragOverDay === day
                          return (
                            <div key={day}
                              className={`flex-1 relative mx-0.5 rounded-xl overflow-hidden transition-colors cursor-crosshair ${isOver ? 'bg-primary/10 ring-2 ring-primary/30' : 'bg-background/70 hover:bg-background'}`}
                              onDragOver={e => handleDragOver(e, day)}
                              onDragLeave={() => setDragOverDay(null)}
                              onDrop={e => handleDrop(e, day)}
                              onClick={e => handleColumnClick(e, day)}
                            >
                              {/* Hour/half-hour grid lines */}
                              {Array.from({ length: TOTAL_SLOTS }).map((_, i) => (
                                <div key={i} className="absolute left-0 right-0 pointer-events-none"
                                  style={{ top: i * SLOT_H, borderTop: i % 2 === 0 ? '1px solid rgba(0,0,0,0.07)' : '1px dashed rgba(0,0,0,0.03)' }} />
                              ))}
                              {daySched.length === 0 && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                  <span className="text-[10px] text-text-secondary/20 font-inter rotate-90 whitespace-nowrap">click to add</span>
                                </div>
                              )}
                              {daySched.map((s: any) => (
                                <div key={s.id} data-block="1">
                                  <ScheduleBlock schedule={s} onEdit={openEditBlock} onDelete={id => setConfirmDelete(id)} onDragStart={handleDragStart} />
                                </div>
                              ))}
                            </div>
                          )
                        })}
                      </div>

                      {/* Legend */}
                      {(schedules as any[]).length > 0 && (
                        <div className="flex flex-wrap gap-x-5 gap-y-2 mt-5 pt-4 border-t border-border">
                          {Array.from(new Map((schedules as any[]).map((s: any) => [s.subjectId, s]))).map(([, s]: any) => (
                            <div key={s.subjectId} className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: s.color || DEFAULT_COLOR }} />
                              <span className="font-inter text-xs text-text-secondary">
                                <span className="font-medium text-text-primary">{s.subject?.code}</span> — {s.subject?.name}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Add/Edit Block Modal ── */}
              <Modal open={modal === 'block'} onClose={closeBlockModal} title={editingSchedule ? 'Edit Schedule Block' : 'Add Schedule Block'} size="sm"
                footer={<div className="flex gap-3 justify-end"><Button variant="secondary" onClick={closeBlockModal}>Cancel</Button><Button loading={createSchedule.isPending || updateSchedule.isPending} onClick={submitBlock} disabled={!isBlockValid}>{editingSchedule ? 'Save Changes' : 'Add Block'}</Button></div>}>
                <div className="space-y-4">

                  {/* Conflict warning */}
                  {conflictInfo && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm font-inter text-amber-700">
                        <p className="font-semibold">Schedule Conflict</p>
                        <p className="text-xs mt-0.5">
                          {form.teacherId && (teachers as any[]).find((t:any)=>t.id===form.teacherId)?.fullName} already teaches <strong>{conflictInfo.subject?.name}</strong> ({conflictInfo.startTime}–{conflictInfo.endTime}) on {conflictInfo.dayOfWeek} for {conflictInfo.section?.name}. You can still save.
                        </p>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium font-inter text-text-primary mb-1.5">Subject *</label>
                    <select className="input-field" value={form.subjectId} onChange={e => setForm(f => ({ ...f, subjectId: e.target.value }))}>
                      <option value="">Select subject</option>
                      {(subjects as any[]).map((s: any) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium font-inter text-text-primary mb-1.5">Teacher *</label>
                    <select className="input-field" value={form.teacherId} onChange={e => setForm(f => ({ ...f, teacherId: e.target.value }))}>
                      <option value="">Select teacher</option>
                      {(teachers as any[]).map((t: any) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium font-inter text-text-primary mb-1.5">Day of Week</label>
                    <select className="input-field" value={form.dayOfWeek} onChange={e => setForm(f => ({ ...f, dayOfWeek: e.target.value }))}>
                      {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium font-inter text-text-primary mb-1.5">Start Time</label>
                      <input type="time" className="input-field" value={form.startTime} step="1800" onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium font-inter text-text-primary mb-1.5">End Time</label>
                      <input type="time" className="input-field" value={form.endTime} step="1800" onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
                    </div>
                  </div>
                  <ColorPicker value={form.color} onChange={c => setForm(f => ({ ...f, color: c }))} />
                  <Input label="Note (optional)" placeholder="e.g. Room 201" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
              </Modal>

              {/* ── Confirm Delete Modal ── */}
              <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Remove Schedule Block" size="sm"
                footer={<div className="flex gap-3 justify-end"><Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button><Button variant="danger" loading={deleteSchedule.isPending} onClick={() => confirmDelete && deleteSchedule.mutate(confirmDelete)}>Remove</Button></div>}>
                <p className="text-text-secondary font-inter text-sm">Are you sure you want to remove this schedule block? This cannot be undone.</p>
              </Modal>
            </div>
          )}
        </>
      )}
    </div>
  )
}
