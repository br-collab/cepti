type HeroDict = {
  headline: string
  sub: string
  cta: string
  ctaSecondary: string
  brandLine: string
  tagline: string
}

export default function Hero({ dict }: { dict: HeroDict }) {
  return (
    <section
      className="relative bg-cover bg-center"
      style={{
        backgroundImage: "url('/images/brand/Background_Building_left.jpg')",
        minHeight: '420px',
      }}
    >
      <div className="flex">
        <div className="hidden md:block md:w-1/2" />
        <div className="w-full md:w-1/2 px-8 sm:px-12 py-14 sm:py-20">
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
            {dict.headline}
          </h1>
          <p className="text-base sm:text-lg leading-relaxed text-white/90">
            {dict.tagline}
          </p>
        </div>
      </div>
    </section>
  )
}
