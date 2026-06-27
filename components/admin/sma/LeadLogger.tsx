'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Lead = {
  id: string
  task_id: string | null
  platform: string | null
  note: string | null
  created_at: string | null
}

/**
 * Manual WhatsApp-lead logger. A human records a conversion against a post —
 * a free-text note plus an optional ref tag (or the caption that contains
 * one; the API parses [ref:fb-post-…] to derive platform/task_id). Posts to
 * /api/sma/leads, then refreshes. Recent leads are listed with delete.
 *
 * Stopgap until the WhatsApp Business API enables automatic attribution.
 */
export default function LeadLogger({ recent }: { recent: Lead[] }) {
  const router = useRouter()
  const [note, setNote] = useState('')
  const [refText, setRefText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!note.trim() && !refText.trim()) {
      setError('Add a note or a ref tag.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/sma/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note: note.trim() || undefined,
          ref_text: refText.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to log lead')
      }
      setNote('')
      setRefText('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log lead')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeleting(id)
    try {
      const res = await fetch(`/api/sma/leads/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to delete')
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400">
            Note
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Quote request from FB comment — Ladriflex"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400">
            Ref tag (optional)
          </label>
          <input
            type="text"
            value={refText}
            onChange={(e) => setRefText(e.target.value)}
            placeholder="[ref:fb-post-TSK-…] or paste the caption"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-zinc-400">
            If a ref tag is present, platform and task are parsed from it.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Log a lead'}
          </button>
          {error ? <span className="text-xs text-red-600">{error}</span> : null}
        </div>
      </form>

      {recent.length === 0 ? (
        <p className="text-sm text-zinc-500">No leads logged yet.</p>
      ) : (
        <ul className="divide-y divide-zinc-100 border-t border-zinc-100">
          {recent.map((lead) => (
            <li key={lead.id} className="flex items-start justify-between gap-4 py-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {lead.platform ? (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                      {lead.platform}
                    </span>
                  ) : null}
                  {lead.task_id ? (
                    <span className="text-xs text-zinc-400">{lead.task_id}</span>
                  ) : null}
                  <span className="text-xs text-zinc-400">
                    {lead.created_at
                      ? new Date(lead.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })
                      : '—'}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm text-zinc-700">
                  {lead.note || <span className="text-zinc-400">No note</span>}
                </p>
              </div>
              <button
                onClick={() => handleDelete(lead.id)}
                disabled={deleting === lead.id}
                className="shrink-0 text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
              >
                {deleting === lead.id ? 'Deleting…' : 'Delete'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
