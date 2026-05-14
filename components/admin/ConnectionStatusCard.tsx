import { PLATFORM_LABEL } from '@/lib/sma/platforms'
import type { ConnectionStatus } from '@/lib/sma/connections'

export default function ConnectionStatusCard({
  status,
  lang,
}: {
  status: ConnectionStatus
  lang: 'es' | 'en'
}) {
  const startHref = `/api/sma/oauth/${status.platform}/start?lang=${lang}`
  const label = PLATFORM_LABEL[status.platform]
  const stateLabel = status.revoked
    ? 'Reconnect required'
    : status.connected
      ? 'Connected'
      : 'Not connected'
  const tone = status.revoked
    ? 'text-amber-700 bg-amber-50 border-amber-200'
    : status.connected
      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
      : 'text-zinc-600 bg-zinc-50 border-zinc-200'

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{label}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full border ${tone}`}>{stateLabel}</span>
      </div>
      <dl className="text-sm text-zinc-600 space-y-1">
        <div className="flex justify-between gap-2">
          <dt>Account</dt>
          <dd className="text-right">{status.accountLabel || status.externalAccountId || '—'}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Scopes</dt>
          <dd className="text-right">{status.scopes.length}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Expires</dt>
          <dd className="text-right">
            {status.expiresAt ? new Date(status.expiresAt).toLocaleDateString() : '—'}
          </dd>
        </div>
      </dl>
      <a
        href={startHref}
        className="mt-1 inline-flex items-center justify-center rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-800"
      >
        {status.connected && !status.revoked ? 'Reconnect' : 'Connect'}
      </a>
    </div>
  )
}
