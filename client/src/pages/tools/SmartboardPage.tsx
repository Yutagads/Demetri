import React, { useRef, useState, useEffect, useCallback } from 'react'
import {
  Pencil, Eraser, Undo2, Redo2, Trash2, Download,
  Maximize2, Minimize2, Type, Minus, Square, Circle,
  ArrowRight, Bold,
} from 'lucide-react'
import ToolLayout from '../../components/layout/ToolLayout'
import { cn } from '../../lib/utils'

type DrawTool = 'pen' | 'eraser' | 'text' | 'line' | 'rect' | 'circle' | 'arrow'

interface Point { x: number; y: number }
interface DrawCmd {
  type: DrawTool
  color: string
  size: number
  points: Point[]
  text?: string
  fontSize?: number
}

const COLORS = [
  { label: 'Black',  value: '#111827' },
  { label: 'Blue',   value: '#3B82F6' },
  { label: 'Red',    value: '#EF4444' },
  { label: 'Green',  value: '#22C55E' },
  { label: 'Orange', value: '#F97316' },
  { label: 'Purple', value: '#A855F7' },
]
const SIZES = [2, 4, 8, 14, 20]

function drawCmd(ctx: CanvasRenderingContext2D, cmd: DrawCmd, preview?: DrawCmd) {
  const renderOne = (c: DrawCmd) => {
    ctx.strokeStyle = c.color
    ctx.fillStyle   = c.color
    ctx.lineWidth   = c.size
    ctx.lineCap     = 'round'
    ctx.lineJoin    = 'round'

    if (c.type === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.lineWidth = c.size * 4
    } else {
      ctx.globalCompositeOperation = 'source-over'
    }

    if (c.type === 'pen' || c.type === 'eraser') {
      if (c.points.length < 2) return
      ctx.beginPath()
      ctx.moveTo(c.points[0].x, c.points[0].y)
      for (let i = 1; i < c.points.length; i++) ctx.lineTo(c.points[i].x, c.points[i].y)
      ctx.stroke()
    } else if (c.type === 'line') {
      if (c.points.length < 2) return
      const [a, b] = [c.points[0], c.points[c.points.length - 1]]
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
    } else if (c.type === 'arrow') {
      if (c.points.length < 2) return
      const [a, b] = [c.points[0], c.points[c.points.length - 1]]
      const angle = Math.atan2(b.y - a.y, b.x - a.x)
      const head = 16 + c.size * 2
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(b.x, b.y)
      ctx.lineTo(b.x - head * Math.cos(angle - Math.PI / 6), b.y - head * Math.sin(angle - Math.PI / 6))
      ctx.lineTo(b.x - head * Math.cos(angle + Math.PI / 6), b.y - head * Math.sin(angle + Math.PI / 6))
      ctx.closePath(); ctx.fill()
    } else if (c.type === 'rect') {
      if (c.points.length < 2) return
      const [a, b] = [c.points[0], c.points[c.points.length - 1]]
      ctx.beginPath(); ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y)
    } else if (c.type === 'circle') {
      if (c.points.length < 2) return
      const [a, b] = [c.points[0], c.points[c.points.length - 1]]
      const rx = Math.abs(b.x - a.x) / 2, ry = Math.abs(b.y - a.y) / 2
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke()
    } else if (c.type === 'text' && c.text) {
      ctx.globalCompositeOperation = 'source-over'
      ctx.font = `${c.fontSize || 20}px Poppins, sans-serif`
      ctx.fillText(c.text, c.points[0].x, c.points[0].y)
    }
    ctx.globalCompositeOperation = 'source-over'
  }
  renderOne(cmd)
  if (preview) renderOne(preview)
}

