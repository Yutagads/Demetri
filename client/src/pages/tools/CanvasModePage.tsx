import React, { useState, useRef, useCallback } from 'react'
import {
  StickyNote, Type, Square, Download,
  ZoomIn, ZoomOut, Maximize2, Trash2, X, Move, Pencil,
} from 'lucide-react'
import ToolLayout from '../../components/layout/ToolLayout'
import { cn } from '../../lib/utils'

type ItemType = 'sticky' | 'text' | 'shape'
type ShapeKind = 'rect' | 'circle' | 'diamond'

const STICKY_COLORS = [
  '#FEF08A', '#BBF7D0', '#BAE6FD', '#FECACA', '#E9D5FF', '#FED7AA',
]

interface CanvasItem {
  id: string
  type: ItemType
  x: number
  y: number
  w: number
  h: number
  text: string
  color: string
  shape?: ShapeKind
  fontSize?: number
}

let nextId = 1

function makeStickyNote(x: number, y: number): CanvasItem {
  return { id: String(nextId++), type: 'sticky', x, y, w: 180, h: 140, text: 'Click to edit…', color: STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)] }
}

function makeText(x: number, y: number): CanvasItem {
  return { id: String(nextId++), type: 'text', x, y, w: 200, h: 60, text: 'Text', color: '#111827', fontSize: 18 }
}

function makeShape(x: number, y: number, shape: ShapeKind): CanvasItem {
  return { id: String(nextId++), type: 'shape', x, y, w: 140, h: 100, text: '', color: '#4E7D4B', shape }
}

