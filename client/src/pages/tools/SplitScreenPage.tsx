import React, { useRef, useState, useEffect, useCallback } from 'react'
import {
  Pencil, Eraser, Trash2, Download, Upload, Maximize2, Minimize2,
  ChevronLeft, ChevronRight, HighlighterIcon, RefreshCw,
} from 'lucide-react'
import ToolLayout from '../../components/layout/ToolLayout'
import { cn } from '../../lib/utils'

type DrawTool = 'pen' | 'eraser' | 'highlight'
const COLORS = ['#111827','#3B82F6','#EF4444','#22C55E','#F59E0B','#A855F7']
const SIZES  = [2, 5, 10, 18]

interface Point { x: number; y: number }

export default function SplitScreenPage() {
  const [leftFile, setLeftFile]     = useState<string | null>(null)
  const [leftType, setLeftType]     = useState<'image' | 'pdf' | null>(null)
  const [leftName, setLeftName]     = useState('')
  const [splitRatio, setSplitRatio] = useState(55)
  const [tool, setTool]             = useState<DrawTool>('pen')
  const [color, setColor]           = useState(COLORS[0])
  const [size, setSize]             = useState(SIZES[1])
  const [history, setHistory]       = useState<any[]>([])
  const [annotation, setAnnotation] = useState(false)
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const wrapRef    = useRef<HTMLDivElement>(null)
  const drawing    = useRef(false)
  const lastPt     = useRef<Point | null>(null)
  const fileInput  = useRef<HTMLInputElement>(null)
  const resizing   = useRef(false)
  const dividerRef = useRef<HTMLDivElement>(null)
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
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
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
  }

  const onUp = () => { drawing.current = false; lastPt.current = null }

  const clearAnnotation = () => {
    const canvas = canvasRef.current!
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
  }

  const downloadAnnotated = () => {
    const canvas = canvasRef.current!
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = 'annotation.png'
    a.click()
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLeftName(file.name)
    const url = URL.createObjectURL(file)
    setLeftFile(url)
    setLeftType(file.type.startsWith('image/') ? 'image' : 'pdf')
  }

  // Divider drag
  const onDividerDown = (e: React.MouseEvent) => {
    e.preventDefault(); resizing.current = true
    const move = (me: MouseEvent) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const pct  = ((me.clientX - rect.left) / rect.width) * 100
      setSplitRatio(Math.min(80, Math.max(20, pct)))
    }
    const up = () => { resizing.current = false; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const drawTools = [
    { id: 'pen'       as DrawTool, icon: <Pencil className="w-4 h-4" />,        label: 'Pen'       },
    { id: 'highlight' as DrawTool, icon: <HighlighterIcon className="w-4 h-4" />, label: 'Highlight' },
    { id: 'eraser'    as DrawTool, icon: <Eraser className="w-4 h-4" />,         label: 'Eraser'    },
  ]

  return (
    <ToolLayout
      title="Split-Screen Teaching"
      subtitle="Present & Annotate Simultaneously"
      icon={<ChevronLeft className="w-4 h-4" />}
      fullHeight
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-white border-b border-gray-200 flex-shrink-0">
        {/* Draw tools */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          {drawTools.map(t => (
            <button key={t.id} onClick={() => setTool(t.id)} title={t.label} className={cn('p-2 rounded-lg transition-all touch-manipulation', tool === t.id ? 'bg-primary text-white' : 'text-gray-500 hover:bg-white')}>
              {t.icon}
            </button>
          ))}
        </div>
        {/* Colors */}
        <div className="flex gap-1.5">
          {COLORS.map(c => <button key={c} onClick={() => setColor(c)} className={cn('w-6 h-6 rounded-full border-2 transition-all', color === c ? 'border-gray-800 scale-125' : 'border-transparent')} style={{ backgroundColor: c }} />)}
        </div>
        {/* Sizes */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {SIZES.map(s => <button key={s} onClick={() => setSize(s)} className={cn('w-7 h-7 rounded-lg flex items-center justify-center transition-all', size === s ? 'bg-primary' : 'hover:bg-white')}><div className="rounded-full" style={{ width: Math.min(s+2,16), height: Math.min(s+2,16), backgroundColor: size === s ? 'white' : color }} /></button>)}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={clearAnnotation} title="Clear annotations" className="p-2 rounded-xl text-gray-500 hover:bg-red-50 hover:text-red-500 transition-all touch-manipulation"><Trash2 className="w-4 h-4" /></button>
          <button onClick={downloadAnnotated} className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white text-xs font-poppins font-semibold rounded-xl hover:bg-primary-dark transition-all touch-manipulation"><Download className="w-3.5 h-3.5" /><span className="hidden sm:inline">Export</span></button>
        </div>
      </div>

      {/* Split panels */}
      <div ref={containerRef} className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Left: Lesson material */}
        <div className="relative flex flex-col min-h-0 overflow-hidden" style={{ width: `${splitRatio}%` }}>
          <div className="absolute top-2 left-2 z-10 bg-primary-dark/80 text-white text-xs font-poppins font-semibold px-2 py-1 rounded-lg">Lesson Material</div>
          {!leftFile ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-gray-100">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
                <Upload className="w-8 h-8 text-primary/50" />
              </div>
              <p className="text-gray-500 font-poppins text-sm">Upload a lesson file</p>
              <button
                onClick={() => fileInput.current?.click()}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white font-poppins font-semibold text-sm rounded-xl hover:bg-primary-dark transition-all touch-manipulation"
              >
                <Upload className="w-4 h-4" />Browse
              </button>
              <input ref={fileInput} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFile} />
            </div>
          ) : leftType === 'image' ? (
            <img src={leftFile} alt={leftName} className="w-full h-full object-contain bg-gray-900" />
          ) : (
            <iframe src={leftFile} title={leftName} className="flex-1 w-full border-0 min-h-0" />
          )}
          {leftFile && (
            <button onClick={() => fileInput.current?.click()} className="absolute bottom-2 right-2 p-2 bg-white/80 rounded-xl shadow text-gray-600 hover:bg-white transition-all touch-manipulation" title="Change file">
              <RefreshCw className="w-4 h-4" />
              <input ref={fileInput} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFile} />
            </button>
          )}
        </div>

        {/* Draggable divider */}
        <div
          ref={dividerRef}
          onMouseDown={onDividerDown}
          className="w-1.5 bg-gray-300 hover:bg-primary cursor-col-resize flex-shrink-0 transition-colors z-20"
        />

        {/* Right: Annotation board */}
        <div ref={wrapRef} className="flex-1 relative bg-white min-h-0" style={{ cursor: tool === 'eraser' ? 'cell' : 'crosshair' }}>
          <div className="absolute top-2 left-2 z-10 bg-primary-dark/80 text-white text-xs font-poppins font-semibold px-2 py-1 rounded-lg">Annotation Board</div>
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
          {!history.length && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <Pencil className="w-12 h-12 text-gray-200 mb-2" />
              <p className="text-gray-300 font-poppins text-sm">Draw annotations here</p>
            </div>
          )}
        </div>
      </div>
    </ToolLayout>
  )
}
