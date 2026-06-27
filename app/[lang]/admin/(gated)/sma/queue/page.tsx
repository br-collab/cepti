'use client'

import { useState, useEffect } from 'react'
import NewContentForm from '@/components/admin/sma/NewContentForm'
import VideoLab from '@/components/admin/sma/VideoLab'
import ApprovalQueueSection from '@/components/admin/sma/ApprovalQueueSection'
import ReadyToPostSection from '@/components/admin/sma/ReadyToPostSection'
import HistorySidebar from '@/components/admin/sma/HistorySidebar'
import type { PausedLifecycle } from '@/lib/sma/coordinator/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LifecycleRow = { task_id: string; lifecycle_record: any; lineage_hash: string; assembled_at: string }

export default function QueuePage() {
  const [paused, setPaused] = useState<PausedLifecycle[]>([])
  const [ready, setReady] = useState<LifecycleRow[]>([])
  const [history, setHistory] = useState<LifecycleRow[]>([])
  const [loading, setLoading] = useState(true)

  // Load initial data
  const loadData = async () => {
    setLoading(true)
    try {
      const [pausedRes, readyRes, historyRes] = await Promise.all([
        fetch('/api/sma/coordinator/queue'),
        fetch('/api/sma/coordinator/ready'),
        fetch('/api/sma/coordinator/history'),
      ])

      if (pausedRes.ok) {
        setPaused(await pausedRes.json())
      }
      if (readyRes.ok) {
        const readyRows = (await readyRes.json()) as LifecycleRow[]
        // Only show actionable items: exclude anything already published —
        // published items now live in History.
        setReady(
          readyRows.filter(
            (row) => Object.keys(row.lifecycle_record?.publications || {}).length === 0,
          ),
        )
      }
      if (historyRes.ok) {
        setHistory(await historyRes.json())
      }
    } catch (error) {
      console.error('Failed to load queue data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Load data on mount
  useEffect(() => {
    if (paused.length === 0 && ready.length === 0 && history.length === 0) {
      loadData()
    }
  }, [])

  const handleDraftGenerated = async () => {
    // Refresh queue, ready, and history lists
    await loadData()
  }

  const handleDecisionMade = async () => {
    // Refresh queue, ready, and history lists
    await loadData()
  }

  const handleDismiss = async (taskId: string) => {
    try {
      const res = await fetch(`/api/sma/coordinator/dismiss/${taskId}`, {
        method: 'POST',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Dismiss failed')
      }
      await loadData()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'An error occurred')
    }
  }

  return (
    <div className="lg:grid lg:grid-cols-3 lg:gap-8 space-y-8 lg:space-y-0">
      {/* Main column */}
      <div className="lg:col-span-2 space-y-8">
        {/* New Content Form */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-semibold mb-4">New Content</h2>
          <NewContentForm onSuccess={handleDraftGenerated} />
        </section>

        {/* Video Studio (beta) */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-semibold mb-4">Video Studio (beta)</h2>
          <VideoLab />
        </section>

        {/* Approval Queue */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-semibold mb-4">Approval Queue</h2>
          <ApprovalQueueSection items={paused} onDecision={handleDecisionMade} />
        </section>

        {/* Ready to Post */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-semibold mb-4">Ready to Publish</h2>
          <ReadyToPostSection items={ready} />
        </section>
      </div>

      {/* History sidebar */}
      <div className="lg:col-span-1">
        <HistorySidebar items={history} onDismiss={handleDismiss} />
      </div>
    </div>
  )
}
