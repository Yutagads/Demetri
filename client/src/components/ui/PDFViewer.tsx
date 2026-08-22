/**
 * PDFViewer — renders PDF files as canvas elements using PDF.js.
 * Works in any browser context including sandboxed iframes, because it
 * bypasses Chrome's built-in PDF viewer entirely.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react'

// Point the worker at the bundled copy shipped with pdfjs-dist
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).href

interface Props {
  /** HTTP URL or blob: URL of the PDF to display */
  url: string
}

export default function PDFViewer({ url }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const renderTask = useRef<any>(null)

  const [pdf,      setPdf]      = useState<any>(null)
  const [pageNum,  setPageNum]  = useState(1)
  const [numPages, setNumPages] = useState(0)
  const [scale,    setScale]    = useState(1.4)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  // Load document whenever the URL changes
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setPageNum(1)
    pdfjsLib.getDocument(url).promise
      .then(doc => {
        if (cancelled) return
        setPdf(doc)
        setNumPages(doc.numPages)
        setLoading(false)
      })
      .catch(err => {
        if (cancelled) return
        console.error('[PDFViewer] load error:', err)
        setError('Could not load PDF.')
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [url])

  // Render the current page whenever pdf / pageNum / scale changes
  const renderPage = useCallback(async () => {
    if (!pdf || !canvasRef.current) return
    // Cancel any in-progress render
    if (renderTask.current) {
      renderTask.current.cancel()
      renderTask.current = null
    }
    try {
      const page     = await pdf.getPage(pageNum)
      const viewport = page.getViewport({ scale })
      const canvas   = canvasRef.current
      canvas.width   = viewport.width
      canvas.height  = viewport.height
      const ctx      = canvas.getContext('2d')!
      renderTask.current = page.render({ canvasContext: ctx, viewport })
      await renderTask.current.promise
    } catch (err: any) {
      // RenderingCancelledException is expected when navigating quickly
      if (err?.name !== 'RenderingCancelledException') {
        console.error('[PDFViewer] render error:', err)
      }
    }
  }, [pdf, pageNum, scale])

  useEffect(() => { renderPage() }, [renderPage])

  const prev = () => setPageNum(p => Math.max(1, p - 1))
  const next = () => setPageNum(p => Math.min(numPages, p + 1))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-white/50 font-inter text-sm">
        {error}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable canvas area */}
      <div className="flex-1 overflow-auto flex items-start justify-center bg-neutral-800 py-4">
        <canvas ref={canvasRef} className="shadow-2xl" />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 py-2 px-4 bg-black/70 flex-shrink-0">
        {/* Zoom */}
        <button
          onClick={() => setScale(s => Math.max(0.5, +(s - 0.2).toFixed(1)))}
          className="p-1.5 text-white/60 hover:text-white transition-colors"
          title="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-white/50 font-inter text-xs w-10 text-center">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={() => setScale(s => Math.min(3, +(s + 0.2).toFixed(1)))}
          className="p-1.5 text-white/60 hover:text-white transition-colors"
          title="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        {/* Page navigation */}
        {numPages > 1 && (
          <>
            <div className="w-px h-4 bg-white/20 mx-1" />
            <button
              onClick={prev}
              disabled={pageNum === 1}
              className="p-1.5 text-white/60 hover:text-white disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-white/70 font-inter text-xs whitespace-nowrap">
              {pageNum} / {numPages}
            </span>
            <button
              onClick={next}
              disabled={pageNum === numPages}
              className="p-1.5 text-white/60 hover:text-white disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
