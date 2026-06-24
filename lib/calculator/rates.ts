/**
 * Canonical material consumption rates for the CEPTI calculator.
 *
 * Source of truth: Material_Consumption_Calculator.xlsx — Francisco Valdez,
 * 2026-05-14 (committed under docs/sma/inputs/). These values replace the
 * made-up per-product coverage numbers and the SURFACE_FACTOR multiplier
 * that the calculator used before.
 *
 * Consumption is a direct table lookup on (productId, surface, coats).
 * Coats are part of the key, not a linear multiplier — 1 coat vs 2 coats
 * have independent rates in the spec.
 */

export type Surface = 'smooth' | 'rough' | 'na'
export type RateUnit = 'kg/m²' | 'L/m²' | 'sheets/m²' | 'pieces/m²'

export type CalculatorRate = {
  productId: string
  surface: Surface
  coats: 1 | 2
  unit: RateUnit
  /** Consumption per m² in `unit`. */
  rate: number
  /** Plural noun shown next to the computed quantity in the UI. */
  displayNoun: { es: string; en: string }
}

/**
 * A calculator product option. The calculator's product list is not 1:1 with
 * the catalog (data/products.json): "Pintura con Efecto Granito y Granito
 * Líquido" is one catalog entry but three calculator options, and catalog
 * entries with no spec rate (e.g. Arte con Arena) are absent here.
 */
export type CalculatorProduct = {
  productId: string
  name: { es: string; en: string }
}

/** Display noun is derived from the rate unit so it stays consistent. */
const DISPLAY_NOUN: Record<RateUnit, { es: string; en: string }> = {
  'kg/m²': { es: 'kg', en: 'kg' },
  'L/m²': { es: 'litros', en: 'liters' },
  'sheets/m²': { es: 'hojas', en: 'sheets' },
  'pieces/m²': { es: 'piezas', en: 'pieces' },
}

// [productId, surface, coats, unit, rate] — mirrors Francisco's spec table row-for-row.
type RateSpec = [string, Surface, 1 | 2, RateUnit, number]

const RATE_SPECS: RateSpec[] = [
  ['pintura-aterciopelada', 'smooth', 1, 'kg/m²', 0.45],
  ['pintura-aterciopelada', 'smooth', 2, 'kg/m²', 0.75],
  ['pintura-aterciopelada', 'rough', 1, 'kg/m²', 0.5],
  ['pintura-aterciopelada', 'rough', 2, 'kg/m²', 0.85],
  ['pintura-de-piedra', 'smooth', 1, 'kg/m²', 1.6],
  ['pintura-de-piedra', 'smooth', 2, 'kg/m²', 2.1],
  ['pintura-de-piedra', 'rough', 1, 'kg/m²', 1.8],
  ['pintura-de-piedra', 'rough', 2, 'kg/m²', 2.4],
  ['pintura-efecto-granito', 'smooth', 1, 'kg/m²', 1.7],
  ['pintura-efecto-granito', 'smooth', 2, 'kg/m²', 2.2],
  ['pintura-efecto-granito', 'rough', 1, 'kg/m²', 1.9],
  ['pintura-efecto-granito', 'rough', 2, 'kg/m²', 2.5],
  ['granito-liquido-estandar', 'smooth', 1, 'L/m²', 0.2],
  ['granito-liquido-estandar', 'rough', 1, 'L/m²', 0.3],
  ['granito-liquido-intensivo', 'smooth', 1, 'L/m²', 0.3],
  ['granito-liquido-intensivo', 'rough', 1, 'L/m²', 0.4],
  ['pegamento', 'smooth', 1, 'L/m²', 3.5],
  ['pegamento', 'rough', 1, 'L/m²', 4.1],
  ['primer', 'smooth', 1, 'L/m²', 0.15],
  ['primer', 'rough', 1, 'L/m²', 0.2],
  ['papelex', 'na', 1, 'sheets/m²', 1.56],
  ['ladriflex', 'na', 1, 'pieces/m²', 50],
]

export const CALCULATOR_RATES: CalculatorRate[] = RATE_SPECS.map(
  ([productId, surface, coats, unit, rate]) => ({
    productId,
    surface,
    coats,
    unit,
    rate,
    displayNoun: DISPLAY_NOUN[unit],
  })
)

/**
 * Calculator dropdown options, in display order. Names for catalog-backed
 * products mirror data/products.json; the Granito Líquido variants are
 * calculator-only and have no catalog entry.
 */
export const CALCULATOR_PRODUCTS: CalculatorProduct[] = [
  {
    productId: 'papelex',
    name: { es: 'Piedra Flexible (Papelex)', en: 'Flexible Stone (Papelex)' },
  },
  {
    productId: 'ladriflex',
    name: { es: 'Ladrillo Flexible (Ladriflex)', en: 'Flexible Brick (Ladriflex)' },
  },
  {
    productId: 'pintura-de-piedra',
    name: { es: 'Pintura con Efecto Piedra', en: 'Stone Effect Paint' },
  },
  {
    productId: 'pintura-efecto-granito',
    name: { es: 'Pintura con Efecto Granito', en: 'Granite Effect Paint' },
  },
  {
    productId: 'granito-liquido-estandar',
    name: { es: 'Granito Líquido (Estándar)', en: 'Liquid Granite (Standard)' },
  },
  {
    productId: 'granito-liquido-intensivo',
    name: { es: 'Granito Líquido (Intensivo)', en: 'Liquid Granite (Intensive)' },
  },
  {
    productId: 'pintura-aterciopelada',
    name: { es: 'Pintura Aterciopelada', en: 'Velvet Paint' },
  },
  { productId: 'primer', name: { es: 'Primer', en: 'Primer' } },
  { productId: 'pegamento', name: { es: 'Pegamento', en: 'Adhesive' } },
]

/** All rate rows for a product, in table order. Empty if the product is unknown. */
export function getProductRates(productId: string): CalculatorRate[] {
  return CALCULATOR_RATES.filter((r) => r.productId === productId)
}

/** Distinct surfaces available for a product, in table order. */
export function productSurfaces(productId: string): Surface[] {
  return [...new Set(getProductRates(productId).map((r) => r.surface))]
}

/** Distinct coat counts available for a product, ascending. */
export function productCoats(productId: string): (1 | 2)[] {
  return [...new Set(getProductRates(productId).map((r) => r.coats))].sort()
}

/**
 * Exact rate lookup. Throws if no row matches — callers must pass a
 * (productId, surface, coats) combination that exists in the spec rather
 * than relying on a silent fallback.
 */
export function lookupRate(
  productId: string,
  surface: Surface,
  coats: 1 | 2
): CalculatorRate {
  const row = CALCULATOR_RATES.find(
    (r) => r.productId === productId && r.surface === surface && r.coats === coats
  )
  if (!row) {
    throw new Error(
      `No calculator rate for productId=${productId}, surface=${surface}, coats=${coats}`
    )
  }
  return row
}

/**
 * A sensible default rate row for contexts with no surface/coats selector
 * (e.g. the mini calculator on product pages): smooth + 1 coat when the
 * product supports it, otherwise the first available row. Throws if the
 * product has no rates at all.
 */
export function getDefaultRate(productId: string): CalculatorRate {
  const rows = getProductRates(productId)
  if (rows.length === 0) {
    throw new Error(`No calculator rates for productId=${productId}`)
  }
  return (
    rows.find((r) => r.surface === 'smooth' && r.coats === 1) ??
    rows.find((r) => r.coats === 1) ??
    rows[0]
  )
}
