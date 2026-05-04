import { notFound } from 'next/navigation'
import { getDictionary, hasLocale } from '@/app/[lang]/dictionaries'
import { brand, getHomepageProducts, pickLang } from '@/lib/products'
import Calculadora, {
  type CalcProductOption,
} from '@/components/calculator/Calculadora'

export function generateStaticParams() {
  return [{ lang: 'es' }, { lang: 'en' }]
}

export async function generateMetadata({
  params,
}: PageProps<'/[lang]/calculadora'>) {
  const { lang } = await params
  if (!hasLocale(lang)) return {}
  const dict = await getDictionary(lang)
  return {
    title: `${dict.calculator.title} — CEPTI`,
    description: dict.calculator.sub,
  }
}

export default async function CalculadoraPage({
  params,
}: PageProps<'/[lang]/calculadora'>) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()

  const dict = await getDictionary(lang)
  const products: CalcProductOption[] = getHomepageProducts()
    .filter((p) => p.slug !== 'arte-con-arena')
    .map((p) => ({
      slug: p.slug,
      name: pickLang(p.name, lang),
      coverage: p.coverage_m2_per_unit,
      unitLabel: pickLang(p.unit_label, lang),
    }))

  return (
    <>
      <section
        className="relative text-white py-10 sm:py-14 bg-cover bg-center"
        style={{ backgroundImage: "url('/images/brand/Calculadora_Cover.png')" }}
      >
        <div className="absolute inset-0 bg-stone-900/50" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
          <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight mb-3">
            {dict.calculator.title}
          </h1>
          <p className="text-base sm:text-lg text-white/95 max-w-2xl leading-relaxed">
            {dict.calculator.sub}
          </p>
        </div>
      </section>

      <section className="py-10 sm:py-14 bg-background">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <Calculadora
            products={products}
            whatsappNumber={brand.whatsapp_number}
            lang={lang}
            dict={dict.calculator}
          />
        </div>
      </section>
    </>
  )
}
