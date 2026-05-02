import Image from 'next/image'

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
      style={{ backgroundImage: "url('/images/brand/Background_plain.jpg')" }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14 lg:py-20 flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
        <div className="w-full lg:w-1/2 flex justify-center lg:justify-start">
          <Image
            src="/images/brand/Building.png"
            alt=""
            width={1200}
            height={650}
            priority
            className="w-full max-w-md lg:max-w-none h-auto"
          />
        </div>
        <div className="w-full lg:w-1/2">
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-white leading-tight mb-5 lg:mb-6">
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
