import { type NextRequest, NextResponse } from 'next/server'
import { requireSmaAdmin } from '@/lib/sma/auth'
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { getProductImages, loadProductsCatalog } from '@/lib/sma/products-service'
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
    const { productSlug, prompt, duration, sourceImageUrl } = body as {
      productSlug?: string
      prompt?: string
      duration?: number
      sourceImageUrl?: string
    }

    const hasUploadedSource =
      typeof sourceImageUrl === 'string' && sourceImageUrl.trim() !== ''
    const trimmedSlug =
      typeof productSlug === 'string' && productSlug.trim() !== '' ? productSlug.trim() : null

    // When no uploaded "before" photo is provided, fall back to the product
    // hero image — which requires a productSlug.
    if (!hasUploadedSource && !trimmedSlug) {
      return NextResponse.json(
        { error: 'productSlug is required and must be a non-empty string' },
        { status: 400 },
      )
    }

    // Resolve the first-frame image URL.
    let imageUrl: string
    if (hasUploadedSource) {
      imageUrl = sourceImageUrl.trim()
    } else {
      // trimmedSlug is guaranteed non-null here.
      const images = await getProductImages(trimmedSlug as string)
      const imagePath = images[0]
      if (!imagePath) {
        return NextResponse.json(
          { error: `No image found for product "${productSlug}"` },
          { status: 400 },
        )
      }
      imageUrl = `${SITE_ORIGIN}${imagePath}`
    }

    // Resolve the prompt. A custom prompt always wins. Otherwise: if we're
    // animating an uploaded "before" wall, use a transformation-style default
    // (optionally naming the product); else the standard reveal default.
    let resolvedPrompt: string
    if (typeof prompt === 'string' && prompt.trim() !== '') {
      resolvedPrompt = prompt.trim()
    } else if (hasUploadedSource) {
      let productName = 'CEPTI'
      if (trimmedSlug) {
        const catalog = await loadProductsCatalog()
        const product = catalog.find(
          (p) => p.slug.toLowerCase() === trimmedSlug.toLowerCase(),
        )
        if (product?.name?.es) {
          productName = product.name.es
        }
      }
      resolvedPrompt =
        `Transición elegante que revela el acabado ${productName} sobre esta pared, ` +
        'con movimiento de cámara lento, luz natural y aspecto realista.'
    } else {
      resolvedPrompt = DEFAULT_PROMPT
    }

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
        product_slug: trimmedSlug,
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
