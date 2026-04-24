import { notFound } from 'next/navigation'
import { hasLocale } from '@/app/[lang]/dictionaries'

export function generateStaticParams() {
  return [{ lang: 'es' }, { lang: 'en' }]
}

export const metadata = {
  title: 'Sobre Nosotros — CEPTI',
}

export default async function SobreNosotrosPage({
  params,
}: PageProps<'/[lang]/sobre-nosotros'>) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()

  return (
    <section className="py-16 sm:py-24 bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight text-cepti-brown-dark mb-8">
          Sobre Nosotros
        </h1>

        <div className="space-y-6 text-base sm:text-lg leading-relaxed text-stone-700">
          <p>
            CEPTI es un fabricante innovador de materiales de decoración de vanguardia
            para todos tipos de superficies de interiores y exteriores, que transformarán
            y ampliarán los límites de sus ideas de decoración por menos dinero.
          </p>

          <p>
            CEPTI se creó en el año 2017 para la implementación de las tecnologías del
            día de mañana, la introducción de nuevas soluciones, únicas e innovadoras,
            que podrían ya ahora satisfacer las necesidades del futuro en la República
            Dominicana y todo el mundo.
          </p>

          <div>
            <p className="mb-4">Nuestros metas y objetivos son:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                Búsqueda de las tecnologías innovadoras con ideas modernas y de las
                empresas reconocidas como líderes de alta tecnología en todo el mundo
              </li>
              <li>
                Reemplazo de costosos materiales de acabado por otro más económico y
                seguro
              </li>
              <li>
                Revestimiento y protección de fachadas con diversas texturas y colores
                creados por la naturaleza
              </li>
              <li>
                Implementación de nuevas ideas y soluciones de diseño en los interiores
                y exteriores
              </li>
              <li>Evitar reparaciones y remodelaciones anuales</li>
              <li>
                Disminución de las importaciones de materiales de construcción de
                acabado
              </li>
              <li>
                Subida del nivel tecnológico de República Dominicana y otros países de
                América Latina a los primeros puestos entre los líderes de alta
                tecnología del mundo
              </li>
            </ul>
          </div>

          <p>
            Todos nuestros productos están protegidas contra la aparición de moho y
            hongos, son 100% ecológicos y soportan fácilmente la limpieza húmeda.
            Formulaciones probadas que resisten el clima tropical sin perder color ni
            textura y que tienen una vida útil de hasta 10 años en diseños de interiores
            y exteriores. También tenemos una garantía de al menos 5 años en la
            aplicación de nuestros materiales de acabado, realizada por nuestros
            expertos.
          </p>
        </div>
      </div>
    </section>
  )
}
