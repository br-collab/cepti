import Link from 'next/link'
import type { Locale } from '@/app/[lang]/dictionaries'

const footerContent = {
  es: { tagline: 'Acabados de calidad para la República Dominicana.', rights: 'Todos los derechos reservados.' },
  en: { tagline: 'Quality finishes for the Dominican Republic.', rights: 'All rights reserved.' },
}

export default function Footer({ lang }: { lang: Locale }) {
  const t = footerContent[lang]

  return (
    <footer className="bg-stone-900 text-stone-400 py-12 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <span className="text-xl font-bold text-white tracking-tight">CEPTI</span>
          <p className="mt-1 text-sm">{t.tagline}</p>
        </div>
        <div className="flex gap-4 text-sm">
          <Link href="/es" className="hover:text-white transition-colors">ES</Link>
          <Link href="/en" className="hover:text-white transition-colors">EN</Link>
        </div>
      </div>
      <div className="max-w-6xl mx-auto mt-8 pt-6 border-t border-stone-800 text-xs text-stone-500">
        © {new Date().getFullYear()} CEPTI Corp. {t.rights}
      </div>
    </footer>
  )
}
