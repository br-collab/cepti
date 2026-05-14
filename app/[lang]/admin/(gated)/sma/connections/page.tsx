import { getConnectionStatus } from '@/lib/sma/connections'
import ConnectionStatusCard from '@/components/admin/ConnectionStatusCard'
import { PLATFORM_LABEL, PLATFORM_SCOPES } from '@/lib/sma/platforms'

export const dynamic = 'force-dynamic'

export default async function SmaConnectionsPage({
  params,
}: PageProps<'/[lang]/admin/sma/connections'>) {
  const { lang } = await params
  const safeLang = lang === 'en' ? 'en' : 'es'
  const statuses = await getConnectionStatus()

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statuses.map((s) => (
          <ConnectionStatusCard key={s.platform} status={s} lang={safeLang} />
        ))}
      </div>
      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="font-medium">Requested scopes (App Review)</h2>
        <p className="text-sm text-zinc-500 mt-1">
          Each scope below requires App Review with Meta (2–4 weeks per item). Track approval status outside this dashboard until the Phase 2 build adds review visibility.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          {(Object.keys(PLATFORM_SCOPES) as Array<keyof typeof PLATFORM_SCOPES>).map((p) => (
            <div key={p}>
              <div className="text-sm font-medium">{PLATFORM_LABEL[p]}</div>
              <ul className="mt-1 text-xs text-zinc-600 space-y-0.5">
                {PLATFORM_SCOPES[p].map((scope) => (
                  <li key={scope} className="font-mono">{scope}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
