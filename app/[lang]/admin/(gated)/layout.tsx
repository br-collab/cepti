import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/sma/auth'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { signOutAction } from '../login/actions'

export const dynamic = 'force-dynamic'

export default async function AdminGatedLayout({
  children,
  params,
}: LayoutProps<'/[lang]/admin'>) {
  const { lang } = await params
  const user = await getAdminUser()
  if (!user) redirect(`/${lang}/admin/login`)

  const supabase = await getSupabaseServerClient()
  const { data: admin } = await supabase
    .from('sma_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!admin) {
    await supabase.auth.signOut()
    redirect(`/${lang}/admin/login?error=Account%20is%20not%20authorised%20for%20admin%20access`)
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="font-semibold tracking-tight">CEPTI Admin</div>
          <div className="flex items-center gap-4 text-sm text-zinc-600">
            <span>{user.email}</span>
            <form action={signOutAction}>
              <input type="hidden" name="lang" value={lang} />
              <button type="submit" className="text-zinc-600 hover:text-zinc-900 underline-offset-2 hover:underline">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
    </div>
  )
}
