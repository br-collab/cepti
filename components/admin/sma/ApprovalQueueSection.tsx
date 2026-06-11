'use client'

import { useState, useEffect } from 'react'
import type { PausedLifecycle, DraftImage, DraftVideo } from '@/lib/sma/coordinator/types'

interface ApprovalData {
  approved_by: string[]
  denied_by: string[]
  status: 'PENDING' | 'APPROVED' | 'DENIED'
  all_approvals: Array<{
    task_id: string
    decided_by: string
    decision: string
    decided_at: string
    rationale: string
  }>
}

export default function ApprovalQueueSection({
  items,
  onDecision,
  currentUser,
}: {
  items: PausedLifecycle[]
  onDecision: () => Promise<void>
  currentUser?: 'bill' | 'francisco'
}) {
  const [deciding, setDeciding] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [rationales, setRationales] = useState<Record<string, string>>({})
  const [editedCaptions, setEditedCaptions] = useState<Record<string, string>>({})
  const [scheduledTimes, setScheduledTimes] = useState<Record<string, string | null>>({})
  const [approvalStatus, setApprovalStatus] = useState<Record<string, ApprovalData>>({})

  // Fetch approval status for all items
  useEffect(() => {
    const fetchApprovalStatus = async () => {
      const statuses: Record<string, ApprovalData> = {}
      for (const item of items) {
        try {
          const res = await fetch(`/api/sma/coordinator/approval-status/${item.task_id}`)
          if (res.ok) {
            statuses[item.task_id] = await res.json()
          }
        } catch (err) {
          console.error(`Failed to fetch approval status for ${item.task_id}:`, err)
        }
      }
      setApprovalStatus(statuses)
    }
    if (items.length > 0) {
      fetchApprovalStatus()
    }
  }, [items])

  const handleDecision = async (taskId: string, decision: 'APPROVE' | 'DENY') => {
    const rationale = rationales[taskId]
    if (!rationale?.trim()) {
      alert('Rationale is required')
      return
    }

    const scheduledTime = scheduledTimes[taskId] || null

    // Validate scheduled time is in future if provided
    if (scheduledTime) {
      const scheduledDate = new Date(scheduledTime)
      if (scheduledDate <= new Date()) {
        alert('Scheduled time must be in the future')
        return
      }
    }

    setDeciding(taskId)
    try {
      const res = await fetch(`/api/sma/coordinator/decide/${taskId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          rationale: rationale.trim(),
          scheduled_for: scheduledTime ? new Date(scheduledTime).toISOString() : null,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Decision failed')
      }

      // Clear rationale and scheduled time for this task
      setRationales((prev) => {
        const next = { ...prev }
        delete next[taskId]
        return next
      })
      setScheduledTimes((prev) => {
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
    return <p className="text-sm text-zinc-500">No items awaiting approval</p>
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const draft = item.context.draft
        const originalCaption = draft.body
        const isEditing = editing === item.task_id
        const displayCaption = editedCaptions[item.task_id] ?? originalCaption
        const generatedAt = new Date(draft.generated_at).toLocaleString('en-US')
        const images = draft.images as DraftImage[] | undefined
        const video = draft.video as DraftVideo | undefined

        return (
          <div key={item.task_id} className="border border-zinc-200 rounded-lg p-4 space-y-3">
            <div className="space-y-1">
              <h3 className="font-semibold text-zinc-900">{item.context.intent.topic}</h3>
              <p className="text-xs text-zinc-500">
                {draft.platform} • {generatedAt} • {draft.model} • In: {draft.tokens_input} | Out:{' '}
                {draft.tokens_output}
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

            {isEditing ? (
              <div className="space-y-2">
                <textarea
                  value={displayCaption}
                  onChange={(e) =>
                    setEditedCaptions((prev) => ({
                      ...prev,
                      [item.task_id]: e.target.value,
                    }))
                  }
                  disabled={deciding === item.task_id}
                  rows={6}
                  className="w-full px-3 py-2 border border-blue-300 rounded-md text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
                <button
                  onClick={() => setEditing(null)}
                  disabled={deciding === item.task_id}
                  className="text-sm px-3 py-1 rounded bg-blue-100 text-blue-900 hover:bg-blue-200 disabled:opacity-50"
                >
                  Done Editing
                </button>
              </div>
            ) : (
              <div className="bg-zinc-50 rounded p-3 text-sm text-zinc-900 whitespace-pre-wrap max-h-60 overflow-y-auto">
                {displayCaption}
              </div>
            )}

            <div className="space-y-2">
              <button
                onClick={() => {
                  if (!isEditing) {
                    setEditing(item.task_id)
                    if (!editedCaptions[item.task_id]) {
                      setEditedCaptions((prev) => ({
                        ...prev,
                        [item.task_id]: originalCaption,
                      }))
                    }
                  }
                }}
                disabled={deciding === item.task_id || isEditing}
                className="text-sm px-3 py-1 rounded bg-zinc-100 text-zinc-700 hover:bg-zinc-200 disabled:opacity-50"
              >
                {isEditing ? 'Editing...' : 'Edit Caption'}
              </button>
            </div>

            <textarea
              value={rationales[item.task_id] || ''}
              onChange={(e) =>
                setRationales((prev) => ({
                  ...prev,
                  [item.task_id]: e.target.value,
                }))
              }
              placeholder="Decision rationale"
              disabled={deciding === item.task_id}
              rows={2}
              className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm text-zinc-900 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:opacity-50"
            />

            <div className="space-y-2 p-3 bg-zinc-50 rounded-md border border-zinc-200">
              <div className="text-sm font-medium text-zinc-700">Publishing</div>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`publish-mode-${item.task_id}`}
                  checked={!scheduledTimes[item.task_id]}
                  onChange={() =>
                    setScheduledTimes((prev) => ({
                      ...prev,
                      [item.task_id]: null,
                    }))
                  }
                  disabled={deciding === item.task_id}
                  className="w-4 h-4 cursor-pointer disabled:opacity-50"
                />
                <span className="text-sm text-zinc-700">Publish immediately after approval</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`publish-mode-${item.task_id}`}
                  checked={!!scheduledTimes[item.task_id]}
                  onChange={() =>
                    setScheduledTimes((prev) => ({
                      ...prev,
                      [item.task_id]: new Date(Date.now() + 3600000).toISOString().slice(0, 16),
                    }))
                  }
                  disabled={deciding === item.task_id}
                  className="w-4 h-4 cursor-pointer disabled:opacity-50"
                />
                <span className="text-sm text-zinc-700">Schedule for:</span>
              </label>
              {scheduledTimes[item.task_id] && (
                <input
                  type="datetime-local"
                  value={scheduledTimes[item.task_id]!.slice(0, 16)}
                  onChange={(e) =>
                    setScheduledTimes((prev) => ({
                      ...prev,
                      [item.task_id]: new Date(e.target.value).toISOString(),
                    }))
                  }
                  disabled={deciding === item.task_id}
                  className="ml-6 px-2 py-1 border border-zinc-300 rounded text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:opacity-50"
                />
              )}
            </div>

            {/* Approval status badge and audit trail */}
            {approvalStatus[item.task_id] && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 space-y-2">
                <div className="text-sm font-medium text-blue-900">
                  Approval Status: {approvalStatus[item.task_id].status === 'APPROVED' && '2/2 Both Approved'}
                  {approvalStatus[item.task_id].status === 'PENDING' && '1/2 Awaiting Second Approval'}
                  {approvalStatus[item.task_id].status === 'DENIED' && 'Denied'}
                </div>

                {/* Audit trail of existing approvals */}
                {approvalStatus[item.task_id].all_approvals && approvalStatus[item.task_id].all_approvals.length > 0 && (
                  <div className="space-y-1">
                    {approvalStatus[item.task_id].all_approvals.map((approval, idx) => {
                      const approvalDate = new Date(approval.decided_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                      return (
                        <div key={idx} className="text-xs text-blue-800">
                          {approval.decision === 'APPROVE' ? '✓' : '✗'} {approval.decided_by} {approval.decision === 'APPROVE' ? 'Approved' : 'Denied'} {approvalDate}
                          {approval.rationale && <span className="ml-2 italic">({approval.rationale.substring(0, 30)}...)</span>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Approve/Deny buttons */}
            <div className="flex gap-2">
              {currentUser && approvalStatus[item.task_id] && approvalStatus[item.task_id].approved_by.includes(currentUser) ? (
                <button
                  disabled
                  className="flex-1 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white opacity-50 cursor-not-allowed"
                >
                  ✓ You Approved
                </button>
              ) : (
                <button
                  onClick={() => handleDecision(item.task_id, 'APPROVE')}
                  disabled={deciding === item.task_id || (approvalStatus[item.task_id]?.status === 'DENIED')}
                  className="flex-1 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deciding === item.task_id ? 'Processing...' : 'Approve'}
                </button>
              )}

              {currentUser && approvalStatus[item.task_id] && approvalStatus[item.task_id].denied_by.includes(currentUser) ? (
                <button
                  disabled
                  className="flex-1 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white opacity-50 cursor-not-allowed"
                >
                  ✗ You Denied
                </button>
              ) : (
                <button
                  onClick={() => handleDecision(item.task_id, 'DENY')}
                  disabled={deciding === item.task_id || (approvalStatus[item.task_id]?.status === 'DENIED')}
                  className="flex-1 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deciding === item.task_id ? 'Processing...' : 'Deny'}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
