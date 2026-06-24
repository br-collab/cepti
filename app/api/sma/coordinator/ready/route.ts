import { NextResponse } from 'next/server'
import { requireSmaAdmin } from '@/lib/sma/auth'
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET() {
  const user = await requireSmaAdmin()
  if (!user) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  try {
    const supabase = await getSupabaseServiceRoleClient()

    const { data: lifecycles, error: dbError } = await supabase
      .from('sma_content_lifecycles')
      .select('*')
      .filter('lifecycle_record->>status', 'eq', 'COMPLETE')
      .order('assembled_at', { ascending: false })
      .limit(20)

    if (dbError) {
      throw new Error(`Supabase error: ${dbError.message}`)
    }

    return NextResponse.json(lifecycles || [])
  } catch (error) {
    console.error('GET /api/sma/coordinator/ready error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
