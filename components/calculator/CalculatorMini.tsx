'use client'

import { useMemo, useState } from 'react'
import type { Locale } from '@/app/[lang]/dictionaries'
import WhatsAppIcon from '@/components/icons/WhatsAppIcon'
import {
  type CalcProduct,
  WASTE_LABEL,
  buildWhatsAppHref,
  calcQuantity,
  formatM2,
  formatQuantity,
  parseNumber,
} from '@/lib/calculator'
import { getDefaultRate } from '@/lib/calculator/rates'

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
}

export default function CalculatorMini({
  product,
  selectedCode,
  whatsappNumber,
  lang,
  dict,
}: {
  product: CalcProduct
  selectedCode: string | null
  whatsappNumber: string
  lang: Locale
  dict: CalculatorDict
}) {
  const [area, setArea] = useState('')
  const m2 = parseNumber(area)

  // No surface/coats selector here — use the product's default spec row.
  const rate = getDefaultRate(product.slug)
  const quantity = calcQuantity(m2, product.slug, rate.surface, rate.coats)
  const hasResult = m2 > 0 && quantity > 0
  const quantityText = `${formatQuantity(quantity)} ${rate.displayNoun[lang]}`

  const codeForMsg = selectedCode ?? dict.placeholderCode

  const waHref = useMemo(() => {
    if (!hasResult) return '#'
    return buildWhatsAppHref({
      template: product.whatsappTemplate,
      code: codeForMsg,
      m2: formatM2(m2),
      whatsappNumber,
    })
  }, [product.whatsappTemplate, codeForMsg, m2, whatsappNumber, hasResult])

  const inputBase =
    'w-full rounded-lg border border-stone-200 bg-white px-4 py-3 text-base text-stone-900 placeholder:text-stone-400 focus:border-cepti-red focus:outline-none focus:ring-2 focus:ring-cepti-red/20'

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-5 sm:p-7 max-w-2xl mx-auto">
      <h3 className="text-xl sm:text-2xl font-bold text-stone-900 mb-4">
        {dict.heading}
      </h3>

      <label className="block mb-4">
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

      <div
        className={`rounded-xl p-4 mb-4 border ${
          hasResult ? 'bg-cepti-red/5 border-cepti-red/20' : 'bg-stone-50 border-stone-100'
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
              {dict.resultOf} <span className="font-semibold">{product.name}</span>{' '}
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
          <span className="ml-1 text-sm bg-white/15 rounded px-2 py-0.5">{selectedCode}</span>
        )}
      </a>
    </div>
  )
}
