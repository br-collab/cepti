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
      className="text-white"
      style={{ backgroundColor: '#7a6350' }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <p className="text-base sm:text-lg leading-relaxed text-white max-w-4xl">
          {dict.tagline}
        </p>
      </div>
    </section>
  )
}
