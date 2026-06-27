'use client'

import { useState, useEffect, useCallback } from 'react'

type JobStatus = 'scheduled' | 'published' | 'failed' | 'canceled'

interface ScheduledJob {
  id: string
  task_id: string
  platform: string
  scheduled_for: string
  status: JobStatus
  error: string | null
  published_post_id: string | null
  created_at: string
  updated_at: string
}

interface ReadyLifecycleRow {
  task_id: string
  lifecycle_record: { intent?: { topic?: string } }
}

const STATUS_BADGE: Record<JobStatus, string> = {
  scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
  published: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  canceled: 'bg-zinc-100 text-zinc-500 border-zinc-300',
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ScheduledPage() {
  const [jobs, setJobs] = useState<ScheduledJob[]>([])
  const [topics, setTopics] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [canceling, setCanceling] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [jobsRes, readyRes] = await Promise.all([
        fetch('/api/sma/schedule'),
        fetch('/api/sma/coordinator/ready').catch(() => null),
      ])
      if (!jobsRes.ok) throw new Error('Failed to load scheduled jobs')
      const jobsData = (await jobsRes.json()) as ScheduledJob[]
      setJobs(Array.isArray(jobsData) ? jobsData : [])

      if (readyRes && readyRes.ok) {
        const readyData = (await readyRes.json()) as ReadyLifecycleRow[]
        const map: Record<string, string> = {}
        for (const row of Array.isArray(readyData) ? readyData : []) {
          const topic = row.lifecycle_record?.intent?.topic
          if (row.task_id && typeof topic === 'string') map[row.task_id] = topic
        }
        setTopics(map)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleCancel = async (id: string) => {
    setCanceling(id)
    try {
      const res = await fetch(`/api/sma/schedule/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Cancel failed')
      }
      setJobs((prev) =>
        prev.map((j) => (j.id === id ? { ...j, status: 'canceled' as JobStatus } : j)),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancel failed')
    } finally {
      setCanceling(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          Pre-approved drafts pinned to a future time. The publish cron runs each one at its
          scheduled moment using the same human-authorized publish path.
        </p>
        <button
          onClick={load}
          disabled={loading}
          className="text-xs font-medium px-3 py-1.5 rounded-md border border-zinc-300 hover:bg-zinc-50 disabled:opacity-50"
        >
          {loading ? 'Loading...' : '↺ Refresh'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border border-zinc-200 bg-zinc-50 h-16 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && jobs.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-12 text-center">
          <p className="text-sm text-zinc-500 font-medium">Nothing scheduled.</p>
        </div>
      )}

      {!loading && jobs.length > 0 && (
        <div className="space-y-2">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-4"
            >
              <div className="min-w-0 space-y-1">
                <p className="font-medium text-zinc-900 truncate">
                  {topics[job.task_id] || job.task_id}
                </p>
                <p className="text-xs text-zinc-500">
                  {job.platform} • {formatTime(job.scheduled_for)}
                </p>
                {job.status === 'failed' && job.error && (
                  <p className="text-xs text-red-600">{job.error}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded border ${STATUS_BADGE[job.status]}`}
                >
                  {job.status}
                </span>
                {job.status === 'scheduled' && (
                  <button
                    onClick={() => handleCancel(job.id)}
                    disabled={canceling === job.id}
                    className="text-xs font-medium px-3 py-1.5 rounded-md border border-zinc-300 hover:bg-zinc-50 disabled:opacity-50"
                  >
                    {canceling === job.id ? 'Canceling…' : 'Cancel'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
