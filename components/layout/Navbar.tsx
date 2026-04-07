import Link from 'next/link'
import type { Locale } from '@/app/[lang]/dictionaries'

const navLinks = {
  es: { products: 'Productos', whyUs: '¿Por qué CEPTI?', contact: 'Contacto', langHref: '/en', langLabel: 'EN' },
  en: { products: 'Products', whyUs: 'Why CEPTI?', contact: 'Contact', langHref: '/es', langLabel: 'ES' },
}

export default function Navbar({ lang }: { lang: Locale }) {
  const t = navLinks[lang]

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-stone-100 shadow-sm">
      <nav className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        <Link href={`/${lang}`} className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight text-cepti-red">CEPTI</span>
          <span className="hidden sm:inline text-xs text-stone-400 font-medium uppercase tracking-widest">
            Corp
          </span>
        </Link>

        <ul className="hidden md:flex items-center gap-8 text-sm font-medium text-stone-600">
          <li><Link href={`/${lang}#productos`} className="hover:text-cepti-red transition-colors">{t.products}</Link></li>
          <li><Link href={`/${lang}#porque-cepti`} className="hover:text-cepti-red transition-colors">{t.whyUs}</Link></li>
          <li><Link href={`/${lang}#contacto`} className="hover:text-cepti-red transition-colors">{t.contact}</Link></li>
        </ul>

        <div className="flex items-center gap-3">
          <Link
            href={t.langHref}
            className="text-xs font-semibold text-stone-500 hover:text-cepti-red transition-colors border border-stone-200 rounded px-2 py-1"
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
