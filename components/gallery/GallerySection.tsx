'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import Lightbox from '@/components/products/Lightbox'

type Props = {
  slug: string
  name: string
  images: string[]
  productHref: string
  viewDetailsLabel: string
  rowIndex: number
}

export default function GallerySection({
  slug,
  name,
  images,
  productHref,
  viewDetailsLabel,
  rowIndex,
}: Props) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  const bg = rowIndex % 2 === 0 ? 'bg-background' : 'bg-stone-50'

  return (
    <section id={slug} className={`py-12 sm:py-16 scroll-mt-28 ${bg}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-stone-900">{name}</h2>
          <Link
            href={productHref}
            className="text-sm font-semibold text-cepti-brown hover:text-cepti-brown-dark transition-colors"
          >
            {viewDetailsLabel} →
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setLightboxIdx(i)}
              className="relative aspect-[4/3] overflow-hidden rounded-xl bg-stone-100 group cursor-zoom-in"
            >
              <Image
                src={src}
                alt={`${name} ${i + 1}`}
                fill
                sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover group-hover:scale-[1.03] transition-transform duration-300"
              />
            </button>
          ))}
        </div>
      </div>

      <Lightbox
        images={images}
        index={lightboxIdx}
        onClose={() => setLightboxIdx(null)}
        onChange={setLightboxIdx}
        alt={name}
      />
    </section>
  )
}
