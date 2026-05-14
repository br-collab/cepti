'use client'

import { useMemo, useState } from 'react'
import type { Locale } from '@/app/[lang]/dictionaries'
import WhatsAppIcon from '@/components/icons/WhatsAppIcon'
import {
  WASTE_LABEL,
  calcQuantity,
  formatM2,
  formatQuantity,
  parseNumber,
} from '@/lib/calculator'
import {
  CALCULATOR_PRODUCTS,
  lookupRate,
  productCoats,
  productSurfaces,
} from '@/lib/calculator/rates'

type Dict = {
  selectProduct: string
  width: string
  height: string
  total: string
  requestQuote: string
  estimatedQty: string
  m2Short: string
}

const SURFACE_LABELS: Record<Locale, Record<'smooth' | 'rough', string>> = {
  es: { smooth: 'Lisa', rough: 'Rugosa' },
  en: { smooth: 'Smooth', rough: 'Rough' },
}

const COATS_LABEL: Record<Locale, string> = { es: 'Manos', en: 'Coats' }
const SURFACE_LABEL: Record<Locale, string> = {
  es: 'Tipo de superficie',
  en: 'Surface type',
}

export default function Calculadora({
  whatsappNumber,
  lang,
  dict,
}: {
  whatsappNumber: string
  lang: Locale
  dict: Dict
}) {
  const [productId, setProductId] = useState(CALCULATOR_PRODUCTS[0].productId)
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [coats, setCoats] = useState<1 | 2>(1)
  const [surface, setSurface] = useState<'smooth' | 'rough'>('smooth')

  const product = useMemo(
    () =>
      CALCULATOR_PRODUCTS.find((p) => p.productId === productId) ??
      CALCULATOR_PRODUCTS[0],
    [productId]
  )

  // Surfaces/coats available for this product per the spec. Some products
  // have a single option (e.g. surface 'na', or 1 coat only) — those selectors
  // are hidden and the effective value is derived, not stored, so changing
  // product never needs a state-resetting effect.
  const availableSurfaces = productSurfaces(productId)
  const availableCoats = productCoats(productId)
  const showSurface = !availableSurfaces.includes('na')
  const showCoats = availableCoats.length > 1

  const effectiveSurface = showSurface
    ? availableSurfaces.includes(surface)
      ? surface
      : (availableSurfaces[0] as 'smooth' | 'rough')
    : 'na'
  const effectiveCoats = availableCoats.includes(coats) ? coats : availableCoats[0]

  const rate = lookupRate(productId, effectiveSurface, effectiveCoats)
  const baseM2 = parseNumber(width) * parseNumber(height)
  const quantity = calcQuantity(baseM2, productId, effectiveSurface, effectiveCoats)
  const hasResult = baseM2 > 0 && quantity > 0
  const quantityText = `${formatQuantity(quantity)} ${rate.displayNoun[lang]}`

  // Plain derivations — React Compiler handles memoization. A manual useMemo
  // here trips preserve-manual-memoization because the deps are themselves
  // derived values.
  const coatsWord =
    lang === 'es'
      ? effectiveCoats === 1
        ? '1 mano'
        : `${effectiveCoats} manos`
      : effectiveCoats === 1
      ? '1 coat'
      : `${effectiveCoats} coats`
  const waContext =
    effectiveSurface === 'na'
      ? ''
      : lang === 'es'
      ? ` (${coatsWord}, superficie ${SURFACE_LABELS.es[effectiveSurface].toLowerCase()})`
      : ` (${coatsWord}, ${SURFACE_LABELS.en[effectiveSurface].toLowerCase()} surface)`
  const waMessage =
    lang === 'es'
      ? `Hola CEPTI, me interesa: ${product.name.es}. Superficie total: ${formatM2(baseM2)} m²${waContext}. Cantidad estimada: ${quantityText} (incluye 10% de margen). ¿Me pueden dar una cotización?`
      : `Hi CEPTI, I'm interested in: ${product.name.en}. Total surface: ${formatM2(baseM2)} m²${waContext}. Estimated quantity: ${quantityText} (includes 10% buffer). Can you send me a quote?`
  const waHref = `https://wa.me/${whatsappNumber.replace(
    /[^\d]/g,
    ''
  )}?text=${encodeURIComponent(waMessage)}`

  const inputBase =
    'w-full rounded-lg border border-stone-200 bg-white px-4 py-3 text-base text-stone-900 placeholder:text-stone-400 focus:border-cepti-brown focus:outline-none focus:ring-2 focus:ring-cepti-brown/20'

  return (
    <div className="bg-cepti-cream rounded-2xl shadow-sm border border-stone-200 p-5 sm:p-8 space-y-6">
      <label className="block">
        <span className="block text-sm font-semibold text-cepti-brown-dark mb-2">
          {dict.selectProduct}
        </span>
        <select
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          className={
            inputBase +
            " appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 viewBox=%220 0 16 16%22 fill=%22none%22 stroke=%22%237a6350%22 stroke-width=%222%22><path d=%22M4 6l4 4 4-4%22/></svg>')] bg-no-repeat bg-[right_12px_center] pr-10"
          }
        >
          {CALCULATOR_PRODUCTS.map((p) => (
            <option key={p.productId} value={p.productId}>
              {p.name[lang]}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <label className="block">
          <span className="block text-sm font-semibold text-cepti-brown-dark mb-2">
            {dict.width} <span className="text-stone-400 font-normal">(m)</span>
          </span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={width}
            onChange={(e) => setWidth(e.target.value)}
            placeholder="0.00"
            className={inputBase}
          />
        </label>
        <label className="block">
          <span className="block text-sm font-semibold text-cepti-brown-dark mb-2">
            {dict.height} <span className="text-stone-400 font-normal">(m)</span>
          </span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            placeholder="0.00"
            className={inputBase}
          />
        </label>
      </div>

      {(showCoats || showSurface) && (
        <div
          className={
            showCoats && showSurface ? 'grid grid-cols-2 gap-3 sm:gap-4' : ''
          }
        >
          {showCoats && (
            <label className="block">
              <span className="block text-sm font-semibold text-cepti-brown-dark mb-2">
                {COATS_LABEL[lang]}
              </span>
              <select
                value={effectiveCoats}
                onChange={(e) => setCoats(Number(e.target.value) as 1 | 2)}
                className={inputBase}
              >
                {availableCoats.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          )}
          {showSurface && (
            <label className="block">
              <span className="block text-sm font-semibold text-cepti-brown-dark mb-2">
                {SURFACE_LABEL[lang]}
              </span>
              <select
                value={effectiveSurface}
                onChange={(e) =>
                  setSurface(e.target.value as 'smooth' | 'rough')
                }
                className={inputBase}
              >
                {availableSurfaces
                  .filter((s): s is 'smooth' | 'rough' => s !== 'na')
                  .map((s) => (
                    <option key={s} value={s}>
                      {SURFACE_LABELS[lang][s]}
                    </option>
                  ))}
              </select>
            </label>
          )}
        </div>
      )}

      <div
        className="rounded-xl p-5 sm:p-6 border bg-cepti-brown/5 border-cepti-brown/25"
        aria-live="polite"
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-cepti-brown-dark mb-1">
          {dict.total}
        </p>
        <p className="text-3xl sm:text-4xl font-bold text-cepti-brown-dark">
          {formatM2(baseM2)} {dict.m2Short}
        </p>
        {hasResult ? (
          <>
            <p className="mt-3 text-sm sm:text-base text-stone-700">
              {dict.estimatedQty}:{' '}
              <span className="font-bold text-cepti-brown-dark">
                {quantityText}
              </span>{' '}
              <span className="text-stone-500">— {product.name[lang]}</span>
            </p>
            <p className="mt-1 text-xs text-stone-500">{WASTE_LABEL[lang]}</p>
          </>
        ) : null}
      </div>

      <a
        href={hasResult ? waHref : '#'}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={!hasResult}
        onClick={(e) => {
          if (!hasResult) e.preventDefault()
        }}
        className={`flex w-full items-center justify-center gap-2 rounded-xl px-6 py-4 text-base sm:text-lg font-semibold transition-colors ${
          hasResult
            ? 'bg-green-600 text-white hover:bg-green-700 shadow-md shadow-green-600/30'
            : 'bg-stone-200 text-stone-400 cursor-not-allowed'
        }`}
      >
        <WhatsAppIcon size={24} className="w-6 h-6" />
        {dict.requestQuote}
      </a>
    </div>
  )
}
