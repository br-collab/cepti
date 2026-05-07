'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { Locale } from '@/app/[lang]/dictionaries'
import type { CalcProduct } from '@/lib/calculator'
import CalculatorMini from '@/components/calculator/CalculatorMini'
import WhatsAppIcon from '@/components/icons/WhatsAppIcon'
import TextureVisualizer from './TextureVisualizer'
import Lightbox from './Lightbox'

type ProductDict = {
  requestQuote: string
  selectColor: string
  properties: string
  useCases: string
  palette: string
  gallery: string
  videos: string
  viewMore: string
  ctaBand: string
  whatsappBtn: string
  backToProducts: string
}

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

type VisualizerDict = {
  title: string
  sub: string
  hint: string
  selected: string
}

type VisualizerConfig = {
  referenceSrc: string
  wallInset: { top: string; bottom: string; left: string; right: string }
}

type Props = {
  lang: Locale
  slug: string
  name: string
  tagline: string
  description: string
  properties: string[]
  useCases: string[]
  textures: { code: string; src: string }[]
  heroSrc: string | null
  projectImages: string[]
  whatsappTemplate: string
  whatsappNumber: string
  dict: ProductDict
  calcProduct: CalcProduct
  calculatorDict: CalculatorDict
  visualizerDict: VisualizerDict
  visualizer: VisualizerConfig | null
  videos: string[]
  showCalculator?: boolean
  galleryTitleOverride?: string | null
  inMasterGallery?: boolean
}

const INLINE_GALLERY_LIMIT = 6

