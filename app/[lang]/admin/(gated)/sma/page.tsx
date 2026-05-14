import { getConnectionStatus } from '@/lib/sma/connections'
import ConnectionStatusCard from '@/components/admin/ConnectionStatusCard'

export const dynamic = 'force-dynamic'

export default async function SmaDashboardPage({
  params,
}: PageProps<'/[lang]/admin/sma'>) {
  const { lang } = await params
  const safeLang = lang === 'en' ? 'en' : 'es'
  const statuses = await getConnectionStatus()
  const anyConnected = statuses.some((s) => s.connected && !s.revoked)

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-medium">Connections</h2>
          <p className="text-sm text-zinc-500">
            Authorize CEPTI&apos;s social accounts so the agent can recommend, schedule, and triage on your behalf.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {statuses.map((s) => (
            <ConnectionStatusCard key={s.platform} status={s} lang={safeLang} />
          ))}
        </div>
        {!anyConnected ? (
          <p className="text-sm text-zinc-500">
            No platforms connected yet. Connect at least one account to unlock Phase 2.
          </p>
        ) : null}
      </section>
      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-lg font-medium">Phase 1 status</h2>
        <ul className="mt-2 text-sm text-zinc-600 list-disc pl-5 space-y-1">
          <li>Foundation tables and RLS are deployed.</li>
          <li>OAuth handshake is wired for Instagram, Facebook Page, and Threads.</li>
          <li>Recommendations, Scheduled, Inbox, and Insights ship in later phases.</li>
        </ul>
      </section>
    </div>
  )
}
