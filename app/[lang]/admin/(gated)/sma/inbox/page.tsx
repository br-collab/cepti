'use client'

import { useState, useEffect } from 'react'

type CommentClass = 'inquiry' | 'compliment' | 'complaint' | 'spam' | 'other' | 'unclassified'
type Platform = 'facebook' | 'instagram' | 'threads'
type ReplyStatus = 'drafted' | 'approved' | 'posted' | 'rejected' | 'failed'

interface ReplyDraft {
  id: string
  draft_body: string
  edited_body: string | null
  status: ReplyStatus
}

interface Comment {
  id: string
  platform: Platform
  external_comment_id: string
  author_handle: string | null
  body: string
  posted_at: string
  classification: CommentClass
  classification_confidence: number | null
  needs_human: boolean
  observed_at: string
  reply_drafts: ReplyDraft[]
}

const CLASS_COLORS: Record<CommentClass, string> = {
  inquiry: 'bg-blue-50 text-blue-700 border-blue-200',
  compliment: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  complaint: 'bg-red-50 text-red-700 border-red-200',
  spam: 'bg-zinc-100 text-zinc-500 border-zinc-300',
  other: 'bg-amber-50 text-amber-700 border-amber-200',
  unclassified: 'bg-zinc-100 text-zinc-500 border-zinc-200',
}

const PLATFORM_COLORS: Record<Platform, string> = {
  facebook: 'bg-blue-50 text-blue-700 border-blue-200',
  instagram: 'bg-pink-50 text-pink-700 border-pink-200',
  threads: 'bg-zinc-100 text-zinc-700 border-zinc-300',
}

const FILTERS: { id: CommentClass | 'all' | 'needs_attention'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'needs_attention', label: 'Needs Attention' },
  { id: 'inquiry', label: 'Inquiries' },
  { id: 'compliment', label: 'Compliments' },
  { id: 'complaint', label: 'Complaints' },
  { id: 'spam', label: 'Spam' },
]