export default function SmartboardPage() {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const wrapRef     = useRef<HTMLDivElement>(null)
  const [tool, setTool]       = useState<DrawTool>('pen')
  const [color, setColor]     = useState(COLORS[0].value)
  const [size, setSize]       = useState(SIZES[1])
  const [history, setHistory] = useState<DrawCmd[]>([])
  const [redo, setRedo]       = useState<DrawCmd[]>([])
  const [fullscreen, setFullscreen] = useState(false)
  const [textInput, setTextInput]   = useState('')
  const [textPos, setTextPos]       = useState<Point | null>(null)
  const drawing   = useRef(false)
  const current   = useRef<DrawCmd | null>(null)
  const offscreen = useRef<HTMLCanvasElement | null>(null)

  // Resize canvas to fill wrapper
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current
      const wrap   = wrapRef.current
      if (!canvas || !wrap) return
      const { width, height } = wrap.getBoundingClientRect()
      // Snapshot before resize
      const snap = canvas.toDataURL()
      canvas.width  = width
      canvas.height = height
      // Restore
      const img = new Image()
      img.onload = () => canvas.getContext('2d')?.drawImage(img, 0, 0)
      img.src = snap
    }
    resize()
    const ro = new ResizeObserver(resize)
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [fullscreen])

  const redraw = useCallback((cmds: DrawCmd[], preview?: DrawCmd) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    cmds.forEach(c => drawCmd(ctx, c))
    if (preview) drawCmd(ctx, preview)
  }, [])

  const pt = (e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width  / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      const t = e.touches[0] || e.changedTouches[0]
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY }
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }

  const onDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (tool === 'text') { setTextPos(pt(e)); return }
    e.preventDefault()
    drawing.current = true
    current.current = { type: tool, color, size, points: [pt(e)] }
  }

  const onMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current || !current.current) return
    e.preventDefault()
    const p = pt(e)
    if (tool === 'pen' || tool === 'eraser') {
      current.current.points.push(p)
      const ctx = canvasRef.current?.getContext('2d')!
      const cmds = current.current.points
      if (cmds.length >= 2) {
        drawCmd(ctx, { ...current.current, points: cmds.slice(-2) })
      }
    } else {
      // Shape preview
      current.current = { ...current.current, points: [current.current.points[0], p] }
      redraw(history, current.current)
    }
  }

  const onUp = () => {
    if (!drawing.current || !current.current) return
    drawing.current = false
    const cmd = { ...current.current }
    const next = [...history, cmd]
    setHistory(next)
    setRedo([])
    if (tool !== 'pen' && tool !== 'eraser') redraw(next)
    current.current = null
  }

  const handleUndo = () => {
    if (!history.length) return
    const next = history.slice(0, -1)
    setRedo(r => [...r, history[history.length - 1]])
    setHistory(next)
    redraw(next)
  }

  const handleRedo = () => {
    if (!redo.length) return
    const cmd = redo[redo.length - 1]
    const next = [...history, cmd]
    setHistory(next)
    setRedo(r => r.slice(0, -1))
    redraw(next)
  }

  const handleClear = () => { setHistory([]); setRedo([]); redraw([]) }

  const handleTextSubmit = () => {
    if (!textPos || !textInput.trim()) { setTextPos(null); return }
    const cmd: DrawCmd = { type: 'text', color, size, points: [textPos], text: textInput, fontSize: 14 + size * 2 }
    const next = [...history, cmd]
    setHistory(next)
    setRedo([])
    redraw(next)
    setTextInput('')
    setTextPos(null)
  }

  const downloadPNG = () => {
    const canvas = canvasRef.current!
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = 'smartboard.png'
    a.click()
  }

  const tools: { id: DrawTool; icon: React.ReactNode; label: string }[] = [
    { id: 'pen',    icon: <Pencil   className="w-4 h-4" />, label: 'Pen'      },
    { id: 'eraser', icon: <Eraser   className="w-4 h-4" />, label: 'Eraser'   },
    { id: 'text',   icon: <Type     className="w-4 h-4" />, label: 'Text'     },
    { id: 'line',   icon: <Minus    className="w-4 h-4" />, label: 'Line'     },
    { id: 'arrow',  icon: <ArrowRight className="w-4 h-4" />, label: 'Arrow'  },
    { id: 'rect',   icon: <Square   className="w-4 h-4" />, label: 'Rect'     },
    { id: 'circle', icon: <Circle   className="w-4 h-4" />, label: 'Circle'   },
  ]

  return (
    <ToolLayout
      title="SMARTBOARD"
      subtitle="Digital Whiteboard"
      icon={<Pencil className="w-4 h-4" />}
      fullHeight
      actions={
        <button
          onClick={() => setFullscreen(f => !f)}
          className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors touch-manipulation"
          title={fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        >
          {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      }
    >
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-white border-b border-gray-200 flex-shrink-0">
          {/* Draw tools */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            {tools.map(t => (
              <button
                key={t.id}
                onClick={() => setTool(t.id)}
                title={t.label}
                className={cn(
                  'p-2 rounded-lg transition-all touch-manipulation min-w-[36px] min-h-[36px] flex items-center justify-center',
                  tool === t.id ? 'bg-primary text-white shadow-sm' : 'text-gray-500 hover:bg-white hover:text-gray-800',
                )}
              >{t.icon}</button>
            ))}
          </div>

          {/* Colors */}
          <div className="flex items-center gap-1.5">
            {COLORS.map(c => (
              <button
                key={c.value}
                onClick={() => setColor(c.value)}
                title={c.label}
                className={cn(
                  'w-7 h-7 rounded-full border-2 transition-all touch-manipulation',
                  color === c.value ? 'border-primary scale-125 shadow' : 'border-transparent hover:scale-110',
                )}
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>

          {/* Size */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            {SIZES.map(s => (
              <button
                key={s}
                onClick={() => setSize(s)}
                title={`${s}px`}
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center transition-all touch-manipulation',
                  size === s ? 'bg-primary' : 'hover:bg-white',
                )}
              >
                <div
                  className="rounded-full"
                  style={{ width: Math.min(s + 4, 20), height: Math.min(s + 4, 20), backgroundColor: size === s ? 'white' : color }}
                />
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 ml-auto">
            <button onClick={handleUndo} disabled={!history.length} title="Undo" className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-all touch-manipulation">
              <Undo2 className="w-4 h-4" />
            </button>
            <button onClick={handleRedo} disabled={!redo.length} title="Redo" className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-all touch-manipulation">
              <Redo2 className="w-4 h-4" />
            </button>
            <button onClick={handleClear} title="Clear" className="p-2 rounded-xl text-gray-500 hover:bg-red-50 hover:text-red-500 transition-all touch-manipulation">
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={downloadPNG} title="Download PNG" className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white text-xs font-poppins font-semibold rounded-xl hover:bg-primary-dark transition-all touch-manipulation">
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">PNG</span>
            </button>
          </div>
        </div>

        {/* Canvas area */}
        <div ref={wrapRef} className="flex-1 relative bg-white overflow-hidden" style={{ cursor: tool === 'eraser' ? 'cell' : tool === 'text' ? 'text' : 'crosshair' }}>
          <canvas
            ref={canvasRef}
            className="absolute inset-0 touch-none"
            onMouseDown={onDown}
            onMouseMove={onMove}
            onMouseUp={onUp}
            onMouseLeave={onUp}
            onTouchStart={onDown}
            onTouchMove={onMove}
            onTouchEnd={onUp}
          />

          {/* Text input overlay */}
          {textPos && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute pointer-events-auto flex gap-2 items-center" style={{ left: textPos.x, top: textPos.y - 48 }}>
                <input
                  autoFocus
                  value={textInput}
                  onChange={e => setTextInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleTextSubmit(); if (e.key === 'Escape') { setTextPos(null); setTextInput('') } }}
                  placeholder="Type text…"
                  className="border border-primary rounded-lg px-3 py-1.5 text-sm font-inter bg-white shadow-lg focus:outline-none focus:ring-2 focus:ring-primary w-48"
                  style={{ color, fontSize: 14 + size * 2 > 28 ? 28 : 14 + size * 2 }}
                />
                <button onClick={handleTextSubmit} className="px-2 py-1.5 bg-primary text-white text-xs rounded-lg">Add</button>
              </div>
            </div>
          )}

          {/* Empty hint */}
          {!history.length && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <Pencil className="w-16 h-16 text-gray-200 mb-3" />
              <p className="text-gray-300 font-poppins text-lg">Start drawing…</p>
            </div>
          )}
        </div>
      </div>
    </ToolLayout>
  )
}
