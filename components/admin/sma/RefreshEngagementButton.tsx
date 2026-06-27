'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Triggers POST /api/sma/engagement/refresh, which pulls live Facebook
 * engagement for recent published posts, then refreshes the server component
 * so the new snapshots render. No-op-friendly: with 0 posts it just reports 0.
 */
export default function RefreshEngagementButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleRefresh = async () => {
    setLoading(true)
    setMessage(null)
    setError(null)
    try {
      const res = await fetch('/api/sma/engagement/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Refresh failed')
      }
      const errCount = Array.isArray(data.errors) ? data.errors.length : 0
      setMessage(
        `Refreshed ${data.refreshed ?? 0} post${data.refreshed === 1 ? '' : 's'}` +
          (errCount > 0 ? ` · ${errCount} error${errCount === 1 ? '' : 's'}` : ''),
      )
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={handleRefresh}
        disabled={loading}
        className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {loading ? 'Refreshing…' : 'Refresh engagement'}
      </button>
      {message ? <span className="text-xs text-zinc-500">{message}</span> : null}
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  )
}
