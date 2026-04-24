'use client'

import { useMemo, useState } from 'react'
import type { Locale } from '@/app/[lang]/dictionaries'
import { calcQuantity, formatM2, parseNumber, pluralizeUnit } from '@/lib/calculator'

export type CalcProductOption = {
  slug: string
  name: string
  coverage: number
  unitLabel: string
}

type Dict = {
  selectProduct: string
  addSurface: string
  width: string
  height: string
  total: string
  requestQuote: string
  estimatedQty: string
  m2Short: string
}

type Surface = { width: string; height: string }

export default function MultiSurfaceCalculator({
  products,
  whatsappNumber,
  lang,
  dict,
}: {
  products: CalcProductOption[]
  whatsappNumber: string
  lang: Locale
  dict: Dict
}) {
  const [slug, setSlug] = useState(products[0]?.slug ?? '')
  const [surfaces, setSurfaces] = useState<Surface[]>([{ width: '', height: '' }])

  const product = useMemo(
    () => products.find((p) => p.slug === slug) ?? products[0],
    [products, slug]
  )

  const totalM2 = useMemo(
    () =>
      surfaces.reduce(
        (sum, s) => sum + parseNumber(s.width) * parseNumber(s.height),
        0
      ),
    [surfaces]
  )

  const quantity = product ? calcQuantity(totalM2, product.coverage) : 0
  const hasResult = !!product && totalM2 > 0 && quantity > 0
  const unitPlural = product ? pluralizeUnit(product.unitLabel, quantity, lang) : ''

  const waHref = useMemo(() => {
    if (!product) return '#'
    const message =
      lang === 'es'
        ? `Hola CEPTI, me interesa: ${product.name}. Superficie total: ${formatM2(totalM2)} m². Cantidad estimada: ${quantity} ${unitPlural}. ¿Me pueden dar una cotización?`
        : `Hi CEPTI, I'm interested in: ${product.name}. Total surface: ${formatM2(totalM2)} m². Estimated quantity: ${quantity} ${unitPlural}. Can you send me a quote?`
    const digits = whatsappNumber.replace(/[^\d]/g, '')
    return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
  }, [product, totalM2, quantity, unitPlural, whatsappNumber, lang])

  const updateSurface = (i: number, patch: Partial<Surface>) =>
    setSurfaces((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s))
    )

  const addSurface = () =>
    setSurfaces((prev) => [...prev, { width: '', height: '' }])

  const removeSurface = (i: number) =>
    setSurfaces((prev) =>
      prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev
    )

  const inputBase =
    'w-full rounded-lg border border-stone-200 bg-white px-4 py-3 text-base text-stone-900 placeholder:text-stone-400 focus:border-cepti-red focus:outline-none focus:ring-2 focus:ring-cepti-red/20'

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-5 sm:p-8 space-y-6">
      <label className="block">
        <span className="block text-sm font-semibold text-stone-700 mb-2">
          {dict.selectProduct}
        </span>
        <select
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className={
            inputBase +
            " appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 viewBox=%220 0 16 16%22 fill=%22none%22 stroke=%22%23666%22 stroke-width=%222%22><path d=%22M4 6l4 4 4-4%22/></svg>')] bg-no-repeat bg-[right_12px_center] pr-10"
          }
        >
          {products.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-4">
        {surfaces.map((s, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end"
          >
            <label className="block">
              <span className="block text-sm font-semibold text-stone-700 mb-2">
                {dict.width} <span className="text-stone-400 font-normal">(m)</span>
              </span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={s.width}
                onChange={(e) => updateSurface(i, { width: e.target.value })}
                placeholder="0.00"
                className={inputBase}
              />
            </label>
            <label className="block">
              <span className="block text-sm font-semibold text-stone-700 mb-2">
                {dict.height} <span className="text-stone-400 font-normal">(m)</span>
              </span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={s.height}
                onChange={(e) => updateSurface(i, { height: e.target.value })}
                placeholder="0.00"
                className={inputBase}
              />
            </label>
            <button
              type="button"
              onClick={() => removeSurface(i)}
              disabled={surfaces.length <= 1}
              aria-label={lang === 'es' ? 'Eliminar superficie' : 'Remove surface'}
              className="h-[50px] w-[50px] flex items-center justify-center rounded-lg border border-stone-200 text-stone-400 hover:text-cepti-red hover:border-cepti-red disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <span aria-hidden className="text-lg leading-none">×</span>
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={addSurface}
          className="inline-flex items-center gap-2 rounded-lg border border-stone-300 px-4 py-2.5 text-sm sm:text-base font-semibold text-stone-700 hover:bg-stone-50 hover:border-stone-400 transition-colors"
          style={{ borderColor: '#7a6350', color: '#7a6350' }}
        >
          <span aria-hidden className="text-lg leading-none">+</span>
          {dict.addSurface}
        </button>
      </div>

      <div
        className="rounded-xl p-5 sm:p-6 border"
        style={{ backgroundColor: 'rgba(122, 99, 80, 0.08)', borderColor: 'rgba(122, 99, 80, 0.25)' }}
        aria-live="polite"
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-stone-500 mb-1">
          {dict.total}
        </p>
        <p className="text-3xl sm:text-4xl font-bold" style={{ color: '#7a6350' }}>
          {formatM2(totalM2)} {dict.m2Short}
        </p>
        {hasResult && product ? (
          <p className="mt-3 text-sm sm:text-base text-stone-700">
            {dict.estimatedQty}:{' '}
            <span className="font-bold text-stone-900">
              {quantity} {unitPlural}
            </span>{' '}
            <span className="text-stone-500">— {product.name}</span>
          </p>
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
        <span aria-hidden className="text-xl">💬</span>
        {dict.requestQuote}
      </a>
    </div>
  )
}
