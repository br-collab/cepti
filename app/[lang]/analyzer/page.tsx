import { notFound } from 'next/navigation'
import { hasLocale } from '@/app/[lang]/dictionaries'
import Analyzer from '@/components/analyzer/Analyzer'

export function generateStaticParams() {
  return [{ lang: 'es' }, { lang: 'en' }]
}

export const metadata = {
  title: 'Analizador de Superficies — CEPTI',
  description:
    'Sube una foto de tu superficie y visualiza productos CEPTI en tiempo real. Descarga un análisis listo para compartir.',
}

export default async function AnalyzerPage({
  params,
}: PageProps<'/[lang]/analyzer'>) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()

  return <Analyzer />
}
