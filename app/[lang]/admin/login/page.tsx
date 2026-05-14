import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/sma/auth'
import { signInAction } from './actions'

export const dynamic = 'force-dynamic'

export default async function AdminLoginPage({
  params,
  searchParams,
}: PageProps<'/[lang]/admin/login'>) {
  const { lang } = await params
  const sp = await searchParams
  const error = typeof sp?.error === 'string' ? sp.error : null

  const user = await getAdminUser()
  if (user) redirect(`/${lang}/admin/sma`)

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
      <form
        action={signInAction}
        className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm border border-zinc-200 space-y-4"
      >
        <div>
          <h1 className="text-xl font-semibold tracking-tight">CEPTI Admin</h1>
          <p className="text-sm text-zinc-500 mt-1">Sign in to access the SMA dashboard.</p>
        </div>
        <input type="hidden" name="lang" value={lang} />
        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-700">Email</label>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-700">Password</label>
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
        </div>
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : null}
        <button
          type="submit"
          className="w-full rounded-md bg-zinc-900 text-white py-2 text-sm font-medium hover:bg-zinc-800"
        >
          Sign in
        </button>
      </form>
    </div>
  )
}
