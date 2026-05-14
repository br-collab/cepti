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
