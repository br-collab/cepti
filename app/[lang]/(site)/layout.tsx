import { notFound } from 'next/navigation'
import { getDictionary, hasLocale } from '../dictionaries'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import ChatbotCEPTI from '@/components/ChatbotCEPTI'
import { brand } from '@/lib/products'

export default async function SiteLayout({
  children,
  params,
}: LayoutProps<'/[lang]'>) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()

  const dict = await getDictionary(lang)

  return (
    <>
      <Navbar lang={lang} />
      <main className="flex-1">{children}</main>
      <Footer dict={dict.footer} whatsappNumber={brand.whatsapp_number} />
      <ChatbotCEPTI whatsappNumber={brand.whatsapp_number} initialLang={lang} />
    </>
  )
}
