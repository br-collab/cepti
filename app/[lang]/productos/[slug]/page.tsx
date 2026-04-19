import { notFound } from 'next/navigation'
import { getDictionary, hasLocale } from '@/app/[lang]/dictionaries'
import {
  brand,
  getAllProducts,
  getProduct,
  getProductImages,
  pickLang,
} from '@/lib/products'
import ProductDetail from '@/components/products/ProductDetail'

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

  return (
    <ProductDetail
      lang={lang}
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
    />
  )
}
