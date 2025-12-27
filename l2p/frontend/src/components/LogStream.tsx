import React, { useEffect, useRef, useState } from 'react'

interface LogStreamProps {
  title: string
  path: string // relative path after base, e.g. "/admin/logs/frontend/stream"
  maxLines?: number
}

function resolveApiBase(): string {
  let envUrl: string | undefined
  
  // Handle Vite environment variables (only available in browser/Vite context)
  if (typeof window !== 'undefined' && 'import' in window) {
    const windowWithImport = window as { import?: { meta?: { env?: { VITE_API_URL?: string } } } }
    if (windowWithImport.import?.meta?.env?.VITE_API_URL) {
      envUrl = windowWithImport.import.meta.env.VITE_API_URL
    }
  } else if (typeof process !== 'undefined' && process.env?.VITE_API_URL) {
    envUrl = process.env.VITE_API_URL
  }
  // Ensure ends without trailing slash
  const base = (envUrl && envUrl.trim()) || '/api'
  return base.replace(/\/$/, '')
}

export const LogStream: React.FC<LogStreamProps> = ({ title, path, maxLines = 500 }) => {
  const [lines, setLines] = useState<string[]>([])
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const base = resolveApiBase()
    const url = `${base}${path}`
    const es = new EventSource(url)

    es.onopen = () => {
      setConnected(true)
      setError(null)
    }

    es.onerror = () => {
      setConnected(false)
      setError('Connection lost. Retrying...')
      // EventSource auto-reconnects
    }

    es.onmessage = (ev: MessageEvent) => {
      const text = String(ev.data || '')
      if (!text) return
      setLines((prev) => {
        const next = [...prev, text]
        if (next.length > maxLines) {
          return next.slice(next.length - maxLines)
        }
        return next
      })
    }

    return () => {
      es.close()
    }
  }, [path, maxLines])

  // Auto-scroll to bottom on new lines
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [lines])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderBottom: '1px solid #ddd' }}>
        <strong>{title}</strong>
        <span style={{ fontSize: 12, color: connected ? '#2e7d32' : '#d32f2f' }}>
          {connected ? 'LIVE' : 'DISCONNECTED'}
        </span>
        {error && <span style={{ fontSize: 12, color: '#d32f2f' }}>{error}</span>}
      </div>
      <div
        ref={containerRef}
        style={{
          flex: 1,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          fontSize: 12,
          background: '#0b0f14',
          color: '#e3f2fd',
          padding: 8,
          overflow: 'auto',
          whiteSpace: 'pre',
          lineHeight: 1.35,
          borderRadius: 4,
        }}
        aria-label={`${title} live log`}
      >
        {lines.length === 0 ? (
          <div style={{ opacity: 0.7 }}>Waiting for log data...</div>
        ) : (
          lines.map((l, i) => (
            <div key={i}>{l}</div>
          ))
        )}
      </div>
    </div>
  )
}

export default LogStream
