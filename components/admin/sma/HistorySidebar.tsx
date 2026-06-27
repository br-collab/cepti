'use client'

import { useState } from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HistoryItem = { task_id: string; lifecycle_record: any; lineage_hash: string; assembled_at: string }

export default function HistorySidebar({
  items,
  onDismiss,
}: {
  items: HistoryItem[]
  onDismiss: (taskId: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [dismissing, setDismissing] = useState<string | null>(null)

  const handleDismiss = async (taskId: string) => {
    if (!window.confirm('Dismiss this item? This permanently deletes it.')) return
    setDismissing(taskId)
    try {
      await onDismiss(taskId)
    } finally {
      setDismissing(null)
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-6 py-4 text-left"
      >
        <span className="text-lg font-semibold">
          History <span className="text-sm font-normal text-zinc-500">({items.length})</span>
        </span>
        <span className="text-zinc-400 text-sm">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-6 pb-6">
          {items.length === 0 ? (
            <p className="text-sm text-zinc-500">No resolved items</p>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => {
                const lifecycle = item.lifecycle_record
                const topic = lifecycle?.intent?.topic ?? 'Untitled'
                const platforms = Object.keys(lifecycle?.drafts || {})
                const publications = (lifecycle?.publications || {}) as Record<
                  string,
                  { permalink?: string }
                >
                const publishedEntries = Object.values(publications)
                const isDenied = lifecycle?.status === 'DENIED'
                const isPublished = publishedEntries.length > 0
                const decidedAt = new Date(item.assembled_at).toLocaleDateString('es-ES')
                const permalink = publishedEntries.find((p) => p?.permalink)?.permalink

                const badge = isDenied
                  ? { label: 'Denied', cls: 'bg-red-100 text-red-700' }
                  : isPublished
                    ? { label: 'Published', cls: 'bg-emerald-100 text-emerald-700' }
                    : { label: 'Approved', cls: 'bg-zinc-100 text-zinc-700' }

                return (
                  <li
                    key={item.task_id}
                    className="rounded-lg border border-zinc-200 p-3 text-sm space-y-1"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-zinc-900">{topic}</span>
                      <span
                        className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500">
                      {platforms.length > 0 ? platforms.join(', ') : 'no platforms'} • {decidedAt}
                    </p>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      {isPublished && permalink ? (
                        <a
                          href={permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-emerald-700 hover:underline"
                        >
                          view post
                        </a>
                      ) : (
                        <span />
                      )}
                      <button
                        onClick={() => handleDismiss(item.task_id)}
                        disabled={dismissing === item.task_id}
                        className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
                      >
                        {dismissing === item.task_id ? '…' : 'Dismiss'}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
