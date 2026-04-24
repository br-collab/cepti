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
  return (
    <section id="contacto" className="py-10 sm:py-14 bg-cepti-red">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">{dict.title}</h2>
        <p className="text-red-100 text-lg mb-10">{dict.sub}</p>

        <div className="bg-white/10 backdrop-blur rounded-2xl p-6 sm:p-8 text-left space-y-5 text-white">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-red-100 mb-1">
              {dict.address}
            </p>
            <p className="text-base sm:text-lg leading-relaxed">
              Avenida República de Colombia 10, nave 11, sector los Peralejos, Distrito
              Nacional, Santo Domingo, República Dominicana
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-red-100 mb-1">
              {dict.email}
            </p>
            <a
              href="mailto:info@cepticorp.com"
              className="text-base sm:text-lg underline underline-offset-2 hover:text-red-100"
            >
              info@cepticorp.com
            </a>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-red-100 mb-1">
              {dict.instagram}
            </p>
            <a
              href="https://instagram.com/cepti_rd"
              target="_blank"
              rel="noopener noreferrer"
              className="text-base sm:text-lg underline underline-offset-2 hover:text-red-100"
            >
              @cepti_rd
            </a>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-red-100 mb-1">
              {dict.website}
            </p>
            <a
              href="https://cepticorp.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-base sm:text-lg underline underline-offset-2 hover:text-red-100"
            >
              cepticorp.com
            </a>
          </div>

          <div className="pt-2 border-t border-white/20 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-red-100 mb-1">
                {dict.phone}
              </p>
              <p className="text-sm sm:text-base text-red-100">[{dict.comingSoon}]</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-red-100 mb-1">
                {dict.whatsapp}
              </p>
              <p className="text-sm sm:text-base text-red-100">[{dict.comingSoon}]</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-red-100 mb-1">
                {dict.facebook}
              </p>
              <p className="text-sm sm:text-base text-red-100">[{dict.comingSoon}]</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-red-100 mb-1">
                {dict.threads}
              </p>
              <p className="text-sm sm:text-base text-red-100">[{dict.comingSoon}]</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
