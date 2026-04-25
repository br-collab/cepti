'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type MouseEvent,
  type TouchEvent,
} from 'react'
import jsPDF from 'jspdf'

type ProductOption = {
  id: string
  name: string
  color: string
}

const PRODUCTS: ProductOption[] = [
  { id: 'ladriflex', name: 'Ladriflex', color: '#5DCAA5' },
  { id: 'pinturas', name: 'Pinturas', color: '#D85A30' },
  { id: 'papelex', name: 'Papelex', color: '#7F77DD' },
  { id: 'arte-con-arena', name: 'Arte con Arena', color: '#BA7517' },
  { id: 'primer', name: 'Primer', color: '#888780' },
  { id: 'granito-liquido', name: 'Granito Líquido', color: '#378ADD' },
]

const SURFACE_TYPE = 'Bloque de concreto'

const ANALYSIS_BULLETS = [
  'Porosidad alta — recomendamos aplicar imprimación antes del producto seleccionado.',
  'Para acabado uniforme, aplicar dos manos respetando los tiempos de secado.',
  'Tiempo de secado entre manos: 4–6 horas a temperatura ambiente (20–25 °C).',
]

const NEXT_STEPS = [
  'Solicita una muestra del color sobre tu superficie real para validar el resultado.',
  'Calcula la cantidad necesaria con la Calculadora CEPTI.',
  'Coordina una visita técnica o pide cotización por WhatsApp.',
]

const WHATSAPP_NUMBER = '19172461283'
const WHATSAPP_DISPLAY = '+1 (917) 246-1283'
const HEADER_GREEN: [number, number, number] = [15, 110, 86]

const MAX_FILE_SIZE = 10 * 1024 * 1024
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  }
}

