'use client'

import { useState } from 'react'
import type { PausedLifecycle } from '@/lib/sma/coordinator/types'

export default function ApprovalQueueSection({
  items,
  onDecision,
}: {
  items: PausedLifecycle[]
  onDecision: () => Promise<void>
}) {
  const [deciding, setDeciding] = useState<string | null>(null)
  const [rationales, setRationales] = useState<Record<string, string>>({})

  const handleDecision = async (taskId: string, decision: 'APPROVE' | 'DENY') => {
    const rationale = rationales[taskId]
    if (!rationale?.trim()) {
      alert('Rationale is required')
      return
    }

    setDeciding(taskId)
    try {
      const res = await fetch(`/api/sma/coordinator/decide/${taskId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          rationale: rationale.trim(),
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Decision failed')
      }

      // Clear rationale for this task
      setRationales((prev) => {
        const next = { ...prev }
        delete next[taskId]
        return next
      })

      // Refresh queue
      await onDecision()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setDeciding(null)
    }
  }

  if (items.length === 0) {
    return <p className="text-sm text-zinc-500">No items pending approval</p>
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const draft = item.context.draft
        const caption = draft.body
        const generatedAt = new Date(draft.generated_at).toLocaleString('es-ES')

        return (
          <div key={item.task_id} className="border border-zinc-200 rounded-lg p-4 space-y-3">
            <div className="space-y-1">
              <h3 className="font-semibold text-zinc-900">{item.context.intent.topic}</h3>
              <p className="text-xs text-zinc-500">
                {draft.platform} • {generatedAt} • {draft.model} • In: {draft.tokens_input} | Out:{' '}
                {draft.tokens_output}
              </p>
            </div>

            <div className="bg-zinc-50 rounded p-3 text-sm text-zinc-900 whitespace-pre-wrap max-h-60 overflow-y-auto">
              {caption}
            </div>

            <textarea
              value={rationales[item.task_id] || ''}
              onChange={(e) =>
                setRationales((prev) => ({
                  ...prev,
                  [item.task_id]: e.target.value,
                }))
              }
              placeholder="Razonamiento de la decisión"
              disabled={deciding === item.task_id}
              rows={2}
              className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm text-zinc-900 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:opacity-50"
            />

            <div className="flex gap-2">
              <button
                onClick={() => handleDecision(item.task_id, 'APPROVE')}
                disabled={deciding === item.task_id}
                className="flex-1 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {deciding === item.task_id ? 'Procesando...' : 'Aprobar'}
              </button>
              <button
                onClick={() => handleDecision(item.task_id, 'DENY')}
                disabled={deciding === item.task_id}
                className="flex-1 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deciding === item.task_id ? 'Procesando...' : 'Denegar'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
