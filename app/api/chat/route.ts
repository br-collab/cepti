import { NextRequest, NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'

export const runtime = 'nodejs'

type ChatMessage = { role: 'user' | 'assistant'; content: string }

/**
 * Shared product knowledge base — the same ficha-técnica content the WhatsApp
 * Advisor uses (prompts/whatsapp/kb.md), so the website chatbot and WhatsApp
 * answer product questions at the same depth. Loaded once and cached in module
 * scope. If the file is missing, the chatbot falls back to the product summary
 * in SYSTEM_PROMPT rather than failing.
 */
let cachedKb: string | null = null
function loadProductKb(): string {
  if (cachedKb !== null) return cachedKb
  try {
    cachedKb = fs.readFileSync(path.join(process.cwd(), 'prompts/whatsapp/kb.md'), 'utf-8')
  } catch (e) {
    console.error('chat: product KB not found, continuing without it:', e)
    cachedKb = ''
  }
  return cachedKb
}

const SYSTEM_PROMPT = `You are CEPTI's product advisor — a knowledgeable friend, not a salesperson. You speak both Spanish and English fluently. Always respond in the language indicated.

CEPTI is an innovative manufacturer of cutting-edge decoration materials for interior and exterior surfaces, based in the Dominican Republic. The product line:

- Pintura Aterciopelada — luxury velvet-finish paint, sophisticated interiors.
- Pintura con Efecto Piedra — decorative stone-effect finish for any surface.
- Pintura con Efecto Granito y Granito Líquido — granite-look continuous finish, interior or exterior.
- Piedra Flexible (Papelex) — lightweight flexible stone sheets, fits curved surfaces.
- Ladrillo Flexible (Ladriflex) — real-brick appearance with full flexibility.
- Primer — high-quality preparation base, extends finish life.
- Pegamento — professional adhesive for Papelex and Ladriflex.
- Arte con Arena y Piedra — custom artistic textures with natural sand and stone.

All products are 100% ecological, mold/fungus resistant, withstand tropical climate, and last up to 10 years. Installation by CEPTI experts comes with at least a 5-year warranty.

Rules:
- Keep responses short and conversational — 2 to 4 sentences max. No long lists, no walls of text.
- Recommend exactly ONE product per turn unless the user explicitly asks to compare.
- Never quote prices, never speculate on cost. Pricing is handled via WhatsApp quote.
- When the user signals readiness to buy, asks for a quote, asks "how do I order", or otherwise wants to take the next step, append the literal tag [SHOW_WA] at the end of your message (case-sensitive, exact characters, no extra punctuation around it).
- Match the recommended product to the user's described surface or project (interior wall, facade, column, furniture, etc.).
- If you cannot answer something with confidence (specific catalog code, exact dimensions, technical spec not in the list above), say so plainly and suggest they ask via WhatsApp — that's a [SHOW_WA] moment.`

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not configured on the server' },
      { status: 500 }
    )
  }

  let body: { messages?: ChatMessage[]; lang?: 'es' | 'en' }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const messages = body.messages
  const lang = body.lang === 'en' ? 'en' : 'es'

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: 'messages must be a non-empty array' },
      { status: 400 }
    )
  }

  const langLine =
    lang === 'en'
      ? 'User language preference: English. Respond only in English.'
      : 'User language preference: Spanish. Respond only in Spanish.'

  // Detailed product knowledge (shared with the WhatsApp Advisor). It's in
  // Spanish; answer in the requested language regardless. The website's own
  // rules above stay authoritative — in particular, price/quote/uncertainty is
  // a [SHOW_WA] moment here (the KB's "handoff" wording is the WhatsApp equivalent).
  const productKb = loadProductKb()
  const kbBlock = productKb
    ? `REFERENCIA — fichas técnicas de producto (usa estos datos para responder especificaciones; si piden precio o cotización, NO lo des, usa [SHOW_WA]):\n\n${productKb}`
    : null

  type SystemBlock = { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }
  const system: SystemBlock[] = [
    { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
  ]
  if (kbBlock) {
    system.push({ type: 'text', text: kbBlock, cache_control: { type: 'ephemeral' } })
  }
  system.push({ type: 'text', text: langLine })

  const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system,
      messages,
    }),
  })

  if (!apiResponse.ok) {
    const detail = await apiResponse.text()
    const status = apiResponse.status >= 500 ? 502 : apiResponse.status
    return NextResponse.json(
      { error: `Anthropic API error (${apiResponse.status})`, detail },
      { status }
    )
  }

  const data = await apiResponse.json()
  const textBlock = Array.isArray(data?.content)
    ? data.content.find((b: { type?: string }) => b?.type === 'text')
    : null
  const text =
    typeof textBlock?.text === 'string' ? textBlock.text : ''

  return NextResponse.json({ message: text })
}
