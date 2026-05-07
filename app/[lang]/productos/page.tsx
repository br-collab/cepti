import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getDictionary, hasLocale } from '@/app/[lang]/dictionaries'
import {
  getAllProducts,
  getProductImages,
  pickLang,
} from '@/lib/products'

const CARD_PHOTO_CLASS: Record<string, string> = {
  'primer': 'object-cover [object-position:50%_65%] group-hover:scale-[1.02]',
  'pegamento': 'object-cover scale-105 group-hover:scale-[1.07]',
  'arte-con-arena': 'object-contain group-hover:scale-[1.02]',
}
const DEFAULT_CARD_PHOTO_CLASS = 'object-cover group-hover:scale-[1.02]'

export function generateStaticParams() {
  return [{ lang: 'es' }, { lang: 'en' }]
}

export default async function ProductosIndexPage({
  params,
}: PageProps<'/[lang]/productos'>) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()

  const dict = await getDictionary(lang)
  const products = getAllProducts()

  const cards = products.map((p) => ({
    slug: p.slug,
    name: pickLang(p.name, lang),
    tagline: pickLang(p.tagline, lang),
    description: pickLang(p.description, lang),
    cardSrc: getProductImages(p).card,
  }))

  return (
    <>
      <section
        className="relative text-white py-16 sm:py-24 lg:py-32 bg-cover bg-center"
        style={{ backgroundImage: "url('/images/brand/Productos_Cover.png')" }}
      >
        <div className="absolute inset-0 bg-stone-900/55" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            {dict.products.title}
          </h1>
          <p className="text-lg sm:text-xl text-stone-100 max-w-2xl leading-relaxed">
            {dict.products.sub}
          </p>
        </div>
      </section>

      <section className="py-16 sm:py-20 bg-background">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            {cards.map((c) => (
              <Link
                key={c.slug}
                href={`/${lang}/productos/${c.slug}`}
                className="group bg-white rounded-2xl overflow-hidden border border-stone-100 shadow-sm hover:shadow-lg hover:border-cepti-red/30 transition-all flex flex-col"
              >
                <div className="relative aspect-[4/3] bg-stone-100">
                  {c.cardSrc ? (
                    <Image
                      src={c.cardSrc}
                      alt={c.name}
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className={`transition-transform duration-300 ${CARD_PHOTO_CLASS[c.slug] ?? DEFAULT_CARD_PHOTO_CLASS}`}
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-stone-800 via-stone-900 to-cepti-red/40" />
                  )}
                </div>
                <div className="p-6 sm:p-8 flex flex-col flex-1">
                  <h2 className="text-2xl font-bold text-stone-900 mb-2 group-hover:text-cepti-red transition-colors">
                    {c.name}
                  </h2>
                  <p className="text-cepti-red font-medium text-sm mb-4">
                    {c.tagline}
                  </p>
                  <p className="text-stone-600 leading-relaxed flex-1">
                    {c.description}
                  </p>
                  <span className="inline-flex items-center gap-1 mt-6 text-cepti-red font-semibold text-sm">
                    {dict.products.viewDetails}
                    <span aria-hidden>→</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
