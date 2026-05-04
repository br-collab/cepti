import Image from 'next/image'
import Link from 'next/link'

type FooterDict = {
  slogan: string
  rights: string
}

const PHONE_PLACEHOLDER = '+18091234567'

export default function Footer({ dict }: { dict: FooterDict }) {
  const phoneDigits = PHONE_PLACEHOLDER.replace(/[^\d]/g, '')

  return (
    <footer
      className="text-white py-8 px-4 sm:px-6 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/images/brand/Background_plain.jpg')" }}
    >
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4 sm:gap-6 max-w-3xl">
          <Image
            src="/images/brand/LOGO_WHITE.png"
            alt="CEPTI"
            width={200}
            height={56}
            className="h-12 w-auto sm:h-14 flex-shrink-0"
          />
          <p className="font-display text-xs sm:text-sm lg:text-base font-semibold text-white tracking-wide leading-snug">
            {dict.slogan}
          </p>
        </div>
        <div className="flex gap-4 text-sm text-white">
          <Link href="/es" className="hover:text-white/80 transition-colors">ES</Link>
          <Link href="/en" className="hover:text-white/80 transition-colors">EN</Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto mt-6 flex items-center gap-5">
        <a
          href="https://instagram.com/cepti_rd"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Instagram"
          className="text-white hover:opacity-75 transition-opacity"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.336 3.608 1.311.975.975 1.249 2.242 1.311 3.608.058 1.266.069 1.646.069 4.85s-.012 3.584-.07 4.85c-.062 1.366-.336 2.633-1.311 3.608-.975.975-2.242 1.249-3.608 1.311-1.266.058-1.646.069-4.85.069s-3.584-.012-4.85-.07c-1.366-.062-2.633-.336-3.608-1.311-.975-.975-1.249-2.242-1.311-3.608C2.175 15.747 2.163 15.367 2.163 12s.012-3.584.07-4.85c.062-1.366.336-2.633 1.311-3.608.975-.975 2.242-1.249 3.608-1.311C8.416 2.175 8.796 2.163 12 2.163zm0 1.838c-3.155 0-3.51.012-4.749.068-1.064.049-1.642.222-2.027.371-.51.198-.875.435-1.258.819-.384.383-.621.748-.819 1.258-.149.385-.322.963-.371 2.027-.056 1.239-.068 1.594-.068 4.749s.012 3.51.068 4.749c.049 1.064.222 1.642.371 2.027.198.51.435.875.819 1.258.383.384.748.621 1.258.819.385.149.963.322 2.027.371 1.239.056 1.594.068 4.749.068s3.51-.012 4.749-.068c1.064-.049 1.642-.222 2.027-.371.51-.198.875-.435 1.258-.819.384-.383.621-.748.819-1.258.149-.385.322-.963.371-2.027.056-1.239.068-1.594.068-4.749s-.012-3.51-.068-4.749c-.049-1.064-.222-1.642-.371-2.027-.198-.51-.435-.875-.819-1.258-.383-.384-.748-.621-1.258-.819-.385-.149-.963-.322-2.027-.371-1.239-.056-1.594-.068-4.749-.068zm0 3.131a4.868 4.868 0 110 9.736 4.868 4.868 0 010-9.736zm0 8.03a3.162 3.162 0 100-6.324 3.162 3.162 0 000 6.324zm6.184-8.236a1.137 1.137 0 11-2.275 0 1.137 1.137 0 012.275 0z" />
          </svg>
        </a>
        <a
          href="https://facebook.com/cepticorp"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Facebook"
          className="text-white hover:opacity-75 transition-opacity"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
          </svg>
        </a>
        <a
          href="https://www.threads.net/@cepti_rd"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Threads"
          className="text-white hover:opacity-75 transition-opacity"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.781 3.631 2.695 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.991.232-2.722 1.32L7.734 7.847c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.32.144 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65Zm1.003-11.69c-.242 0-.487.007-.739.021-1.836.103-2.98.946-2.916 2.143.067 1.256 1.452 1.839 2.784 1.767 1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221z" />
          </svg>
        </a>
        <a
          href="mailto:info@cepticorp.com"
          aria-label="Email"
          className="text-white hover:opacity-75 transition-opacity"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <path d="M2 7l10 6 10-6" />
          </svg>
        </a>
        <a
          href={`https://wa.me/${phoneDigits}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="WhatsApp"
          className="text-white hover:opacity-75 transition-opacity"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.15-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
        </a>
        <a
          href={`tel:${PHONE_PLACEHOLDER}`}
          aria-label="Phone"
          className="text-white hover:opacity-75 transition-opacity"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z" />
          </svg>
        </a>
      </div>

      <div className="max-w-6xl mx-auto mt-6 pt-4 border-t border-white/20 text-xs text-white/70">
        © {new Date().getFullYear()} CEPTI. {dict.rights}
      </div>
    </footer>
  )
}
