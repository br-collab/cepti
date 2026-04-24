import '@/app/globals.css'
import { notFound } from 'next/navigation'
import { Syne, Manrope } from 'next/font/google'
import { getDictionary, hasLocale } from './dictionaries'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'

const syne = Syne({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
  weight: ['500', '600', '700', '800'],
})

const manrope = Manrope({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
  weight: ['300', '400', '500', '600', '700'],
})

export function generateStaticParams() {
  return [{ lang: 'es' }, { lang: 'en' }]
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<'/[lang]'>) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()

  const dict = await getDictionary(lang)

  return (
    <html
      lang={lang}
      data-scroll-behavior="smooth"
      className={`h-full scroll-smooth antialiased ${syne.variable} ${manrope.variable}`}
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
        <Footer dict={dict.footer} />
      </body>
    </html>
  )
}
