'use client'

import { useState } from 'react'

export default function ReadyToPostSection({
  items,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: Array<{ task_id: string; lifecycle_record: any; lineage_hash: string; assembled_at: string }>
}) {
  const [copied, setCopied] = useState<string | null>(null)

  const handleCopy = async (taskId: string, caption: string) => {
    try {
      await navigator.clipboard.writeText(caption)
      setCopied(taskId)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      alert('Failed to copy to clipboard')
    }
  }

  if (items.length === 0) {
    return <p className="text-sm text-zinc-500">No approved content ready to publish</p>
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const lifecycle = item.lifecycle_record
        const draft = lifecycle.drafts?.facebook
        const caption = draft?.body || 'No caption'
        const assembledAt = new Date(item.assembled_at).toLocaleString('es-ES')

        return (
          <div key={item.task_id} className="border border-zinc-200 rounded-lg p-4 space-y-3">
            <div className="space-y-1">
              <h3 className="font-semibold text-zinc-900">{lifecycle.intent.topic}</h3>
              <p className="text-xs text-zinc-500">
                facebook • Aprobado {assembledAt} • Hash: {item.lineage_hash.substring(0, 8)}...
              </p>
            </div>

            <div className="bg-zinc-50 rounded p-3 text-sm text-zinc-900 whitespace-pre-wrap max-h-60 overflow-y-auto">
              {caption}
            </div>

            <button
              onClick={() => handleCopy(item.task_id, caption)}
              className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              {copied === item.task_id ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        )
      })}
    </div>
  )
}
