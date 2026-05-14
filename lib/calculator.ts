import type { Locale } from '@/app/[lang]/dictionaries'
import { type Surface, lookupRate } from '@/lib/calculator/rates'

export type CalcProduct = {
  slug: string
  name: string
  whatsappTemplate: string
  catalogCodes: string[]
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

/**
 * Material quantity for an area: a direct rate lookup from Francisco's spec
 * (productId, surface, coats) times the area, plus a 10% waste buffer.
 * Returns the raw quantity — no rounding up. Throws via lookupRate if the
 * (productId, surface, coats) combination is not in the spec.
 */
export function calcQuantity(
  m2: number,
  productId: string,
  surface: Surface,
  coats: 1 | 2
): number {
  if (!m2 || m2 <= 0) return 0
  const { rate } = lookupRate(productId, surface, coats)
  return rate * m2 * WASTE_BUFFER
}

export function formatM2(m2: number): string {
  if (!m2) return '0'
  const rounded = Math.round(m2 * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2)
}

/**
 * Format a computed quantity for display: round to 2 decimals, then trim
 * trailing zeros. The waste buffer is already baked into the raw value;
 * this only controls how the final number reads. e.g. 5 -> "5",
 * 0.66 -> "0.66", 9.9 -> "9.9".
 */
export function formatQuantity(raw: number): string {
  return Number(raw.toFixed(2)).toString()
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
