'use client'

import { useState } from 'react'
import type { Locale } from '@/app/[lang]/dictionaries'
import WhatsAppIcon from '@/components/icons/WhatsAppIcon'
import {
  type CalcProduct,
  WASTE_LABEL,
  calcQuantity,
  formatM2,
  formatQuantity,
  parseNumber,
} from '@/lib/calculator'
import {
  lookupRate,
  productCoats,
  productSurfaces,
} from '@/lib/calculator/rates'

type CalculatorDict = {
  heading: string
  area: string
  m2Short: string
  resultLead: string
  resultFor: string
  resultOf: string
  cta: string
  placeholderCode: string
  enterValues: string
  surface: string
  smooth: string
  rough: string
  coats: string
  subProduct: string
}

type SubProductOption = { label: string; productId: string }

export default function CalculatorMini({
  product,
  selectedCode,
  whatsappNumber,
  lang,
  dict,
  showSubSelector = false,
  subProducts,
}: {
  product: CalcProduct
  selectedCode: string | null
  whatsappNumber: string
  lang: Locale
  dict: CalculatorDict
  showSubSelector?: boolean
  subProducts?: SubProductOption[]
}) {
  const [area, setArea] = useState('')
  const [activeProductId, setActiveProductId] = useState(product.slug)
  const [surface, setSurface] = useState<'smooth' | 'rough'>('smooth')
  const [coats, setCoats] = useState<1 | 2>(1)

  const m2 = parseNumber(area)

  // Surfaces/coats available for this product per the spec. Surface 'na'
  // hides the surface dropdown; single-coat products hide the coats dropdown.
  // The effective value is clamped to what's available so changing
  // sub-product never needs a state-resetting effect.
  const availableSurfaces = productSurfaces(activeProductId)
  const availableCoats = productCoats(activeProductId)
  const showSurface = !availableSurfaces.includes('na')
  const showCoats = availableCoats.length > 1
  const showSubProductSelector =
    showSubSelector && !!subProducts && subProducts.length > 1

  const effectiveSurface = showSurface
    ? availableSurfaces.includes(surface)
      ? surface
      : (availableSurfaces[0] as 'smooth' | 'rough')
    : 'na'
  const effectiveCoats = availableCoats.includes(coats)
    ? coats
    : availableCoats[0]

  const rate = lookupRate(activeProductId, effectiveSurface, effectiveCoats)
  const quantity = calcQuantity(
    m2,
    activeProductId,
    effectiveSurface,
    effectiveCoats
  )
  const hasResult = m2 > 0 && quantity > 0
  const quantityText = `${formatQuantity(quantity)} ${rate.displayNoun[lang]}`

  // Product name for the result + WhatsApp message: when a sub-product is
  // active that differs from the page's product, use the sub-option label.
  const activeProductName =
    showSubProductSelector
      ? subProducts!.find((p) => p.productId === activeProductId)?.label ??
        product.name
      : product.name

  // WhatsApp message — same shape as the full Calculadora.
  const surfaceWord =
    effectiveSurface === 'na'
      ? ''
      : lang === 'es'
        ? effectiveSurface === 'smooth'
          ? 'lisa'
          : 'rugosa'
        : effectiveSurface === 'smooth'
          ? 'smooth'
          : 'rough'
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
        ? ` (${coatsWord}, superficie ${surfaceWord})`
        : ` (${coatsWord}, ${surfaceWord} surface)`
  const waMessage =
    lang === 'es'
      ? `Hola CEPTI, me interesa: ${activeProductName}. Superficie total: ${formatM2(m2)} m²${waContext}. Cantidad estimada: ${quantityText} (incluye 10% de margen). ¿Me pueden dar una cotización?`
      : `Hi CEPTI, I'm interested in: ${activeProductName}. Total surface: ${formatM2(m2)} m²${waContext}. Estimated quantity: ${quantityText} (includes 10% buffer). Can you send me a quote?`
  const waHref = hasResult
    ? `https://wa.me/${whatsappNumber.replace(/[^\d]/g, '')}?text=${encodeURIComponent(waMessage)}`
    : '#'

  const inputBase =
    'w-full rounded-lg border border-stone-200 bg-white px-4 py-3 text-base text-stone-900 placeholder:text-stone-400 focus:border-cepti-red focus:outline-none focus:ring-2 focus:ring-cepti-red/20'

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-5 sm:p-7 max-w-2xl mx-auto">
      <h3 className="text-xl sm:text-2xl font-bold text-stone-900 mb-4">
        {dict.heading}
      </h3>

      {showSubProductSelector && (
        <label className="block mb-4">
          <span className="block text-sm font-semibold text-stone-700 mb-2">
            {dict.subProduct}
          </span>
          <select
            value={activeProductId}
            onChange={(e) => setActiveProductId(e.target.value)}
            className={inputBase}
          >
            {subProducts!.map((p) => (
              <option key={p.productId} value={p.productId}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="block mb-4">
        <span className="block text-sm font-semibold text-stone-700 mb-2">
          {dict.area}{' '}
          <span className="text-stone-400 font-normal">({dict.m2Short})</span>
        </span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={area}
          onChange={(e) => setArea(e.target.value)}
          placeholder="0.00"
          className={inputBase}
        />
      </label>

      {(showSurface || showCoats) && (
        <div
          className={
            showSurface && showCoats
              ? 'grid grid-cols-2 gap-3 sm:gap-4 mb-4'
              : 'mb-4'
          }
        >
          {showSurface && (
            <label className="block">
              <span className="block text-sm font-semibold text-stone-700 mb-2">
                {dict.surface}
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
                      {s === 'smooth' ? dict.smooth : dict.rough}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {showCoats && (
            <label className="block">
              <span className="block text-sm font-semibold text-stone-700 mb-2">
                {dict.coats}
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
        </div>
      )}

      <div
        className={`rounded-xl p-4 mb-4 border ${
          hasResult
            ? 'bg-cepti-red/5 border-cepti-red/20'
            : 'bg-stone-50 border-stone-100'
        }`}
        aria-live="polite"
      >
        {hasResult ? (
          <>
            <p className="text-base sm:text-lg text-stone-800 leading-relaxed">
              {dict.resultLead}{' '}
              <span className="font-bold text-cepti-red text-xl sm:text-2xl">
                {quantityText}
              </span>{' '}
              {dict.resultOf}{' '}
              <span className="font-semibold">{activeProductName}</span>{' '}
              {dict.resultFor}{' '}
              <span className="font-semibold">
                {formatM2(m2)} {dict.m2Short}
              </span>
              .
            </p>
            <p className="mt-2 text-xs text-stone-500">{WASTE_LABEL[lang]}</p>
          </>
        ) : (
          <p className="text-sm text-stone-500">{dict.enterValues}</p>
        )}
      </div>

      <a
        href={hasResult ? waHref : '#'}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={!hasResult}
        onClick={(e) => {
          if (!hasResult) e.preventDefault()
        }}
        className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3.5 text-base font-semibold transition-colors ${
          hasResult
            ? 'bg-cepti-red text-white hover:bg-cepti-red-dark shadow-md shadow-cepti-red/20'
            : 'bg-stone-200 text-stone-400 cursor-not-allowed'
        }`}
      >
        <WhatsAppIcon size={20} className="w-5 h-5" />
        {dict.cta}
        {hasResult && selectedCode && (
          <span className="ml-1 text-sm bg-white/15 rounded px-2 py-0.5">
            {selectedCode}
          </span>
        )}
      </a>
    </div>
  )
}
