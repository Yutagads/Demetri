import React, { useState, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { studentsApi, structureApi } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import {
  Upload, FileText, Download, CheckCircle2, XCircle, AlertTriangle,
  ChevronRight, ArrowLeft, Users, X
} from 'lucide-react'
import { cn } from '../../lib/utils'

// ─── CSV helpers ──────────────────────────────────────────────────────────────

const TEMPLATE_HEADERS = [
  'Student Number', 'Full Name', 'Email', 'Gender',
  'Birth Date', 'Contact Number', 'Guardian Name', 'Guardian Contact',
]

const HEADER_MAP: Record<string, string> = {
  'student number': 'studentNumber',
  'full name': 'fullName',
  'email': 'email',
  'gender': 'gender',
  'birth date': 'birthDate',
  'contact number': 'contactNumber',
  'guardian name': 'guardianName',
  'guardian contact': 'guardianContact',
}

function downloadTemplate() {
  const sample = [
    '2024-00002,Maria Clara,maria.clara@email.com,Female,2006-03-15,09171234567,Rosa Clara,09171234568',
    '2024-00003,Jose Rizal,jose.rizal@email.com,Male,2006-06-19,09181234567,Teodora Alonso,09181234568',
  ]
  const csv = [TEMPLATE_HEADERS.join(','), ...sample].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'student_import_template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function downloadCredentials(credentials: any[]) {
  const headers = ['Row', 'Student Number', 'Full Name', 'Temporary Password']
  const rows = credentials.map(c => `${c.rowNumber},${c.studentNumber},"${c.fullName}",${c.tempPassword}`)
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'imported_student_credentials.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }

  const parseRow = (line: string): string[] => {
    const values: string[] = []
    let cur = ''
    let inQ = false
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQ = !inQ }
      else if (line[i] === ',' && !inQ) { values.push(cur.trim()); cur = '' }
      else { cur += line[i] }
    }
    values.push(cur.trim())
    return values
  }

  const rawHeaders = parseRow(lines[0])
  const mappedHeaders = rawHeaders.map(h => HEADER_MAP[h.toLowerCase().trim()] || h.toLowerCase().replace(/\s+/g, '_'))

  const rows = lines.slice(1).map(line => {
    const vals = parseRow(line)
    const row: Record<string, string> = {}
    mappedHeaders.forEach((h, i) => { row[h] = vals[i] ?? '' })
    return row
  })

  return { headers: mappedHeaders, rows }
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: 'valid' | 'error' | 'duplicate' }) {
  if (status === 'valid') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
      <CheckCircle2 className="w-3 h-3" /> Valid
    </span>
  )
  if (status === 'duplicate') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
      <AlertTriangle className="w-3 h-3" /> Duplicate
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
      <XCircle className="w-3 h-3" /> Error
    </span>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type Step = 'upload' | 'validate' | 'done'

interface Props {
  open: boolean
  onClose: () => void
}

