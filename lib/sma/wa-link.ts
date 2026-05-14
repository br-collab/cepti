import { brand } from '@/lib/products'

export type WaRefPlatform = 'ig' | 'fb' | 'th'

export type WaLinkInput = {
  message: string
  ref?: {
    platform: WaRefPlatform
    kind: 'post' | 'comment' | 'reply' | 'bio'
    id: string
  }
}

export function buildWaLink({ message, ref }: WaLinkInput): string {
  const number = brand.whatsapp_number.replace(/\D/g, '')
  const refTag = ref ? ` [ref:${ref.platform}-${ref.kind}-${ref.id}]` : ''
  const text = encodeURIComponent(`${message}${refTag}`)
  return `https://wa.me/${number}?text=${text}`
}

const REF_RE = /\[ref:(ig|fb|th)-(post|comment|reply|bio)-([^\]\s]+)\]/

export function parseWaRef(text: string): WaLinkInput['ref'] | null {
  const m = text.match(REF_RE)
  if (!m) return null
  return { platform: m[1] as WaRefPlatform, kind: m[2] as 'post' | 'comment' | 'reply' | 'bio', id: m[3] }
}
