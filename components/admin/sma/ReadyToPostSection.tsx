'use client'

import { useState } from 'react'
import type { DraftImage, DraftVideo } from '@/lib/sma/coordinator/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function ReadyToPostSection({
  items,
}: {
  items: Array<{ task_id: string; lifecycle_record: any; lineage_hash: string; assembled_at: string; published_at?: string }>
}) {
  const [copied, setCopied] = useState<string | null>(null)
  const [publishing, setPublishing] = useState<string | null>(null)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [publishedLinks, setPublishedLinks] = useState<Record<string, Record<string, string>>>({})

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
    setPublishError(null)

    try {
      const response = await fetch('/api/sma/coordinator/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId }),
      })

      if (!response.ok) {
        const errorData = await response.json() as { error?: string }
        throw new Error(errorData.error || `Failed to publish (${response.status})`)
      }

      const data = await response.json() as { links?: Record<string, string> }
      setPublishedLinks((prev) => ({
        ...prev,
        [taskId]: data.links || {},
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      setPublishError(`Failed to publish: ${message}`)
      console.error('Publish error:', error)
    } finally {
      setPublishing(null)
    }
  }

  if (items.length === 0) {
    return <p className="text-sm text-zinc-500">No approved content ready to post</p>
  }

  return (
    <div className="space-y-4">
      {publishError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {publishError}
        </div>
      )}
      {items.map((item) => {
        const lifecycle = item.lifecycle_record
        const draft = lifecycle.drafts?.facebook
        const caption = draft?.body || 'No caption'
        const images = draft?.images as DraftImage[] | undefined
        const video = draft?.video as DraftVideo | undefined
        const assembledAt = new Date(item.assembled_at).toLocaleString('en-US')
        const isPublished = item.published_at || publishedLinks[item.task_id]
        const links = publishedLinks[item.task_id]

        return (
          <div key={item.task_id} className="border border-zinc-200 rounded-lg p-4 space-y-3">
            <div className="space-y-1">
              <h3 className="font-semibold text-zinc-900">{lifecycle.intent.topic}</h3>
              <p className="text-xs text-zinc-500">
                facebook • Approved {assembledAt} • Hash: {item.lineage_hash.substring(0, 8)}...
              </p>
              {isPublished && (
                <p className="text-xs text-green-600 font-medium">✓ Published</p>
              )}
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

            {/* Show published links if available */}
            {links && Object.keys(links).length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded p-3 text-sm space-y-1">
                <p className="font-medium text-green-900">Published links:</p>
                {Object.entries(links).map(([platform, url]) => (
                  <a
                    key={platform}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-green-700 hover:text-green-900 underline break-all"
                  >
                    {platform}: {url}
                  </a>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => handleCopy(item.task_id, caption)}
                className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                disabled={publishing === item.task_id || !!isPublished}
              >
                {copied === item.task_id ? '✓ Copied' : 'Copy'}
              </button>

              {!isPublished && (
                <button
                  onClick={() => handlePublish(item.task_id)}
                  className="inline-flex items-center justify-center rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  disabled={publishing === item.task_id}
                >
                  {publishing === item.task_id ? 'Publishing...' : 'Publish Now'}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
