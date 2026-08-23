import { notFound } from 'next/navigation'
import { getDictionary, hasLocale } from '@/app/[lang]/dictionaries'
import { getShowcaseVideos } from '@/lib/products'
import Hero from '@/components/sections/Hero'
import VideoRail from '@/components/sections/VideoRail'
import Products from '@/components/sections/Products'
import WhyUs from '@/components/sections/WhyUs'

export default async function HomePage({ params }: PageProps<'/[lang]'>) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()

  const dict = await getDictionary(lang)

  const railItems = getShowcaseVideos(lang).map((v) => ({
    ...v,
    href: `/${lang}/productos/${v.slug}`,
  }))

  return (
    <>
      <Hero dict={dict.hero} />
      <VideoRail items={railItems} dict={dict.videoRail} />
      <Products dict={dict.products} lang={lang} />
      <WhyUs dict={dict.whyUs} />
    </>
  )
}
