import Image from 'next/image'
import Link from 'next/link'
import type { Locale } from '@/app/[lang]/dictionaries'

const footerContent = {
  es: {
    tagline: 'Acabados innovadores de calidad para la República Dominicana.',
    brandLine: 'El futuro en la decoración que está al alcance ahora.',
    rights: 'Todos los derechos reservados.',
  },
  en: {
    tagline: 'Innovative quality finishes for the Dominican Republic.',
    brandLine: 'The future of interior design, within reach today.',
    rights: 'All rights reserved.',
  },
}

export default function Footer({ lang }: { lang: Locale }) {
  const t = footerContent[lang]

  return (
    <footer className="bg-cepti-texture text-cepti-cream-dim py-14 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8">
        <div className="max-w-md">
          <div className="relative h-10 w-32 mb-4">
            <Image
              src="/images/brand/logo-light.png"
              alt="CEPTI"
              fill
              sizes="140px"
              className="object-contain object-left"
            />
          </div>
          <p className="font-display text-sm italic text-cepti-cream/80 leading-snug mb-2">
            {t.brandLine}
          </p>
          <p className="text-sm text-cepti-cream-dim">{t.tagline}</p>
        </div>
        <div className="flex gap-4 text-sm">
          <Link href="/es" className="hover:text-cepti-cream transition-colors">ES</Link>
          <Link href="/en" className="hover:text-cepti-cream transition-colors">EN</Link>
        </div>
      </div>
      <div className="max-w-6xl mx-auto mt-8 pt-6 border-t border-cepti-cream/15 text-xs text-cepti-cream/50">
        © {new Date().getFullYear()} CEPTI. {t.rights}
      </div>
    </footer>
  )
}
