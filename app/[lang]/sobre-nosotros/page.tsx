import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { getDictionary, hasLocale } from '@/app/[lang]/dictionaries'
import { getAllProducts, getProductImages, pickLang } from '@/lib/products'

const SOBRE_GALLERY_ORDER = [
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
}: PageProps<'/[lang]/sobre-nosotros'>) {
  const { lang } = await params
  if (!hasLocale(lang)) return {}
  const dict = await getDictionary(lang)
  return { title: dict.sobreNosotros.metaTitle }
}

export default async function SobreNosotrosPage({
  params,
}: PageProps<'/[lang]/sobre-nosotros'>) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()

  const dict = await getDictionary(lang)
  const t = dict.sobreNosotros

  const products = getAllProducts()
  const galleryThumbs = SOBRE_GALLERY_ORDER.map((slug) => {
    const product = products.find((p) => p.slug === slug)
    if (!product) return null
    const images = getProductImages(product)
    const src = images.projectImages[0]
    if (!src) return null
    return { slug, src, name: pickLang(product.name, lang) }
  }).filter((t): t is { slug: string; src: string; name: string } => t !== null)

  return (
    <>
      <section
        className="relative text-white py-16 sm:py-24 lg:py-32 bg-cover bg-center"
        style={{ backgroundImage: "url('/images/brand/SobreNosotros_Cover.png')" }}
      >
        <div className="absolute inset-0 bg-stone-900/50" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
          <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight text-white">
            {t.title}
          </h1>
        </div>
      </section>

      <section className="py-16 sm:py-24 bg-background">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="space-y-6 text-base sm:text-lg leading-relaxed text-stone-700">
            <p>{t.intro1}</p>
            <p>{t.intro2}</p>
            <div className="my-4 relative aspect-[16/9] rounded-2xl overflow-hidden bg-stone-100">
              <Image
                src="/images/brand/SobreNosotros_Body.jpg"
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 768px"
                className="object-cover"
              />
            </div>

            <div>
              <p className="mb-4">{t.objectivesTitle}</p>
              <ul className="list-disc pl-6 space-y-2">
                {t.objectives.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>

            <p>{t.closing}</p>
          </div>
        </div>
      </section>

      {galleryThumbs.length > 0 && (
        <section className="py-12 sm:py-16 bg-stone-50 border-t border-stone-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 mb-8">
              {dict.products.gallery}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              {galleryThumbs.map(({ slug, src, name }) => (
                <Link
                  key={slug}
                  href={`/${lang}/galeria#${slug}`}
                  className="relative aspect-[4/3] overflow-hidden rounded-xl bg-stone-100 group"
                >
                  <Image
                    src={src}
                    alt={name}
                    fill
                    sizes="(max-width: 768px) 50vw, 33vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </Link>
              ))}
            </div>
            <div className="mt-8 flex justify-center">
              <Link
                href={`/${lang}/galeria`}
                className="inline-flex items-center gap-2 bg-cepti-brown text-white font-semibold px-6 py-3 rounded-lg hover:bg-cepti-brown-dark transition-colors text-base"
              >
                {dict.products.viewMore}
                <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </section>
      )}
    </>
  )
}
