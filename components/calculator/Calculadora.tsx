'use client'

import { useMemo, useState } from 'react'
import type { Locale } from '@/app/[lang]/dictionaries'
import WhatsAppIcon from '@/components/icons/WhatsAppIcon'
import {
  type SurfaceType,
  WASTE_LABEL,
  calcQuantity,
  formatM2,
  parseNumber,
  pluralizeUnit,
} from '@/lib/calculator'

export type CalcProductOption = {
  slug: string
  name: string
  coverage: number
  unitLabel: string
}

type Dict = {
  selectProduct: string
  width: string
  height: string
  total: string
  requestQuote: string
  estimatedQty: string
  m2Short: string
}

const SURFACE_LABELS: Record<Locale, Record<SurfaceType, string>> = {
  es: { lisa: 'Lisa', rugosa: 'Rugosa', porosa: 'Porosa' },
  en: { lisa: 'Smooth', rugosa: 'Rough', porosa: 'Porous' },
}

const COATS_LABEL: Record<Locale, string> = { es: 'Manos', en: 'Coats' }
const SURFACE_LABEL: Record<Locale, string> = {
  es: 'Tipo de superficie',
  en: 'Surface type',
}

export default function Calculadora({
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
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [coats, setCoats] = useState(1)
  const [surface, setSurface] = useState<SurfaceType>('lisa')

  const product = useMemo(
    () => products.find((p) => p.slug === slug) ?? products[0],
    [products, slug]
  )

  const baseM2 = parseNumber(width) * parseNumber(height)
  const quantity = product
    ? calcQuantity(baseM2, product.coverage, { coats, surface })
    : 0
  const hasResult = !!product && baseM2 > 0 && quantity > 0
  const unitPlural = product
    ? pluralizeUnit(product.unitLabel, quantity, lang)
    : ''

  const waHref = useMemo(() => {
    if (!product) return '#'
    const surfaceText = SURFACE_LABELS[lang][surface]
    const coatsWord =
      lang === 'es'
        ? coats === 1
          ? '1 mano'
          : `${coats} manos`
        : coats === 1
        ? '1 coat'
        : `${coats} coats`
    const message =
      lang === 'es'
        ? `Hola CEPTI, me interesa: ${product.name}. Superficie total: ${formatM2(baseM2)} m² (${coatsWord}, superficie ${surfaceText.toLowerCase()}). Cantidad estimada: ${quantity} ${unitPlural} (incluye 10% de margen). ¿Me pueden dar una cotización?`
        : `Hi CEPTI, I'm interested in: ${product.name}. Total surface: ${formatM2(baseM2)} m² (${coatsWord}, ${surfaceText.toLowerCase()} surface). Estimated quantity: ${quantity} ${unitPlural} (includes 10% buffer). Can you send me a quote?`
    const digits = whatsappNumber.replace(/[^\d]/g, '')
    return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
  }, [product, baseM2, coats, surface, quantity, unitPlural, whatsappNumber, lang])

  const inputBase =
    'w-full rounded-lg border border-stone-200 bg-white px-4 py-3 text-base text-stone-900 placeholder:text-stone-400 focus:border-cepti-brown focus:outline-none focus:ring-2 focus:ring-cepti-brown/20'

  return (
    <div className="bg-cepti-cream rounded-2xl shadow-sm border border-stone-200 p-5 sm:p-8 space-y-6">
      <label className="block">
        <span className="block text-sm font-semibold text-cepti-brown-dark mb-2">
          {dict.selectProduct}
        </span>
        <select
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className={
            inputBase +
            " appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 viewBox=%220 0 16 16%22 fill=%22none%22 stroke=%22%237a6350%22 stroke-width=%222%22><path d=%22M4 6l4 4 4-4%22/></svg>')] bg-no-repeat bg-[right_12px_center] pr-10"
          }
        >
          {products.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name}
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

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <label className="block">
          <span className="block text-sm font-semibold text-cepti-brown-dark mb-2">
            {COATS_LABEL[lang]}
          </span>
          <select
            value={coats}
            onChange={(e) => setCoats(Number(e.target.value))}
            className={inputBase}
          >
            {[1, 2, 3].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-sm font-semibold text-cepti-brown-dark mb-2">
            {SURFACE_LABEL[lang]}
          </span>
          <select
            value={surface}
            onChange={(e) => setSurface(e.target.value as SurfaceType)}
            className={inputBase}
          >
            <option value="lisa">{SURFACE_LABELS[lang].lisa}</option>
            <option value="rugosa">{SURFACE_LABELS[lang].rugosa}</option>
            <option value="porosa">{SURFACE_LABELS[lang].porosa}</option>
          </select>
        </label>
      </div>

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
        {hasResult && product ? (
          <>
            <p className="mt-3 text-sm sm:text-base text-stone-700">
              {dict.estimatedQty}:{' '}
              <span className="font-bold text-cepti-brown-dark">
                {quantity} {unitPlural}
              </span>{' '}
              <span className="text-stone-500">— {product.name}</span>
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
