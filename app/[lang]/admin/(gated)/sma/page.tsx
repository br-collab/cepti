import { getDashboardStats } from '@/lib/sma/dashboard-stats'
import { PLATFORM_LABEL, type Platform } from '@/lib/sma/platforms'

export const dynamic = 'force-dynamic'

function usd(n: number): string {
  return `$${(Number.isFinite(n) ? n : 0).toFixed(2)}`
}

function platformLabel(p: string): string {
  return PLATFORM_LABEL[p as Platform] ?? p
}

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
  const { funnel, cadence, recentPosts, video, library, aiSpend, contentBreakdown } = stats

  const captionModel =
    aiSpend.byModel.find((m) => m.model !== 'grok-imagine-video-1.5')?.model ?? 'claude-opus-4-8'
  const videoModelRow = aiSpend.byModel.find((m) => m.model === 'grok-imagine-video-1.5')
  const captionRow = aiSpend.byModel.find((m) => m.model === captionModel)

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

      {/* 1b. AI spend (FinOps) */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="mb-4">
          <h2 className="text-lg font-medium">AI spend</h2>
          <p className="text-sm text-zinc-500">
            Estimated cost of caption generation and video rendering.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Stat label="Total est." value={usd(aiSpend.totalUsd)} hint="all time" />
          <Stat
            label="This month"
            value={usd(aiSpend.thisMonthUsd)}
            hint="captions (LLM) this month"
          />
        </div>
        {aiSpend.byModel.length > 0 ? (
          <ul className="mt-4 divide-y divide-zinc-100 border-t border-zinc-100">
            {aiSpend.byModel.map((m) => (
              <li
                key={m.model}
                className="flex items-center justify-between gap-4 py-2 text-sm"
              >
                <span className="min-w-0 truncate text-zinc-700">{m.model}</span>
                <span className="shrink-0 text-zinc-500">
                  <span className="font-medium text-zinc-800">{usd(m.usd)}</span>
                  {' · '}
                  {m.calls} {m.calls === 1 ? 'call' : 'calls'}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-3 text-xs text-zinc-400">
          Estimated from token usage and video seconds; LLM prices are approximate.
        </p>
      </section>

      {/* 1c. Models in use */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="mb-4">
          <h2 className="text-lg font-medium">Models in use</h2>
          <p className="text-sm text-zinc-500">Which models power each part of the pipeline.</p>
        </div>
        <ul className="divide-y divide-zinc-100">
          <li className="flex items-center justify-between gap-4 py-3 text-sm">
            <span className="text-zinc-700">
              Captions — Claude{' '}
              <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs text-zinc-600">
                {captionModel}
              </code>
            </span>
            <span className="shrink-0 font-medium text-zinc-800">
              {usd(captionRow?.usd ?? 0)}
            </span>
          </li>
          <li className="flex items-center justify-between gap-4 py-3 text-sm">
            <span className="text-zinc-700">
              Video — Grok{' '}
              <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs text-zinc-600">
                grok-imagine-video-1.5
              </code>
            </span>
            <span className="shrink-0 font-medium text-zinc-800">
              {usd(videoModelRow?.usd ?? 0)}
            </span>
          </li>
        </ul>
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

      {/* 4b. Content breakdown */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="mb-4">
          <h2 className="text-lg font-medium">Content breakdown</h2>
          <p className="text-sm text-zinc-500">What the SMA has been making, by volume.</p>
        </div>
        {contentBreakdown.byProduct.length === 0 &&
        contentBreakdown.byPlatform.length === 0 ? (
          <p className="text-sm text-zinc-500">No content yet.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
                Top products
              </div>
              {contentBreakdown.byProduct.length === 0 ? (
                <p className="text-sm text-zinc-400">No content yet.</p>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {contentBreakdown.byProduct.map((p) => (
                    <li
                      key={p.product}
                      className="flex items-center justify-between gap-4 py-2 text-sm"
                    >
                      <span className="min-w-0 truncate text-zinc-700">{p.product}</span>
                      <span className="shrink-0 font-medium text-zinc-800">{p.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
                By platform
              </div>
              {contentBreakdown.byPlatform.length === 0 ? (
                <p className="text-sm text-zinc-400">No content yet.</p>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {contentBreakdown.byPlatform.map((p) => (
                    <li
                      key={p.platform}
                      className="flex items-center justify-between gap-4 py-2 text-sm"
                    >
                      <span className="min-w-0 truncate text-zinc-700">
                        {platformLabel(p.platform)}
                      </span>
                      <span className="shrink-0 font-medium text-zinc-800">{p.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
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
