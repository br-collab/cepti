'use client'

type VisualizerDict = {
  title: string
  sub: string
  hint: string
  selected: string
}

function deriveForegroundSrc(referenceSrc: string): string | null {
  // Convention: a foreground SVG sits next to the reference with -fg suffix.
  // e.g. /images/visualizer/interior-wall.svg -> /images/visualizer/interior-wall-fg.svg
  const match = referenceSrc.match(/^(.*)\.([a-z0-9]+)$/i)
  if (!match) return null
  const [, base, ext] = match
  return `${base}-fg.${ext}`
}

function deriveBackgroundSrc(referenceSrc: string): string {
  const match = referenceSrc.match(/^(.*)\.([a-z0-9]+)$/i)
  if (!match) return referenceSrc
  const [, base, ext] = match
  return `${base}-bg.${ext}`
}

export default function TextureVisualizer({
  referenceSrc,
  textureSrc,
  textureCode,
  wallInset,
  dict,
}: {
  referenceSrc: string
  textureSrc: string | null
  textureCode: string | null
  wallInset: { top: string; bottom: string; left: string; right: string }
  dict: VisualizerDict
}) {
  const hasTexture = !!textureSrc
  const backgroundSrc = deriveBackgroundSrc(referenceSrc)
  const foregroundSrc = deriveForegroundSrc(referenceSrc)

  return (
    <section className="py-16 sm:py-20 bg-stone-50 border-y border-stone-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-6 sm:mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-stone-900">{dict.title}</h2>
            <p className="text-stone-500 text-sm sm:text-base mt-1">{dict.sub}</p>
          </div>
          {hasTexture && textureCode && (
            <span className="text-sm text-stone-600">
              {dict.selected}:{' '}
              <span className="font-semibold text-cepti-red">{textureCode}</span>
            </span>
          )}
        </div>

        <div className="relative w-full aspect-[16/10] rounded-2xl overflow-hidden shadow-lg bg-stone-200">
          {/* Background: wall + floor + spotlight */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={backgroundSrc}
            alt=""
            className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
            draggable={false}
            onError={(e) => {
              // Fallback: if -bg variant doesn't exist, use the original reference
              const target = e.currentTarget
              if (target.src !== referenceSrc) target.src = referenceSrc
            }}
          />

          {/* Texture overlay on wall region */}
          {hasTexture ? (
            <div
              aria-hidden
              className="absolute transition-opacity duration-300"
              style={{
                top: wallInset.top,
                left: wallInset.left,
                right: wallInset.right,
                bottom: wallInset.bottom,
                backgroundImage: `url("${textureSrc}")`,
                backgroundSize: '220px 220px',
                backgroundRepeat: 'repeat',
                mixBlendMode: 'multiply',
                opacity: 0.92,
              }}
            />
          ) : null}

          {/* Foreground: window + table — sits ABOVE the texture so it isn't covered */}
          {foregroundSrc && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={foregroundSrc}
              alt=""
              className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
              draggable={false}
            />
          )}

          {!hasTexture && (
            <div className="absolute inset-0 flex items-start justify-center pt-10 sm:pt-16 pointer-events-none">
              <span className="bg-black/60 text-white text-xs sm:text-sm font-medium px-3 py-2 rounded-full backdrop-blur-sm">
                {dict.hint}
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
