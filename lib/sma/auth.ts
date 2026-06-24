import 'server-only'
import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export async function getAdminUser() {
  const supabase = await getSupabaseServerClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null
  return data.user
}

export async function requireAdminUser(lang: 'es' | 'en' = 'es') {
  const user = await getAdminUser()
  if (!user) redirect(`/${lang}/admin/login`)
  return user
}

/**
 * Verify that the session user is in sma_admins.
 * Used by API routes to enforce membership before any coordinator action.
 * Returns the user if verified, null if not authenticated or not in sma_admins.
 */
export async function requireSmaAdmin() {
  const user = await getAdminUser()
  if (!user) return null

  const supabase = await getSupabaseServerClient()
  const { data: admin } = await supabase
    .from('sma_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!admin) return null
  return user
}