export default function Analyzer() {
  const [image, setImage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<ProductOption>(PRODUCTS[0])
  const [opacity, setOpacity] = useState<number>(45)
  const [splitPosition, setSplitPosition] = useState<number>(50)
  const [dragging, setDragging] = useState<boolean>(false)
  const [generating, setGenerating] = useState<boolean>(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const img = imageRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const containerWidth = canvas.clientWidth
    if (containerWidth === 0) return
    const ratio = img.naturalHeight / img.naturalWidth
    canvas.width = containerWidth
    canvas.height = Math.round(containerWidth * ratio)

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    const splitX = (splitPosition / 100) * canvas.width
    const { r, g, b } = hexToRgb(selected.color)

    ctx.save()
    ctx.beginPath()
    ctx.rect(splitX, 0, canvas.width - splitX, canvas.height)
    ctx.clip()
    ctx.fillStyle = `rgba(${r},${g},${b},${opacity / 100})`
    ctx.fillRect(splitX, 0, canvas.width - splitX, canvas.height)
    ctx.restore()

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(splitX - 1, 0, 2, canvas.height)

    const handleY = canvas.height / 2
    ctx.beginPath()
    ctx.arc(splitX, handleY, 18, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.strokeStyle = `rgb(${HEADER_GREEN.join(',')})`
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = `rgb(${HEADER_GREEN.join(',')})`
    ctx.font = 'bold 16px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('⇄', splitX, handleY)
  }, [selected, opacity, splitPosition])

  useEffect(() => {
    if (!image) {
      imageRef.current = null
      return
    }
    const img = new Image()
    img.onload = () => {
      imageRef.current = img
      requestAnimationFrame(() => draw())
    }
    img.src = image
  }, [image, draw])

  useEffect(() => {
    draw()
  }, [draw])

  useEffect(() => {
    const handleResize = () => draw()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [draw])

  const handleFile = (file: File) => {
    setError(null)
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Formato no soportado. Usa JPG, PNG o WEBP.')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('La imagen supera los 10 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setImage(reader.result as string)
      setSplitPosition(50)
    }
    reader.onerror = () => setError('No se pudo leer el archivo.')
    reader.readAsDataURL(file)
  }

  const onFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const updateSplit = useCallback((clientX: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const pct = ((clientX - rect.left) / rect.width) * 100
    setSplitPosition(Math.max(0, Math.min(100, pct)))
  }, [])

  const onMouseDown = (e: MouseEvent<HTMLCanvasElement>) => {
    setDragging(true)
    updateSplit(e.clientX)
  }
  const onTouchStart = (e: TouchEvent<HTMLCanvasElement>) => {
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

  const buildWhatsAppHref = () => {
    const msg = `Hola CEPTI, vengo del Analizador de Superficies. Producto seleccionado: ${selected.name}. Tipo de superficie: ${SURFACE_TYPE}. ¿Pueden enviarme una cotización?`
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`
  }

  const downloadPdf = async () => {
    const img = imageRef.current
    if (!img) return
    setGenerating(true)
    try {
      const tmp = document.createElement('canvas')
      const targetWidth = 1200
      const ratio = img.naturalHeight / img.naturalWidth
      tmp.width = targetWidth
      tmp.height = Math.round(targetWidth * ratio)
      const tctx = tmp.getContext('2d')
      if (!tctx) return
      tctx.drawImage(img, 0, 0, tmp.width, tmp.height)
      const splitX = tmp.width / 2
      const { r, g, b } = hexToRgb(selected.color)
      tctx.save()
      tctx.beginPath()
      tctx.rect(splitX, 0, tmp.width - splitX, tmp.height)
      tctx.clip()
      tctx.fillStyle = `rgba(${r},${g},${b},${opacity / 100})`
      tctx.fillRect(splitX, 0, tmp.width - splitX, tmp.height)
      tctx.restore()

      tctx.fillStyle = 'rgba(0,0,0,0.6)'
      tctx.fillRect(20, 20, 110, 36)
      tctx.fillRect(tmp.width - 130, 20, 110, 36)
      tctx.fillStyle = '#ffffff'
      tctx.font = 'bold 18px sans-serif'
      tctx.textAlign = 'center'
      tctx.textBaseline = 'middle'
      tctx.fillText('ANTES', 75, 38)
      tctx.fillText('DESPUÉS', tmp.width - 75, 38)
      const dataUrl = tmp.toDataURL('image/jpeg', 0.9)

      const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const margin = 14

      pdf.setFillColor(...HEADER_GREEN)
      pdf.rect(0, 0, pageW, 28, 'F')
      pdf.setTextColor(255, 255, 255)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(16)
      pdf.text('ANALIZADOR DE SUPERFICIES CEPTI', margin, 14)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      const today = new Date().toLocaleDateString('es-DO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
      pdf.text(today, margin, 22)

      let y = 36
      const imgW = pageW - margin * 2
      const imgH = imgW * ratio
      const maxImgH = 90
      const finalImgH = Math.min(imgH, maxImgH)
      const finalImgW = finalImgH === maxImgH ? maxImgH / ratio : imgW
      const offsetX = (pageW - finalImgW) / 2
      pdf.addImage(dataUrl, 'JPEG', offsetX, y, finalImgW, finalImgH)
      y += finalImgH + 8

      pdf.setFillColor(245, 240, 232)
      pdf.rect(margin, y, pageW - margin * 2, 22, 'F')
      const rgb = hexToRgb(selected.color)
      pdf.setFillColor(rgb.r, rgb.g, rgb.b)
      pdf.rect(margin + 4, y + 5, 12, 12, 'F')
      pdf.setTextColor(110, 100, 90)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      pdf.text('Producto recomendado', margin + 22, y + 9)
      pdf.setTextColor(40, 40, 40)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(13)
      pdf.text(selected.name, margin + 22, y + 16)
      y += 28

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.setTextColor(...HEADER_GREEN)
      pdf.text(`Análisis de superficie: ${SURFACE_TYPE}`, margin, y)
      y += 6
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.setTextColor(60, 60, 60)
      ANALYSIS_BULLETS.forEach((b) => {
        const lines = pdf.splitTextToSize(`•  ${b}`, pageW - margin * 2 - 4)
        pdf.text(lines, margin + 2, y)
        y += lines.length * 5 + 1
      })
      y += 4

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.setTextColor(...HEADER_GREEN)
      pdf.text('Próximos pasos', margin, y)
      y += 6
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.setTextColor(60, 60, 60)
      NEXT_STEPS.forEach((s, i) => {
        const lines = pdf.splitTextToSize(`${i + 1}.  ${s}`, pageW - margin * 2 - 4)
        pdf.text(lines, margin + 2, y)
        y += lines.length * 5 + 1
      })
      y += 6

      pdf.setFillColor(...HEADER_GREEN)
      pdf.rect(margin, y, pageW - margin * 2, 20, 'F')
      pdf.setTextColor(255, 255, 255)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      pdf.text('Contacto CEPTI', margin + 4, y + 7)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      pdf.text(
        `cepticorp.com   ·   WhatsApp ${WHATSAPP_DISPLAY}   ·   @cepti_rd   ·   info@cepticorp.com`,
        margin + 4,
        y + 14
      )

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      pdf.setTextColor(150, 150, 150)
      pdf.text(
        'Generado por el Analizador de Superficies CEPTI · cepticorp.com',
        pageW / 2,
        pageH - 8,
        { align: 'center' }
      )

      pdf.save(`analisis-cepti-${selected.id}.pdf`)
    } finally {
      setGenerating(false)
    }
  }

  const reset = () => {
    setImage(null)
    setError(null)
    imageRef.current = null
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-8">
      <header className="text-center space-y-3">
        <p className="inline-block text-xs font-bold uppercase tracking-widest text-cepti-brown bg-cepti-cream px-3 py-1 rounded-full">
          Analizador de superficies
        </p>
        <h1 className="font-display text-3xl sm:text-5xl font-bold text-stone-900 tracking-tight">
          Visualiza el acabado en tu propia superficie
        </h1>
        <p className="text-stone-600 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
          Sube una foto, prueba productos CEPTI en tiempo real y descarga un análisis listo para compartir.
        </p>
      </header>

      {!image ? (
        <UploadZone onDrop={onDrop} onInput={onFileInput} error={error} />
      ) : (
        <>
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <h2 className="font-display text-xl sm:text-2xl font-bold text-stone-900">
                Compara antes y después
              </h2>
              <button
                type="button"
                onClick={reset}
                className="text-sm font-medium text-stone-500 hover:text-cepti-red transition-colors underline-offset-4 hover:underline"
              >
                Cambiar imagen
              </button>
            </div>
            <p className="text-stone-500 text-sm">
              Arrastra el divisor para revelar el acabado con el producto seleccionado.
            </p>

            <div className="relative bg-stone-100 rounded-2xl overflow-hidden shadow-sm">
              <canvas
                ref={canvasRef}
                onMouseDown={onMouseDown}
                onTouchStart={onTouchStart}
                className="block w-full cursor-ew-resize select-none touch-none"
              />
              <span className="absolute top-3 left-3 bg-black/60 text-white text-[10px] sm:text-xs font-bold uppercase tracking-widest px-2 sm:px-2.5 py-1 rounded">
                Antes
              </span>
              <span className="absolute top-3 right-3 bg-black/60 text-white text-[10px] sm:text-xs font-bold uppercase tracking-widest px-2 sm:px-2.5 py-1 rounded">
                Después
              </span>
            </div>
          </section>

          <ProductSwitcher selected={selected} onSelect={setSelected} />
          <OpacitySlider value={opacity} onChange={setOpacity} />

          <AnalysisCard />

          <ActionRow
            onDownload={downloadPdf}
            generating={generating}
            whatsappHref={buildWhatsAppHref()}
          />
        </>
      )}
    </div>
  )
}

function UploadZone({
  onDrop,
  onInput,
  error,
}: {
  onDrop: (e: DragEvent<HTMLLabelElement>) => void
  onInput: (e: ChangeEvent<HTMLInputElement>) => void
  error: string | null
}) {
  return (
    <section>
      <label
        htmlFor="analyzer-upload"
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        className="block cursor-pointer"
      >
        <div className="border-2 border-dashed border-stone-300 rounded-2xl p-10 sm:p-16 text-center bg-white hover:border-cepti-brown hover:bg-cepti-cream/40 transition-colors">
          <div className="mx-auto w-14 h-14 rounded-full bg-cepti-brown/10 text-cepti-brown flex items-center justify-center mb-5">
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-stone-900 mb-2">
            Sube una foto de tu superficie
          </h2>
          <p className="text-stone-500 mb-6 text-base">
            Arrastra y suelta aquí, o haz clic para seleccionar.
          </p>
          <span className="inline-flex items-center bg-cepti-brown text-cepti-cream font-semibold px-5 py-3 rounded-lg hover:bg-cepti-brown-dark transition-colors">
            Seleccionar imagen
          </span>
          <p className="mt-5 text-xs text-stone-400 uppercase tracking-widest">
            JPG · PNG · WEBP — máximo 10 MB
          </p>
        </div>
        <input
          id="analyzer-upload"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={onInput}
          className="sr-only"
        />
      </label>
      {error ? (
        <p className="mt-3 text-sm text-cepti-red text-center" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}

function ProductSwitcher({
  selected,
  onSelect,
}: {
  selected: ProductOption
  onSelect: (p: ProductOption) => void
}) {
  return (
    <section className="space-y-3">
      <h3 className="font-display text-lg font-bold text-stone-900">Producto</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {PRODUCTS.map((p) => {
          const active = p.id === selected.id
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p)}
              aria-pressed={active}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 px-3 py-4 transition-all ${
                active
                  ? 'border-cepti-brown bg-cepti-cream/40 shadow-sm'
                  : 'border-stone-200 bg-white hover:border-stone-300'
              }`}
            >
              <span
                className="block w-10 h-10 rounded-full border border-black/5"
                style={{ backgroundColor: p.color }}
                aria-hidden
              />
              <span className="text-xs sm:text-sm font-semibold text-stone-700 text-center leading-tight">
                {p.name}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function OpacitySlider({
  value,
  onChange,
}: {
  value: number
  onChange: (n: number) => void
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-bold text-stone-900">
          Intensidad
        </h3>
        <span className="text-sm font-medium text-stone-600 tabular-nums">
          {value}%
        </span>
      </div>
      <input
        type="range"
        min={10}
        max={80}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-cepti-brown"
        aria-label="Opacidad del producto"
      />
    </section>
  )
}

function AnalysisCard() {
  return (
    <section className="bg-cepti-cream/40 rounded-2xl border border-cepti-brown/15 p-5 sm:p-6 space-y-3">
      <p className="text-xs font-bold uppercase tracking-widest text-cepti-brown">
        Análisis de superficie
      </p>
      <h3 className="font-display text-2xl sm:text-3xl font-bold text-stone-900">
        {SURFACE_TYPE}
      </h3>
      <ul className="space-y-2 text-stone-700 text-sm sm:text-base leading-relaxed pt-1">
        {ANALYSIS_BULLETS.map((b, i) => (
          <li key={i} className="flex gap-3">
            <span className="text-cepti-brown font-bold mt-0.5">•</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ActionRow({
  onDownload,
  generating,
  whatsappHref,
}: {
  onDownload: () => void
  generating: boolean
  whatsappHref: string
}) {
  return (
    <section className="flex flex-col sm:flex-row gap-3">
      <button
        type="button"
        onClick={onDownload}
        disabled={generating}
        className="flex-1 inline-flex items-center justify-center gap-2 bg-cepti-brown text-cepti-cream font-semibold px-6 py-4 rounded-xl hover:bg-cepti-brown-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        {generating ? 'Generando PDF...' : 'Descargar análisis (PDF)'}
      </button>
      <a
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 inline-flex items-center justify-center gap-2 bg-green-600 text-white font-semibold px-6 py-4 rounded-xl hover:bg-green-700 transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.15-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
        Hablar por WhatsApp
      </a>
    </section>
  )
}
