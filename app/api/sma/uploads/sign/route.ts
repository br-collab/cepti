import { type NextRequest, NextResponse } from 'next/server'
import { requireSmaAdmin } from '@/lib/sma/auth'
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const BUCKET = 'sma-uploads'
const MAX_BYTES = 30 * 1024 * 1024 // 30MB — stakeholder-approved per-file cap

/**
 * Mint a signed upload URL for direct-to-Storage uploads from the operator's
 * browser. We sign here (service-role, server-side) and the client PUTs the
 * file straight to Supabase Storage — this bypasses Vercel's ~4.5MB request
 * body limit, which a multipart POST through a Next route would hit at 30MB.
 *
 * Mirrors app/api/sma/video/upload conventions: same bucket, same safeName
 * scheme, public-url retrieval via getPublicUrl.
 */
export async function POST(req: NextRequest) {
  const user = await requireSmaAdmin()
  if (!user) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { filename, contentType, sizeBytes } = body as {
      filename?: string
      contentType?: string
      sizeBytes?: number
    }

    if (typeof contentType !== 'string' || (!contentType.startsWith('image/') && !contentType.startsWith('video/'))) {
      return NextResponse.json({ error: 'File must be an image or video' }, { status: 400 })
    }

    if (typeof sizeBytes !== 'number' || !Number.isFinite(sizeBytes) || sizeBytes <= 0) {
      return NextResponse.json({ error: 'sizeBytes is required and must be a positive number' }, { status: 400 })
    }

    if (sizeBytes > MAX_BYTES) {
      return NextResponse.json({ error: 'File must be 30MB or smaller' }, { status: 400 })
    }

    const safeName = (filename || 'upload')
      .toLowerCase()
      .replace(/[^a-z0-9.\-_]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 80)
    const path = `posts/${Date.now()}-${safeName}`

    const supabase = getSupabaseServiceRoleClient()
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path)

    if (error || !data) {
      throw new Error(`Failed to create signed upload URL: ${error?.message ?? 'unknown error'}`)
    }

    const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl

    return NextResponse.json({
      path: data.path ?? path,
      token: data.token,
      signedUrl: data.signedUrl,
      publicUrl,
    })
  } catch (error) {
    console.error('POST /api/sma/uploads/sign error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
