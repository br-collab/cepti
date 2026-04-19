import '@/app/globals.css'
import { notFound } from 'next/navigation'
import { hasLocale } from './dictionaries'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'

export function generateStaticParams() {
  return [{ lang: 'es' }, { lang: 'en' }]
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<'/[lang]'>) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()

  return (
    <html
      lang={lang}
      data-scroll-behavior="smooth"
      className="h-full scroll-smooth antialiased"
      suppressHydrationWarning
    >
      <head>
        <meta name="google" content="notranslate" />
      </head>
      <body
        translate="no"
        className="min-h-full flex flex-col bg-background text-foreground font-sans notranslate"
        suppressHydrationWarning
      >
        <Navbar lang={lang} />
        <main className="flex-1">{children}</main>
        <Footer lang={lang} />
      </body>
    </html>
  )
}
