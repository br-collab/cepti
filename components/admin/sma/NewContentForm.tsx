'use client'

import { useState } from 'react'

export default function NewContentForm({ onSuccess }: { onSuccess: () => Promise<void> }) {
  const [topic, setTopic] = useState('')
  const [notes, setNotes] = useState('')
  const [mediaMode, setMediaMode] = useState<'pictures' | 'video' | 'both'>('both')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!topic.trim()) {
      setError('Topic is required and cannot be empty')
      return
    }

    setLoading(true)
    try {
      const includePictures = mediaMode === 'pictures' || mediaMode === 'both'
      const includeVideo = mediaMode === 'video' || mediaMode === 'both'

      const res = await fetch('/api/sma/coordinator/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          notes: notes.trim() || undefined,
          includePictures,
          includeVideo,
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
          Topic *
        </label>
        <input
          id="topic"
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="E.g: Ladriflex — benefits of flexible brick"
          disabled={loading}
          className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm text-zinc-900 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:opacity-50"
        />
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-zinc-700 mb-1">
          Notes (optional)
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional context for the draft"
          disabled={loading}
          rows={3}
          className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm text-zinc-900 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:opacity-50"
        />
      </div>

      <div className="space-y-3 border-t border-zinc-200 pt-4">
        <label className="block text-sm font-medium text-zinc-700">Visual Content</label>
        <div className="space-y-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMediaMode('pictures')}
              disabled={loading}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md border transition-colors ${
                mediaMode === 'pictures'
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'bg-white text-zinc-900 border-zinc-300 hover:border-zinc-900'
              } disabled:opacity-50`}
            >
              🖼️ Pictures Only
            </button>
            <button
              type="button"
              onClick={() => setMediaMode('video')}
              disabled={loading}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md border transition-colors ${
                mediaMode === 'video'
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'bg-white text-zinc-900 border-zinc-300 hover:border-zinc-900'
              } disabled:opacity-50`}
            >
              🎬 Video Only
            </button>
            <button
              type="button"
              onClick={() => setMediaMode('both')}
              disabled={loading}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md border transition-colors ${
                mediaMode === 'both'
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'bg-white text-zinc-900 border-zinc-300 hover:border-zinc-900'
              } disabled:opacity-50`}
            >
              🎬📸 Both
            </button>
          </div>
          <p className="text-xs text-zinc-500">
            {mediaMode === 'video' && 'Generates a 45-second narrative video showcasing the product transformation.'}
            {mediaMode === 'pictures' && 'Attaches 1-3 representative product images.'}
            {mediaMode === 'both' && 'Generates video + attaches individual product images.'}
          </p>
        </div>
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
            Generating...
          </>
        ) : (
          'Generate Draft'
        )}
      </button>
    </form>
  )
}
