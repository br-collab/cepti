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
import type { Locale } from '@/app/[lang]/dictionaries'
import WhatsAppIcon from '@/components/icons/WhatsAppIcon'

type ProductId =
  | 'ladriflex'
  | 'pinturas'
  | 'papelex'
  | 'arte-con-arena'
  | 'primer'
  | 'granito-liquido'

type ProductOption = {
  id: ProductId
  color: string
  textureSrc?: string
}

const PRODUCTS: ProductOption[] = [
  { id: 'ladriflex', color: '#5DCAA5', textureSrc: '/images/products/ladriflex/texture-01.jpg' },
  { id: 'pinturas', color: '#D85A30', textureSrc: '/images/products/pintura-aterciopelada/texture-01.jpg' },
  { id: 'papelex', color: '#7F77DD', textureSrc: '/images/products/papelex/texture-01.jpg' },
  { id: 'arte-con-arena', color: '#BA7517', textureSrc: '/images/products/arte-con-arena/project-01.jpg' },
  { id: 'primer', color: '#888780' },
  { id: 'granito-liquido', color: '#378ADD', textureSrc: '/images/products/pintura-efecto-granito/texture-01.jpg' },
]

type Strings = {
  eyebrow: string
  headline: string
  subhead: string
  uploadTitle: string
  uploadHint: string
  uploadCta: string
  uploadFormats: string
  errorFormat: string
  errorSize: string
  errorRead: string
  compareTitle: string
  changeImage: string
  compareHint: string
  beforeBadge: string
  afterBadge: string
  productLabel: string
  intensityLabel: string
  intensityAria: string
  analysisLabel: string
  surfaceType: string
  analysisBullets: string[]
  download: string
  downloading: string
  whatsappCta: string
  whatsappMessage: (productName: string, surfaceType: string) => string
  productNames: Record<ProductId, string>
  pdf: {
    title: string
    before: string
    after: string
    dateLocale: string
    recommendedProduct: string
    surfaceAnalysis: string
    nextSteps: string
    nextStepsList: string[]
    contact: string
    footer: string
    filenamePrefix: string
  }
}

