import { notFound } from 'next/navigation'
import { getDictionary, hasLocale } from '@/app/[lang]/dictionaries'
import { getAllProducts, getProductImages, pickLang } from '@/lib/products'
import GallerySection from '@/components/gallery/GallerySection'

const MASTER_ORDER = [
  'papelex',
  'ladriflex',
  'pintura-de-piedra',
  'pintura-efecto-granito',
  'pintura-aterciopelada',
  'arte-con-arena',
  'primer',
  'pegamento',
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
        className="text-white bg-cover bg-center min-h-[26rem] sm:min-h-[28rem] lg:min-h-[30rem] flex items-center"
        style={{ backgroundImage: "url('/images/brand/Galeria_Cover.png')" }}
      >
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight text-white text-left">
            {dict.products.gallery}
          </h1>
        </div>
      </section>

      {sections.map((section, idx) => (
        <GallerySection
          key={section.slug}
          slug={section.slug}
          name={section.name}
          images={section.images}
          productHref={`/${lang}/productos/${section.slug}`}
          viewDetailsLabel={dict.products.viewDetails}
          rowIndex={idx}
        />
      ))}
    </>
  )
}
