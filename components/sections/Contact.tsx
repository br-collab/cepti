type ContactDict = {
  title: string
  sub: string
  cta: string
}

export default function Contact({ dict }: { dict: ContactDict }) {
  return (
    <section id="contacto" className="py-20 sm:py-28 bg-cepti-red">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">{dict.title}</h2>
        <p className="text-red-100 text-lg mb-10">{dict.sub}</p>
        <a
          href="mailto:info@cepticorp.com"
          className="inline-flex items-center justify-center bg-white text-cepti-red font-semibold text-base px-8 py-4 rounded-xl hover:bg-stone-100 transition-colors shadow-md"
        >
          {dict.cta}
        </a>
      </div>
    </section>
  )
}
