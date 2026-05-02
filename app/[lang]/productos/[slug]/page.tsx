import { notFound } from 'next/navigation'
import { getDictionary, hasLocale } from '@/app/[lang]/dictionaries'
import {
  brand,
  fileExistsInPublic,
  getAllProducts,
  getProduct,
  getProductImages,
  pickLang,
} from '@/lib/products'
import type { CalcProduct } from '@/lib/calculator'
import ProductDetail from '@/components/products/ProductDetail'

const VISUALIZER_MAP: Record<string, string> = {
  'pintura-aterciopelada': 'interior-wall',
  'pintura-de-piedra': 'interior-wall',
  'pintura-efecto-granito': 'interior-wall',
  'ladriflex': 'interior-wall',
  'papelex': 'interior-wall',
}

const MASTER_GALLERY_SLUGS = new Set([
  'papelex',
  'ladriflex',
  'pintura-aterciopelada',
  'pintura-de-piedra',
  'pintura-efecto-granito',
  'arte-con-arena',
])

const ARTE_GALLERY_TITLE = {
  es: 'Ejemplos de arte con Arena y Piedra',
  en: 'Sand and Stone art examples',
}

const WALL_INSETS: Record<string, { top: string; bottom: string; left: string; right: string }> = {
  'interior-wall': { top: '0%', bottom: '30%', left: '0%', right: '0%' },
  'facade': { top: '20%', bottom: '12%', left: '0%', right: '0%' },
}

function resolveVisualizerRef(refName: string): string | null {
  for (const ext of ['jpg', 'jpeg', 'png', 'webp', 'svg']) {
    const path = `/images/visualizer/${refName}.${ext}`
    if (fileExistsInPublic(path)) return path
  }
  return null
}

export function generateStaticParams() {
  const products = getAllProducts()
  return ['es', 'en'].flatMap((lang) =>
    products.map((p) => ({ lang, slug: p.slug }))
  )
}

export async function generateMetadata({
  params,
}: PageProps<'/[lang]/productos/[slug]'>) {
  const { lang, slug } = await params
  if (!hasLocale(lang)) return {}
  const product = getProduct(slug)
  if (!product) return {}
  return {
    title: `${pickLang(product.name, lang)} — CEPTI`,
    description: pickLang(product.tagline, lang),
  }
}

export default async function ProductDetailPage({
  params,
}: PageProps<'/[lang]/productos/[slug]'>) {
  const { lang, slug } = await params
  if (!hasLocale(lang)) notFound()
  const product = getProduct(slug)
  if (!product) notFound()

  const dict = await getDictionary(lang)
  const images = getProductImages(product)

  const calcProduct: CalcProduct = {
    slug: product.slug,
    name: pickLang(product.name, lang),
    coverage: product.coverage_m2_per_unit,
    unitLabel: pickLang(product.unit_label, lang),
    whatsappTemplate: pickLang(product.whatsapp_template, lang),
    catalogCodes: product.catalog_codes,
  }

  const refName = VISUALIZER_MAP[product.slug]
  const refSrc = refName ? resolveVisualizerRef(refName) : null
  const visualizer = refSrc && refName
    ? { referenceSrc: refSrc, wallInset: WALL_INSETS[refName] }
    : null

  const galleryTitleOverride =
    product.slug === 'arte-con-arena' ? ARTE_GALLERY_TITLE[lang] : null
  const inMasterGallery = MASTER_GALLERY_SLUGS.has(product.slug)

  return (
    <ProductDetail
      lang={lang}
      slug={product.slug}
      name={pickLang(product.name, lang)}
      tagline={pickLang(product.tagline, lang)}
      description={pickLang(product.description, lang)}
      properties={pickLang(product.properties, lang)}
      useCases={pickLang(product.use_cases, lang)}
      textures={images.textures}
      heroSrc={images.hero}
      projectImages={images.projectImages}
      whatsappTemplate={pickLang(product.whatsapp_template, lang)}
      whatsappNumber={brand.whatsapp_number}
      dict={dict.products}
      calcProduct={calcProduct}
      calculatorDict={dict.calculator}
      visualizerDict={dict.visualizer}
      visualizer={visualizer}
      showCalculator={product.slug !== 'arte-con-arena'}
      galleryTitleOverride={galleryTitleOverride}
      inMasterGallery={inMasterGallery}
    />
  )
}
