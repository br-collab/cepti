'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Locale } from '@/app/[lang]/dictionaries'

type LinkItem = { href: string; label: string }

function isActive(pathname: string, href: string, home: string): boolean {
  const path = href.split('#')[0]
  if (path === home || path === `${home}/`) {
    return pathname === home
  }
  return pathname === path || pathname.startsWith(path + '/')
}

export default function NavLinks({
  lang,
  links,
}: {
  lang: Locale
  links: LinkItem[]
}) {
  const pathname = usePathname()
  const home = `/${lang}`

  return (
    <ul className="hidden md:flex items-center gap-8 text-lg font-medium text-stone-600">
      {links.map((l) => {
        const active = isActive(pathname, l.href, home)
        return (
          <li key={l.href}>
            <Link
              href={l.href}
              className={
                active
                  ? 'font-bold text-stone-900 underline decoration-cepti-red decoration-2 underline-offset-4'
                  : 'hover:text-cepti-brown transition-colors'
              }
            >
              {l.label}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
