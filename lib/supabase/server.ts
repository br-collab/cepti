import 'server-only'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

function env() {
  const url = process.env.SUPABASE_URL
  const anon = process.env.SUPABASE_ANON_KEY
  if (!url || !anon) throw new Error('SUPABASE_URL / SUPABASE_ANON_KEY not configured')
  return { url, anon }
}

export async function getSupabaseServerClient() {
  const { url, anon } = env()
  const cookieStore = await cookies()
  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(toSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          for (const { name, value, options } of toSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Called from a Server Component, which cannot mutate cookies.
          // The auth refresh middleware (or a subsequent Server Action) will rewrite them.
        }
      },
    },
  })
}

export function getSupabaseServiceRoleClient() {
  const { url } = env()
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!service) throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured')
  return createServerClient(url, service, {
    cookies: { getAll: () => [], setAll: () => {} },
  })
}
