import { type NextRequest, NextResponse } from 'next/server'
import { requireSmaAdmin } from '@/lib/sma/auth'
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const BUCKET = 'sma-uploads'
const MAX_BYTES = 10 * 1024 * 1024 // ~10MB

export async function POST(req: NextRequest) {
  const user = await requireSmaAdmin()
  if (!user) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'A "file" field is required' }, { status: 400 })
    }

    const contentType = file.type || 'application/octet-stream'
    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File must be under 10MB' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const fileBuffer = Buffer.from(arrayBuffer)

    const safeName = (file.name || 'upload')
      .toLowerCase()
      .replace(/[^a-z0-9.\-_]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 80)
    const path = `before/${Date.now()}-${safeName}`

    const supabase = getSupabaseServiceRoleClient()
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, fileBuffer, { contentType, upsert: false })

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`)
    }

    const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl

    return NextResponse.json({ url })
  } catch (error) {
    console.error('POST /api/sma/video/upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
