import { type NextRequest, NextResponse } from 'next/server'
import { requireSmaAdmin } from '@/lib/sma/auth'
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { getProductImages } from '@/lib/sma/products-service'
import { startImageToVideo } from '@/lib/sma/xai-video'

export const runtime = 'nodejs'

const SITE_ORIGIN = 'https://www.cepticorp.com'

const DEFAULT_PROMPT =
  'Movimiento de cámara lento y elegante que revela la textura y el acabado ' +
  'del material, con luz natural suave y un ambiente sofisticado.'

const MIN_DURATION = 4
const MAX_DURATION = 10
const DEFAULT_DURATION = 6

export async function POST(req: NextRequest) {
  const user = await requireSmaAdmin()
  if (!user) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { productSlug, prompt, duration } = body as {
      productSlug?: string
      prompt?: string
      duration?: number
    }

    if (!productSlug || typeof productSlug !== 'string' || productSlug.trim() === '') {
      return NextResponse.json(
        { error: 'productSlug is required and must be a non-empty string' },
        { status: 400 },
      )
    }

    const images = await getProductImages(productSlug.trim())
    const imagePath = images[0]
    if (!imagePath) {
      return NextResponse.json(
        { error: `No image found for product "${productSlug}"` },
        { status: 400 },
      )
    }
    const imageUrl = `${SITE_ORIGIN}${imagePath}`

    const resolvedPrompt =
      typeof prompt === 'string' && prompt.trim() !== '' ? prompt.trim() : DEFAULT_PROMPT

    const rawDuration = typeof duration === 'number' && !Number.isNaN(duration) ? duration : DEFAULT_DURATION
    const resolvedDuration = Math.min(MAX_DURATION, Math.max(MIN_DURATION, Math.round(rawDuration)))

    const { requestId } = await startImageToVideo({
      imageUrl,
      prompt: resolvedPrompt,
      duration: resolvedDuration,
    })

    const supabase = getSupabaseServiceRoleClient()
    const { data: inserted, error: dbError } = await supabase
      .from('sma_video_jobs')
      .insert({
        request_id: requestId,
        status: 'pending',
        product_slug: productSlug.trim(),
        source_image_url: imageUrl,
        prompt: resolvedPrompt,
        duration: resolvedDuration,
      })
      .select('id')
      .single()

    if (dbError) {
      throw new Error(`Supabase error: ${dbError.message}`)
    }

    return NextResponse.json({ jobId: inserted.id, requestId })
  } catch (error) {
    console.error('POST /api/sma/video/start error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
