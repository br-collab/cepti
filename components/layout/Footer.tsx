import Image from 'next/image'
import Link from 'next/link'
import { Link2, Mail, MessageCircle, Share2 } from 'lucide-react'

type FooterDict = {
  slogan: string
  rights: string
}

export default function Footer({ dict }: { dict: FooterDict }) {
  return (
    <footer
      className="text-white py-8 px-4 sm:px-6"
      style={{ backgroundColor: '#7a6350' }}
    >
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="max-w-xl">
          <div className="relative h-20 w-64 sm:h-24 sm:w-80 mb-4">
            <Image
              src="/images/brand/LogoWhite_TrasperentBackground.png"
              alt="CEPTI"
              fill
              sizes="320px"
              className="object-contain object-left"
            />
          </div>
          <p className="font-display text-base sm:text-lg font-semibold text-white leading-snug tracking-wide">
            {dict.slogan}
          </p>
        </div>
        <div className="flex gap-4 text-sm text-white">
          <Link href="/es" className="hover:text-white/80 transition-colors">ES</Link>
          <Link href="/en" className="hover:text-white/80 transition-colors">EN</Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto mt-6 flex items-center gap-5">
        <a
          href="https://instagram.com/cepti_rd"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Instagram"
          className="text-white hover:opacity-75 transition-opacity"
        >
          <Link2 size={24} aria-hidden />
        </a>
        <span
          aria-label="Facebook — próximamente"
          aria-disabled="true"
          className="text-white opacity-40 cursor-not-allowed"
        >
          <Share2 size={24} aria-hidden />
        </span>
        <span
          aria-label="Threads — próximamente"
          aria-disabled="true"
          className="text-white opacity-40 cursor-not-allowed"
        >
          <Share2 size={24} aria-hidden />
        </span>
        <a
          href="mailto:info@cepticorp.com"
          aria-label="Email"
          className="text-white hover:opacity-75 transition-opacity"
        >
          <Mail size={24} aria-hidden />
        </a>
        <span
          aria-label="WhatsApp — próximamente"
          aria-disabled="true"
          className="text-white opacity-40 cursor-not-allowed"
        >
          <MessageCircle size={24} aria-hidden />
        </span>
      </div>

      <div className="max-w-6xl mx-auto mt-6 pt-4 border-t border-white/20 text-xs text-white/70">
        © {new Date().getFullYear()} CEPTI. {dict.rights}
      </div>
    </footer>
  )
}