function CommentCard({ comment, onAction }: { comment: Comment; onAction: () => void }) {
  const [editing, setEditing] = useState(false)
  const [editedBody, setEditedBody] = useState('')
  const [actioning, setActioning] = useState(false)

  const activeDraft = comment.reply_drafts.find(d => d.status === 'drafted')
  const approvedDraft = comment.reply_drafts.find(d => d.status === 'approved')

  const postedAt = new Date(comment.posted_at).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })

  const handleReplyAction = async (action: 'approve' | 'reject') => {
    if (!activeDraft) return
    setActioning(true)
    try {
      const res = await fetch(`/api/sma/inbox/${comment.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reply_draft_id: activeDraft.id,
          action,
          edited_body: editing && editedBody.trim() ? editedBody.trim() : undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Action failed')
      }
      onAction()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setActioning(false)
      setEditing(false)
    }
  }

  return (
    <div className={`rounded-xl border bg-white p-5 space-y-3 ${comment.needs_human ? 'border-amber-300' : 'border-zinc-200'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-medium px-2 py-0.5 rounded border ${PLATFORM_COLORS[comment.platform]}`}>
            {comment.platform}
          </span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded border ${CLASS_COLORS[comment.classification]}`}>
            {comment.classification}
          </span>
          {comment.needs_human && (
            <span className="text-xs font-medium px-2 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200">
              ⚠ Needs attention
            </span>
          )}
          {comment.classification_confidence !== null && (
            <span className="text-xs text-zinc-400">
              {Math.round((comment.classification_confidence ?? 0) * 100)}% confidence
            </span>
          )}
        </div>
        <span className="text-xs text-zinc-400 shrink-0">{postedAt}</span>
      </div>

      {comment.author_handle && (
        <p className="text-xs font-medium text-zinc-500">@{comment.author_handle}</p>
      )}

      <p className="text-sm text-zinc-900 bg-zinc-50 rounded p-3 border border-zinc-100">
        {comment.body}
      </p>

      {comment.classification === 'complaint' && (
        <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded p-2 border border-red-100">
          <span>⚠</span>
          <span>Complaint — no auto-reply. Handle directly with the customer.</span>
        </div>
      )}

      {comment.classification === 'spam' && (
        <p className="text-xs text-zinc-400 italic">Spam — no action required.</p>
      )}

      {approvedDraft && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-emerald-600">✓ Reply approved</p>
          <p className="text-sm text-zinc-700 bg-emerald-50 rounded p-3 border border-emerald-100 whitespace-pre-wrap">
            {approvedDraft.edited_body || approvedDraft.draft_body}
          </p>
        </div>
      )}

      {activeDraft && !approvedDraft && (
        <div className="space-y-3 border-t border-zinc-100 pt-3">
          <p className="text-xs font-medium text-zinc-600">AI-drafted reply:</p>

          {editing ? (
            <textarea
              value={editedBody}
              onChange={e => setEditedBody(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500"
            />
          ) : (
            <p className="text-sm text-zinc-700 bg-zinc-50 rounded p-3 border border-zinc-200 whitespace-pre-wrap">
              {activeDraft.draft_body}
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleReplyAction('approve')}
              disabled={actioning}
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {actioning ? 'Saving...' : 'Approve'}
            </button>
            <button
              onClick={() => {
                if (!editing) setEditedBody(activeDraft.draft_body)
                setEditing(!editing)
              }}
              disabled={actioning}
              className="text-xs font-medium px-3 py-1.5 rounded-md border border-zinc-300 hover:bg-zinc-50 disabled:opacity-50"
            >
              {editing ? 'Cancel edit' : 'Edit'}
            </button>
            <button
              onClick={() => handleReplyAction('reject')}
              disabled={actioning}
              className="text-xs font-medium px-3 py-1.5 rounded-md border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function InboxPage() {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<CommentClass | 'all' | 'needs_attention'>('all')
  const [refreshKey, setRefreshKey] = useState(0)

  const load = () => {
    setLoading(true)
    setError(null)
    setRefreshKey(k => k + 1)
  }

  useEffect(() => {
    let cancelled = false
    fetch('/api/sma/inbox')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load inbox')
        return res.json()
      })
      .then(data => { if (!cancelled) { setComments(data.comments || []); setLoading(false) } })
      .catch(err => { if (!cancelled) { setError(err instanceof Error ? err.message : 'Failed to load'); setLoading(false) } })
    return () => { cancelled = true }
  }, [refreshKey])

  const filtered = comments.filter(c => {
    if (filter === 'all') return true
    if (filter === 'needs_attention') return c.needs_human || c.classification === 'complaint'
    return c.classification === filter
  })

  const needsAttentionCount = comments.filter(c => c.needs_human || c.classification === 'complaint').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          Public comments from Instagram, Facebook, and Threads — classified automatically. Complaints are flagged for human review. AI drafts replies to inquiries and compliments for your approval.
        </p>
        <button
          onClick={load}
          disabled={loading}
          className="text-xs font-medium px-3 py-1.5 rounded-md border border-zinc-300 hover:bg-zinc-50 disabled:opacity-50"
        >
          {loading ? 'Loading...' : '↺ Refresh'}
        </button>
      </div>

      <div className="flex gap-1 border-b border-zinc-200 overflow-x-auto">
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-2 text-sm whitespace-nowrap transition-colors border-b-2 -mb-px ${
              filter === f.id
                ? 'border-zinc-900 text-zinc-900 font-medium'
                : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {f.label}
            {f.id === 'needs_attention' && needsAttentionCount > 0 && (
              <span className="ml-1.5 text-xs bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5">
                {needsAttentionCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {!loading && comments.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-12 text-center space-y-2">
          <p className="text-sm font-medium text-zinc-500">No comments yet</p>
          <p className="text-xs text-zinc-400">
            Comments will appear here once Instagram, Facebook, and Threads are connected via OAuth and webhooks are live.
          </p>
          <p className="text-xs text-zinc-400 mt-1">
            Connect your accounts in the <strong>Connections</strong> tab to get started.
          </p>
        </div>
      )}

      {!loading && comments.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-zinc-500 text-center py-8">No comments match this filter.</p>
      )}

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-xl border border-zinc-200 bg-zinc-50 h-32 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map(comment => (
            <CommentCard key={comment.id} comment={comment} onAction={load} />
          ))}
        </div>
      )}
    </div>
  )
}
