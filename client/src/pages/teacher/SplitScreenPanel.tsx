/**
 * SplitScreenPanel — the split-screen teaching UI without any page chrome.
 * Embedded directly inside TeacherPresentation's sub-tab.
 */
import React, { useRef, useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Pencil, Eraser, Trash2, Download, Upload, RefreshCw, HighlighterIcon,
  ZoomIn, ZoomOut, RotateCcw, FolderOpen, X, FileText, ImageIcon, Video, Search,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAuth } from '../../lib/auth'
import { presentationsApi } from '../../lib/api'

type DrawTool = 'pen' | 'eraser' | 'highlight'
const COLORS = ['#111827', '#3B82F6', '#EF4444', '#22C55E', '#F59E0B', '#A855F7']
const SIZES  = [2, 5, 10, 18]

interface Point { x: number; y: number }

function fileIcon(fileType: string) {
  if (fileType === 'image') return <ImageIcon className="w-4 h-4 text-primary" />
  if (fileType === 'video') return <Video className="w-4 h-4 text-primary" />
  return <FileText className="w-4 h-4 text-primary" />
}

export default function SplitScreenPanel() {
  const { user } = useAuth()
  const teacher = user?.profile

  const [leftFile, setLeftFile]     = useState<string | null>(null)
  const [leftType, setLeftType]     = useState<'image' | 'pdf' | null>(null)
  const [leftName, setLeftName]     = useState('')
  const [leftZoom, setLeftZoom]     = useState(100)
  const [splitRatio, setSplitRatio] = useState(55)
  const [tool, setTool]             = useState<DrawTool>('pen')
  const [color, setColor]           = useState(COLORS[0])
  const [size, setSize]             = useState(SIZES[1])
  const [hasStrokes, setHasStrokes] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')

  // Fetch teacher's uploaded files for the picker
  const { data: teacherFiles = [] } = useQuery({
    queryKey: ['split-screen-files', teacher?.id],
    queryFn: () => presentationsApi.getAll({ teacherId: teacher?.id }).then(r => r.data),
    enabled: !!teacher?.id && showPicker,
  })

  const filteredFiles = (teacherFiles as any[]).filter(m =>
    !pickerSearch ||
    m.title.toLowerCase().includes(pickerSearch.toLowerCase()) ||
    m.subject?.name?.toLowerCase().includes(pickerSearch.toLowerCase())
  )

  function pickMaterial(m: any) {
    // For images: use the filePath directly as src
    // For PDFs: use the filePath in the iframe
    // Other types not zoomable in split-screen — use iframe
    const type = m.fileType === 'image' ? 'image' : 'pdf'
    setLeftFile(m.filePath)
    setLeftType(type)
    setLeftName(m.title)
    setLeftZoom(100)
    setShowPicker(false)
    setPickerSearch('')
  }

  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const wrapRef      = useRef<HTMLDivElement>(null)
  const drawing      = useRef(false)
  const lastPt       = useRef<Point | null>(null)
  const fileInput    = useRef<HTMLInputElement>(null)
  const resizing     = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const wrap   = wrapRef.current
    if (!canvas || !wrap) return
    const snap  = canvas.toDataURL()
    const { width, height } = wrap.getBoundingClientRect()
    canvas.width  = width
    canvas.height = height
    const img = new Image()
    img.onload = () => canvas.getContext('2d')?.drawImage(img, 0, 0)
    img.src = snap
  }, [])

  useEffect(() => {
    const ro = new ResizeObserver(resizeCanvas)
    if (wrapRef.current) ro.observe(wrapRef.current)
    resizeCanvas()
    return () => ro.disconnect()
  }, [resizeCanvas, splitRatio])

  const pt = (e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current!
    const rect   = canvas.getBoundingClientRect()
    const scaleX = canvas.width  / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      const t = e.touches[0] || e.changedTouches[0]
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY }
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }

  const onDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); drawing.current = true; lastPt.current = pt(e)
  }

  const onMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current || !lastPt.current) return
    e.preventDefault()
    const ctx = canvasRef.current!.getContext('2d')!
    const cur = pt(e)
    ctx.strokeStyle = tool === 'highlight' ? color + '77' : color
    ctx.lineWidth   = tool === 'eraser' ? size * 5 : tool === 'highlight' ? size * 4 : size
    ctx.lineCap     = 'round'
    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over'
    ctx.beginPath(); ctx.moveTo(lastPt.current.x, lastPt.current.y); ctx.lineTo(cur.x, cur.y); ctx.stroke()
    ctx.globalCompositeOperation = 'source-over'
    lastPt.current = cur
    setHasStrokes(true)
  }

  const onUp = () => { drawing.current = false; lastPt.current = null }

  const clearAnnotation = () => {
    canvasRef.current!.getContext('2d')!.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height)
    setHasStrokes(false)
  }

  const downloadAnnotated = () => {
    const a = document.createElement('a')
    a.href = canvasRef.current!.toDataURL('image/png')
    a.download = 'annotation.png'
    a.click()
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLeftName(file.name)
    setLeftFile(URL.createObjectURL(file))
    setLeftType(file.type.startsWith('image/') ? 'image' : 'pdf')
  }

  const onDividerDown = (e: React.MouseEvent) => {
    e.preventDefault(); resizing.current = true
    const move = (me: MouseEvent) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const pct  = ((me.clientX - rect.left) / rect.width) * 100
      setSplitRatio(Math.min(80, Math.max(20, pct)))
    }
    const up = () => {
      resizing.current = false
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const drawTools = [
    { id: 'pen'       as DrawTool, icon: <Pencil className="w-4 h-4" />,          label: 'Pen'       },
    { id: 'highlight' as DrawTool, icon: <HighlighterIcon className="w-4 h-4" />, label: 'Highlight' },
    { id: 'eraser'    as DrawTool, icon: <Eraser className="w-4 h-4" />,           label: 'Eraser'    },
  ]

  return (
    <>
    {/* File picker modal */}
    {showPicker && (
      <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowPicker(false)}>
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
            <p className="font-poppins font-semibold text-gray-800">Choose from Library</p>
            <button onClick={() => setShowPicker(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          </div>
          <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search files…"
                value={pickerSearch}
                onChange={e => setPickerSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm font-inter focus:outline-none focus:ring-2 focus:ring-primary/30"
                autoFocus
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {filteredFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <FolderOpen className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm font-inter">{pickerSearch ? 'No matches' : 'No files uploaded yet'}</p>
              </div>
            ) : filteredFiles.map((m: any) => (
              <button
                key={m.id}
                onClick={() => pickMaterial(m)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-primary/5 text-left transition-colors"
              >
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  {fileIcon(m.fileType)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-inter text-sm font-medium text-gray-800 truncate">{m.title}</p>
                  <p className="font-inter text-xs text-gray-400 truncate">
                    {m.subject?.name ? `${m.subject.name} · ${m.section?.name}` : m.originalName}
                  </p>
                </div>
                <span className="text-[10px] font-poppins font-semibold text-primary/60 bg-primary/8 px-1.5 py-0.5 rounded-full uppercase flex-shrink-0">
                  {m.fileType}
                </span>
              </button>
            ))}
          </div>
          <div className="px-4 py-3 border-t border-gray-100 flex-shrink-0 text-center">
            <button
              onClick={() => { fileInput.current?.click(); setShowPicker(false) }}
              className="text-primary text-sm font-inter font-medium hover:underline"
            >
              + Upload a new file instead
            </button>
          </div>
        </div>
      </div>
    )}

    <div className="flex flex-col rounded-xl border border-border overflow-hidden bg-white" style={{ height: '70vh', minHeight: 480 }}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-white border-b border-gray-200 flex-shrink-0">
        {/* Annotation tools */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          {drawTools.map(t => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              title={t.label}
              className={cn('p-2 rounded-lg transition-all touch-manipulation', tool === t.id ? 'bg-primary text-white' : 'text-gray-500 hover:bg-white')}
            >
              {t.icon}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={cn('w-6 h-6 rounded-full border-2 transition-all', color === c ? 'border-gray-800 scale-125' : 'border-transparent')}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {SIZES.map(s => (
            <button
              key={s}
              onClick={() => setSize(s)}
              className={cn('w-7 h-7 rounded-lg flex items-center justify-center transition-all', size === s ? 'bg-primary' : 'hover:bg-white')}
            >
              <div className="rounded-full" style={{ width: Math.min(s + 2, 16), height: Math.min(s + 2, 16), backgroundColor: size === s ? 'white' : color }} />
            </button>
          ))}
        </div>
        {/* Divider */}
        <div className="w-px h-5 bg-gray-200 mx-1" />
        {/* Zoom controls (affect left panel) */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setLeftZoom(z => Math.max(25, z - 25))}
            title="Zoom out lesson"
            disabled={!leftFile}
            className="p-2 rounded-lg text-gray-500 hover:bg-white disabled:opacity-30 transition-all touch-manipulation"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-[11px] font-poppins font-semibold text-gray-600 min-w-[32px] text-center select-none">
            {leftZoom}%
          </span>
          <button
            onClick={() => setLeftZoom(z => Math.min(300, z + 25))}
            title="Zoom in lesson"
            disabled={!leftFile}
            className="p-2 rounded-lg text-gray-500 hover:bg-white disabled:opacity-30 transition-all touch-manipulation"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setLeftZoom(100)}
            title="Reset zoom"
            disabled={!leftFile || leftZoom === 100}
            className="p-2 rounded-lg text-gray-500 hover:bg-white disabled:opacity-30 transition-all touch-manipulation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={clearAnnotation}
            title="Clear annotations"
            className="p-2 rounded-xl text-gray-500 hover:bg-red-50 hover:text-red-500 transition-all touch-manipulation"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={downloadAnnotated}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white text-xs font-poppins font-semibold rounded-xl hover:bg-primary-dark transition-all touch-manipulation"
          >
            <Download className="w-3.5 h-3.5" /><span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* Split panels */}
      <div ref={containerRef} className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Left: Lesson material */}
        <div className="relative flex flex-col min-h-0" style={{ width: `${splitRatio}%`, overflow: 'auto' }}>
          <div className="absolute top-2 left-2 z-10 bg-primary-dark/80 text-white text-xs font-poppins font-semibold px-2 py-1 rounded-lg">
            Lesson Material
          </div>
          {!leftFile ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-gray-100 min-h-full">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
                <Upload className="w-8 h-8 text-primary/50" />
              </div>
              <p className="text-gray-500 font-poppins text-sm">Load a lesson file</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowPicker(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white font-poppins font-semibold text-sm rounded-xl hover:bg-primary-dark transition-all touch-manipulation"
                >
                  <FolderOpen className="w-4 h-4" /> From Library
                </button>
                <button
                  onClick={() => fileInput.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 font-poppins font-semibold text-sm rounded-xl hover:bg-gray-50 transition-all touch-manipulation"
                >
                  <Upload className="w-4 h-4" /> Upload
                </button>
              </div>
              <input ref={fileInput} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFile} />
            </div>
          ) : leftType === 'image' ? (
            <div className="flex-1 flex items-center justify-center bg-gray-900 overflow-auto min-h-full">
              <img
                src={leftFile}
                alt={leftName}
                style={{ transform: `scale(${leftZoom / 100})`, transformOrigin: 'center center', transition: 'transform 0.15s ease' }}
              />
            </div>
          ) : (
            <iframe
              src={leftFile}
              title={leftName}
              className="flex-1 w-full border-0 min-h-0"
              style={{ zoom: leftZoom / 100 }}
            />
          )}
          {leftFile && (
            <div className="absolute bottom-2 right-2 flex gap-1.5 z-10">
              <button
                onClick={() => setShowPicker(true)}
                className="p-2 bg-white/90 rounded-xl shadow text-gray-600 hover:bg-white transition-all touch-manipulation"
                title="Choose from library"
              >
                <FolderOpen className="w-4 h-4" />
              </button>
              <button
                onClick={() => fileInput.current?.click()}
                className="p-2 bg-white/90 rounded-xl shadow text-gray-600 hover:bg-white transition-all touch-manipulation"
                title="Upload different file"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <input ref={fileInput} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFile} />
            </div>
          )}
        </div>

        {/* Draggable divider */}
        <div
          onMouseDown={onDividerDown}
          className="w-1.5 bg-gray-300 hover:bg-primary cursor-col-resize flex-shrink-0 transition-colors z-20"
        />

        {/* Right: Annotation board */}
        <div ref={wrapRef} className="flex-1 relative bg-white min-h-0" style={{ cursor: tool === 'eraser' ? 'cell' : 'crosshair' }}>
          <div className="absolute top-2 left-2 z-10 bg-primary-dark/80 text-white text-xs font-poppins font-semibold px-2 py-1 rounded-lg">
            Annotation Board
          </div>
          <canvas
            ref={canvasRef}
            className="absolute inset-0 touch-none w-full h-full"
            onMouseDown={onDown}
            onMouseMove={onMove}
            onMouseUp={onUp}
            onMouseLeave={onUp}
            onTouchStart={onDown}
            onTouchMove={onMove}
            onTouchEnd={onUp}
          />
          {!hasStrokes && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <Pencil className="w-12 h-12 text-gray-200 mb-2" />
              <p className="text-gray-300 font-poppins text-sm">Draw annotations here</p>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  )
}
