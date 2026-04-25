import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  const key = process.env.ANTHROPIC_API_KEY
  const hasKey = typeof key === 'string' && key.trim().length > 0
  return NextResponse.json({ ok: true, hasKey })
}
