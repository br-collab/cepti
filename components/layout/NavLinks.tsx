'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import type { Locale } from '@/app/[lang]/dictionaries'

type LinkItem = { href: string; label: string; newTab?: boolean }

function isActive(pathname: string, href: string, home: string): boolean {
  if (href.includes('#')) return false
  const path = href.split('#')[0]
  if (path === home || path === `${home}/`) {
    return pathname === home
  }
  return pathname === path || pathname.startsWith(path + '/')
}

export default function NavLinks({
  lang,
  links,
  contactLabel,
  contactHref,
}: {
  lang: Locale
  links: LinkItem[]
  contactLabel: string
  contactHref: string
}) {
  const pathname = usePathname()
  const home = `/${lang}`
  const [open, setOpen] = useState(false)

  return (
    <>
      <ul className="hidden md:flex items-center gap-8 text-lg font-medium text-stone-600">
        {links.map((l) => {
          const active = isActive(pathname, l.href, home)
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                target={l.newTab ? '_blank' : undefined}
                rel={l.newTab ? 'noopener noreferrer' : undefined}
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

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        className="md:hidden relative w-10 h-10 flex flex-col items-center justify-center gap-1.5"
      >
        <span
          className={`block h-0.5 w-6 bg-stone-800 transition-transform duration-200 ${
            open ? 'translate-y-2 rotate-45' : ''
          }`}
        />
        <span
          className={`block h-0.5 w-6 bg-stone-800 transition-opacity duration-200 ${
            open ? 'opacity-0' : ''
          }`}
        />
        <span
          className={`block h-0.5 w-6 bg-stone-800 transition-transform duration-200 ${
            open ? '-translate-y-2 -rotate-45' : ''
          }`}
        />
      </button>

      {open ? (
        <div className="md:hidden absolute left-0 right-0 top-full bg-white border-b border-stone-100 shadow-md">
          <ul className="flex flex-col px-4 sm:px-6 py-4 gap-1 text-base font-medium text-stone-700">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  target={l.newTab ? '_blank' : undefined}
                  rel={l.newTab ? 'noopener noreferrer' : undefined}
                  onClick={() => setOpen(false)}
                  className="block py-3 hover:text-cepti-brown transition-colors"
                >
                  {l.label}
                </Link>
              </li>
            ))}
            <li className="pt-2">
              <Link
                href={contactHref}
                onClick={() => setOpen(false)}
                className="block w-full text-center bg-cepti-red text-white font-semibold px-4 py-3 rounded-lg hover:bg-cepti-red-dark transition-colors"
              >
                {contactLabel}
              </Link>
            </li>
          </ul>
        </div>
      ) : null}
    </>
  )
}
