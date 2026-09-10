import React, { useState, useRef, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { announcementsApi } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Badge } from '../../components/ui/Badge'
import { LoadingSpinner, EmptyState } from '../../components/ui/EmptyState'
import { formatDate } from '../../lib/utils'
import {
  Plus, Megaphone, Trash2, Eye, EyeOff, Upload, X,
  FileText, Image as ImageIcon, AlertCircle, Settings,
  BookOpen, Calendar, Phone, ChevronDown, ChevronUp,
} from 'lucide-react'
import { cn } from '../../lib/utils'

// ── Helpers ───────────────────────────────────────────────────────────────────

function sortByRecency(items: any[]) {
  return [...items].sort((a, b) => {
    const da = new Date(a.publishedAt || a.createdAt).getTime()
    const db = new Date(b.publishedAt || b.createdAt).getTime()
    return db - da
  })
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'School Announcements': <Megaphone className="w-4 h-4" />,
  'Upcoming Events':      <Calendar  className="w-4 h-4" />,
  'Class Schedule':       <BookOpen  className="w-4 h-4" />,
  'Emergency Hotlines':   <Phone     className="w-4 h-4" />,
}

// ── Media thumbnail ───────────────────────────────────────────────────────────

function MediaThumb({ image, pdf }: { image?: string; pdf?: string }) {
  if (image) {
    return (
      <div className="w-20 h-14 rounded-xl overflow-hidden border border-gray-200 flex-shrink-0">
        <img src={image} alt="" className="w-full h-full object-cover" />
      </div>
    )
  }
  if (pdf) {
    return (
      <div className="w-20 h-14 rounded-xl border border-gray-200 bg-red-50 flex flex-col items-center justify-center gap-1 flex-shrink-0">
        <FileText className="w-5 h-5 text-red-500" />
        <span className="text-[10px] font-inter font-medium text-red-500">PDF</span>
      </div>
    )
  }
  return null
}

// ── Upload zone ───────────────────────────────────────────────────────────────

interface UploadZoneProps {
  file: File | null
  onChange: (f: File | null) => void
  existingImage?: string
  existingPdf?: string
}

function UploadZone({ file, onChange, existingImage, existingPdf }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const [err, setErr] = useState('')

  const handleFile = (f: File) => {
    setErr('')
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
    if (!allowed.includes(f.type)) { setErr('Only images (JPEG, PNG, GIF, WebP) or PDF files are allowed.'); return }
    if (f.size > 20 * 1024 * 1024) { setErr('File must be under 20 MB.'); return }
    onChange(f)
  }

  const preview   = file ? URL.createObjectURL(file) : null
  const isPdf     = file ? file.type === 'application/pdf' : !!existingPdf
  const isImage   = file ? file.type.startsWith('image/') : !!existingImage
  const displaySrc = preview || existingImage || existingPdf || null
  const hasMedia  = !!file || !!existingImage || !!existingPdf

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium font-inter text-text-primary">Image or PDF (optional)</label>
      <p className="text-xs text-text-secondary font-inter -mt-1">
        Upload a poster, canvas, flyer, or PDF — displayed full-width on the announcement board.
      </p>

      {hasMedia ? (
        <div className="relative rounded-2xl border border-gray-200 overflow-hidden bg-gray-50">
          {isImage && displaySrc && (
            <img src={displaySrc} alt="" className="w-full max-h-52 object-contain" />
          )}
          {isPdf && (
            <div className="flex items-center gap-3 p-4">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <FileText className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <p className="font-inter font-medium text-text-primary text-sm">
                  {file ? file.name : 'Attached PDF'}
                </p>
                <p className="text-xs text-text-secondary font-inter">
                  {file ? (file.size / 1024 / 1024).toFixed(1) + ' MB' : 'Existing attachment'}
                </p>
              </div>
            </div>
          )}
          <button
            onClick={() => onChange(null)}
            className="absolute top-2 right-2 w-7 h-7 bg-white/90 hover:bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm transition-colors"
            title="Remove"
          >
            <X className="w-3.5 h-3.5 text-gray-600" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={e => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-2xl py-8 cursor-pointer transition-all duration-200',
            drag ? 'border-primary bg-primary-light' : 'border-border hover:border-primary/50 hover:bg-gray-50',
          )}
        >
          <input ref={inputRef} type="file" className="hidden" accept="image/*,.pdf" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center transition-colors', drag ? 'bg-primary text-white' : 'bg-gray-100 text-text-secondary')}>
            <Upload className="w-5 h-5" />
          </div>
          <div className="text-center">
            <p className="text-sm font-inter font-medium text-text-primary">Drop a file here or click to browse</p>
            <p className="text-xs text-text-secondary font-inter mt-0.5">Images (JPEG, PNG, GIF, WebP) or PDF · Max 20 MB</p>
          </div>
        </div>
      )}

      {err && (
        <div className="flex items-center gap-2 text-sm text-danger font-inter">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {err}
        </div>
      )}
    </div>
  )
}

