'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type TouchEvent,
} from 'react'

type VisualizerDict = {
  title: string
  sub: string
  hint: string
  selected: string
  beforeBadge: string
  afterBadge: string
  compareHint: string
}

function deriveForegroundSrc(referenceSrc: string): string | null {
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
  tileScalePx = 320,
  dict,
}: {
  referenceSrc: string
  textureSrc: string | null
  textureCode: string | null
  wallInset: { top: string; bottom: string; left: string; right: string }
  tileScalePx?: number
  dict: VisualizerDict
}) {
  const hasTexture = !!textureSrc
  const backgroundSrc = deriveBackgroundSrc(referenceSrc)
  const foregroundSrc = deriveForegroundSrc(referenceSrc)

  const frameRef = useRef<HTMLDivElement>(null)
  const [splitPosition, setSplitPosition] = useState<number>(50)
  const [dragging, setDragging] = useState<boolean>(false)

  // Reset to the middle whenever the user picks a new texture, so the next
  // preview starts in a sensible state instead of inheriting a far-left or
  // far-right split from the previous color.
  useEffect(() => {
    if (textureSrc) setSplitPosition(50)
  }, [textureSrc])

  const updateSplit = useCallback((clientX: number) => {
    const frame = frameRef.current
    if (!frame) return
    const rect = frame.getBoundingClientRect()
    const pct = ((clientX - rect.left) / rect.width) * 100
    setSplitPosition(Math.max(0, Math.min(100, pct)))
  }, [])

  const onMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (!hasTexture) return
    setDragging(true)
    updateSplit(e.clientX)
  }
  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    if (!hasTexture) return
    setDragging(true)
    updateSplit(e.touches[0].clientX)
  }

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: globalThis.MouseEvent | globalThis.TouchEvent) => {
      const x =
        'touches' in e ? e.touches[0].clientX : (e as globalThis.MouseEvent).clientX
      updateSplit(x)
    }
    const onUp = () => setDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onMove)
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
    }
  }, [dragging, updateSplit])

  return (
    <section className="py-16 sm:py-20 bg-stone-50 border-y border-stone-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-6 sm:mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-stone-900">{dict.title}</h2>
            <p className="text-stone-500 text-sm sm:text-base mt-1">
              {hasTexture ? dict.compareHint : dict.sub}
            </p>
          </div>
          {hasTexture && textureCode && (
            <span className="text-sm text-stone-600">
              {dict.selected}:{' '}
              <span className="font-semibold text-cepti-red">{textureCode}</span>
            </span>
          )}
        </div>

        <div
          ref={frameRef}
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
          className={`relative w-full aspect-[16/10] rounded-2xl overflow-hidden shadow-lg bg-stone-200 select-none touch-none ${
            hasTexture ? 'cursor-ew-resize' : ''
          }`}
        >
          {/* Background: wall + floor + spotlight */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={backgroundSrc}
            alt=""
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            draggable={false}
            onError={(e) => {
              const target = e.currentTarget
              if (target.src !== referenceSrc) target.src = referenceSrc
            }}
          />

          {/* Texture overlay, clipped to the right of the split so the left
              side shows the bare wall for comparison. */}
          {hasTexture && (
            <div
              aria-hidden
              className="absolute pointer-events-none"
              style={{
                top: wallInset.top,
                left: wallInset.left,
                right: wallInset.right,
                bottom: wallInset.bottom,
                backgroundImage: `url("${textureSrc}")`,
                backgroundSize: `${tileScalePx}px ${tileScalePx}px`,
                backgroundRepeat: 'repeat',
                backgroundPosition: 'center',
                mixBlendMode: 'multiply',
                opacity: 0.92,
                clipPath: `inset(0 0 0 ${splitPosition}%)`,
              }}
            />
          )}

          {/* Foreground: window + table — sits ABOVE the texture so it isn't covered */}
          {foregroundSrc && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={foregroundSrc}
              alt=""
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              draggable={false}
            />
          )}

          {/* Split line + handle, only when a texture is active */}
          {hasTexture && (
            <>
              <div
                aria-hidden
                className="absolute pointer-events-none bg-white/95 shadow-[0_0_0_1px_rgba(0,0,0,0.15)]"
                style={{
                  left: `calc(${splitPosition}% - 1px)`,
                  top: wallInset.top,
                  bottom: wallInset.bottom,
                  width: '2px',
                }}
              />
              <div
                aria-hidden
                className="absolute pointer-events-none flex items-center justify-center bg-white text-stone-700 font-bold text-base rounded-full shadow-md border border-stone-200"
                style={{
                  left: `calc(${splitPosition}% - 18px)`,
                  top: `calc((${wallInset.top} + (100% - ${wallInset.top} - ${wallInset.bottom}) / 2) - 18px)`,
                  width: '36px',
                  height: '36px',
                }}
              >
                ⇄
              </div>
              <span className="absolute top-3 left-3 bg-black/60 text-white text-[10px] sm:text-xs font-bold uppercase tracking-widest px-2 sm:px-2.5 py-1 rounded">
                {dict.beforeBadge}
              </span>
              <span className="absolute top-3 right-3 bg-black/60 text-white text-[10px] sm:text-xs font-bold uppercase tracking-widest px-2 sm:px-2.5 py-1 rounded">
                {dict.afterBadge}
              </span>
            </>
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
