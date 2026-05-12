import { notFound } from 'next/navigation'
import { getDictionary, hasLocale } from '@/app/[lang]/dictionaries'
import { brand } from '@/lib/products'
import Contact from '@/components/sections/Contact'

export function generateStaticParams() {
  return [{ lang: 'es' }, { lang: 'en' }]
}

export async function generateMetadata({
  params,
}: PageProps<'/[lang]/contacto'>) {
  const { lang } = await params
  if (!hasLocale(lang)) return {}
  const dict = await getDictionary(lang)
  return {
    title: `${dict.contact.title} — CEPTI`,
    description: dict.contact.sub,
  }
}

export default async function ContactoPage({
  params,
}: PageProps<'/[lang]/contacto'>) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()

  const dict = await getDictionary(lang)

  return (
    <>
      <section
        className="text-white bg-cover bg-center min-h-[26rem] sm:min-h-[28rem] lg:min-h-[30rem] flex items-center"
        style={{ backgroundImage: "url('/images/brand/Contacto_Cover.png')" }}
      >
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-white">
            {dict.contact.title}
          </h1>
        </div>
      </section>

      <Contact dict={dict.contact} whatsappNumber={brand.whatsapp_number} />
    </>
  )
}
