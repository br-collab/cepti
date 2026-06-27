import { type NextRequest, NextResponse } from 'next/server'
import { requireSmaAdmin } from '@/lib/sma/auth'
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { parseWaRef } from '@/lib/sma/wa-link'

export const runtime = 'nodejs'

const REF_PLATFORM_LABEL: Record<string, string> = {
  fb: 'facebook',
  ig: 'instagram',
  th: 'threads',
}

export async function GET() {
  const user = await requireSmaAdmin()
  if (!user) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  try {
    const supabase = getSupabaseServiceRoleClient()

    const { data, error: dbError } = await supabase
      .from('sma_leads')
      .select('id, task_id, ref_text, platform, note, created_at')
      .order('created_at', { ascending: false })
      .limit(100)

    if (dbError) {
      throw new Error(`Supabase error: ${dbError.message}`)
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('GET /api/sma/leads error:', error)
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
    const body = (await req.json()) as {
      task_id?: unknown
      ref_text?: unknown
      platform?: unknown
      note?: unknown
    }

    let taskId =
      typeof body.task_id === 'string' && body.task_id.trim() ? body.task_id.trim() : null
    const refText =
      typeof body.ref_text === 'string' && body.ref_text.trim() ? body.ref_text.trim() : null
    let platform =
      typeof body.platform === 'string' && body.platform.trim() ? body.platform.trim() : null
    const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null

    // If a ref tag (or a caption containing one) was supplied, derive
    // platform/task_id from it when not explicitly provided.
    if (refText) {
      const parsed = parseWaRef(refText)
      if (parsed) {
        if (!platform) platform = REF_PLATFORM_LABEL[parsed.platform] ?? parsed.platform
        if (!taskId && parsed.kind === 'post') taskId = parsed.id
      }
    }

    if (!taskId && !refText && !note) {
      return NextResponse.json(
        { error: 'At least one of task_id, ref_text, or note is required' },
        { status: 400 },
      )
    }

    const supabase = getSupabaseServiceRoleClient()

    const { data, error: dbError } = await supabase
      .from('sma_leads')
      .insert({
        task_id: taskId,
        ref_text: refText,
        platform,
        note,
      })
      .select('id, task_id, ref_text, platform, note, created_at')
      .single()

    if (dbError) {
      throw new Error(`Supabase error: ${dbError.message}`)
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('POST /api/sma/leads error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
