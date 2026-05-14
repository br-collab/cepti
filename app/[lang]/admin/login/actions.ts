'use server'

import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export async function signInAction(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const lang = String(formData.get('lang') ?? 'es') === 'en' ? 'en' : 'es'

  if (!email || !password) {
    redirect(`/${lang}/admin/login?error=Email%20and%20password%20are%20required`)
  }

  const supabase = await getSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    redirect(`/${lang}/admin/login?error=${encodeURIComponent(error.message)}`)
  }
  redirect(`/${lang}/admin/sma`)
}

export async function signOutAction(formData: FormData) {
  const lang = String(formData.get('lang') ?? 'es') === 'en' ? 'en' : 'es'
  const supabase = await getSupabaseServerClient()
  await supabase.auth.signOut()
  redirect(`/${lang}/admin/login`)
}
