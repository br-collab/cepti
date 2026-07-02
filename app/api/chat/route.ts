import { NextRequest, NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server'

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

/**
 * Official CEPTI price list — the same list the shared advisor brain quotes from
 * (prompts/advisor/pricing.md). Loaded once and cached in module scope. If the
 * file is missing, the chatbot falls back to not quoting rather than failing.
 */
let cachedPricing: string | null = null
function loadPricing(): string {
  if (cachedPricing !== null) return cachedPricing
  try {
    cachedPricing = fs.readFileSync(path.join(process.cwd(), 'prompts/advisor/pricing.md'), 'utf-8')
  } catch (e) {
    console.error('chat: pricing list not found, continuing without it:', e)
    cachedPricing = ''
  }
  return cachedPricing
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

All products are 100% ecological, mold/fungus resistant, withstand tropical climate, and last up to 10 years. Installation by CEPTI experts comes with at least a 5-year warranty. Products are for walls, ceilings, and surfaces — NOT floors or stairs.

Rules:
- Keep responses short and conversational — 2 to 4 sentences max. No long lists, no walls of text.
- Recommend exactly ONE product per turn unless the user explicitly asks to compare.
- You SHOULD answer pricing questions and quote — but ONLY from the official price list provided in this system prompt. Never invent, negotiate, or discount a price. If a price cannot be derived from the list, say so plainly and offer to continue on WhatsApp.
- Quote flow: ask WHERE they'll apply it and HOW MANY m² the project is. For paints (Aterciopelada, Efecto Piedra, Efecto Granito, Granito Líquido) also ask if the surface is lisa (smooth) or rugosa (rough) and 1 or 2 manos (coats). For Papelex/Ladriflex ask whether it's interior (980 DOP/m²) or exterior (1080 DOP/m²). Give the per-m² price, and if you have the m², also give the total (rate × m², rounded to the nearest peso).
- Match the recommended product to the user's described surface or project (interior wall, facade, column, furniture, etc.). Products are for walls/ceilings/surfaces, not floors or stairs.
- Append the literal tag [SHOW_WA] at the end of your message (case-sensitive, exact characters, no extra punctuation around it) whenever you give a price/quote OR the customer signals readiness to buy or order — so the "Chat on WhatsApp" button appears to close the sale.
- If you cannot answer something with confidence (specific catalog code, exact dimensions, technical spec not in the KB), say so plainly and suggest they continue via WhatsApp — that's a [SHOW_WA] moment.`

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not configured on the server' },
      { status: 500 }
    )
  }

  let body: { messages?: ChatMessage[]; lang?: 'es' | 'en'; conversationId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const messages = body.messages
  const lang = body.lang === 'en' ? 'en' : 'es'
  const conversationId =
    typeof body.conversationId === 'string' && body.conversationId
      ? body.conversationId
      : crypto.randomUUID()

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
  // Spanish; answer in the requested language regardless. Use it to answer
  // specifications; quote from the official price list block below.
  const productKb = loadProductKb()
  const kbBlock = productKb
    ? `REFERENCIA — fichas técnicas de producto (usa estos datos para responder especificaciones; cotiza con la lista de precios oficial y usa [SHOW_WA] al cotizar o cuando el cliente quiera comprar):\n\n${productKb}`
    : null

  // Official price list (shared with the advisor brain). Quote SOLELY from this.
  const pricing = loadPricing()
  const pricingBlock = pricing
    ? `LISTA DE PRECIOS OFICIAL — cotiza SOLO con estos datos, nunca inventes/negocies:\n\n${pricing}`
    : null

  type SystemBlock = { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }
  const system: SystemBlock[] = [
    { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
  ]
  if (kbBlock) {
    system.push({ type: 'text', text: kbBlock, cache_control: { type: 'ephemeral' } })
  }
  if (pricingBlock) {
    system.push({ type: 'text', text: pricingBlock, cache_control: { type: 'ephemeral' } })
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

  // Best-effort persistence for the admin Web Chat view. Never break the reply:
  // any DB failure is swallowed with a console.error, exactly like
  // logAdvisorUsage in advisor-core.ts. Only the newest user message and this
  // reply are written — never the whole history. The stored assistant text is
  // the raw model text WITHOUT the [SHOW_WA] tag.
  try {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')
    const assistantText = text.replace('[SHOW_WA]', '').trim()
    const supabase = getSupabaseServiceRoleClient()
    const nowIso = new Date().toISOString()

    const { data: existing } = await supabase
      .from('sma_web_chat_conversations')
      .select('conversation_id, message_count')
      .eq('conversation_id', conversationId)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('sma_web_chat_conversations')
        .update({
          last_message_at: nowIso,
          message_count: (existing.message_count ?? 0) + 2,
          lang,
        })
        .eq('conversation_id', conversationId)
    } else {
      await supabase.from('sma_web_chat_conversations').insert({
        conversation_id: conversationId,
        lang,
        first_message_at: nowIso,
        last_message_at: nowIso,
        message_count: 2,
      })
    }

    const rows: { conversation_id: string; role: 'user' | 'assistant'; content: string }[] = []
    if (lastUser) {
      rows.push({ conversation_id: conversationId, role: 'user', content: lastUser.content })
    }
    if (assistantText) {
      rows.push({ conversation_id: conversationId, role: 'assistant', content: assistantText })
    }
    if (rows.length > 0) {
      await supabase.from('sma_web_chat_messages').insert(rows)
    }
  } catch (e) {
    console.error('chat: web-chat persistence failed (non-fatal):', e)
  }

  return NextResponse.json({ message: text, conversationId })
}
