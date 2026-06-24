'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'

type Platform = 'facebook' | 'instagram' | 'threads'

interface DraftResult {
  platform: Platform
  body: string
  draft_id: string
  generated_at: string
  attached_assets?: string[]
}

interface ContentIntent {
  topic: string
  proposed_platforms: Platform[]
}

interface ContentLifecycle {
  task_id: string
  intent: ContentIntent
  drafts: Partial<Record<Platform, DraftResult>>
  assembled_at: string
  status: string
}

interface LifecycleRow {
  task_id: string
  lifecycle_record: ContentLifecycle
  lineage_hash: string
  assembled_at: string
}

const PLATFORM_COLORS: Record<Platform, string> = {
  facebook: 'bg-blue-50 text-blue-700 border-blue-200',
  instagram: 'bg-pink-50 text-pink-700 border-pink-200',
  threads: 'bg-zinc-100 text-zinc-700 border-zinc-300',
}

const FILTERS: { id: Platform | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'threads', label: 'Threads' },
]

function LifecycleCard({ row }: { row: LifecycleRow }) {
  const [copied, setCopied] = useState<string | null>(null)
  const lifecycle = row.lifecycle_record
  const platforms = Object.keys(lifecycle.drafts) as Platform[]
  const approvedAt = new Date(row.assembled_at).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  const handleCopy = async (platform: Platform, body: string) => {
    try {
      await navigator.clipboard.writeText(body)
      setCopied(platform)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      alert('Failed to copy')
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
      <div>
        <p className="text-xs text-zinc-400 mb-1">{approvedAt}</p>
        <h3 className="font-semibold text-zinc-900">{lifecycle.intent.topic}</h3>
      </div>

      {platforms.map(platform => {
        const draft = lifecycle.drafts[platform]
        if (!draft) return null
        const images = draft.attached_assets?.filter(a => /\.(jpg|jpeg|png|webp)$/i.test(a)).map(p => p.replace(/^public\//, '/')) || []
        const videos = draft.attached_assets?.filter(a => /\.(mp4|webm|mov)$/i.test(a)).map(p => p.replace(/^public\//, '/')) || []

        return (
          <div key={platform} className="border border-zinc-100 rounded-lg p-4 space-y-3 bg-zinc-50">
            <div className="flex items-center justify-between">
              <span className={`text-xs font-medium px-2 py-0.5 rounded border ${PLATFORM_COLORS[platform]}`}>
                {platform.charAt(0).toUpperCase() + platform.slice(1)}
              </span>
              <span className="text-xs text-zinc-400">{draft.body.length} chars</span>
            </div>

            {videos.length > 0 && (
              <div className="space-y-2">
                <video src={videos[0]} controls className="w-full rounded-lg bg-zinc-900 max-h-48" />
                <a
                  href={videos[0]}
                  download={videos[0].split('/').pop() || 'video.mp4'}
                  className="inline-block text-xs font-medium px-3 py-1.5 rounded-md border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700"
                >
                  ↓ Download Video
                </a>
              </div>
            )}
            {images.length > 0 && videos.length === 0 && (
              <div className="space-y-2">
                <div className="relative w-full h-48 rounded-lg overflow-hidden">
                  <Image src={images[0]} alt="Product" fill className="object-cover" />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <a
                    href={images[0]}
                    download={images[0].split('/').pop() || 'image.jpg'}
                    className="inline-block text-xs font-medium px-3 py-1.5 rounded-md border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700"
                  >
                    ↓ Download Image
                  </a>
                  {images.slice(1).map((img, i) => (
                    <a
                      key={i}
                      href={img}
                      download={img.split('/').pop() || `image-${i + 2}.jpg`}
                      className="text-xs text-zinc-500 hover:text-zinc-700 underline"
                    >
                      + Photo {i + 2}
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded p-3 text-sm text-zinc-900 whitespace-pre-wrap max-h-48 overflow-y-auto border border-zinc-200">
              {draft.body}
            </div>

            <button
              onClick={() => handleCopy(platform, draft.body)}
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-zinc-900 text-white hover:bg-zinc-700 transition-colors"
            >
              {copied === platform ? '✓ Copied' : 'Copy Caption'}
            </button>
          </div>
        )
      })}

      <p className="text-xs text-zinc-400">
        Hash: {row.lineage_hash.substring(0, 12)}...
      </p>
    </div>
  )
}

export default function ScheduledPage() {
  const [rows, setRows] = useState<LifecycleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Platform | 'all'>('all')
  const [refreshKey, setRefreshKey] = useState(0)

  const load = () => {
    setLoading(true)
    setError(null)
    setRefreshKey(k => k + 1)
  }

  useEffect(() => {
    let cancelled = false
    fetch('/api/sma/coordinator/ready')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load')
        return res.json()
      })
      .then((data: LifecycleRow[]) => { if (!cancelled) { setRows(data); setLoading(false) } })
      .catch(err => { if (!cancelled) { setError(err instanceof Error ? err.message : 'Failed to load'); setLoading(false) } })
    return () => { cancelled = true }
  }, [refreshKey])

  const filtered = filter === 'all'
    ? rows
    : rows.filter(r => Object.keys(r.lifecycle_record.drafts).includes(filter))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          Approved content ready to post manually. Copy the caption and publish on the platform, then come back to mark it done once publishing is wired up.
        </p>
        <button
          onClick={load}
          disabled={loading}
          className="text-xs font-medium px-3 py-1.5 rounded-md border border-zinc-300 hover:bg-zinc-50 disabled:opacity-50"
        >
          {loading ? 'Loading...' : '↺ Refresh'}
        </button>
      </div>

      <div className="flex gap-1 border-b border-zinc-200">
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-2 text-sm transition-colors border-b-2 -mb-px ${
              filter === f.id
                ? 'border-zinc-900 text-zinc-900 font-medium'
                : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-12 text-center">
          <p className="text-sm text-zinc-500 font-medium">No approved content yet</p>
          <p className="text-xs text-zinc-400 mt-1">
            Generate and approve drafts in the Queue — they appear here once approved.
          </p>
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map(i => (
            <div key={i} className="rounded-xl border border-zinc-200 bg-zinc-50 h-48 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(row => (
            <LifecycleCard key={row.task_id} row={row} />
          ))}
        </div>
      )}
    </div>
  )
}
