'use client'

import { useState } from 'react'

export default function NewContentForm({ onSuccess }: { onSuccess: () => Promise<void> }) {
  const [topic, setTopic] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!topic.trim()) {
      setError('Topic is required')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/sma/coordinator/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          notes: notes.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to generate draft')
      }

      // Clear form
      setTopic('')
      setNotes('')

      // Refresh queue
      await onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="topic" className="block text-sm font-medium text-zinc-700 mb-1">
          Tema *
        </label>
        <input
          id="topic"
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Ej: Ladriflex — ventajas del ladrillo flexible"
          disabled={loading}
          className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm text-zinc-900 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:opacity-50"
        />
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-zinc-700 mb-1">
          Notas (opcional)
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Contexto adicional para el borrador"
          disabled={loading}
          rows={3}
          className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm text-zinc-900 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:opacity-50"
        />
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {loading ? (
          <>
            <span className="animate-spin mr-2">⏳</span>
            Generando...
          </>
        ) : (
          'Generar borrador'
        )}
      </button>
    </form>
  )
}
