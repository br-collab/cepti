import Image from 'next/image'
import Link from 'next/link'
import type { Locale } from '@/app/[lang]/dictionaries'
import { fileExistsInPublic } from '@/lib/products'

const navLinks = {
  es: {
    products: 'Productos',
    calculator: 'Calculadora',
    calculatorHref: '/es/calculadora',
    whyUs: '¿Por qué CEPTI?',
    about: 'Sobre nosotros',
    contact: 'Contacto',
    langHref: '/en',
    langLabel: 'EN',
  },
  en: {
    products: 'Products',
    calculator: 'Calculator',
    calculatorHref: '/en/calculator',
    whyUs: 'Why CEPTI?',
    about: 'About us',
    contact: 'Contact',
    langHref: '/es',
    langLabel: 'ES',
  },
}

const LOGO_PATH = '/images/brand/logo-dark.png'

export default function Navbar({ lang }: { lang: Locale }) {
  const t = navLinks[lang]
  const hasLogo = fileExistsInPublic(LOGO_PATH)

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-stone-100 shadow-sm">
      <nav className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        <Link href={`/${lang}`} className="flex items-center gap-2" translate="no">
          {hasLogo ? (
            <Image
              src={LOGO_PATH}
              alt="CEPTI"
              width={160}
              height={44}
              priority
              className="h-10 w-auto sm:h-11"
            />
          ) : (
            <span className="font-display text-2xl font-bold tracking-tight text-cepti-brown-dark">
              CEPTI
            </span>
          )}
        </Link>

        <ul className="hidden md:flex items-center gap-8 text-sm font-medium text-stone-600">
          <li><Link href={`/${lang}/productos`} className="hover:text-cepti-brown transition-colors">{t.products}</Link></li>
          <li><Link href={t.calculatorHref} className="hover:text-cepti-brown transition-colors">{t.calculator}</Link></li>
          <li><Link href={`/${lang}#porque-cepti`} className="hover:text-cepti-brown transition-colors">{t.whyUs}</Link></li>
          <li><Link href={`/${lang}#contacto`} className="hover:text-cepti-brown transition-colors">{t.about}</Link></li>
        </ul>

        <div className="flex items-center gap-3">
          <Link
            href={t.langHref}
            translate="no"
            className="text-xs font-semibold text-stone-500 hover:text-cepti-red transition-colors border border-stone-200 rounded px-2 py-1"
            aria-label={lang === 'es' ? 'Switch to English' : 'Cambiar a Español'}
          >
            {t.langLabel}
          </Link>
          <Link
            href={`/${lang}#contacto`}
            className="hidden sm:inline-flex items-center bg-cepti-red text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-cepti-red-dark transition-colors"
          >
            {t.contact}
          </Link>
        </div>
      </nav>
    </header>
  )
}
