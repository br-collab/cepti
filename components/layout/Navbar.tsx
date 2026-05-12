import Image from 'next/image'
import Link from 'next/link'
import type { Locale } from '@/app/[lang]/dictionaries'
import { fileExistsInPublic } from '@/lib/products'
import NavLinks from '@/components/layout/NavLinks'

const navLinks = {
  es: {
    products: 'Productos',
    calculator: 'Calculadora',
    calculatorHref: '/es/calculadora',
    analyzer: 'Analizador',
    whyUs: '¿Por qué CEPTI?',
    about: 'Sobre nosotros',
    contact: 'Contacto',
    langHref: '/en',
    langLabel: 'EN',
  },
  en: {
    products: 'Products',
    calculator: 'Calculator',
    calculatorHref: '/en/calculadora',
    analyzer: 'Analyzer',
    whyUs: 'Why CEPTI?',
    about: 'About us',
    contact: 'Contact',
    langHref: '/es',
    langLabel: 'ES',
  },
}

const LOGO_PATH = '/images/brand/LogoBlack_WhiteBackground_Nerrow_bobers.png'

export default function Navbar({ lang }: { lang: Locale }) {
  const t = navLinks[lang]
  const hasLogo = fileExistsInPublic(LOGO_PATH)

  return (
    <header className="sticky top-0 z-50 bg-white backdrop-blur border-b border-stone-100 shadow-sm relative">
      <nav className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4 h-24 lg:h-28">
        <Link
          href={`/${lang}`}
          className="flex items-center gap-2 flex-shrink-0"
          translate="no"
        >
          {hasLogo ? (
            <Image
              src={LOGO_PATH}
              alt="CEPTI"
              width={480}
              height={132}
              priority
              className="h-16 w-auto sm:h-20 lg:h-24 max-w-[200px] lg:max-w-none"
            />
          ) : (
            <span className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-black">
              CEPTI
            </span>
          )}
        </Link>

        <NavLinks
          lang={lang}
          links={[
            { href: `/${lang}/productos`, label: t.products },
            { href: t.calculatorHref, label: t.calculator },
            { href: `/${lang}/analyzer`, label: t.analyzer },
            { href: `/${lang}#porque-cepti`, label: t.whyUs },
            { href: `/${lang}/sobre-nosotros`, label: t.about },
          ]}
          contactLabel={t.contact}
          contactHref={`/${lang}/contacto`}
        />

        <div className="hidden lg:flex items-center gap-3">
          <Link
            href={t.langHref}
            translate="no"
            className="text-xs font-semibold text-stone-500 hover:text-cepti-red transition-colors border border-stone-200 rounded px-2 py-1"
            aria-label={lang === 'es' ? 'Switch to English' : 'Cambiar a Español'}
          >
            {t.langLabel}
          </Link>
          <Link
            href={`/${lang}/contacto`}
            className="inline-flex items-center bg-cepti-red text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-cepti-red-dark transition-colors"
          >
            {t.contact}
          </Link>
        </div>
      </nav>
    </header>
  )
}
