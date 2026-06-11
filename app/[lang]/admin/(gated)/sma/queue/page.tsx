'use client'

import { useState } from 'react'
import NewContentForm from '@/components/admin/sma/NewContentForm'
import ApprovalQueueSection from '@/components/admin/sma/ApprovalQueueSection'
import ReadyToPostSection from '@/components/admin/sma/ReadyToPostSection'
import type { PausedLifecycle } from '@/lib/sma/coordinator/types'

export default function QueuePage() {
  const [paused, setPaused] = useState<PausedLifecycle[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [ready, setReady] = useState<Array<{ task_id: string; lifecycle_record: any; lineage_hash: string; assembled_at: string }>>([])
  const [loading, setLoading] = useState(true)

  // Load initial data
  const loadData = async () => {
    setLoading(true)
    try {
      const [pausedRes, readyRes] = await Promise.all([
        fetch('/api/sma/coordinator/queue'),
        fetch('/api/sma/coordinator/ready'),
      ])

      if (pausedRes.ok) {
        setPaused(await pausedRes.json())
      }
      if (readyRes.ok) {
        setReady(await readyRes.json())
      }
    } catch (error) {
      console.error('Failed to load queue data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Load data on mount
  if (loading && paused.length === 0 && ready.length === 0) {
    const mountEffect = async () => {
      await loadData()
    }
    mountEffect()
  }

  const handleDraftGenerated = async () => {
    // Refresh both queue and ready lists
    await loadData()
  }

  const handleDecisionMade = async () => {
    // Refresh both queue and ready lists
    await loadData()
  }

  return (
    <div className="space-y-8">
      {/* New Content Form */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold mb-4">Nuevo Contenido</h2>
        <NewContentForm onSuccess={handleDraftGenerated} />
      </section>

      {/* Approval Queue */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold mb-4">Cola de Aprobación</h2>
        <ApprovalQueueSection items={paused} onDecision={handleDecisionMade} />
      </section>

      {/* Ready to Post */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold mb-4">Listo para Publicar</h2>
        <ReadyToPostSection items={ready} />
      </section>
    </div>
  )
}
