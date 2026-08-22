import React, { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../lib/auth'
import { presentationsApi } from '../../lib/api'
import {
  FileText, ImageIcon, Video, Upload, Trash2, Clock, Eye,
  FolderOpen, Search, X,
} from 'lucide-react'
import { LoadingSpinner, EmptyState } from '../../components/ui/EmptyState'
import { formatDateTime, timeAgo } from '../../lib/utils'

function fileIcon(fileType: string) {
  if (fileType === 'image') return <ImageIcon className="w-5 h-5 text-primary" />
  if (fileType === 'video') return <Video className="w-5 h-5 text-primary" />
  return <FileText className="w-5 h-5 text-primary" />
}

function fileTypeBadge(fileType: string) {
  const map: Record<string, string> = {
    image: 'bg-blue-100 text-blue-700',
    pdf: 'bg-red-100 text-red-700',
    pptx: 'bg-orange-100 text-orange-700',
    doc: 'bg-indigo-100 text-indigo-700',
    video: 'bg-purple-100 text-purple-700',
    other: 'bg-gray-100 text-gray-600',
  }
  return map[fileType] ?? map.other
}

export default function TeacherFiles() {
  const { user } = useAuth()
  const teacher = user?.profile
  const assignments: any[] = teacher?.subjectAssignments || []
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [search, setSearch] = useState('')
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadSubjectId, setUploadSubjectId] = useState('')
  const [uploadSectionId, setUploadSectionId] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadFile, setUploadFile] = useState<{ name: string; size: number } | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [previewMaterial, setPreviewMaterial] = useState<any | null>(null)

  // All teacher files
  const { data: allFiles = [], isLoading } = useQuery({
    queryKey: ['teacher-files-all', teacher?.id],
    queryFn: () => presentationsApi.getAll({ teacherId: teacher?.id }).then(r => r.data),
    enabled: !!teacher?.id,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => presentationsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teacher-files-all'] }),
  })

  // Unique subject+section combos from assignments
  const subjectOptions = assignments.map((a: any) => ({
    key: `${a.subjectId}__${a.sectionId}`,
    subjectId: a.subjectId,
    sectionId: a.sectionId,
    label: `${a.subject?.name} — ${a.section?.name}`,
  }))

  function handleSubjectPick(val: string) {
    const opt = subjectOptions.find(o => o.key === val)
    setUploadSubjectId(opt?.subjectId || '')
    setUploadSectionId(opt?.sectionId || '')
  }

  async function handleFileChosen(file: File) {
    if (!uploadTitle.trim()) { setUploadError('Enter a title first'); return }
    setUploading(true); setUploadError(null); setUploadProgress(0)
    setUploadFile({ name: file.name, size: file.size })
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('title', uploadTitle.trim())
      if (uploadSubjectId) fd.append('subjectId', uploadSubjectId)
      if (uploadSectionId) fd.append('sectionId', uploadSectionId)
      await presentationsApi.upload(fd, e => {
        if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100))
      })
      setUploadTitle('')
      setUploadSubjectId('')
      setUploadSectionId('')
      queryClient.invalidateQueries({ queryKey: ['teacher-files-all'] })
      queryClient.invalidateQueries({ queryKey: ['presentation-materials'] })
      queryClient.invalidateQueries({ queryKey: ['presentation-materials-all'] })
    } catch (err: any) {
      setUploadError(err.response?.data?.error || 'Upload failed')
    } finally {
      setUploading(false); setUploadProgress(0); setUploadFile(null)
    }
  }

  const filtered = (allFiles as any[]).filter(m =>
    !search ||
    m.title.toLowerCase().includes(search.toLowerCase()) ||
    m.originalName.toLowerCase().includes(search.toLowerCase()) ||
    m.subject?.name?.toLowerCase().includes(search.toLowerCase()) ||
    m.section?.name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      {/* Quick preview overlay */}
      {previewMaterial && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setPreviewMaterial(null)}>
          <div className="bg-white rounded-2xl overflow-hidden max-w-3xl w-full max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
              <p className="font-poppins font-semibold text-text-primary truncate">{previewMaterial.title}</p>
              <button onClick={() => setPreviewMaterial(null)} className="text-text-secondary hover:text-text-primary ml-4">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-auto bg-gray-50">
              {previewMaterial.fileType === 'image' ? (
                <img src={previewMaterial.filePath} alt={previewMaterial.title} className="w-full h-full object-contain" />
              ) : previewMaterial.fileType === 'video' ? (
                <video src={previewMaterial.filePath} controls className="w-full" />
              ) : (
                <iframe src={previewMaterial.filePath} title={previewMaterial.title} className="w-full h-full border-0 min-h-[400px]" />
              )}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="page-title">Files Library</h1>
          <p className="text-text-secondary font-inter text-sm mt-1">
            All your uploaded files in one place. Upload here and reuse across any subject.
          </p>
        </div>

        {/* Upload card */}
        <div className="card border-2 border-dashed border-border bg-background/50 space-y-3">
          <p className="font-poppins font-semibold text-sm text-text-primary flex items-center gap-2">
            <Upload className="w-4 h-4 text-primary" /> Upload New File
          </p>

          {uploading ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-inter">
                <span className="text-text-primary font-medium truncate max-w-[200px]">{uploadFile?.name ?? 'Uploading…'}</span>
                <span className="text-primary font-semibold ml-2">{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
              <p className="text-[11px] text-text-secondary font-inter text-right">Uploading, please wait…</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3 items-end">
              <input
                type="text"
                placeholder="File title (required)"
                value={uploadTitle}
                onChange={e => setUploadTitle(e.target.value)}
                className="flex-1 min-w-[180px] px-3 py-2 rounded-lg border border-border bg-surface font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 text-text-primary placeholder:text-text-secondary"
              />
              <select
                value={subjectOptions.find(o => o.subjectId === uploadSubjectId && o.sectionId === uploadSectionId)?.key ?? ''}
                onChange={e => handleSubjectPick(e.target.value)}
                className="min-w-[200px] px-3 py-2 rounded-lg border border-border bg-surface font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 text-text-primary"
              >
                <option value="">No subject (library only)</option>
                {subjectOptions.map(o => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={!uploadTitle.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white font-poppins font-semibold text-sm rounded-xl hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <Upload className="w-4 h-4" /> Choose File
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.ppt,.pptx,.doc,.docx,.mp4,.webm,.mov"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileChosen(f); e.target.value = '' }}
          />
          {uploadError && <p className="text-red-500 text-xs font-inter">{uploadError}</p>}
          <p className="text-text-secondary font-inter text-xs">
            Images, PDF, PowerPoint, Word, Video · Max 50 MB · Subject is optional — you can assign later from the Subjects tab.
          </p>
        </div>

        {/* Search + file list */}
        <div className="card space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
              <input
                type="text"
                placeholder="Search files…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-surface font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 text-text-primary placeholder:text-text-secondary"
              />
            </div>
            {isLoading && <LoadingSpinner />}
            <span className="text-xs text-text-secondary font-inter flex-shrink-0">{filtered.length} file{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8"><LoadingSpinner /></div>
          ) : filtered.length === 0 ? (
            <EmptyState
              title={search ? 'No files match your search' : 'No files yet'}
              description={search ? 'Try a different keyword.' : 'Upload a file above to get started.'}
              icon={<FolderOpen className="w-8 h-8 text-primary" />}
            />
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((m: any) => (
                <div key={m.id} className="flex items-center gap-3 py-3 group">
                  <div className="w-10 h-10 bg-primary-light rounded-lg flex items-center justify-center flex-shrink-0">
                    {fileIcon(m.fileType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-inter text-sm font-medium text-text-primary truncate">{m.title}</p>
                    <p className="font-inter text-xs text-text-secondary truncate">{m.originalName}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={`text-[10px] font-poppins font-semibold px-1.5 py-0.5 rounded-full uppercase ${fileTypeBadge(m.fileType)}`}>
                        {m.fileType}
                      </span>
                      {m.subject && (
                        <span className="text-[11px] font-inter text-text-secondary">
                          {m.subject.name} · {m.section?.name}
                        </span>
                      )}
                      {!m.subjectId && (
                        <span className="text-[11px] font-inter text-text-secondary/60 italic">Library only</span>
                      )}
                    </div>
                    <p className="font-inter text-[11px] text-text-secondary/70 mt-0.5 flex items-center gap-1" title={formatDateTime(m.uploadedAt)}>
                      <Clock className="w-3 h-3 flex-shrink-0" /> {timeAgo(m.uploadedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => setPreviewMaterial(m)}
                      className="p-2 rounded-lg text-text-secondary hover:bg-primary-light hover:text-primary transition-colors"
                      title="Preview"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <a
                      href={m.filePath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 rounded-lg border border-border text-xs font-inter text-text-primary hover:bg-border transition-colors"
                    >
                      Open
                    </a>
                    <button
                      onClick={() => { if (confirm(`Delete "${m.title}"?`)) deleteMutation.mutate(m.id) }}
                      className="opacity-0 group-hover:opacity-100 p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-all"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
