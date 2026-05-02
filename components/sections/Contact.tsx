type ContactDict = {
  title: string
  sub: string
  cta: string
  address: string
  email: string
  instagram: string
  website: string
  phone: string
  whatsapp: string
  facebook: string
  threads: string
  comingSoon: string
}

export default function Contact({ dict }: { dict: ContactDict }) {
  const labelClass = 'text-xs font-semibold uppercase tracking-widest text-cepti-brown mb-1'
  const valueClass = 'text-base sm:text-lg leading-relaxed text-cepti-brown-dark'
  const linkClass =
    'text-base sm:text-lg leading-relaxed text-cepti-brown-dark underline underline-offset-2 hover:text-cepti-red transition-colors'

  return (
    <section id="contacto" className="py-10 sm:py-14 bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="bg-cepti-cream rounded-2xl p-6 sm:p-8 text-left space-y-5 border border-cepti-brown/10 shadow-sm">
          <div>
            <p className={labelClass}>{dict.address}</p>
            <p className={valueClass}>
              Avenida República de Colombia 10, nave 11, sector los Peralejos, Distrito
              Nacional, Santo Domingo, República Dominicana
            </p>
          </div>

          <div>
            <p className={labelClass}>{dict.email}</p>
            <a href="mailto:info@cepticorp.com" className={linkClass}>
              info@cepticorp.com
            </a>
          </div>

          <div>
            <p className={labelClass}>{dict.website}</p>
            <a
              href="https://cepticorp.com"
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass}
            >
              cepticorp.com
            </a>
          </div>

          <div>
            <p className={labelClass}>{dict.instagram}</p>
            <a
              href="https://instagram.com/cepti_rd"
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass}
            >
              @cepti_rd
            </a>
          </div>

          <div>
            <p className={labelClass}>{dict.facebook}</p>
            <p className={`${valueClass} text-cepti-brown/70`}>[{dict.comingSoon}]</p>
          </div>

          <div>
            <p className={labelClass}>{dict.threads}</p>
            <a
              href="https://www.threads.net/@cepti_rd"
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass}
            >
              @cepti_rd
            </a>
          </div>

          <div>
            <p className={labelClass}>{dict.whatsapp}</p>
            <p className={`${valueClass} text-cepti-brown/70`}>[{dict.comingSoon}]</p>
          </div>

          <div>
            <p className={labelClass}>{dict.phone}</p>
            <p className={`${valueClass} text-cepti-brown/70`}>[{dict.comingSoon}]</p>
          </div>
        </div>
      </div>
    </section>
  )
}
