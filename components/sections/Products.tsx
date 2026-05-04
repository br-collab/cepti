import Image from 'next/image'
import Link from 'next/link'
import type { Locale } from '@/app/[lang]/dictionaries'
import { getHomepageProducts, getProductImages, pickLang } from '@/lib/products'

type ProductsDict = {
  title: string
  sub: string
  viewDetails: string
  viewAll: string
}

const CARD_PHOTO_CLASS: Record<string, string> = {
  'primer': 'object-cover [object-position:50%_65%] group-hover:scale-[1.03]',
  'pegamento': 'object-cover scale-105 group-hover:scale-[1.08]',
  'arte-con-arena': 'object-contain group-hover:scale-[1.03]',
}
const DEFAULT_CARD_PHOTO_CLASS = 'object-cover group-hover:scale-[1.03]'

export default function Products({
  dict,
  lang,
}: {
  dict: ProductsDict
  lang: Locale
}) {
  const products = getHomepageProducts()
  const cards = products.map((p) => ({
    slug: p.slug,
    name: pickLang(p.name, lang),
    tagline: pickLang(p.tagline, lang),
    cardSrc: getProductImages(p).card,
  }))

  return (
    <section id="productos" className="py-20 sm:py-28 bg-stone-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-stone-900 mb-3">{dict.title}</h2>
          <p className="text-stone-500 text-lg">{dict.sub}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
          {cards.map((c) => (
            <Link
              key={c.slug}
              href={`/${lang}/productos/${c.slug}`}
              className="group bg-white rounded-2xl overflow-hidden shadow-sm border border-stone-100 hover:shadow-md hover:border-cepti-brown/40 transition-all flex flex-col"
            >
              <div className="relative aspect-[4/3] bg-stone-100">
                {c.cardSrc ? (
                  <Image
                    src={c.cardSrc}
                    alt={c.name}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    className={`transition-transform duration-300 ${CARD_PHOTO_CLASS[c.slug] ?? DEFAULT_CARD_PHOTO_CLASS}`}
                  />
                ) : (
                  <div className="absolute inset-0 bg-cepti-texture" />
                )}
              </div>
              <div className="p-5 flex flex-col flex-1">
                <h3 className="font-display text-lg font-semibold text-stone-900 mb-1 group-hover:text-cepti-brown transition-colors">
                  {c.name}
                </h3>
                <p className="text-sm text-stone-500 leading-snug line-clamp-2 sm:line-clamp-none">
                  {c.tagline}
                </p>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link
            href={`/${lang}/productos`}
            className="inline-flex items-center gap-2 bg-cepti-brown text-cepti-cream font-semibold px-6 py-3 rounded-lg hover:bg-cepti-brown-dark transition-colors"
          >
            {dict.viewAll}
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </section>
  )
}
