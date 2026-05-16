import { notFound } from 'next/navigation'
import { hasLocale } from '@/app/[lang]/dictionaries'
import Analyzer from '@/components/analyzer/Analyzer'

export function generateStaticParams() {
  return [{ lang: 'es' }, { lang: 'en' }]
}

const META = {
  es: {
    title: 'Analizador de Superficies — CEPTI',
    description:
      'Sube una foto de tu superficie y visualiza productos CEPTI en tiempo real. Descarga un análisis listo para compartir.',
  },
  en: {
    title: 'Surface Analyzer — CEPTI',
    description:
      'Upload a photo of your surface and visualize CEPTI products in real time. Download a shareable analysis.',
  },
}

export async function generateMetadata({
  params,
}: PageProps<'/[lang]/analizador'>) {
  const { lang } = await params
  if (!hasLocale(lang)) return {}
  return META[lang]
}

export default async function AnalyzerPage({
  params,
}: PageProps<'/[lang]/analizador'>) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()

  return <Analyzer lang={lang} />
}
