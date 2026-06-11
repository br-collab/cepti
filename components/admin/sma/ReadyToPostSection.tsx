'use client'

import { useState } from 'react'
import type { DraftImage, DraftVideo } from '@/lib/sma/coordinator/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function ReadyToPostSection({
  items,
}: {
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
    return <p className="text-sm text-zinc-500">No approved content ready to post</p>
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const lifecycle = item.lifecycle_record
        const draft = lifecycle.drafts?.facebook
        const caption = draft?.body || 'No caption'
        const images = draft?.images as DraftImage[] | undefined
        const video = draft?.video as DraftVideo | undefined
        const assembledAt = new Date(item.assembled_at).toLocaleString('en-US')

        return (
          <div key={item.task_id} className="border border-zinc-200 rounded-lg p-4 space-y-3">
            <div className="space-y-1">
              <h3 className="font-semibold text-zinc-900">{lifecycle.intent.topic}</h3>
              <p className="text-xs text-zinc-500">
                facebook • Approved {assembledAt} • Hash: {item.lineage_hash.substring(0, 8)}...
              </p>
            </div>

            {/* Display images if available */}
            {images && images.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {images.slice(0, 4).map((img, idx) => (
                  <div key={idx} className="flex-shrink-0 relative">
                    <img
                      src={img.url}
                      alt={img.productName}
                      className="h-24 w-24 object-cover rounded border border-zinc-300"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs p-1 rounded-b text-center truncate">
                      {img.productName}
                    </div>
                  </div>
                ))}
                {images.length > 4 && (
                  <div className="flex-shrink-0 h-24 w-24 rounded border border-zinc-300 bg-zinc-100 flex items-center justify-center text-xs text-zinc-600">
                    +{images.length - 4} more
                  </div>
                )}
              </div>
            )}

            {/* Display video preview if available */}
            {video && (
              <div className="bg-black rounded overflow-hidden">
                <video
                  controls
                  poster={video.thumbnail}
                  className="w-full max-h-48"
                >
                  <source src={video.url} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>
            )}

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
