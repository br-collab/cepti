import { notFound } from 'next/navigation'
import { getDictionary, hasLocale } from '@/app/[lang]/dictionaries'
import { brand, getAllProducts, pickLang } from '@/lib/products'
import type { CalcProduct } from '@/lib/calculator'
import Calculator from '@/components/calculator/Calculator'

export function generateStaticParams() {
  return [{ lang: 'es' }, { lang: 'en' }]
}

export async function generateMetadata({ params }: PageProps<'/[lang]/calculadora'>) {
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
  const products: CalcProduct[] = getAllProducts().map((p) => ({
    slug: p.slug,
    name: pickLang(p.name, lang),
    coverage: p.coverage_m2_per_unit,
    unitLabel: pickLang(p.unit_label, lang),
    whatsappTemplate: pickLang(p.whatsapp_template, lang),
    catalogCodes: p.catalog_codes,
  }))

  return (
    <>
      <section className="bg-stone-900 text-white py-14 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <span className="inline-block text-cepti-gold text-xs font-bold uppercase tracking-widest mb-4">
            CEPTI Corp
          </span>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight mb-4">
            {dict.calculator.title}
          </h1>
          <p className="text-base sm:text-xl text-stone-300 max-w-2xl leading-relaxed">
            {dict.calculator.sub}
          </p>
        </div>
      </section>

      <section className="py-12 sm:py-16 bg-background">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <Calculator
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