const STRINGS: Record<Locale, Strings> = {
  es: {
    eyebrow: 'Analizador de superficies',
    headline: 'Visualiza el acabado en tu propia superficie',
    subhead:
      'Sube una foto, prueba productos CEPTI en tiempo real y descarga un análisis listo para compartir.',
    uploadTitle: 'Sube una foto de tu superficie',
    uploadHint: 'Arrastra y suelta aquí, o haz clic para seleccionar.',
    uploadCta: 'Seleccionar imagen',
    uploadFormats: 'JPG · PNG · WEBP — máximo 10 MB',
    errorFormat: 'Formato no soportado. Usa JPG, PNG o WEBP.',
    errorSize: 'La imagen supera los 10 MB.',
    errorRead: 'No se pudo leer el archivo.',
    compareTitle: 'Compara antes y después',
    changeImage: 'Cambiar imagen',
    compareHint:
      'Arrastra el divisor para revelar el acabado con el producto seleccionado.',
    beforeBadge: 'Antes',
    afterBadge: 'Después',
    productLabel: 'Producto',
    intensityLabel: 'Intensidad',
    intensityAria: 'Opacidad del producto',
    analysisLabel: 'Análisis de superficie',
    surfaceType: 'Bloque de concreto',
    analysisBullets: [
      'Porosidad alta — recomendamos aplicar imprimación antes del producto seleccionado.',
      'Para acabado uniforme, aplicar dos manos respetando los tiempos de secado.',
      'Tiempo de secado entre manos: 4–6 horas a temperatura ambiente (20–25 °C).',
    ],
    download: 'Descargar análisis (PDF)',
    downloading: 'Generando PDF...',
    whatsappCta: 'Hablar por WhatsApp',
    whatsappMessage: (name, surface) =>
      `Hola CEPTI, vengo del Analizador de Superficies. Producto seleccionado: ${name}. Tipo de superficie: ${surface}. ¿Pueden enviarme una cotización?`,
    productNames: {
      ladriflex: 'Ladriflex',
      pinturas: 'Pinturas',
      papelex: 'Papelex',
      'arte-con-arena': 'Arte con Arena',
      primer: 'Primer',
      'granito-liquido': 'Granito Líquido',
    },
    pdf: {
      title: 'ANALIZADOR DE SUPERFICIES CEPTI',
      before: 'ANTES',
      after: 'DESPUÉS',
      dateLocale: 'es-DO',
      recommendedProduct: 'Producto recomendado',
      surfaceAnalysis: 'Análisis de superficie',
      nextSteps: 'Próximos pasos',
      nextStepsList: [
        'Solicita una muestra del color sobre tu superficie real para validar el resultado.',
        'Calcula la cantidad necesaria con la Calculadora CEPTI.',
        'Coordina una visita técnica o pide cotización por WhatsApp.',
      ],
      contact: 'Contacto CEPTI',
      footer:
        'Generado por el Analizador de Superficies CEPTI · cepticorp.com',
      filenamePrefix: 'analisis-cepti',
    },
  },
  en: {
    eyebrow: 'Surface analyzer',
    headline: 'Visualize the finish on your own surface',
    subhead:
      'Upload a photo, try CEPTI products in real time, and download a shareable analysis.',
    uploadTitle: 'Upload a photo of your surface',
    uploadHint: 'Drag and drop here, or click to select.',
    uploadCta: 'Select image',
    uploadFormats: 'JPG · PNG · WEBP — max 10 MB',
    errorFormat: 'Unsupported format. Use JPG, PNG, or WEBP.',
    errorSize: 'Image exceeds 10 MB.',
    errorRead: 'Could not read the file.',
    compareTitle: 'Compare before and after',
    changeImage: 'Change image',
    compareHint:
      'Drag the divider to reveal the finish with the selected product.',
    beforeBadge: 'Before',
    afterBadge: 'After',
    productLabel: 'Product',
    intensityLabel: 'Intensity',
    intensityAria: 'Product opacity',
    analysisLabel: 'Surface analysis',
    surfaceType: 'Concrete block',
    analysisBullets: [
      'High porosity — we recommend applying primer before the selected product.',
      'For a uniform finish, apply two coats while respecting drying times.',
      'Drying time between coats: 4–6 hours at room temperature (20–25 °C).',
    ],
    download: 'Download analysis (PDF)',
    downloading: 'Generating PDF...',
    whatsappCta: 'Chat on WhatsApp',
    whatsappMessage: (name, surface) =>
      `Hi CEPTI, I'm coming from the Surface Analyzer. Selected product: ${name}. Surface type: ${surface}. Can you send me a quote?`,
    productNames: {
      ladriflex: 'Ladriflex',
      pinturas: 'Paints',
      papelex: 'Papelex',
      'arte-con-arena': 'Sand Art',
      primer: 'Primer',
      'granito-liquido': 'Liquid Granite',
    },
    pdf: {
      title: 'CEPTI SURFACE ANALYZER',
      before: 'BEFORE',
      after: 'AFTER',
      dateLocale: 'en-US',
      recommendedProduct: 'Recommended product',
      surfaceAnalysis: 'Surface analysis',
      nextSteps: 'Next steps',
      nextStepsList: [
        'Request a color sample on your real surface to validate the result.',
        'Calculate the quantity needed with the CEPTI Calculator.',
        'Schedule a technical visit or request a quote on WhatsApp.',
      ],
      contact: 'CEPTI Contact',
      footer: 'Generated by the CEPTI Surface Analyzer · cepticorp.com',
      filenamePrefix: 'cepti-analysis',
    },
  },
}

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

