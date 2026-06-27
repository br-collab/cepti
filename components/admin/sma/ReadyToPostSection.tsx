'use client'

import { useState } from 'react'

export default function ReadyToPostSection({
  items,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: Array<{ task_id: string; lifecycle_record: any; lineage_hash: string; assembled_at: string }>
}) {
  const [copied, setCopied] = useState<string | null>(null)
  const [publishing, setPublishing] = useState<string | null>(null)
  // taskId -> { permalink } on success, or { error } on failure
  const [publishResult, setPublishResult] = useState<
    Record<string, { permalink?: string; error?: string }>
  >({})
  // taskId -> chosen datetime-local value (e.g. "2026-07-01T14:30")
  const [scheduleInput, setScheduleInput] = useState<Record<string, string>>({})
  const [scheduling, setScheduling] = useState<string | null>(null)
  // taskId -> { scheduled: true } on success, or { error } on failure
  const [scheduleResult, setScheduleResult] = useState<
    Record<string, { scheduled?: boolean; error?: string }>
  >({})

  const handleCopy = async (taskId: string, caption: string) => {
    try {
      await navigator.clipboard.writeText(caption)
      setCopied(taskId)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      alert('Failed to copy to clipboard')
    }
  }

  const handlePublish = async (taskId: string) => {
    setPublishing(taskId)
    setPublishResult((prev) => {
      const next = { ...prev }
      delete next[taskId]
      return next
    })
    try {
      const res = await fetch(`/api/sma/publish/${taskId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Publish failed')
      }
      setPublishResult((prev) => ({ ...prev, [taskId]: { permalink: data.permalink } }))
    } catch (error) {
      setPublishResult((prev) => ({
        ...prev,
        [taskId]: { error: error instanceof Error ? error.message : 'Publish failed' },
      }))
    } finally {
      setPublishing(null)
    }
  }

  const handleSchedule = async (taskId: string) => {
    const local = scheduleInput[taskId]
    if (!local) {
      setScheduleResult((prev) => ({ ...prev, [taskId]: { error: 'Pick a date and time first' } }))
      return
    }
    // datetime-local has no timezone; interpret it in the admin's local zone.
    const date = new Date(local)
    if (Number.isNaN(date.getTime())) {
      setScheduleResult((prev) => ({ ...prev, [taskId]: { error: 'Invalid date/time' } }))
      return
    }
    if (date.getTime() < Date.now()) {
      setScheduleResult((prev) => ({ ...prev, [taskId]: { error: 'Time must be in the future' } }))
      return
    }

    setScheduling(taskId)
    setScheduleResult((prev) => {
      const next = { ...prev }
      delete next[taskId]
      return next
    })
    try {
      const res = await fetch('/api/sma/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          scheduledFor: date.toISOString(),
          platform: 'facebook',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Schedule failed')
      }
      setScheduleResult((prev) => ({ ...prev, [taskId]: { scheduled: true } }))
    } catch (error) {
      setScheduleResult((prev) => ({
        ...prev,
        [taskId]: { error: error instanceof Error ? error.message : 'Schedule failed' },
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
              const copyKey = `${item.task_id}-${platform}`
              const alreadyPublished = publications[platform]
              const result = publishResult[item.task_id]
              return (
                <div key={platform} className="space-y-2">
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{platform}</p>
                  <div className="bg-zinc-50 rounded p-3 text-sm text-zinc-900 whitespace-pre-wrap max-h-60 overflow-y-auto">
                    {caption}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleCopy(copyKey, caption)}
                      className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                    >
                      {copied === copyKey ? '✓ Copied' : 'Copy'}
                    </button>

                    {platform === 'facebook' && (
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
                          onClick={() => handlePublish(item.task_id)}
                          disabled={publishing === item.task_id}
                          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {publishing === item.task_id ? 'Publishing…' : 'Publish to Facebook'}
                        </button>
                      )
                    )}
                  </div>

                  {platform === 'facebook' && !alreadyPublished && !result?.permalink && (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="datetime-local"
                        value={scheduleInput[item.task_id] || ''}
                        onChange={(e) =>
                          setScheduleInput((prev) => ({ ...prev, [item.task_id]: e.target.value }))
                        }
                        className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
                      />
                      <button
                        onClick={() => handleSchedule(item.task_id)}
                        disabled={scheduling === item.task_id || scheduleResult[item.task_id]?.scheduled}
                        className="inline-flex items-center justify-center rounded-md border border-blue-600 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                      >
                        {scheduling === item.task_id
                          ? 'Scheduling…'
                          : scheduleResult[item.task_id]?.scheduled
                            ? 'Scheduled ✓'
                            : 'Schedule'}
                      </button>
                    </div>
                  )}

                  {platform === 'facebook' && publishResult[item.task_id]?.error && (
                    <p className="text-xs text-red-600">{publishResult[item.task_id].error}</p>
                  )}
                  {platform === 'facebook' && scheduleResult[item.task_id]?.error && (
                    <p className="text-xs text-red-600">{scheduleResult[item.task_id].error}</p>
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
