import { NextResponse } from 'next/server'
import { requireSmaAdmin } from '@/lib/sma/auth'
import { generateDetailed } from '@/lib/sma/llm-client'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'

export interface ContentRecommendation {
  id: string
  product_slug: string
  product_name: string
  platform: 'facebook' | 'instagram' | 'threads'
  angle: string
  content_type: 'pictures' | 'video' | 'both'
  rationale: string
}

const RECOMMENDATION_SCHEMA = `[
  {
    "id": "string — unique id like rec-001",
    "product_slug": "string — exact product slug",
    "product_name": "string — product name in Spanish",
    "platform": "facebook | instagram | threads",
    "angle": "string — specific content angle or hook in Spanish (1-2 sentences)",
    "content_type": "pictures | video | both",
    "rationale": "string — why this content would perform well, in Spanish (1 sentence)"
  }
]`

export async function GET() {
  const user = await requireSmaAdmin()
  if (!user) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  try {
    const productsPath = path.join(process.cwd(), 'data/products.json')
    const productsData = JSON.parse(fs.readFileSync(productsPath, 'utf-8'))
    const products = productsData.products as Array<{ slug: string; name: { es: string; en: string }; tagline: { es: string } }>

    const productList = products
      .map(p => `- ${p.slug}: ${p.name.es} — ${p.tagline.es}`)
      .join('\n')

    const systemPrompt = `Eres un estratega de contenido digital experto en el mercado dominicano de materiales de acabado. Conoces a fondo los productos de CEPTI y sus audiencias en Instagram (@cepti_rd, 1,300 seguidores — diseñadores, arquitectos, propietarios), Facebook (12 seguidores — propietarios y contratistas dominicanos) y Threads (audiencia conversacional y profesional).

Tu trabajo: generar recomendaciones de contenido concretas, variadas y accionables para las tres plataformas. Cada recomendación debe tener un ángulo específico — no genérico. Piensa en qué va a detener el scroll, generar conversación, o llevar al WhatsApp.

Responde ÚNICAMENTE con un array JSON válido que siga exactamente este esquema:
${RECOMMENDATION_SCHEMA}

Reglas:
- 8 recomendaciones en total
- Distribuye: 3 Instagram, 3 Facebook, 2 Threads
- Cubre al menos 5 productos distintos
- Mezcla content_type: al menos 2 "video", 3 "pictures", el resto "both"
- Ángulos específicos y creativos — nada genérico como "muestra el producto"
- Todo en español dominicano`

    const userMessage = `Catálogo de productos CEPTI:\n${productList}\n\nGenera 8 recomendaciones de contenido para redes sociales. Prioriza Instagram (mayor audiencia), luego Facebook y Threads. Sé específico en los ángulos.`

    const result = await generateDetailed({
      system: systemPrompt,
      userMessage,
      maxTokens: 2048,
    })

    // Parse JSON from LLM response — strip markdown code fences if present
    const raw = result.text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
    const recommendations: ContentRecommendation[] = JSON.parse(raw)

    return NextResponse.json({ recommendations })
  } catch (error) {
    console.error('GET /api/sma/coordinator/recommend error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
