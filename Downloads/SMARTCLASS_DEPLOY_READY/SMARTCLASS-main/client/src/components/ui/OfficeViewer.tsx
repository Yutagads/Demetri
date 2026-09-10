import React, { useState, useRef } from 'react'
import { FileText, Download, ExternalLink, RefreshCw, AlertCircle } from 'lucide-react'

type Engine = 'ms' | 'google'

interface Props {
  material: {
    filePath: string
    fileType: string
    title: string
    originalName: string
  }
}

function buildViewerUrl(engine: Engine, fileUrl: string): string {
  const encoded = encodeURIComponent(fileUrl)
  if (engine === 'ms') {
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encoded}`
  }
  return `https://docs.google.com/viewer?url=${encoded}&embedded=true`
}

export default function OfficeViewer({ material }: Props) {
  const [engine, setEngine] = useState<Engine>('ms')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Build the full public URL the external viewer can reach
  const fileUrl = `${window.location.origin}${material.filePath}`
  const viewerUrl = buildViewerUrl(engine, fileUrl)

  const label = material.fileType === 'pptx' ? 'PowerPoint Presentation' : 'Word Document'

  function switchEngine(next: Engine) {
    setEngine(next)
    setLoading(true)
    setError(false)
  }

  function reload() {
    setLoading(true)
    setError(false)
    // Force iframe reload by temporarily blanking src
    if (iframeRef.current) {
      iframeRef.current.src = ''
      setTimeout(() => {
        if (iframeRef.current) iframeRef.current.src = viewerUrl
      }, 50)
    }
  }

  return (
    <div className="relative flex flex-col w-full h-full" style={{ minHeight: 'calc(100vh - 56px)' }}>
      {/* Loading overlay */}
      {loading && !error && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80 gap-3">
          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <p className="font-inter text-sm text-white/60">Loading preview…</p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/90 gap-4 px-6">
          <AlertCircle className="w-12 h-12 text-red-400" />
          <div className="text-center">
            <p className="font-poppins font-semibold text-white">Preview failed to load</p>
            <p className="font-inter text-sm text-white/50 mt-1">
              The viewer service couldn't reach the file. Try the other viewer or download instead.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => switchEngine(engine === 'ms' ? 'google' : 'ms')}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-lg text-sm font-inter hover:bg-white/20 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Try {engine === 'ms' ? 'Google Docs' : 'Office'} Viewer
            </button>
            <a
              href={material.filePath}
              download
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-inter hover:bg-primary-dark transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </a>
          </div>
        </div>
      )}

      {/* Iframe viewer */}
      <iframe
        ref={iframeRef}
        src={viewerUrl}
        title={material.title}
        className="flex-1 w-full border-0"
        style={{ minHeight: 'calc(100vh - 56px - 52px)' }}
        onLoad={() => { setLoading(false); setError(false) }}
        onError={() => { setLoading(false); setError(true) }}
        allow="fullscreen"
      />

      {/* Bottom control bar */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-black/80 backdrop-blur-sm border-t border-white/10 flex-shrink-0">
        {/* Left: file info */}
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-white/40 flex-shrink-0" />
          <span className="font-inter text-xs text-white/50 truncate">{label} · Read-only preview</span>
        </div>

        {/* Center: viewer switcher */}
        <div className="flex items-center gap-1 bg-white/10 rounded-lg p-0.5 flex-shrink-0">
          <button
            onClick={() => switchEngine('ms')}
            className={`px-2.5 py-1 rounded-md text-xs font-inter transition-colors ${
              engine === 'ms'
                ? 'bg-white text-black font-medium'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Office
          </button>
          <button
            onClick={() => switchEngine('google')}
            className={`px-2.5 py-1 rounded-md text-xs font-inter transition-colors ${
              engine === 'google'
                ? 'bg-white text-black font-medium'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Google
          </button>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={reload}
            title="Reload preview"
            className="p-1.5 text-white/50 hover:text-white transition-colors rounded-lg hover:bg-white/10"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <a
            href={material.filePath}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 text-white text-xs font-inter rounded-lg hover:bg-white/20 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Open
          </a>
          <a
            href={material.filePath}
            download
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-inter rounded-lg hover:bg-primary-dark transition-colors"
          >
            <Download className="w-3 h-3" />
            Download
          </a>
        </div>
      </div>
    </div>
  )
}
