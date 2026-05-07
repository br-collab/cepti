'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import WhatsAppIcon from '@/components/icons/WhatsAppIcon'

type Locale = 'es' | 'en'
type ChatMessage = { role: 'user' | 'assistant'; content: string }

const SHOW_WA_TAG = '[SHOW_WA]'

const UI: Record<Locale, {
  open: string
  close: string
  title: string
  placeholder: string
  send: string
  greeting: string
  langToggle: string
  whatsapp: string
  whatsappHandoff: string
  errorGeneric: string
  thinking: string
}> = {
  es: {
    open: 'Asesor CEPTI',
    close: 'Cerrar',
    title: 'Asesor CEPTI',
    placeholder: 'Escribe tu pregunta...',
    send: 'Enviar',
    greeting:
      '¡Hola! Soy el asesor de productos CEPTI. ¿En qué proyecto estás trabajando? Cuéntame qué superficie quieres terminar y te recomiendo el producto adecuado.',
    langToggle: 'EN',
    whatsapp: 'Hablar por WhatsApp',
    whatsappHandoff:
      'Hola CEPTI, vengo del asesor virtual y me gustaría una cotización.',
    errorGeneric:
      'Algo salió mal. Intenta de nuevo o contáctanos por WhatsApp.',
    thinking: 'Pensando...',
  },
  en: {
    open: 'CEPTI Advisor',
    close: 'Close',
    title: 'CEPTI Advisor',
    placeholder: 'Type your question...',
    send: 'Send',
    greeting:
      "Hi! I'm the CEPTI product advisor. What project are you working on? Tell me which surface you want to finish and I'll recommend the right product.",
    langToggle: 'ES',
    whatsapp: 'Chat on WhatsApp',
    whatsappHandoff:
      "Hi CEPTI, I'm coming from the virtual advisor and I'd like a quote.",
    errorGeneric: 'Something went wrong. Try again or reach us on WhatsApp.',
    thinking: 'Thinking...',
  },
}

function stripShowWa(text: string): { clean: string; showWa: boolean } {
  if (text.includes(SHOW_WA_TAG)) {
    return { clean: text.replace(SHOW_WA_TAG, '').trim(), showWa: true }
  }
  return { clean: text, showWa: false }
}

export default function ChatbotCEPTI({
  whatsappNumber,
  initialLang = 'es',
}: {
  whatsappNumber: string
  initialLang?: Locale
}) {
  const [open, setOpen] = useState(false)
  const [lang, setLang] = useState<Locale>(initialLang)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showWa, setShowWa] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const t = UI[lang]

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  const toggleLang = () => {
    setLang((l) => (l === 'es' ? 'en' : 'es'))
    setMessages([])
    setError(null)
    setShowWa(false)
  }

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setError(null)

    const next: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: next, lang }),
      })
      if (!res.ok) {
        setError(t.errorGeneric)
        setLoading(false)
        return
      }
      const data: { message?: string } = await res.json()
      const reply = data.message ?? ''
      const { clean, showWa: hasWa } = stripShowWa(reply)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: clean || t.errorGeneric },
      ])
      if (hasWa) setShowWa(true)
    } catch {
      setError(t.errorGeneric)
    } finally {
      setLoading(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const digits = whatsappNumber.replace(/[^\d]/g, '')
  const waHref = `https://wa.me/${digits}?text=${encodeURIComponent(t.whatsappHandoff)}`

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t.open}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex items-center gap-2 rounded-full bg-cepti-red text-white pl-3 pr-5 py-2.5 shadow-lg shadow-cepti-red/30 hover:bg-cepti-red-dark transition-colors text-base font-semibold"
      >
        <Image
          src="/images/brand/Chat_Icon.png"
          alt=""
          width={32}
          height={32}
          aria-hidden
          className="w-8 h-8"
        />
        <span className="hidden sm:inline">{t.open}</span>
      </button>
    )
  }

  return (
    <div
      className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 w-[calc(100vw-2rem)] sm:w-96 max-w-md flex flex-col bg-cepti-cream rounded-2xl shadow-2xl border border-cepti-brown/30 overflow-hidden"
      style={{ height: 'min(70vh, 32rem)' }}
      role="dialog"
      aria-label={t.title}
    >
      <header className="flex items-center justify-between px-4 py-3 bg-cepti-brown text-cepti-cream">
        <span className="font-display font-semibold text-base">{t.title}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleLang}
            className="text-xs font-bold border border-cepti-cream/40 rounded px-2 py-1 hover:bg-cepti-cream/10 transition-colors"
            aria-label={`Switch language to ${t.langToggle}`}
          >
            {t.langToggle}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t.close}
            className="text-xl leading-none hover:opacity-75 transition-opacity"
          >
            ×
          </button>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-sm"
      >
        <div className="rounded-lg bg-white border border-stone-200 px-3 py-2 text-stone-800">
          {t.greeting}
        </div>
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === 'user'
                ? 'rounded-lg bg-cepti-brown text-cepti-cream px-3 py-2 ml-8'
                : 'rounded-lg bg-white border border-stone-200 px-3 py-2 text-stone-800 mr-8'
            }
          >
            {m.content}
          </div>
        ))}
        {loading ? (
          <div className="rounded-lg bg-white border border-stone-200 px-3 py-2 text-stone-500 italic mr-8">
            {t.thinking}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-lg bg-cepti-red/10 border border-cepti-red/30 px-3 py-2 text-cepti-red text-sm">
            {error}
          </div>
        ) : null}
      </div>

      {showWa ? (
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mx-4 mb-2 flex items-center justify-center gap-2 rounded-xl bg-green-600 text-white font-semibold px-4 py-3 hover:bg-green-700 transition-colors text-sm sm:text-base"
        >
          <WhatsAppIcon size={18} className="w-[18px] h-[18px]" />
          {t.whatsapp}
        </a>
      ) : null}

      <div className="border-t border-stone-200 p-3 bg-white">
        <div className="flex items-end gap-2">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t.placeholder}
            disabled={loading}
            className="flex-1 resize-none rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:border-cepti-brown focus:ring-2 focus:ring-cepti-brown/20"
          />
          <button
            type="button"
            onClick={send}
            disabled={loading || !input.trim()}
            className="rounded-lg bg-cepti-brown text-cepti-cream font-semibold px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-cepti-brown-dark transition-colors"
          >
            {t.send}
          </button>
        </div>
      </div>
    </div>
  )
}
