'use client'

import { useState } from 'react'
import type { ContentRecommendation } from '@/app/api/sma/coordinator/recommend/route'

const PLATFORM_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  threads: 'Threads',
}

const PLATFORM_COLORS: Record<string, string> = {
  facebook: 'bg-blue-50 text-blue-700 border-blue-200',
  instagram: 'bg-pink-50 text-pink-700 border-pink-200',
  threads: 'bg-zinc-100 text-zinc-700 border-zinc-300',
}

const CONTENT_TYPE_LABELS: Record<string, string> = {
  pictures: '🖼️ Pictures',
  video: '🎬 Video',
  both: '🎬📸 Both',
}

function RecommendationCard({
  rec,
  onQueue,
}: {
  rec: ContentRecommendation
  onQueue: (rec: ContentRecommendation) => Promise<void>
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'queued' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleQueue = async () => {
    setStatus('loading')
    setErrorMsg(null)
    try {
      await onQueue(rec)
      setStatus('queued')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to queue')
      setStatus('error')
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{rec.product_name}</p>
          <p className="text-sm font-semibold text-zinc-900 leading-snug">{rec.angle}</p>
        </div>
        <span className={`shrink-0 text-xs font-medium px-2 py-1 rounded border ${PLATFORM_COLORS[rec.platform]}`}>
          {PLATFORM_LABELS[rec.platform]}
        </span>
      </div>

      <p className="text-xs text-zinc-500 italic">{rec.rationale}</p>

      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-zinc-400">{CONTENT_TYPE_LABELS[rec.content_type]}</span>
        {status === 'queued' ? (
          <span className="text-xs text-emerald-600 font-medium">✓ Added to queue</span>
        ) : (
          <button
            onClick={handleQueue}
            disabled={status === 'loading'}
            className="text-xs font-medium px-3 py-1.5 rounded-md bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
          >
            {status === 'loading' ? 'Generating...' : 'Send to Queue'}
          </button>
        )}
      </div>
      {status === 'error' && errorMsg && (
        <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">{errorMsg}</p>
      )}
    </div>
  )
}

export default function RecommendationsPage() {
  const [recommendations, setRecommendations] = useState<ContentRecommendation[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generated, setGenerated] = useState(false)

  const fetchRecommendations = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/sma/coordinator/recommend')
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to generate recommendations')
      }
      const data = await res.json()
      setRecommendations(data.recommendations)
      setGenerated(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleQueue = async (rec: ContentRecommendation) => {
    const includePictures = rec.content_type === 'pictures' || rec.content_type === 'both'
    const includeVideo = rec.content_type === 'video' || rec.content_type === 'both'

    const res = await fetch('/api/sma/coordinator/task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: rec.product_slug,
        notes: rec.angle,
        includePictures,
        includeVideo,
        platforms: [rec.platform],
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to generate draft')
    }
  }

  const byPlatform = (platform: string) =>
    recommendations.filter(r => r.platform === platform)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-zinc-500 mt-1">
            AI-generated content ideas across Instagram, Facebook, and Threads — grounded in the CEPTI product catalog.
          </p>
        </div>
        <button
          onClick={fetchRecommendations}
          disabled={loading}
          className="shrink-0 inline-flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {loading ? (
            <>
              <span className="animate-spin">⏳</span>
              Generating...
            </>
          ) : generated ? (
            '↺ Refresh Ideas'
          ) : (
            '✦ Generate Ideas'
          )}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!generated && !loading && (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-12 text-center">
          <p className="text-sm text-zinc-500">Click <strong>Generate Ideas</strong> to get AI-recommended content for all platforms.</p>
          <p className="text-xs text-zinc-400 mt-1">Each idea can be sent directly to the approval queue.</p>
        </div>
      )}

      {generated && recommendations.length > 0 && (
        <div className="space-y-8">
          {['instagram', 'facebook', 'threads'].map(platform => {
            const recs = byPlatform(platform)
            if (recs.length === 0) return null
            return (
              <div key={platform}>
                <h3 className="text-sm font-semibold text-zinc-700 mb-3 flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded border text-xs ${PLATFORM_COLORS[platform]}`}>
                    {PLATFORM_LABELS[platform]}
                  </span>
                  <span className="text-zinc-400 font-normal">{recs.length} idea{recs.length !== 1 ? 's' : ''}</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {recs.map(rec => (
                    <RecommendationCard key={rec.id} rec={rec} onQueue={handleQueue} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
