import Image from 'next/image'
import Link from 'next/link'

type HeroDict = {
  headline: string
  sub: string
  cta: string
  ctaSecondary: string
  brandLine: string
}

export default function Hero({ dict }: { dict: HeroDict }) {
  return (
    <section className="relative bg-cepti-texture text-cepti-cream overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            'radial-gradient(ellipse at 30% 40%, rgba(0,0,0,0.18) 0%, transparent 55%), radial-gradient(ellipse at 85% 95%, rgba(0,0,0,0.35) 0%, transparent 60%)',
        }}
      />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 lg:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          <div className="order-2 lg:order-1 lg:col-span-6">
            <div className="relative aspect-[4/3] w-full">
              <Image
                src="/images/brand/hero-architecture.png"
                alt="Arquitectura CEPTI"
                fill
                priority
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-contain drop-shadow-2xl"
              />
            </div>
          </div>

          <div className="order-1 lg:order-2 lg:col-span-6">
            <div className="max-w-xl">
              <div className="relative h-14 sm:h-16 w-44 sm:w-52 mb-8">
                <Image
                  src="/images/brand/logo-light.png"
                  alt="CEPTI — materiales de acabados"
                  fill
                  priority
                  sizes="220px"
                  className="object-contain object-left"
                />
              </div>

              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-semibold leading-[1.1] tracking-tight text-cepti-cream mb-6">
                {dict.headline}
              </h1>

              <p className="text-base sm:text-lg text-cepti-cream-dim leading-relaxed mb-8">
                {dict.sub}
              </p>

              <p className="font-display text-sm sm:text-base text-cepti-cream/70 italic mb-10 max-w-md leading-snug">
                {dict.brandLine}
              </p>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <Link
                  href="#productos"
                  className="inline-flex items-center justify-center bg-cepti-cream text-cepti-brown-dark font-semibold px-7 py-3.5 rounded-md hover:bg-white transition-colors text-base"
                >
                  {dict.cta}
                </Link>
                <Link
                  href="#contacto"
                  className="inline-flex items-center justify-center border border-cepti-cream/40 text-cepti-cream font-medium px-7 py-3.5 rounded-md hover:bg-cepti-cream/10 hover:border-cepti-cream/70 transition-colors text-base"
                >
                  {dict.ctaSecondary}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        aria-hidden
        className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-b from-transparent to-black/10"
      />
    </section>
  )
}
