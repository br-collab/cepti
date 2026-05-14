import { notFound } from 'next/navigation'
import { getDictionary, hasLocale } from '@/app/[lang]/dictionaries'
import Hero from '@/components/sections/Hero'
import Products from '@/components/sections/Products'
import WhyUs from '@/components/sections/WhyUs'

export default async function HomePage({ params }: PageProps<'/[lang]'>) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()

  const dict = await getDictionary(lang)

  return (
    <>
      <Hero dict={dict.hero} />
      <Products dict={dict.products} lang={lang} />
      <WhyUs dict={dict.whyUs} />
    </>
  )
}
