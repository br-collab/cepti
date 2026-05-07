import type { Locale } from '@/app/[lang]/dictionaries'

export type CalcProduct = {
  slug: string
  name: string
  coverage: number
  unitLabel: string
  whatsappTemplate: string
  catalogCodes: string[]
}

export type SurfaceType = 'lisa' | 'rugosa' | 'porosa'

export const SURFACE_FACTOR: Record<SurfaceType, number> = {
  lisa: 1.0,
  rugosa: 1.2,
  porosa: 1.3,
}

export const WASTE_BUFFER = 1.1

export const WASTE_LABEL: Record<Locale, string> = {
  es: 'Incluye 10% de margen para desperdicio',
  en: 'Includes a 10% waste buffer',
}

export function parseNumber(input: string): number {
  if (!input) return 0
  const n = parseFloat(input.replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function areaFromDimensions(width: string, height: string): number {
  return parseNumber(width) * parseNumber(height)
}

export function calcQuantity(
  m2: number,
  coverage: number,
  options?: { coats?: number; surface?: SurfaceType }
): number {
  if (!m2 || m2 <= 0 || !coverage || coverage <= 0) return 0
  const coats = options?.coats ?? 1
  const surface = options?.surface ?? 'lisa'
  const adjusted = m2 * coats * SURFACE_FACTOR[surface]
  return Math.ceil((adjusted / coverage) * WASTE_BUFFER)
}

export function formatM2(m2: number): string {
  if (!m2) return '0'
  const rounded = Math.round(m2 * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2)
}

const PLURAL_ES: Record<string, string> = { 'galón': 'galones' }
const PLURAL_EN: Record<string, string> = { gallon: 'gallons' }

export function pluralizeUnit(unit: string, count: number, lang: Locale): string {
  if (count <= 1) return unit
  const map = lang === 'es' ? PLURAL_ES : PLURAL_EN
  if (map[unit]) return map[unit]
  if (unit.endsWith('²') || unit === 'kg' || unit === 'm²') return unit
  return unit + 's'
}

export function buildWhatsAppHref(params: {
  template: string
  code: string | null
  m2: string
  whatsappNumber: string
}): string {
  const text = params.template
    .replace(/\{code\}/g, params.code ?? '')
    .replace(/\{m2\}/g, params.m2 ?? '')
    .replace(/\{[a-zA-Z]+\}/g, '')
  const digits = params.whatsappNumber.replace(/[^\d]/g, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}
