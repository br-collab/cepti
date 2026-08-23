'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

export type RailItem = {
  slug: string
  name: string
  src: string
  poster: string
  href: string
}

export type VideoRailDict = {
  title: string
  sub: string
  view: string
  mute: string
  unmute: string
}

function SpeakerOn({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M11 5 6 9H2v6h4l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  )
}

function SpeakerOff({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M11 5 6 9H2v6h4l5 4z" />
      <path d="m17 9 4 6" />
      <path d="m21 9-4 6" />
    </svg>
  )
}

export default function VideoRail({
  items,
  dict,
}: {
  items: RailItem[]
  dict: VideoRailDict
}) {
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([])
  const [autoplay, setAutoplay] = useState(true)
  const [soundOn, setSoundOn] = useState<number | null>(null)

  // Respect the visitor's motion preference and any data-saver setting.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const nav = navigator as Navigator & { connection?: { saveData?: boolean } }
    const update = () => setAutoplay(!mq.matches && !nav.connection?.saveData)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  // Play only the card that is actually on screen; pause the rest.
  useEffect(() => {
    if (!autoplay) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const video = entry.target as HTMLVideoElement
          if (entry.isIntersecting && entry.intersectionRatio >= 0.55) {
            void video.play().catch(() => {})
          } else {
            video.pause()
          }
        }
      },
      { threshold: [0, 0.55, 1] },
    )
    const nodes = videoRefs.current.filter(
      (node): node is HTMLVideoElement => node !== null,
    )
    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [autoplay, items.length])

  // Only one card is ever audible.
  const toggleSound = useCallback(
    (index: number) => {
      setSoundOn((current) => {
        const next = current === index ? null : index
        videoRefs.current.forEach((video, i) => {
          if (!video) return
          video.muted = i !== next
          if (i === next) void video.play().catch(() => {})
        })
        return next
      })
    },
    [],
  )

  if (items.length === 0) return null

  return (
    <section
      id="videos"
      className="bg-stone-950 py-14 sm:py-20"
      aria-labelledby="video-rail-title"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="mb-8 sm:mb-10 text-center">
          <h2
            id="video-rail-title"
            className="font-display text-3xl sm:text-4xl font-bold text-white mb-3"
          >
            {dict.title}
          </h2>
          <p className="text-stone-400 text-base sm:text-lg">{dict.sub}</p>
        </div>
      </div>

      <ul
        className="flex gap-4 sm:gap-5 overflow-x-auto snap-x snap-mandatory scroll-smooth px-4 sm:px-6 pb-4
                   [scrollbar-width:thin] [-webkit-overflow-scrolling:touch]
                   lg:max-w-6xl lg:mx-auto lg:justify-center lg:overflow-visible lg:snap-none"
      >
        {items.map((item, index) => (
          <li
            key={item.slug}
            className="relative shrink-0 snap-center w-[68vw] sm:w-[42vw] md:w-[30vw] lg:w-auto lg:flex-1 lg:min-w-0"
          >
            <Link
              href={item.href}
              className="group block relative aspect-[9/16] overflow-hidden rounded-2xl bg-stone-900
                         ring-1 ring-white/10 transition-shadow hover:ring-cepti-gold/60
                         focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cepti-gold"
            >
              <video
                ref={(node) => {
                  videoRefs.current[index] = node
                }}
                src={item.src}
                poster={item.poster}
                muted
                loop
                playsInline
                preload="none"
                controls={!autoplay}
                aria-label={item.name}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5
                           bg-gradient-to-t from-black/85 via-black/40 to-transparent"
                aria-hidden
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4">
                <h3 className="font-display text-base sm:text-lg font-semibold text-white leading-snug">
                  {item.name}
                </h3>
                <span className="mt-1 inline-flex items-center gap-1.5 text-sm text-cepti-gold">
                  {dict.view}
                  <span
                    aria-hidden
                    className="transition-transform group-hover:translate-x-0.5"
                  >
                    →
                  </span>
                </span>
              </div>
            </Link>

            <button
              type="button"
              onClick={() => toggleSound(index)}
              aria-label={soundOn === index ? dict.mute : dict.unmute}
              aria-pressed={soundOn === index}
              className="absolute top-3 right-3 z-10 grid h-9 w-9 place-items-center rounded-full
                         bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/75
                         focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cepti-gold"
            >
              {soundOn === index ? (
                <SpeakerOn className="h-4 w-4" />
              ) : (
                <SpeakerOff className="h-4 w-4" />
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
