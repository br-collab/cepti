'use client'

import Image from 'next/image'
import { useCallback, useEffect } from 'react'

type Props = {
  images: string[]
  index: number | null
  onClose: () => void
  onChange: (next: number) => void
  alt?: string
}

export default function Lightbox({ images, index, onClose, onChange, alt = '' }: Props) {
  const total = images.length
  const open = index !== null && total > 0

  const goPrev = useCallback(() => {
    if (index === null || total === 0) return
    onChange((index - 1 + total) % total)
  }, [index, total, onChange])

  const goNext = useCallback(() => {
    if (index === null || total === 0) return
    onChange((index + 1) % total)
  }, [index, total, onChange])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, goPrev, goNext])

  if (!open || index === null) return null
  const src = images[index]
  if (!src) return null
  const showNav = total > 1

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        aria-label="Close"
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white text-xl flex items-center justify-center z-10"
      >
        ×
      </button>

      {showNav && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              goPrev()
            }}
            aria-label="Previous image"
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/10 hover:bg-white/25 text-white text-2xl flex items-center justify-center transition-colors z-10"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              goNext()
            }}
            aria-label="Next image"
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/10 hover:bg-white/25 text-white text-2xl flex items-center justify-center transition-colors z-10"
          >
            ›
          </button>
          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs sm:text-sm font-medium px-3 py-1.5 rounded-full">
            {index + 1} / {total}
          </span>
        </>
      )}

      <div
        className="relative w-full max-w-5xl aspect-[4/3]"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={src}
          alt={alt}
          fill
          sizes="100vw"
          className="object-contain"
        />
      </div>
    </div>
  )
}
