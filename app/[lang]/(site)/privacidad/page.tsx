import { notFound } from 'next/navigation'
import { getDictionary, hasLocale } from '@/app/[lang]/dictionaries'

export function generateStaticParams() {
  return [{ lang: 'es' }, { lang: 'en' }]
}

export async function generateMetadata({
  params,
}: PageProps<'/[lang]/privacidad'>) {
  const { lang } = await params
  if (!hasLocale(lang)) return {}
  const dict = await getDictionary(lang)
  return { title: dict.privacy.metaTitle }
}

export default async function PrivacyPage({
  params,
}: PageProps<'/[lang]/privacidad'>) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()

  const dict = await getDictionary(lang)
  const t = dict.privacy
  const sectionKeys = [
    'intro',
    'dataCollected',
    'howWeUse',
    'socialMedia',
    'dataDeletion',
    'contact',
  ] as const

  return (
    <section className="py-16 sm:py-24 bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-stone-900">
          {t.title}
        </h1>
        <p className="mt-3 text-sm text-stone-500">{t.lastUpdated}</p>

        <div className="mt-10 space-y-10 text-base sm:text-lg leading-relaxed text-stone-700">
          {sectionKeys.map((key) => {
            const section = t.sections[key]
            return (
              <div key={key}>
                <h2 className="text-xl sm:text-2xl font-semibold text-stone-900 mb-3">
                  {section.heading}
                </h2>
                <p>{section.body}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