function buildWhatsAppHref(template: string, code: string | null, m2: string, number: string) {
  const text = template
    .replace(/\{code\}/g, code ?? 'N/A')
    .replace(/\{m2\}/g, m2 ?? '')
    .replace(/\{[a-zA-Z]+\}/g, '')
  const digits = number.replace(/[^\d]/g, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

export default function ProductDetail({
  lang,
  slug,
  name,
  tagline,
  description,
  properties,
  useCases,
  textures,
  heroSrc,
  projectImages,
  whatsappTemplate,
  whatsappNumber,
  dict,
  calcProduct,
  calculatorDict,
  visualizerDict,
  visualizer,
  videos,
  showCalculator = true,
  galleryTitleOverride = null,
  inMasterGallery = false,
}: Props) {
  const galleryTitle = galleryTitleOverride ?? dict.gallery
  const galleryThumbnails = inMasterGallery
    ? projectImages.slice(0, INLINE_GALLERY_LIMIT)
    : projectImages
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  const [textureLightboxIdx, setTextureLightboxIdx] = useState<number | null>(null)

  const selectedTextureSrc = useMemo(
    () => textures.find((t) => t.code === selectedCode)?.src ?? null,
    [textures, selectedCode]
  )

  const waHref = useMemo(
    () => buildWhatsAppHref(whatsappTemplate, selectedCode, '', whatsappNumber),
    [whatsappTemplate, selectedCode, whatsappNumber]
  )

  const ctaLabel = selectedCode
    ? `${dict.requestQuote} · ${selectedCode}`
    : dict.requestQuote

  return (
    <>
      {/* Hero */}
      <section className="relative bg-stone-900 text-white overflow-hidden">
        {heroSrc ? (
          <div className="absolute inset-0">
            <Image
              src={heroSrc}
              alt={name}
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-stone-900 via-stone-900 to-cepti-red/60" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-stone-900/85 via-stone-900/45 to-stone-900/15" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-24 sm:py-32 lg:py-40">
          <Link
            href={`/${lang}/productos`}
            className="inline-flex items-center gap-2 text-stone-300 hover:text-white text-sm font-medium mb-6 transition-colors"
          >
            <span aria-hidden>←</span> {dict.backToProducts}
          </Link>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight mb-4">
            {name}
          </h1>
          <p className="text-lg sm:text-2xl text-stone-200 leading-relaxed mb-10 max-w-2xl">
            {tagline}
          </p>
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center bg-cepti-red text-white font-semibold px-7 py-4 rounded-lg hover:bg-cepti-red-dark transition-colors text-base shadow-lg shadow-cepti-red/20"
          >
            {ctaLabel}
          </a>
        </div>
      </section>

      {/* Description */}
      <section className="py-16 sm:py-20 bg-background">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-4" style={{ maxWidth: '65ch' }}>
          {description.split(/\n\n+/).map((para, i) => (
            <p key={i} className="text-lg sm:text-xl text-stone-700 leading-relaxed">
              {para}
            </p>
          ))}
        </div>
      </section>

      {/* Properties grid */}
      {properties.length > 0 && (
        <section className="py-16 sm:py-20 bg-stone-50 border-y border-stone-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 mb-8">
              {dict.properties}
            </h2>
            <ul className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {properties.map((prop, i) => (
                <li
                  key={i}
                  className="bg-white rounded-xl p-5 border border-stone-100 shadow-sm flex items-start gap-3"
                >
                  <span
                    className="flex-shrink-0 w-6 h-6 rounded-full bg-cepti-red/10 text-cepti-red flex items-center justify-center text-sm font-bold mt-0.5"
                    aria-hidden
                  >
                    ✓
                  </span>
                  <span className="text-sm sm:text-base text-stone-700 leading-snug">
                    {prop}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Use cases */}
      {useCases.length > 0 && (
        <section className="py-16 sm:py-20 bg-background">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 mb-8">
              {dict.useCases}
            </h2>
            <ul className="flex flex-wrap gap-3">
              {useCases.map((use, i) => (
                <li
                  key={i}
                  className="inline-flex items-center bg-white border border-stone-200 text-stone-700 px-4 py-2 rounded-full text-sm font-medium"
                >
                  {use}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Palette */}
      {textures.length > 0 && (
        <section className="py-16 sm:py-20 bg-stone-50 border-y border-stone-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-stone-900">
                {dict.palette}
              </h2>
              {selectedCode && (
                <span className="text-sm text-stone-500">
                  {dict.selectColor}: <span className="font-semibold text-cepti-red">{selectedCode}</span>
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
              {textures.map((t, i) => {
                const isSelected = t.code === selectedCode
                return (
                  <button
                    key={t.code}
                    type="button"
                    onClick={() => {
                      setSelectedCode(t.code)
                      setTextureLightboxIdx(i)
                    }}
                    className={`group relative aspect-square overflow-hidden rounded-lg border-2 transition-all cursor-zoom-in ${
                      isSelected
                        ? 'border-cepti-red ring-2 ring-cepti-red/30 scale-[0.98]'
                        : 'border-transparent hover:border-stone-300'
                    }`}
                    aria-pressed={isSelected}
                    aria-label={`${dict.selectColor} ${t.code}`}
                  >
                    <Image
                      src={t.src}
                      alt={`${name} ${t.code}`}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
                      className="object-cover"
                    />
                    <span className="absolute bottom-1 left-1 bg-black/70 text-white text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded">
                      {t.code}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* Texture visualizer */}
      {visualizer && calcProduct.catalogCodes.length > 0 && (
        <TextureVisualizer
          referenceSrc={visualizer.referenceSrc}
          textureSrc={selectedTextureSrc}
          textureCode={selectedCode}
          wallInset={visualizer.wallInset}
          dict={visualizerDict}
        />
      )}

      {/* Galería */}
      {projectImages.length > 0 && (
        <section className="py-16 sm:py-20 bg-background">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 mb-8">
              {galleryTitle}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              {galleryThumbnails.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setLightboxIdx(i)}
                  className="relative aspect-[4/3] overflow-hidden rounded-xl bg-stone-100 group"
                >
                  <Image
                    src={src}
                    alt={`${name} ${i + 1}`}
                    fill
                    sizes="(max-width: 768px) 50vw, 33vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </button>
              ))}
            </div>
            {inMasterGallery && projectImages.length > INLINE_GALLERY_LIMIT && (
              <div className="mt-8 flex justify-center">
                <Link
                  href={`/${lang}/galeria#${slug}`}
                  className="inline-flex items-center gap-2 bg-cepti-brown text-white font-semibold px-6 py-3 rounded-lg hover:bg-cepti-brown-dark transition-colors text-base"
                >
                  {dict.viewMore}
                  <span aria-hidden>→</span>
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Videos */}
      {videos.length > 0 && (
        <section className="py-16 sm:py-20 bg-stone-50 border-y border-stone-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 mb-8">
              {dict.videos}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {videos.map((src) => (
                <video
                  key={src}
                  src={src}
                  controls
                  preload="metadata"
                  playsInline
                  className="w-full aspect-video rounded-xl bg-black"
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Mini calculator */}
      {showCalculator && (
        <section className="py-16 sm:py-20 bg-stone-50 border-y border-stone-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <CalculatorMini
              product={calcProduct}
              selectedCode={selectedCode}
              whatsappNumber={whatsappNumber}
              lang={lang}
              dict={calculatorDict}
            />
          </div>
        </section>
      )}

      {/* CTA band */}
      <section className="bg-cepti-red text-white py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-8 leading-tight">
            {dict.ctaBand}
          </h2>
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 bg-white text-cepti-red font-bold px-8 py-4 rounded-lg hover:bg-stone-100 transition-colors text-lg shadow-xl"
          >
            <WhatsAppIcon size={24} className="w-6 h-6" />
            {dict.whatsappBtn}
            {selectedCode && (
              <span className="text-sm font-semibold bg-cepti-red/10 text-cepti-red px-2 py-1 rounded">
                {selectedCode}
              </span>
            )}
          </a>
        </div>
      </section>

      <Lightbox
        images={galleryThumbnails}
        index={lightboxIdx}
        onClose={() => setLightboxIdx(null)}
        onChange={setLightboxIdx}
        alt={name}
      />

      <Lightbox
        images={textures.map((t) => t.src)}
        index={textureLightboxIdx}
        onClose={() => setTextureLightboxIdx(null)}
        onChange={(idx) => {
          setTextureLightboxIdx(idx)
          setSelectedCode(textures[idx]?.code ?? null)
        }}
        alt={name}
      />
    </>
  )
}
