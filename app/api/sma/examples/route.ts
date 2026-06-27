import { type NextRequest, NextResponse } from 'next/server'
import { requireSmaAdmin } from '@/lib/sma/auth'
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const VALID_PLATFORMS = ['facebook', 'instagram', 'threads'] as const
const VALID_LABELS = ['top', 'good', 'reference'] as const

export async function GET() {
  const user = await requireSmaAdmin()
  if (!user) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  try {
    const supabase = getSupabaseServiceRoleClient()

    const { data, error: dbError } = await supabase
      .from('sma_examples')
      .select('id, platform, product_slug, caption, performance_label, source_note, created_at')
      .order('created_at', { ascending: false })
      .limit(100)

    if (dbError) {
      throw new Error(`Supabase error: ${dbError.message}`)
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('GET /api/sma/examples error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  const user = await requireSmaAdmin()
  if (!user) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = (await req.json()) as Record<string, any>

    const caption = typeof body.caption === 'string' ? body.caption.trim() : ''
    if (!caption) {
      return NextResponse.json({ error: 'caption is required' }, { status: 400 })
    }

    const platform =
      body.platform && VALID_PLATFORMS.includes(body.platform) ? body.platform : null
    const productSlug =
      typeof body.product_slug === 'string' && body.product_slug.trim()
        ? body.product_slug.trim()
        : null
    const performanceLabel =
      body.performance_label && VALID_LABELS.includes(body.performance_label)
        ? body.performance_label
        : null
    const sourceNote =
      typeof body.source_note === 'string' && body.source_note.trim()
        ? body.source_note.trim()
        : null

    const supabase = getSupabaseServiceRoleClient()

    const { data, error: dbError } = await supabase
      .from('sma_examples')
      .insert({
        caption,
        platform,
        product_slug: productSlug,
        performance_label: performanceLabel,
        source_note: sourceNote,
      })
      .select('id, platform, product_slug, caption, performance_label, source_note, created_at')
      .single()

    if (dbError) {
      throw new Error(`Supabase error: ${dbError.message}`)
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('POST /api/sma/examples error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
