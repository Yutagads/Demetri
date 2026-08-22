import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { structureApi } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { LoadingSpinner } from '../../components/ui/EmptyState'
import { Plus, BookOpen, LayoutGrid, GraduationCap, Calendar } from 'lucide-react'

export default function AdminAcademicStructure() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'years' | 'grades' | 'sections' | 'subjects'>('years')
  const [modal, setModal] = useState<string | null>(null)
  const [form, setForm] = useState<any>({})

  const { data: years = [], isLoading: yearsLoading } = useQuery({ queryKey: ['academic-years'], queryFn: () => structureApi.getAcademicYears().then(r => r.data) })
  const { data: grades = [], isLoading: gradesLoading } = useQuery({ queryKey: ['grade-levels'], queryFn: () => structureApi.getGradeLevels().then(r => r.data) })
  const { data: sections = [], isLoading: sectionsLoading } = useQuery({ queryKey: ['sections'], queryFn: () => structureApi.getSections().then(r => r.data) })
  const { data: subjects = [], isLoading: subjectsLoading } = useQuery({ queryKey: ['subjects'], queryFn: () => structureApi.getSubjects().then(r => r.data) })

  const createYear = useMutation({ mutationFn: (d: any) => structureApi.createAcademicYear(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['academic-years'] }); setModal(null) } })
  const createGrade = useMutation({ mutationFn: (d: any) => structureApi.createGradeLevel(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['grade-levels'] }); setModal(null) } })
  const createSection = useMutation({ mutationFn: (d: any) => structureApi.createSection(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['sections'] }); qc.invalidateQueries({ queryKey: ['dashboard-stats'] }); setModal(null) } })
  const createSubject = useMutation({ mutationFn: (d: any) => structureApi.createSubject(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['subjects'] }); qc.invalidateQueries({ queryKey: ['dashboard-stats'] }); setModal(null) } })

  const tabs = [
    { key: 'years', label: 'Academic Years', icon: <Calendar className="w-4 h-4" /> },
    { key: 'grades', label: 'Grade Levels', icon: <GraduationCap className="w-4 h-4" /> },
    { key: 'sections', label: 'Sections', icon: <LayoutGrid className="w-4 h-4" /> },
    { key: 'subjects', label: 'Subjects', icon: <BookOpen className="w-4 h-4" /> },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">Academic Structure</h1>
        <p className="text-text-secondary font-inter text-sm mt-1">Manage academic years, grade levels, sections, and subjects</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-0 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`flex items-center gap-2 px-4 py-3 font-poppins font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {tab === 'years' && (
        <div className="space-y-4">
          <div className="flex justify-end"><Button onClick={() => { setForm({}); setModal('year') }} icon={<Plus className="w-4 h-4" />} size="sm">Add Year</Button></div>
          {yearsLoading ? <LoadingSpinner /> : (
            <div className="grid sm:grid-cols-2 gap-3">
              {(years as any[]).map((y: any) => (
                <div key={y.id} className="card flex items-center gap-4">
                  <div className="w-10 h-10 bg-primary-light rounded-xl flex items-center justify-center"><Calendar className="w-5 h-5 text-primary" /></div>
                  <div>
                    <p className="font-poppins font-semibold text-text-primary">{y.name}</p>
                    {y.isCurrent && <span className="badge bg-success/10 text-success">Current</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'grades' && (
        <div className="space-y-4">
          <div className="flex justify-end"><Button onClick={() => { setForm({ order: 11 }); setModal('grade') }} icon={<Plus className="w-4 h-4" />} size="sm">Add Grade Level</Button></div>
          {gradesLoading ? <LoadingSpinner /> : (
            <div className="grid sm:grid-cols-2 gap-3">
              {(grades as any[]).map((g: any) => (
                <div key={g.id} className="card">
                  <p className="font-poppins font-semibold text-text-primary">{g.name}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {g.strands?.map((s: any) => <span key={s.id} className="badge bg-secondary/10 text-secondary">{s.name}</span>)}
                  </div>
                  <p className="text-xs text-text-secondary mt-2 font-inter">{g.sections?.length || 0} sections</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'sections' && (
        <div className="space-y-4">
          <div className="flex justify-end"><Button onClick={() => { setForm({}); setModal('section') }} icon={<Plus className="w-4 h-4" />} size="sm">Add Section</Button></div>
          {sectionsLoading ? <LoadingSpinner /> : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead><tr><th>Section</th><th>Grade Level</th><th>Strand</th><th>Status</th></tr></thead>
                <tbody>
                  {(sections as any[]).map((s: any) => (
                    <tr key={s.id}>
                      <td className="font-medium">{s.name}</td>
                      <td>{s.gradeLevel?.name}</td>
                      <td>{s.strand?.name || '—'}</td>
                      <td><span className="badge bg-success/10 text-success">{s.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'subjects' && (
        <div className="space-y-4">
          <div className="flex justify-end"><Button onClick={() => { setForm({}); setModal('subject') }} icon={<Plus className="w-4 h-4" />} size="sm">Add Subject</Button></div>
          {subjectsLoading ? <LoadingSpinner /> : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead><tr><th>Subject</th><th>Code</th><th>Description</th><th>Status</th></tr></thead>
                <tbody>
                  {(subjects as any[]).map((s: any) => (
                    <tr key={s.id}>
                      <td className="font-medium">{s.name}</td>
                      <td className="font-mono text-sm">{s.code}</td>
                      <td className="text-text-secondary">{s.description || '—'}</td>
                      <td><span className="badge bg-success/10 text-success">{s.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <Modal open={modal === 'year'} onClose={() => setModal(null)} title="New Academic Year" size="sm"
        footer={<div className="flex gap-3 justify-end"><Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button><Button loading={createYear.isPending} onClick={() => createYear.mutate(form)} disabled={!form.name}>Create</Button></div>}>
        <div className="space-y-4">
          <Input label="Academic Year *" placeholder="2024-2025" value={form.name || ''} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} />
          <div className="flex items-center gap-2">
            <input type="checkbox" id="isCurrent" checked={form.isCurrent || false} onChange={e => setForm((f: any) => ({ ...f, isCurrent: e.target.checked }))} />
            <label htmlFor="isCurrent" className="text-sm font-inter text-text-primary">Set as current year</label>
          </div>
        </div>
      </Modal>

      <Modal open={modal === 'grade'} onClose={() => setModal(null)} title="New Grade Level" size="sm"
        footer={<div className="flex gap-3 justify-end"><Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button><Button loading={createGrade.isPending} onClick={() => createGrade.mutate(form)} disabled={!form.name}>Create</Button></div>}>
        <div className="space-y-4">
          <Input label="Name *" placeholder="Grade 11" value={form.name || ''} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} />
          <Input label="Order" type="number" value={form.order || 11} onChange={e => setForm((f: any) => ({ ...f, order: Number(e.target.value) }))} />
        </div>
      </Modal>

      <Modal open={modal === 'section'} onClose={() => setModal(null)} title="New Section" size="sm"
        footer={<div className="flex gap-3 justify-end"><Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button><Button loading={createSection.isPending} onClick={() => createSection.mutate(form)} disabled={!form.name || !form.gradeLevelId}>Create</Button></div>}>
        <div className="space-y-4">
          <Input label="Section Name *" placeholder="Section A" value={form.name || ''} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} />
          <div>
            <label className="block text-sm font-medium font-inter text-text-primary mb-1.5">Grade Level *</label>
            <select className="input-field" value={form.gradeLevelId || ''} onChange={e => setForm((f: any) => ({ ...f, gradeLevelId: e.target.value }))}>
              <option value="">Select Grade Level</option>
              {(grades as any[]).map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        </div>
      </Modal>

      <Modal open={modal === 'subject'} onClose={() => setModal(null)} title="New Subject" size="sm"
        footer={<div className="flex gap-3 justify-end"><Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button><Button loading={createSubject.isPending} onClick={() => createSubject.mutate(form)} disabled={!form.name || !form.code}>Create</Button></div>}>
        <div className="space-y-4">
          <Input label="Subject Name *" placeholder="General Chemistry" value={form.name || ''} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} />
          <Input label="Subject Code *" placeholder="SCI-CHEM-11" value={form.code || ''} onChange={e => setForm((f: any) => ({ ...f, code: e.target.value }))} />
          <Input label="Description" placeholder="Optional description" value={form.description || ''} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} />
        </div>
      </Modal>
    </div>
  )
}
