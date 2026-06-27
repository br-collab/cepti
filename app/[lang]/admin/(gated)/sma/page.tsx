import { getDashboardStats } from '@/lib/sma/dashboard-stats'

export const dynamic = 'force-dynamic'

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function daysSince(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const ms = Date.now() - d.getTime()
  const days = Math.floor(ms / (24 * 60 * 60 * 1000))
  return days <= 0 ? 'today' : `${days}`
}

export default async function SmaDashboardPage() {
  const stats = await getDashboardStats()
  const { funnel, cadence, recentPosts, video, library } = stats

  const approvalRatePct =
    funnel.approvalRate === null ? '—' : `${Math.round(funnel.approvalRate * 100)}%`

  return (
    <div className="space-y-6">
      {/* 1. Pipeline */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="mb-4">
          <h2 className="text-lg font-medium">Pipeline</h2>
          <p className="text-sm text-zinc-500">
            From generated drafts to live posts on CEPTI&apos;s accounts.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Runs" value={funnel.runs} hint="content generations" />
          <Stat label="Approved" value={funnel.approved} hint="passed review" />
          <Stat label="Published" value={funnel.published} hint="live posts" />
        </div>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-zinc-500">
          <span>
            Approval rate: <span className="font-medium text-zinc-700">{approvalRatePct}</span>
          </span>
          <span>
            Denied: <span className="font-medium text-zinc-700">{funnel.denied}</span>
          </span>
        </div>
      </section>

      {/* 2. Cadence */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="mb-4">
          <h2 className="text-lg font-medium">Cadence</h2>
          <p className="text-sm text-zinc-500">How active the accounts have been lately.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Stat label="Posts (last 7 days)" value={cadence.postsLast7Days} />
          <Stat
            label="Days since last post"
            value={daysSince(cadence.lastPublishedAt)}
            hint={cadence.lastPublishedAt ? `last: ${fmtDate(cadence.lastPublishedAt)}` : 'no posts yet'}
          />
        </div>
      </section>

      {/* 3. Recent posts */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-medium">Recent posts</h2>
        {recentPosts.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No posts yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-100">
            {recentPosts.map((post, i) => (
              <li key={`${post.permalink ?? 'post'}-${i}`} className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                      {post.platformLabel}
                    </span>
                    <span className="text-xs text-zinc-400">{fmtDate(post.publishedAt)}</span>
                  </div>
                  <p className="mt-1 truncate text-sm text-zinc-700">
                    {post.captionSnippet || <span className="text-zinc-400">No caption</span>}
                  </p>
                </div>
                {post.permalink ? (
                  <a
                    href={post.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-sm font-medium text-blue-600 hover:underline"
                  >
                    View
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 4. Video output */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="mb-4">
          <h2 className="text-lg font-medium">Video output</h2>
          <p className="text-sm text-zinc-500">Clips generated in Video Studio.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <Stat label="Done" value={video.done} />
          <Stat label="Failed" value={video.failed} />
          <Stat label="Pending" value={video.pending} />
          <Stat label="Est. spend" value={`$${video.estSpendUsd.toFixed(2)} est`} />
        </div>
      </section>

      {/* 5. Library + connections strip */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-zinc-600">
            Examples saved:{' '}
            <span className="font-medium text-zinc-800">{library.examplesCount}</span>
          </span>
          <span className="text-zinc-600">
            Connected:{' '}
            {library.connectedPlatforms.length === 0 ? (
              <span className="text-zinc-400">none</span>
            ) : (
              <span className="font-medium text-zinc-800">
                {library.connectedPlatforms.map((p) => p.label).join(', ')}
              </span>
            )}
          </span>
        </div>
      </section>

      {/* 6. Coming next note */}
      <p className="text-sm text-zinc-400">
        Engagement metrics and WhatsApp lead attribution will appear here once Graph API insights
        and inbound capture are wired.
      </p>
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string
  value: string | number
  hint?: string
}) {
  return (
    <div>
      <div className="text-3xl font-semibold tracking-tight text-zinc-900">{value}</div>
      <div className="mt-1 text-sm text-zinc-600">{label}</div>
      {hint ? <div className="text-xs text-zinc-400">{hint}</div> : null}
    </div>
  )
}
