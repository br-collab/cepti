import Image from 'next/image'
import Link from 'next/link'
import type { Locale } from '@/app/[lang]/dictionaries'

const footerContent = {
  es: {
    slogan: 'EL FUTURO EN LA DECORACIÓN QUE ESTÁ AL ALCANCE AHORA',
    rights: 'Todos los derechos reservados.',
  },
  en: {
    slogan: 'EL FUTURO EN LA DECORACIÓN QUE ESTÁ AL ALCANCE AHORA',
    rights: 'All rights reserved.',
  },
}

export default function Footer({ lang }: { lang: Locale }) {
  const t = footerContent[lang]

  return (
    <footer
      className="text-white py-8 px-4 sm:px-6"
      style={{ backgroundColor: '#7a6350' }}
    >
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="max-w-xl">
          <div className="relative h-20 w-64 sm:h-24 sm:w-80 mb-4">
            <Image
              src="/images/brand/logo-light.png"
              alt="CEPTI"
              fill
              sizes="320px"
              className="object-contain object-left"
            />
          </div>
          <p className="font-display text-base sm:text-lg font-semibold text-white leading-snug tracking-wide">
            {t.slogan}
          </p>
        </div>
        <div className="flex gap-4 text-sm text-white">
          <Link href="/es" className="hover:text-white/80 transition-colors">ES</Link>
          <Link href="/en" className="hover:text-white/80 transition-colors">EN</Link>
        </div>
      </div>
      <div className="max-w-6xl mx-auto mt-6 pt-4 border-t border-white/20 text-xs text-white/70">
        © {new Date().getFullYear()} CEPTI. {t.rights}
      </div>
    </footer>
  )
}
