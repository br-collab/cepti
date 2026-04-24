import { notFound } from 'next/navigation'
import { getDictionary, hasLocale } from './dictionaries'
import Hero from '@/components/sections/Hero'
import Products from '@/components/sections/Products'
import WhyUs from '@/components/sections/WhyUs'
import Contact from '@/components/sections/Contact'
import ChatbotCEPTI from '@/components/ChatbotCEPTI'
import { brand } from '@/lib/products'

export default async function HomePage({ params }: PageProps<'/[lang]'>) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()

  const dict = await getDictionary(lang)

  return (
    <>
      <Hero dict={dict.hero} />
      <Products dict={dict.products} lang={lang} />
      <WhyUs dict={dict.whyUs} />
      <Contact dict={dict.contact} />
      <ChatbotCEPTI whatsappNumber={brand.whatsapp_number} initialLang={lang} />
    </>
  )
}
