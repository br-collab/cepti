'use client'

import { useState } from 'react'

// Platforms the dashboard can publish/schedule from today. Threads is
// draft/copy-only until its agent is implemented.
const PUBLISHABLE = new Set(['facebook', 'instagram'])

function platformLabel(platform: string): string {
  return platform.charAt(0).toUpperCase() + platform.slice(1)
}

export default function ReadyToPostSection({
  items,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: Array<{ task_id: string; lifecycle_record: any; lineage_hash: string; assembled_at: string }>
}) {
  const [copied, setCopied] = useState<string | null>(null)
  // All maps below are keyed by `${taskId}-${platform}` so a task with drafts
  // on multiple platforms tracks each independently.
  const [publishing, setPublishing] = useState<string | null>(null)
  const [publishResult, setPublishResult] = useState<
    Record<string, { permalink?: string; error?: string }>
  >({})
  const [scheduleInput, setScheduleInput] = useState<Record<string, string>>({})
  const [scheduling, setScheduling] = useState<string | null>(null)
  const [scheduleResult, setScheduleResult] = useState<
    Record<string, { scheduled?: boolean; error?: string }>
  >({})

  const handleCopy = async (key: string, caption: string) => {
    try {
      await navigator.clipboard.writeText(caption)
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      alert('Failed to copy to clipboard')
    }
  }

  const handlePublish = async (taskId: string, platform: string) => {
    const key = `${taskId}-${platform}`
    setPublishing(key)
    setPublishResult((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    try {
      const res = await fetch(`/api/sma/publish/${taskId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Publish failed')
      }
      setPublishResult((prev) => ({ ...prev, [key]: { permalink: data.permalink } }))
    } catch (error) {
      setPublishResult((prev) => ({
        ...prev,
        [key]: { error: error instanceof Error ? error.message : 'Publish failed' },
      }))
    } finally {
      setPublishing(null)
    }
  }

  const handleSchedule = async (taskId: string, platform: string) => {
    const key = `${taskId}-${platform}`
    const local = scheduleInput[key]
    if (!local) {
      setScheduleResult((prev) => ({ ...prev, [key]: { error: 'Pick a date and time first' } }))
      return
    }
    // datetime-local has no timezone; interpret it in the admin's local zone.
    const date = new Date(local)
    if (Number.isNaN(date.getTime())) {
      setScheduleResult((prev) => ({ ...prev, [key]: { error: 'Invalid date/time' } }))
      return
    }
    if (date.getTime() < Date.now()) {
      setScheduleResult((prev) => ({ ...prev, [key]: { error: 'Time must be in the future' } }))
      return
    }

    setScheduling(key)
    setScheduleResult((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    try {
      const res = await fetch('/api/sma/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          scheduledFor: date.toISOString(),
          platform,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Schedule failed')
      }
      setScheduleResult((prev) => ({ ...prev, [key]: { scheduled: true } }))
    } catch (error) {
      setScheduleResult((prev) => ({
        ...prev,
        [key]: { error: error instanceof Error ? error.message : 'Schedule failed' },
      }))
    } finally {
      setScheduling(null)
    }
  }

  if (items.length === 0) {
    return <p className="text-sm text-zinc-500">No approved content ready to publish</p>
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const lifecycle = item.lifecycle_record
        const assembledAt = new Date(item.assembled_at).toLocaleString('es-ES')
        const platforms = Object.keys(lifecycle.drafts || {}) as string[]
        // Already-published platforms come from the lifecycle's publications map.
        const publications = (lifecycle.publications || {}) as Record<
          string,
          { permalink?: string; platform_post_id?: string }
        >

        return (
          <div key={item.task_id} className="border border-zinc-200 rounded-lg p-4 space-y-3">
            <div className="space-y-1">
              <h3 className="font-semibold text-zinc-900">{lifecycle.intent.topic}</h3>
              <p className="text-xs text-zinc-500">Aprobado {assembledAt} • Hash: {item.lineage_hash.substring(0, 8)}...</p>
            </div>

            {platforms.map((platform) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const draft = (lifecycle.drafts as any)[platform]
              const caption = draft?.body || 'No caption'
              const key = `${item.task_id}-${platform}`
              const canPublish = PUBLISHABLE.has(platform)
              const alreadyPublished = publications[platform]
              const result = publishResult[key]
              return (
                <div key={platform} className="space-y-2">
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{platform}</p>
                  <div className="bg-zinc-50 rounded p-3 text-sm text-zinc-900 whitespace-pre-wrap max-h-60 overflow-y-auto">
                    {caption}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleCopy(key, caption)}
                      className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                    >
                      {copied === key ? '✓ Copied' : 'Copy'}
                    </button>

                    {canPublish && (
                      alreadyPublished?.permalink ? (
                        <a
                          href={alreadyPublished.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center rounded-md border border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
                        >
                          ✓ Published — view post
                        </a>
                      ) : result?.permalink ? (
                        <a
                          href={result.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center rounded-md border border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
                        >
                          ✓ Published — view post
                        </a>
                      ) : (
                        <button
                          onClick={() => handlePublish(item.task_id, platform)}
                          disabled={publishing === key}
                          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {publishing === key ? 'Publishing…' : `Publish to ${platformLabel(platform)}`}
                        </button>
                      )
                    )}
                  </div>

                  {canPublish && !alreadyPublished && !result?.permalink && (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="datetime-local"
                        value={scheduleInput[key] || ''}
                        onChange={(e) =>
                          setScheduleInput((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
                      />
                      <button
                        onClick={() => handleSchedule(item.task_id, platform)}
                        disabled={scheduling === key || scheduleResult[key]?.scheduled}
                        className="inline-flex items-center justify-center rounded-md border border-blue-600 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                      >
                        {scheduling === key
                          ? 'Scheduling…'
                          : scheduleResult[key]?.scheduled
                            ? 'Scheduled ✓'
                            : 'Schedule'}
                      </button>
                    </div>
                  )}

                  {canPublish && result?.error && (
                    <p className="text-xs text-red-600">{result.error}</p>
                  )}
                  {canPublish && scheduleResult[key]?.error && (
                    <p className="text-xs text-red-600">{scheduleResult[key].error}</p>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
