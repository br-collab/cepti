import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { getDictionary, hasLocale } from '@/app/[lang]/dictionaries'
import { getAllProducts, getProductImages, pickLang } from '@/lib/products'

const MASTER_ORDER = [
  'papelex',
  'ladriflex',
  'pintura-aterciopelada',
  'pintura-de-piedra',
  'pintura-efecto-granito',
  'arte-con-arena',
]

export function generateStaticParams() {
  return [{ lang: 'es' }, { lang: 'en' }]
}

export async function generateMetadata({
  params,
}: PageProps<'/[lang]/galeria'>) {
  const { lang } = await params
  if (!hasLocale(lang)) return {}
  const dict = await getDictionary(lang)
  return { title: `${dict.products.gallery} — CEPTI` }
}

export default async function GaleriaPage({
  params,
}: PageProps<'/[lang]/galeria'>) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()

  const dict = await getDictionary(lang)
  const products = getAllProducts()

  const sections = MASTER_ORDER.map((slug) => {
    const product = products.find((p) => p.slug === slug)
    if (!product) return null
    const images = getProductImages(product)
    if (images.projectImages.length === 0) return null
    return {
      slug,
      name: pickLang(product.name, lang),
      images: images.projectImages,
    }
  }).filter((s): s is NonNullable<typeof s> => s !== null)

  return (
    <>
      <section
        className="text-white py-10 sm:py-14 bg-cover bg-center"
        style={{ backgroundImage: "url('/images/brand/Background_plain.jpg')" }}
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight text-white">
            {dict.products.gallery}
          </h1>
        </div>
      </section>

      {sections.map((section, idx) => (
        <section
          key={section.slug}
          id={section.slug}
          className={`py-12 sm:py-16 scroll-mt-28 ${
            idx % 2 === 0 ? 'bg-background' : 'bg-stone-50'
          }`}
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex items-end justify-between flex-wrap gap-3 mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-stone-900">
                {section.name}
              </h2>
              <Link
                href={`/${lang}/productos/${section.slug}`}
                className="text-sm font-semibold text-cepti-brown hover:text-cepti-brown-dark transition-colors"
              >
                {dict.products.viewDetails} →
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {section.images.map((src, i) => (
                <div
                  key={src}
                  className="relative aspect-[4/3] overflow-hidden rounded-xl bg-stone-100"
                >
                  <Image
                    src={src}
                    alt={`${section.name} ${i + 1}`}
                    fill
                    sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}
    </>
  )
}
