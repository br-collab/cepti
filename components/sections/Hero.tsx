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
      className="relative text-white bg-cover bg-center"
      style={{
        backgroundImage: "url('/images/brand/Background_Building_right.jpg')",
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-black/45"
      />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <p className="text-base sm:text-lg leading-relaxed text-white max-w-4xl drop-shadow-md">
          {dict.tagline}
        </p>
      </div>
    </section>
  )
}