export default function Analyzer({ lang }: { lang: Locale }) {
  const t = STRINGS[lang]

  const [image, setImage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<ProductOption>(PRODUCTS[0])
  const [opacity, setOpacity] = useState<number>(70)
  const [splitPosition, setSplitPosition] = useState<number>(50)
  const [dragging, setDragging] = useState<boolean>(false)
  const [generating, setGenerating] = useState<boolean>(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const textureRef = useRef<HTMLImageElement | null>(null)
  const [textureVersion, setTextureVersion] = useState(0)

  useEffect(() => {
    if (!selected.textureSrc) {
      textureRef.current = null
      setTextureVersion((v) => v + 1)
      return
    }
    const tex = new Image()
    tex.crossOrigin = 'anonymous'
    tex.onload = () => {
      textureRef.current = tex
      setTextureVersion((v) => v + 1)
    }
    tex.src = selected.textureSrc
  }, [selected])

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
    const alpha = opacity / 100
    const texture = textureRef.current

    ctx.save()
    ctx.beginPath()
    ctx.rect(splitX, 0, canvas.width - splitX, canvas.height)
    ctx.clip()

    // Solid product color as the base coat so the result reads as paint
    // covering the surface, not a transparent veil over the original photo.
    ctx.globalAlpha = alpha
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = `rgb(${r},${g},${b})`
    ctx.fillRect(splitX, 0, canvas.width - splitX, canvas.height)

    if (texture) {
      // Tile the texture on top with multiply so the swatch's pattern shows
      // through without lifting the original photo back through the paint.
      const tileSize = Math.max(160, Math.round(canvas.width / 6))
      const cols = Math.ceil((canvas.width - splitX) / tileSize) + 1
      const rows = Math.ceil(canvas.height / tileSize) + 1
      ctx.globalAlpha = Math.min(1, alpha + 0.2)
      ctx.globalCompositeOperation = 'multiply'
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          ctx.drawImage(
            texture,
            splitX + col * tileSize,
            row * tileSize,
            tileSize,
            tileSize
          )
        }
      }
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    ctx.restore()
    void textureVersion

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
  }, [selected, opacity, splitPosition, textureVersion])

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
      setError(t.errorFormat)
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setError(t.errorSize)
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setImage(reader.result as string)
      setSplitPosition(50)
    }
    reader.onerror = () => setError(t.errorRead)
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

  const selectedName = t.productNames[selected.id]

  const buildWhatsAppHref = () => {
    const msg = t.whatsappMessage(selectedName, t.surfaceType)
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
      tctx.fillText(t.pdf.before, 75, 38)
      tctx.fillText(t.pdf.after, tmp.width - 75, 38)
      const dataUrl = tmp.toDataURL('image/jpeg', 0.9)

      const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
      pdf.setProperties({
        title: t.pdf.title,
        subject: `${t.pdf.surfaceAnalysis}: ${t.surfaceType}`,
        author: 'CEPTI',
        creator: t.pdf.title,
      })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const margin = 14

      pdf.setFillColor(...HEADER_GREEN)
      pdf.rect(0, 0, pageW, 28, 'F')
      pdf.setTextColor(255, 255, 255)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(16)
      pdf.text(t.pdf.title, margin, 14)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      const today = new Date().toLocaleDateString(t.pdf.dateLocale, {
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
      pdf.text(t.pdf.recommendedProduct, margin + 22, y + 9)
      pdf.setTextColor(40, 40, 40)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(13)
      pdf.text(selectedName, margin + 22, y + 16)
      y += 28

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.setTextColor(...HEADER_GREEN)
      pdf.text(`${t.pdf.surfaceAnalysis}: ${t.surfaceType}`, margin, y)
      y += 6
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.setTextColor(60, 60, 60)
      t.analysisBullets.forEach((b) => {
        const lines = pdf.splitTextToSize(`•  ${b}`, pageW - margin * 2 - 4)
        pdf.text(lines, margin + 2, y)
        y += lines.length * 5 + 1
      })
      y += 4

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.setTextColor(...HEADER_GREEN)
      pdf.text(t.pdf.nextSteps, margin, y)
      y += 6
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.setTextColor(60, 60, 60)
      t.pdf.nextStepsList.forEach((s, i) => {
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
      pdf.text(t.pdf.contact, margin + 4, y + 7)
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
      pdf.text(t.pdf.footer, pageW / 2, pageH - 8, { align: 'center' })

      pdf.save(`${t.pdf.filenamePrefix}-${selected.id}.pdf`)
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
          {t.eyebrow}
        </p>
        <h1 className="font-display text-3xl sm:text-5xl font-bold text-stone-900 tracking-tight">
          {t.headline}
        </h1>
        <p className="text-stone-600 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
          {t.subhead}
        </p>
      </header>

      {!image ? (
        <UploadZone t={t} onDrop={onDrop} onInput={onFileInput} error={error} />
      ) : (
        <>
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <h2 className="font-display text-xl sm:text-2xl font-bold text-stone-900">
                {t.compareTitle}
              </h2>
              <button
                type="button"
                onClick={reset}
                className="text-sm font-medium text-stone-500 hover:text-cepti-red transition-colors underline-offset-4 hover:underline"
              >
                {t.changeImage}
              </button>
            </div>
            <p className="text-stone-500 text-sm">{t.compareHint}</p>

            <div className="relative bg-stone-100 rounded-2xl overflow-hidden shadow-sm">
              <canvas
                ref={canvasRef}
                onMouseDown={onMouseDown}
                onTouchStart={onTouchStart}
                className="block w-full cursor-ew-resize select-none touch-none"
              />
              <span className="absolute top-3 left-3 bg-black/60 text-white text-[10px] sm:text-xs font-bold uppercase tracking-widest px-2 sm:px-2.5 py-1 rounded">
                {t.beforeBadge}
              </span>
              <span className="absolute top-3 right-3 bg-black/60 text-white text-[10px] sm:text-xs font-bold uppercase tracking-widest px-2 sm:px-2.5 py-1 rounded">
                {t.afterBadge}
              </span>
            </div>
          </section>

          <ProductSwitcher t={t} selected={selected} onSelect={setSelected} />
          <OpacitySlider t={t} value={opacity} onChange={setOpacity} />

          <AnalysisCard t={t} />

          <ActionRow
            t={t}
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
  t,
  onDrop,
  onInput,
  error,
}: {
  t: Strings
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
            {t.uploadTitle}
          </h2>
          <p className="text-stone-500 mb-6 text-base">{t.uploadHint}</p>
          <span className="inline-flex items-center bg-cepti-brown text-cepti-cream font-semibold px-5 py-3 rounded-lg hover:bg-cepti-brown-dark transition-colors">
            {t.uploadCta}
          </span>
          <p className="mt-5 text-xs text-stone-400 uppercase tracking-widest">
            {t.uploadFormats}
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
  t,
  selected,
  onSelect,
}: {
  t: Strings
  selected: ProductOption
  onSelect: (p: ProductOption) => void
}) {
  return (
    <section className="space-y-3">
      <h3 className="font-display text-lg font-bold text-stone-900">
        {t.productLabel}
      </h3>
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
                {t.productNames[p.id]}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function OpacitySlider({
  t,
  value,
  onChange,
}: {
  t: Strings
  value: number
  onChange: (n: number) => void
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-bold text-stone-900">
          {t.intensityLabel}
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
        aria-label={t.intensityAria}
      />
    </section>
  )
}

function AnalysisCard({ t }: { t: Strings }) {
  return (
    <section className="bg-cepti-cream/40 rounded-2xl border border-cepti-brown/15 p-5 sm:p-6 space-y-3">
      <p className="text-xs font-bold uppercase tracking-widest text-cepti-brown">
        {t.analysisLabel}
      </p>
      <h3 className="font-display text-2xl sm:text-3xl font-bold text-stone-900">
        {t.surfaceType}
      </h3>
      <ul className="space-y-2 text-stone-700 text-sm sm:text-base leading-relaxed pt-1">
        {t.analysisBullets.map((b, i) => (
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
  t,
  onDownload,
  generating,
  whatsappHref,
}: {
  t: Strings
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
        {generating ? t.downloading : t.download}
      </button>
      <a
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 inline-flex items-center justify-center gap-2 bg-green-600 text-white font-semibold px-6 py-4 rounded-xl hover:bg-green-700 transition-colors"
      >
        <WhatsAppIcon size={18} />
        {t.whatsappCta}
      </a>
    </section>
  )
}
