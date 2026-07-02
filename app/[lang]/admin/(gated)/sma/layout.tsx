import Link from 'next/link'

const TABS = [
  { slug: '', label: 'Dashboard' },
  { slug: 'queue', label: 'Queue' },
  { slug: 'connections', label: 'Connections' },
  { slug: 'recommendations', label: 'Recommendations' },
  { slug: 'scheduled', label: 'Scheduled' },
  { slug: 'inbox', label: 'Inbox' },
  { slug: 'whatsapp', label: 'WhatsApp' },
  { slug: 'messages', label: 'DMs' },
  { slug: 'chat', label: 'Web Chat' },
  { slug: 'insights', label: 'Insights' },
  { slug: 'settings', label: 'Settings' },
  { slug: 'guide', label: 'Guide' },
] as const

export default async function SmaLayout({
  children,
  params,
}: LayoutProps<'/[lang]/admin/sma'>) {
  const { lang } = await params
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Social Media Agent</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Recommend, schedule, and triage posts and comments across Instagram, Facebook, and Threads.
        </p>
      </div>
      <nav className="flex flex-wrap gap-1 border-b border-zinc-200">
        {TABS.map((tab) => {
          const href = tab.slug ? `/${lang}/admin/sma/${tab.slug}` : `/${lang}/admin/sma`
          return (
            <Link
              key={tab.slug || 'root'}
              href={href}
              className="px-3 py-2 text-sm text-zinc-600 hover:text-zinc-900 border-b-2 border-transparent hover:border-zinc-300"
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>
      {children}
    </div>
  )
}
