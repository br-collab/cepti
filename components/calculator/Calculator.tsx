'use client'

import { useMemo, useState } from 'react'
import type { Locale } from '@/app/[lang]/dictionaries'
import {
  type CalcProduct,
  areaFromDimensions,
  buildWhatsAppHref,
  calcQuantity,
  formatM2,
  parseNumber,
  pluralizeUnit,
} from '@/lib/calculator'

type CalculatorDict = {
  heading: string
  modeDimensions: string
  modeArea: string
  product: string
  selectProduct: string
  width: string
  height: string
  area: string
  meters: string
  m2Short: string
  resultLead: string
  resultFor: string
  resultOf: string
  cta: string
  placeholderCode: string
  enterValues: string
}

type Mode = 'dimensions' | 'area'

export default function Calculator({
  products,
  whatsappNumber,
  lang,
  dict,
  initialSlug,
  variant = 'full',
}: {
  products: CalcProduct[]
  whatsappNumber: string
  lang: Locale
  dict: CalculatorDict
  initialSlug?: string
  variant?: 'full' | 'mini'
  lockedProduct?: CalcProduct
}) {
  const [mode, setMode] = useState<Mode>('dimensions')
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [area, setArea] = useState('')
  const [slug, setSlug] = useState<string>(initialSlug ?? products[0]?.slug ?? '')

  const product = useMemo(
    () => products.find((p) => p.slug === slug) ?? products[0],
    [products, slug]
  )

  const m2 = mode === 'dimensions' ? areaFromDimensions(width, height) : parseNumber(area)
  const quantity = product ? calcQuantity(m2, product.coverage) : 0
  const hasResult = m2 > 0 && quantity > 0 && !!product
  const unitPlural = product ? pluralizeUnit(product.unitLabel, quantity, lang) : ''

  const waHref = useMemo(() => {
    if (!product || !hasResult) return '#'
    return buildWhatsAppHref({
      template: product.whatsappTemplate,
      code: dict.placeholderCode,
      m2: formatM2(m2),
      whatsappNumber,
    })
  }, [product, hasResult, dict.placeholderCode, m2, whatsappNumber])

  const inputBase =
    'w-full rounded-lg border border-stone-200 bg-white px-4 py-3 text-base text-stone-900 placeholder:text-stone-400 focus:border-cepti-red focus:outline-none focus:ring-2 focus:ring-cepti-red/20'

  return (
    <div
      className={
        variant === 'full'
          ? 'bg-white rounded-2xl shadow-sm border border-stone-100 p-5 sm:p-8'
          : 'bg-white rounded-2xl shadow-sm border border-stone-100 p-5 sm:p-6'
      }
    >
      <h3 className="text-xl sm:text-2xl font-bold text-stone-900 mb-5">
        {dict.heading}
      </h3>

      {/* Product selector (full variant only) */}
      {variant === 'full' && (
        <label className="block mb-5">
          <span className="block text-sm font-semibold text-stone-700 mb-2">
            {dict.product}
          </span>
          <select
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className={inputBase + ' appearance-none bg-[url(\'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 viewBox=%220 0 16 16%22 fill=%22none%22 stroke=%22%23666%22 stroke-width=%222%22><path d=%22M4 6l4 4 4-4%22/></svg>\')] bg-no-repeat bg-[right_12px_center] pr-10'}
          >
            {products.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {/* Mode toggle */}
      <div className="inline-flex items-center rounded-lg bg-stone-100 p-1 mb-5">
        <button
          type="button"
          onClick={() => setMode('dimensions')}
          className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
            mode === 'dimensions'
              ? 'bg-white text-stone-900 shadow-sm'
              : 'text-stone-500 hover:text-stone-800'
          }`}
          aria-pressed={mode === 'dimensions'}
        >
          {dict.modeDimensions}
        </button>
        <button
          type="button"
          onClick={() => setMode('area')}
          className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
            mode === 'area'
              ? 'bg-white text-stone-900 shadow-sm'
              : 'text-stone-500 hover:text-stone-800'
          }`}
          aria-pressed={mode === 'area'}
        >
          {dict.modeArea}
        </button>
      </div>

      {/* Inputs */}
      {mode === 'dimensions' ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-5">
          <label className="block">
            <span className="block text-sm font-semibold text-stone-700 mb-2">
              {dict.width} <span className="text-stone-400 font-normal">({dict.meters})</span>
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
            <span className="block text-sm font-semibold text-stone-700 mb-2">
              {dict.height} <span className="text-stone-400 font-normal">({dict.meters})</span>
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
      ) : (
        <label className="block mb-5">
          <span className="block text-sm font-semibold text-stone-700 mb-2">
            {dict.area} <span className="text-stone-400 font-normal">({dict.m2Short})</span>
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
      )}

      {/* Result */}
      <div
        className={`rounded-xl p-4 sm:p-5 mb-5 border ${
          hasResult
            ? 'bg-cepti-red/5 border-cepti-red/20'
            : 'bg-stone-50 border-stone-100'
        }`}
        aria-live="polite"
      >
        {hasResult && product ? (
          <p className="text-base sm:text-lg text-stone-800 leading-relaxed">
            {dict.resultLead}{' '}
            <span className="font-bold text-cepti-red text-xl sm:text-2xl">
              {quantity} {unitPlural}
            </span>{' '}
            {dict.resultOf} <span className="font-semibold">{product.name}</span>{' '}
            {dict.resultFor}{' '}
            <span className="font-semibold">{formatM2(m2)} {dict.m2Short}</span>.
          </p>
        ) : (
          <p className="text-sm sm:text-base text-stone-500">{dict.enterValues}</p>
        )}
      </div>

      {/* WhatsApp CTA */}
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
        <span aria-hidden>💬</span>
        {dict.cta}
      </a>
    </div>
  )
}