// ── Single announcement row ────────────────────────────────────────────────────

interface AnnouncementRowProps {
  a: any
  attachingId: string | null
  attachFile: File | null
  attachInputRef: React.RefObject<HTMLInputElement>
  onStartAttach: (id: string) => void
  onCancelAttach: () => void
  onAttachFileChange: (f: File | null) => void
  onUpload: (id: string, file: File) => void
  onRemoveMedia: (id: string) => void
  onTogglePublish: (id: string, currentStatus: string) => void
  onDelete: (id: string) => void
  uploadPending: boolean
}

function AnnouncementRow({
  a, attachingId, attachFile, attachInputRef,
  onStartAttach, onCancelAttach, onAttachFileChange,
  onUpload, onRemoveMedia, onTogglePublish, onDelete,
  uploadPending,
}: AnnouncementRowProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="card !p-0 overflow-hidden">
      {/* Main row */}
      <div className="flex items-start gap-3 sm:gap-4 p-4 sm:p-5">
        <MediaThumb image={a.image} pdf={a.pdf} />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-poppins font-semibold text-text-primary text-sm sm:text-base">{a.title}</h3>
                <Badge variant={a.publishStatus === 'published' ? 'success' : a.publishStatus === 'archived' ? 'danger' : 'default'}>
                  {a.publishStatus}
                </Badge>
                {a.image && (
                  <span className="inline-flex items-center gap-1 badge bg-blue-50 text-blue-600">
                    <ImageIcon className="w-3 h-3" /> Image
                  </span>
                )}
                {a.pdf && (
                  <span className="inline-flex items-center gap-1 badge bg-red-50 text-red-600">
                    <FileText className="w-3 h-3" /> PDF
                  </span>
                )}
              </div>
              {a.description && (
                <p className="text-text-secondary font-inter text-sm mt-1 line-clamp-2">{a.description}</p>
              )}
              <p className="text-xs text-text-secondary font-inter mt-1.5">
                {a.publishedAt ? formatDate(a.publishedAt) : formatDate(a.createdAt)}
              </p>
            </div>

            {/* Expand/collapse toggle */}
            <button
              onClick={() => setExpanded(e => !e)}
              className="p-1.5 hover:bg-gray-100 rounded-lg text-text-secondary transition-colors flex-shrink-0 touch-manipulation"
              title={expanded ? 'Collapse' : 'Expand actions'}
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Expandable action strip */}
      {expanded && (
        <div className="border-t border-border bg-gray-50 px-4 sm:px-5 py-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-inter text-text-secondary font-medium mr-1">Actions:</span>

          {/* Attach / replace media */}
          {attachingId === a.id ? (
            <div className="flex items-center gap-2">
              <input
                ref={attachInputRef}
                type="file"
                className="hidden"
                accept="image/*,.pdf"
                onChange={e => onAttachFileChange(e.target.files?.[0] || null)}
              />
              {attachFile ? (
                <Button size="sm" loading={uploadPending} onClick={() => onUpload(a.id, attachFile)}>
                  Upload
                </Button>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => attachInputRef.current?.click()}>
                  Choose File
                </Button>
              )}
              <button
                onClick={onCancelAttach}
                className="p-1.5 hover:bg-gray-200 rounded-lg text-text-secondary transition-colors touch-manipulation"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => onStartAttach(a.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-inter font-medium bg-white border border-border rounded-lg hover:bg-primary/5 hover:border-primary/30 text-text-primary transition-colors touch-manipulation"
              title={a.image || a.pdf ? 'Replace media' : 'Add image / PDF'}
            >
              <Upload className="w-3.5 h-3.5 text-primary" />
              {a.image || a.pdf ? 'Replace Media' : 'Add Media'}
            </button>
          )}

          {/* Remove media */}
          {(a.image || a.pdf) && attachingId !== a.id && (
            <button
              onClick={() => onRemoveMedia(a.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-inter font-medium bg-white border border-border rounded-lg hover:bg-gray-100 text-text-secondary transition-colors touch-manipulation"
              title="Remove media"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              Remove Media
            </button>
          )}

          {/* Publish toggle */}
          <button
            onClick={() => onTogglePublish(a.id, a.publishStatus)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-inter font-medium bg-white border rounded-lg transition-colors touch-manipulation',
              a.publishStatus === 'published'
                ? 'border-warning/40 text-warning hover:bg-warning/10'
                : 'border-success/40 text-success hover:bg-success/10'
            )}
            title={a.publishStatus === 'published' ? 'Unpublish' : 'Publish'}
          >
            {a.publishStatus === 'published' ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {a.publishStatus === 'published' ? 'Unpublish' : 'Publish'}
          </button>

          {/* Delete */}
          <button
            onClick={() => onDelete(a.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-inter font-medium bg-white border border-danger/30 rounded-lg hover:bg-danger/10 text-danger transition-colors touch-manipulation ml-auto"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

const ALL_TAB = '__all__'

export default function AdminAnnouncements() {
  const qc = useQueryClient()

  // Modal state
  const [showAdd, setShowAdd]       = useState(false)
  const [showAddCat, setShowAddCat] = useState(false)
  const [mediaFile, setMediaFile]   = useState<File | null>(null)
  const [uploadError, setUploadError] = useState('')

  // Form state
  const [form, setForm] = useState({
    title: '', categoryId: '', description: '', content: '',
    publishStatus: 'published', displayPriority: 0,
  })
  const [catForm, setCatForm] = useState({ name: '', icon: '' })

  // Active category tab
  const [activeTab, setActiveTab] = useState<string>(ALL_TAB)

  // Per-row attach state
  const [attachingId, setAttachingId]   = useState<string | null>(null)
  const [attachFile, setAttachFile]     = useState<File | null>(null)
  const attachInputRef = useRef<HTMLInputElement>(null)

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['all-announcements'],
    queryFn: () => announcementsApi.getAll().then(r => r.data),
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['announcement-categories'],
    queryFn: () => announcementsApi.getCategories().then(r => r.data),
  })

  // ── Derived data ─────────────────────────────────────────────────────────────

  // Count per category
  const countByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    ;(announcements as any[]).forEach((a: any) => {
      if (a.categoryId) map[a.categoryId] = (map[a.categoryId] || 0) + 1
    })
    return map
  }, [announcements])

  // Filtered + sorted list for current tab
  const visibleAnnouncements = useMemo(() => {
    let list = announcements as any[]
    if (activeTab !== ALL_TAB) list = list.filter((a: any) => a.categoryId === activeTab)
    return sortByRecency(list)
  }, [announcements, activeTab])

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const resetForm = () => {
    setForm({ title: '', categoryId: activeTab !== ALL_TAB ? activeTab : '', description: '', content: '', publishStatus: 'published', displayPriority: 0 })
    setMediaFile(null)
    setUploadError('')
  }

  const openNewModal = () => {
    resetForm()
    setShowAdd(true)
  }

  // ── Mutations ────────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async (d: any) => {
      const res = await announcementsApi.create(d)
      if (mediaFile) {
        try { await announcementsApi.uploadMedia(res.data.id, mediaFile) }
        catch { setUploadError('Announcement created but media upload failed. You can re-attach it from the list.') }
      }
      return res
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-announcements'] })
      setShowAdd(false)
      resetForm()
    },
  })

  const createCatMutation = useMutation({
    mutationFn: (d: any) => announcementsApi.createCategory(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcement-categories'] })
      setShowAddCat(false)
      setCatForm({ name: '', icon: '' })
    },
  })

  const togglePublish = useMutation({
    mutationFn: ({ id, status }: any) => announcementsApi.update(id, { publishStatus: status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['all-announcements'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => announcementsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['all-announcements'] }),
  })

  const uploadMediaMutation = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => announcementsApi.uploadMedia(id, file),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['all-announcements'] }); setAttachingId(null); setAttachFile(null) },
  })

  const removeMediaMutation = useMutation({
    mutationFn: (id: string) => announcementsApi.removeMedia(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['all-announcements'] }),
  })

  if (isLoading) return <LoadingSpinner />

  const totalCount   = (announcements as any[]).length
  const activeCategory = (categories as any[]).find((c: any) => c.id === activeTab)

  return (
    <div className="space-y-0 animate-fade-in">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="page-title">Announcements</h1>
          <p className="text-text-secondary font-inter text-sm mt-1">
            Manage the Digital Announcement Board — images, PDFs, posters, and more
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="secondary" onClick={() => setShowAddCat(true)} size="sm">
            + Category
          </Button>
          <Button onClick={openNewModal} icon={<Plus className="w-4 h-4" />}>
            New Announcement
          </Button>
        </div>
      </div>

      {/* ── Category sub-tabs ── */}
      <div className="border-b border-border mb-6">
        <div className="flex items-end gap-0 overflow-x-auto scrollbar-none -mb-px">

          {/* "All" tab */}
          <button
            onClick={() => setActiveTab(ALL_TAB)}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-poppins font-medium whitespace-nowrap border-b-2 transition-all touch-manipulation',
              activeTab === ALL_TAB
                ? 'border-primary text-primary bg-primary-light/40'
                : 'border-transparent text-text-secondary hover:text-text-primary hover:border-gray-300'
            )}
          >
            <Megaphone className="w-4 h-4" />
            All
            <span className={cn(
              'inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold',
              activeTab === ALL_TAB ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600'
            )}>
              {totalCount}
            </span>
          </button>

          {/* One tab per category */}
          {(categories as any[]).map((cat: any) => {
            const count   = countByCategory[cat.id] || 0
            const isActive = activeTab === cat.id
            return (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-poppins font-medium whitespace-nowrap border-b-2 transition-all touch-manipulation',
                  isActive
                    ? 'border-primary text-primary bg-primary-light/40'
                    : 'border-transparent text-text-secondary hover:text-text-primary hover:border-gray-300'
                )}
              >
                {cat.icon
                  ? <span className="text-base leading-none">{cat.icon}</span>
                  : (CATEGORY_ICONS[cat.name] || <BookOpen className="w-4 h-4" />)
                }
                {cat.name}
                {count > 0 && (
                  <span className={cn(
                    'inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full text-[10px] font-semibold',
                    isActive ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600'
                  )}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="space-y-4">

        {/* Sub-header for category tab */}
        {activeTab !== ALL_TAB && activeCategory && (
          <div className="flex items-center justify-between gap-4 p-4 bg-primary-light/40 border border-primary/20 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-primary/15 rounded-xl flex items-center justify-center text-primary">
                {activeCategory.icon
                  ? <span className="text-lg leading-none">{activeCategory.icon}</span>
                  : (CATEGORY_ICONS[activeCategory.name] || <BookOpen className="w-4 h-4" />)
                }
              </div>
              <div>
                <p className="font-poppins font-semibold text-text-primary text-sm">{activeCategory.name}</p>
                <p className="text-xs text-text-secondary font-inter">
                  {visibleAnnouncements.length} announcement{visibleAnnouncements.length !== 1 ? 's' : ''} · sorted by most recent
                </p>
              </div>
            </div>
            <Button size="sm" onClick={openNewModal} icon={<Plus className="w-3.5 h-3.5" />}>
              Add to {activeCategory.name}
            </Button>
          </div>
        )}

        {/* Empty state */}
        {visibleAnnouncements.length === 0 ? (
          <EmptyState
            title={activeTab === ALL_TAB ? 'No Announcements' : `No announcements in "${activeCategory?.name}"`}
            description={
              activeTab === ALL_TAB
                ? 'Create your first announcement to display on the kiosk.'
                : `Add an announcement to this category and it will appear here.`
            }
            action={<Button onClick={openNewModal}>Create Announcement</Button>}
            icon={<Megaphone className="w-8 h-8 text-primary" />}
          />
        ) : (
          <div className="space-y-3">
            {visibleAnnouncements.map((a: any) => (
              <AnnouncementRow
                key={a.id}
                a={a}
                attachingId={attachingId}
                attachFile={attachFile}
                attachInputRef={attachInputRef}
                onStartAttach={id => { setAttachingId(id); setAttachFile(null) }}
                onCancelAttach={() => { setAttachingId(null); setAttachFile(null) }}
                onAttachFileChange={setAttachFile}
                onUpload={(id, file) => uploadMediaMutation.mutate({ id, file })}
                onRemoveMedia={id => removeMediaMutation.mutate(id)}
                onTogglePublish={(id, status) => togglePublish.mutate({ id, status: status === 'published' ? 'unpublished' : 'published' })}
                onDelete={id => deleteMutation.mutate(id)}
                uploadPending={uploadMediaMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── New Announcement Modal ── */}
      <Modal
        open={showAdd}
        onClose={() => { setShowAdd(false); resetForm() }}
        title="New Announcement"
        size="lg"
        footer={
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => { setShowAdd(false); resetForm() }}>Cancel</Button>
            <Button
              loading={createMutation.isPending}
              onClick={() => createMutation.mutate(form)}
              disabled={!form.title || !form.categoryId}
            >
              {form.publishStatus === 'published' ? 'Publish' : 'Save Draft'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Title *"
            placeholder="Announcement title"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          />

          <div>
            <label className="block text-sm font-medium font-inter text-text-primary mb-1.5">Category *</label>
            <select
              className="input-field"
              value={form.categoryId}
              onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}
            >
              <option value="">Select Category</option>
              {(categories as any[]).map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium font-inter text-text-primary mb-1.5">Description</label>
            <textarea
              className="input-field"
              rows={3}
              placeholder="Brief description shown alongside the media on the kiosk…"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>

          <UploadZone file={mediaFile} onChange={setMediaFile} />

          {uploadError && (
            <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-sm font-inter text-yellow-700">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {uploadError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium font-inter text-text-primary mb-1.5">Status</label>
            <select
              className="input-field"
              value={form.publishStatus}
              onChange={e => setForm(f => ({ ...f, publishStatus: e.target.value }))}
            >
              <option value="published">Published (visible on kiosk)</option>
              <option value="unpublished">Unpublished (draft)</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* ── New Category Modal ── */}
      <Modal
        open={showAddCat}
        onClose={() => setShowAddCat(false)}
        title="New Category"
        size="sm"
        footer={
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setShowAddCat(false)}>Cancel</Button>
            <Button
              loading={createCatMutation.isPending}
              onClick={() => createCatMutation.mutate(catForm)}
              disabled={!catForm.name}
            >
              Create
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Category Name *"
            placeholder="e.g. School Announcements"
            value={catForm.name}
            onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
          />
          <Input
            label="Icon (emoji or symbol)"
            placeholder="📢"
            value={catForm.icon}
            onChange={e => setCatForm(f => ({ ...f, icon: e.target.value }))}
          />
        </div>
      </Modal>
    </div>
  )
}