export default function AdminStudentsImport({ open, onClose }: Props) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('upload')
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState('')
  const [parseError, setParseError] = useState('')
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([])
  const [validationResult, setValidationResult] = useState<any>(null)
  const [importResult, setImportResult] = useState<any>(null)
  const [filterStatus, setFilterStatus] = useState<'all' | 'valid' | 'error' | 'duplicate'>('all')
  const [assignment, setAssignment] = useState({ academicYearId: '', gradeLevelId: '', sectionId: '' })

  const { data: gradeLevels = [] } = useQuery({
    queryKey: ['grade-levels'],
    queryFn: () => structureApi.getGradeLevels().then(r => r.data),
    enabled: open,
  })
  const { data: academicYears = [] } = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => structureApi.getAcademicYears().then(r => r.data),
    enabled: open,
  })

  const selectedLevel = (gradeLevels as any[]).find((g: any) => g.id === assignment.gradeLevelId) as any
  const availableSections = selectedLevel?.sections || []

  const validateMutation = useMutation({
    mutationFn: (rows: any[]) => studentsApi.importStudents({ rows, dryRun: true }),
    onSuccess: (res) => {
      setValidationResult(res.data)
      setStep('validate')
    },
  })

  const importMutation = useMutation({
    mutationFn: () => studentsApi.importStudents({
      rows: parsedRows,
      dryRun: false,
      academicYearId: assignment.academicYearId || undefined,
      gradeLevelId: assignment.gradeLevelId || undefined,
      sectionId: assignment.sectionId || undefined,
    }),
    onSuccess: (res) => {
      setImportResult(res.data)
      setStep('done')
      qc.invalidateQueries({ queryKey: ['students'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })

  const handleFile = (file: File) => {
    setParseError('')
    if (!file.name.endsWith('.csv')) { setParseError('Please upload a .csv file.'); return }
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const { rows } = parseCSV(text)
      if (rows.length === 0) { setParseError('No data rows found. Make sure the file has a header row and at least one data row.'); return }
      // Check required headers
      const first = rows[0]
      if (!('studentNumber' in first) || !('fullName' in first) || !('email' in first)) {
        setParseError('Missing required columns. Download the template to see the correct format.')
        return
      }
      setParsedRows(rows)
    }
    reader.readAsText(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleReset = () => {
    setStep('upload')
    setFileName('')
    setParseError('')
    setParsedRows([])
    setValidationResult(null)
    setImportResult(null)
    setFilterStatus('all')
    setAssignment({ academicYearId: '', gradeLevelId: '', sectionId: '' })
  }

  const handleClose = () => { handleReset(); onClose() }

  const filteredRows = validationResult?.rows?.filter((r: any) =>
    filterStatus === 'all' || r.status === filterStatus
  ) || []

  const summary = validationResult?.summary || { total: 0, valid: 0, errors: 0, duplicates: 0 }

  // ── Step 1: Upload ────────────────────────────────────────────────────────

  const renderUpload = () => (
    <>
      <div className="space-y-5">
        {/* Template download */}
        <div className="flex items-start gap-3 p-4 bg-primary-light rounded-xl">
          <FileText className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-inter font-medium text-text-primary">CSV Format Requirements</p>
            <p className="text-xs text-text-secondary font-inter mt-0.5">
              Required: <span className="text-primary font-medium">Student Number, Full Name, Email</span>
              <br />Optional: Gender, Birth Date, Contact Number, Guardian Name, Guardian Contact
            </p>
          </div>
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-1.5 text-xs font-inter font-medium text-primary hover:text-primary-dark transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Template
          </button>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={cn(
            'relative flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl p-10 cursor-pointer transition-all duration-200',
            dragOver ? 'border-primary bg-primary-light' : 'border-border hover:border-primary/50 hover:bg-gray-50'
          )}
        >
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }} />
          <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center transition-colors', dragOver ? 'bg-primary text-white' : 'bg-gray-100 text-text-secondary')}>
            <Upload className="w-6 h-6" />
          </div>
          {fileName ? (
            <div className="text-center">
              <p className="font-inter font-medium text-text-primary text-sm">{fileName}</p>
              <p className="text-xs text-text-secondary font-inter mt-0.5">{parsedRows.length} data rows found</p>
            </div>
          ) : (
            <div className="text-center">
              <p className="font-inter font-medium text-text-primary text-sm">Drop your CSV file here</p>
              <p className="text-xs text-text-secondary font-inter mt-0.5">or click to browse</p>
            </div>
          )}
        </div>

        {parseError && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
            <XCircle className="w-4 h-4 text-danger mt-0.5 flex-shrink-0" />
            <p className="text-sm font-inter text-danger">{parseError}</p>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <Button variant="secondary" onClick={handleClose}>Cancel</Button>
        <Button
          disabled={parsedRows.length === 0 || !!parseError}
          loading={validateMutation.isPending}
          onClick={() => validateMutation.mutate(parsedRows)}
          icon={<ChevronRight className="w-4 h-4" />}
        >
          Validate {parsedRows.length > 0 ? `${parsedRows.length} Rows` : ''}
        </Button>
      </div>
    </>
  )

  // ── Step 2: Validate ──────────────────────────────────────────────────────

  const renderValidate = () => (
    <>
      {/* Summary strip */}
      <div className="flex flex-wrap gap-3 mb-4">
        {[
          { label: 'Total', value: summary.total, color: 'text-text-primary', bg: 'bg-gray-100', key: 'all' },
          { label: 'Ready', value: summary.valid, color: 'text-green-700', bg: 'bg-green-100', key: 'valid' },
          { label: 'Errors', value: summary.errors, color: 'text-red-700', bg: 'bg-red-100', key: 'error' },
          { label: 'Duplicates', value: summary.duplicates, color: 'text-yellow-700', bg: 'bg-yellow-100', key: 'duplicate' },
        ].map(item => (
          <button
            key={item.key}
            onClick={() => setFilterStatus(item.key as any)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-inter font-medium transition-all border',
              filterStatus === item.key ? 'ring-2 ring-primary border-primary' : 'border-transparent',
              item.bg, item.color
            )}
          >
            <span className="font-poppins font-bold text-base">{item.value}</span>
            <span className="text-xs">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Section assignment */}
      <div className="p-4 bg-gray-50 rounded-xl mb-4">
        <p className="text-xs font-inter font-semibold text-text-secondary uppercase tracking-wide mb-3">
          Assign to Section (optional)
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium font-inter text-text-primary mb-1">Academic Year</label>
            <select className="input-field text-sm py-2" value={assignment.academicYearId} onChange={e => setAssignment(a => ({ ...a, academicYearId: e.target.value }))}>
              <option value="">None</option>
              {(academicYears as any[]).map((y: any) => <option key={y.id} value={y.id}>{y.name}{y.isCurrent ? ' ★' : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium font-inter text-text-primary mb-1">Grade Level</label>
            <select className="input-field text-sm py-2" value={assignment.gradeLevelId} onChange={e => setAssignment(a => ({ ...a, gradeLevelId: e.target.value, sectionId: '' }))}>
              <option value="">None</option>
              {(gradeLevels as any[]).map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium font-inter text-text-primary mb-1">Section</label>
            <select className="input-field text-sm py-2" value={assignment.sectionId} onChange={e => setAssignment(a => ({ ...a, sectionId: e.target.value }))} disabled={!assignment.gradeLevelId}>
              <option value="">None</option>
              {availableSections.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Rows table */}
      <div className="table-wrapper max-h-64 overflow-y-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-12">Row</th>
              <th className="w-28">Status</th>
              <th>Student No.</th>
              <th>Full Name</th>
              <th>Email</th>
              <th>Issue</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-6 text-text-secondary font-inter text-sm">No rows match this filter</td></tr>
            ) : filteredRows.map((r: any) => (
              <tr key={r.rowNumber}>
                <td className="font-mono text-xs text-text-secondary">{r.rowNumber}</td>
                <td><StatusChip status={r.status} /></td>
                <td className="font-mono text-xs">{r.data.studentNumber || <span className="text-danger italic">empty</span>}</td>
                <td className="text-sm">{r.data.fullName || <span className="text-danger italic">empty</span>}</td>
                <td className="text-xs text-text-secondary truncate max-w-[120px]">{r.data.email || <span className="text-danger italic">empty</span>}</td>
                <td className="text-xs text-danger">{r.errors.join(' · ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {validateMutation.isError && (
        <p className="mt-3 text-sm text-danger font-inter">Validation failed. Please try again.</p>
      )}

      <div className="flex justify-between gap-3 mt-5">
        <Button variant="secondary" onClick={() => setStep('upload')} icon={<ArrowLeft className="w-4 h-4" />}>Back</Button>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={handleClose}>Cancel</Button>
          <Button
            disabled={summary.valid === 0}
            loading={importMutation.isPending}
            onClick={() => importMutation.mutate()}
            icon={<Users className="w-4 h-4" />}
          >
            Import {summary.valid} Student{summary.valid !== 1 ? 's' : ''}
          </Button>
        </div>
      </div>
    </>
  )

  // ── Step 3: Done ──────────────────────────────────────────────────────────

  const renderDone = () => (
    <>
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="font-poppins font-bold text-text-primary text-lg">
          {importResult?.imported} Student{importResult?.imported !== 1 ? 's' : ''} Imported
        </h3>
        {importResult?.skipped > 0 && (
          <p className="text-sm text-text-secondary font-inter mt-1">
            {importResult.skipped} row{importResult.skipped !== 1 ? 's' : ''} skipped (errors / duplicates)
          </p>
        )}
      </div>

      {importResult?.credentials?.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-inter font-medium text-text-secondary">Generated credentials — share with students:</p>
            <button
              onClick={() => downloadCredentials(importResult.credentials)}
              className="flex items-center gap-1.5 text-xs font-inter font-medium text-primary hover:text-primary-dark transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download CSV
            </button>
          </div>
          <div className="table-wrapper max-h-64 overflow-y-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student Number</th>
                  <th>Full Name</th>
                  <th>Temp Password</th>
                </tr>
              </thead>
              <tbody>
                {importResult.credentials.map((c: any) => (
                  <tr key={c.rowNumber}>
                    <td className="font-mono text-sm">{c.studentNumber}</td>
                    <td>{c.fullName}</td>
                    <td className="font-mono text-sm font-semibold text-primary">{c.tempPassword}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="flex justify-end mt-6">
        <Button onClick={handleClose}>Done</Button>
      </div>
    </>
  )

  const titles: Record<Step, string> = {
    upload: 'Import Students from CSV',
    validate: 'Review Import',
    done: 'Import Complete',
  }

  return (
    <Modal open={open} onClose={handleClose} title={titles[step]} size="lg">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {(['upload', 'validate', 'done'] as Step[]).map((s, i) => (
          <React.Fragment key={s}>
            <div className={cn(
              'flex items-center gap-1.5 text-xs font-inter font-medium',
              step === s ? 'text-primary' : i < (['upload', 'validate', 'done'] as Step[]).indexOf(step) ? 'text-green-600' : 'text-text-secondary'
            )}>
              <div className={cn(
                'w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold',
                step === s ? 'bg-primary text-white' : i < (['upload', 'validate', 'done'] as Step[]).indexOf(step) ? 'bg-green-600 text-white' : 'bg-gray-200 text-text-secondary'
              )}>
                {i < (['upload', 'validate', 'done'] as Step[]).indexOf(step) ? '✓' : i + 1}
              </div>
              <span className="hidden sm:inline capitalize">{s === 'upload' ? 'Upload' : s === 'validate' ? 'Review' : 'Done'}</span>
            </div>
            {i < 2 && <div className={cn('flex-1 h-px', i < (['upload', 'validate', 'done'] as Step[]).indexOf(step) ? 'bg-green-300' : 'bg-gray-200')} />}
          </React.Fragment>
        ))}
      </div>

      {step === 'upload' && renderUpload()}
      {step === 'validate' && renderValidate()}
      {step === 'done' && renderDone()}
    </Modal>
  )
}
