import Link from 'next/link'

type HeroDict = {
  headline: string
  sub: string
  cta: string
  ctaSecondary: string
}

export default function Hero({ dict }: { dict: HeroDict }) {
  return (
    <section className="relative bg-stone-900 text-white overflow-hidden">
      {/* Background texture overlay */}
      <div className="absolute inset-0 bg-[url('/images/hero-bg.jpg')] bg-cover bg-center opacity-20" />
      <div className="absolute inset-0 bg-gradient-to-br from-stone-900 via-stone-900/95 to-cepti-red/30" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-24 sm:py-36 lg:py-44">
        <div className="max-w-2xl">
          <span className="inline-block text-cepti-gold text-xs font-bold uppercase tracking-widest mb-4">
            CEPTI Corp
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight mb-6">
            {dict.headline}
          </h1>
          <p className="text-lg sm:text-xl text-stone-300 leading-relaxed mb-10 max-w-xl">
            {dict.sub}
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="#productos"
              className="inline-flex items-center justify-center bg-cepti-red text-white font-semibold px-7 py-3.5 rounded-lg hover:bg-cepti-red-dark transition-colors text-base"
            >
              {dict.cta}
            </Link>
            <Link
              href="#contacto"
              className="inline-flex items-center justify-center border border-stone-500 text-stone-200 font-semibold px-7 py-3.5 rounded-lg hover:border-stone-300 hover:text-white transition-colors text-base"
            >
              {dict.ctaSecondary}
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
