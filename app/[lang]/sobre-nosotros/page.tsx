import { notFound } from 'next/navigation'
import { getDictionary, hasLocale } from '@/app/[lang]/dictionaries'

export function generateStaticParams() {
  return [{ lang: 'es' }, { lang: 'en' }]
}

export async function generateMetadata({
  params,
}: PageProps<'/[lang]/sobre-nosotros'>) {
  const { lang } = await params
  if (!hasLocale(lang)) return {}
  const dict = await getDictionary(lang)
  return { title: dict.sobreNosotros.metaTitle }
}

export default async function SobreNosotrosPage({
  params,
}: PageProps<'/[lang]/sobre-nosotros'>) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()

  const dict = await getDictionary(lang)
  const t = dict.sobreNosotros

  return (
    <>
      <section
        className="text-white py-10 sm:py-14 bg-cover bg-center"
        style={{ backgroundImage: "url('/images/brand/Background_plain.jpg')" }}
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight text-white">
            {t.title}
          </h1>
        </div>
      </section>

      <section className="py-16 sm:py-24 bg-background">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="space-y-6 text-base sm:text-lg leading-relaxed text-stone-700">
            <p>{t.intro1}</p>
            <p>{t.intro2}</p>

            <div>
              <p className="mb-4">{t.objectivesTitle}</p>
              <ul className="list-disc pl-6 space-y-2">
                {t.objectives.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>

            <p>{t.closing}</p>
          </div>
        </div>
      </section>
    </>
  )
}