export default function CanvasModePage() {
  const [items, setItems] = useState<CanvasItem[]>([makeStickyNote(80, 80), makeText(320, 100)])
  const [selected, setSelected] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [editing, setEditing] = useState<string | null>(null)
  const dragging = useRef<{ id: string; ox: number; oy: number } | null>(null)
  const panning  = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)

  const updateItem = (id: string, patch: Partial<CanvasItem>) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))

  const deleteItem = (id: string) => { setItems(prev => prev.filter(i => i.id !== id)); setSelected(null) }

  const addSticky = () => setItems(prev => [...prev, makeStickyNote(100 - pan.x + Math.random() * 80, 100 - pan.y + Math.random() * 80)])
  const addText   = () => setItems(prev => [...prev, makeText(160 - pan.x + Math.random() * 80, 160 - pan.y + Math.random() * 80)])
  const addShape  = (s: ShapeKind) => setItems(prev => [...prev, makeShape(200 - pan.x + Math.random() * 80, 200 - pan.y + Math.random() * 80, s)])

  // Drag items
  const onItemMouseDown = (e: React.MouseEvent, id: string) => {
    if (editing === id) return
    e.stopPropagation()
    setSelected(id)
    dragging.current = { id, ox: e.clientX, oy: e.clientY }
  }

  // Pan canvas
  const onBoardMouseDown = (e: React.MouseEvent) => {
    setSelected(null)
    setEditing(null)
    panning.current = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y }
  }

  const onMouseMove = (e: React.MouseEvent) => {
    if (dragging.current) {
      const { id, ox, oy } = dragging.current
      updateItem(id, { x: (items.find(i => i.id === id)?.x ?? 0) + (e.clientX - ox) / zoom, y: (items.find(i => i.id === id)?.y ?? 0) + (e.clientY - oy) / zoom })
      dragging.current = { ...dragging.current, ox: e.clientX, oy: e.clientY }
    } else if (panning.current) {
      const { sx, sy, px, py } = panning.current
      setPan({ x: px + (e.clientX - sx), y: py + (e.clientY - sy) })
    }
  }

  const onMouseUp = () => { dragging.current = null; panning.current = null }

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    setZoom(z => Math.min(3, Math.max(0.3, z - e.deltaY * 0.001)))
  }

  const fitAll = () => { setPan({ x: 0, y: 0 }); setZoom(1) }

  const downloadPNG = useCallback(() => {
    const el = boardRef.current
    if (!el) return
    // Simple approach: open in new window for print
    const w = window.open('', '_blank')!
    w.document.write(`<html><body style="margin:0;background:#f9fafb">${el.innerHTML}</body></html>`)
    w.print()
    w.close()
  }, [])

  const shapeClip = (s: ShapeKind, w: number, h: number) => {
    if (s === 'diamond') return `polygon(${w/2}px 0, ${w}px ${h/2}px, ${w/2}px ${h}px, 0 ${h/2}px)`
    return undefined
  }

  return (
    <ToolLayout
      title="Canvas Mode"
      subtitle="Infinite Workspace"
      icon={<Square className="w-4 h-4" />}
      fullHeight
      actions={
        <>
          <button onClick={() => setZoom(z => Math.min(3, z + 0.2))} className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors touch-manipulation" title="Zoom In"><ZoomIn className="w-4 h-4" /></button>
          <button onClick={() => setZoom(z => Math.max(0.3, z - 0.2))} className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors touch-manipulation" title="Zoom Out"><ZoomOut className="w-4 h-4" /></button>
          <button onClick={fitAll} className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors touch-manipulation" title="Fit"><Maximize2 className="w-4 h-4" /></button>
        </>
      }
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-white border-b border-gray-200 flex-shrink-0">
        <button onClick={addSticky} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-yellow-100 text-yellow-800 text-xs font-poppins font-semibold hover:bg-yellow-200 transition-all touch-manipulation"><StickyNote className="w-3.5 h-3.5" />Sticky Note</button>
        <button onClick={addText}   className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-poppins font-semibold hover:bg-gray-200 transition-all touch-manipulation"><Type className="w-3.5 h-3.5" />Text</button>
        <button onClick={() => addShape('rect')}    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 text-primary text-xs font-poppins font-semibold hover:bg-primary/20 transition-all touch-manipulation"><Square className="w-3.5 h-3.5" />Box</button>
        <button onClick={() => addShape('circle')}  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-poppins font-semibold hover:bg-blue-100 transition-all touch-manipulation">● Oval</button>
        <button onClick={() => addShape('diamond')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-50 text-purple-700 text-xs font-poppins font-semibold hover:bg-purple-100 transition-all touch-manipulation">◆ Diamond</button>
        <div className="ml-auto flex items-center gap-1">
          <span className="text-xs text-gray-400 font-inter">{Math.round(zoom * 100)}%</span>
          {selected && (
            <button onClick={() => deleteItem(selected)} className="p-2 rounded-xl text-red-400 hover:bg-red-50 transition-all touch-manipulation" title="Delete selected"><Trash2 className="w-4 h-4" /></button>
          )}
        </div>
      </div>

      {/* Canvas board */}
      <div
        className="flex-1 overflow-hidden bg-gray-50 relative"
        style={{ cursor: 'default', backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)', backgroundSize: `${30 * zoom}px ${30 * zoom}px`, backgroundPosition: `${pan.x}px ${pan.y}px` }}
        onMouseDown={onBoardMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
      >
        <div ref={boardRef} style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`, transformOrigin: '0 0', position: 'absolute', width: '100%', height: '100%' }}>
          {items.map(item => (
            <div
              key={item.id}
              onMouseDown={e => onItemMouseDown(e, item.id)}
              onDoubleClick={() => setEditing(item.id)}
              style={{
                position: 'absolute', left: item.x, top: item.y,
                width: item.w, height: item.h,
                cursor: dragging.current?.id === item.id ? 'grabbing' : 'grab',
                zIndex: selected === item.id ? 10 : 1,
              }}
            >
              {item.type === 'sticky' && (
                <div
                  className="w-full h-full rounded-lg shadow-md p-2.5 flex flex-col"
                  style={{ backgroundColor: item.color, outline: selected === item.id ? '2px solid #4E7D4B' : 'none' }}
                >
                  {editing === item.id ? (
                    <textarea
                      autoFocus
                      value={item.text}
                      onChange={e => updateItem(item.id, { text: e.target.value })}
                      onBlur={() => setEditing(null)}
                      className="flex-1 w-full bg-transparent resize-none font-inter text-sm text-gray-800 focus:outline-none"
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <p className="font-inter text-sm text-gray-800 break-words select-none">{item.text}</p>
                  )}
                  {selected === item.id && (
                    <button onClick={e => { e.stopPropagation(); deleteItem(item.id) }} className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow"><X className="w-3 h-3" /></button>
                  )}
                </div>
              )}
              {item.type === 'text' && (
                <div style={{ outline: selected === item.id ? '2px dashed #4E7D4B' : '1px dashed transparent', borderRadius: 8, padding: 4, minWidth: 60 }}>
                  {editing === item.id ? (
                    <input
                      autoFocus
                      value={item.text}
                      onChange={e => updateItem(item.id, { text: e.target.value })}
                      onBlur={() => setEditing(null)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditing(null) }}
                      className="bg-transparent font-poppins font-semibold text-gray-800 focus:outline-none w-full"
                      style={{ fontSize: item.fontSize }}
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <p className="font-poppins font-semibold text-gray-800 select-none whitespace-nowrap" style={{ fontSize: item.fontSize }}>{item.text}</p>
                  )}
                  {selected === item.id && <button onClick={e => { e.stopPropagation(); deleteItem(item.id) }} className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow"><X className="w-3 h-3" /></button>}
                </div>
              )}
              {item.type === 'shape' && (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{
                    backgroundColor: item.color + '33',
                    border: `2px solid ${item.color}`,
                    borderRadius: item.shape === 'circle' ? '50%' : item.shape === 'diamond' ? 0 : 12,
                    clipPath: item.shape ? shapeClip(item.shape, item.w, item.h) : undefined,
                    outline: selected === item.id ? `2px solid #111827` : 'none',
                  }}
                >
                  {selected === item.id && <button onClick={e => { e.stopPropagation(); deleteItem(item.id) }} className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow"><X className="w-3 h-3" /></button>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/40 text-white text-xs font-inter px-4 py-1.5 rounded-full pointer-events-none">
        Scroll to zoom · Drag background to pan · Double-click to edit
      </div>
    </ToolLayout>
  )
}
