const pillarKeys = ['quality', 'coverage', 'support'] as const

const pillarIcons: Record<string, string> = {
  quality: '✓',
  coverage: '◉',
  support: '⬡',
}

type WhyUsDict = {
  title: string
  sub: string
  pillars: Record<string, { title: string; desc: string }>
}

export default function WhyUs({ dict }: { dict: WhyUsDict }) {
  return (
    <section id="porque-cepti" className="py-20 sm:py-28 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-stone-900 mb-3">{dict.title}</h2>
          <p className="text-stone-500 text-lg">{dict.sub}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {pillarKeys.map((key) => {
            const pillar = dict.pillars[key]
            return (
              <div key={key} className="text-center px-4">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-cepti-red/10 text-cepti-red text-2xl font-bold mb-5">
                  {pillarIcons[key]}
                </div>
                <h3 className="text-xl font-semibold text-stone-900 mb-3">{pillar.title}</h3>
                <p className="text-stone-500 leading-relaxed">{pillar.desc}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
