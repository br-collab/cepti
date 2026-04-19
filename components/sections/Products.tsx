import Image from 'next/image'
import Link from 'next/link'
import type { Locale } from '@/app/[lang]/dictionaries'
import { getAllProducts, getProductImages, pickLang } from '@/lib/products'

type ProductsDict = {
  title: string
  sub: string
  viewDetails: string
  viewAll: string
}

export default function Products({
  dict,
  lang,
}: {
  dict: ProductsDict
  lang: Locale
}) {
  const products = getAllProducts()
  const cards = products.map((p) => ({
    slug: p.slug,
    name: pickLang(p.name, lang),
    tagline: pickLang(p.tagline, lang),
    heroSrc: getProductImages(p).hero,
  }))

  return (
    <section id="productos" className="py-20 sm:py-28 bg-stone-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-stone-900 mb-3">{dict.title}</h2>
          <p className="text-stone-500 text-lg">{dict.sub}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
          {cards.map((c) => (
            <Link
              key={c.slug}
              href={`/${lang}/productos/${c.slug}`}
              className="group bg-white rounded-2xl overflow-hidden shadow-sm border border-stone-100 hover:shadow-md hover:border-cepti-red/30 transition-all flex flex-col"
            >
              <div className="relative aspect-[4/3] bg-stone-100">
                {c.heroSrc ? (
                  <Image
                    src={c.heroSrc}
                    alt={c.name}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    className="object-cover group-hover:scale-[1.03] transition-transform duration-300"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-stone-800 via-stone-900 to-cepti-red/40 flex items-center justify-center">
                    <span className="text-cepti-gold text-xs font-bold uppercase tracking-widest">
                      CEPTI
                    </span>
                  </div>
                )}
              </div>
              <div className="p-5 flex flex-col flex-1">
                <h3 className="text-lg font-semibold text-stone-900 mb-1 group-hover:text-cepti-red transition-colors">
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
            className="inline-flex items-center gap-2 bg-cepti-red text-white font-semibold px-6 py-3 rounded-lg hover:bg-cepti-red-dark transition-colors"
          >
            {dict.viewAll}
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </section>
  )
}
