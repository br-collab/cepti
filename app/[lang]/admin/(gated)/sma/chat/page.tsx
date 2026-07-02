'use client'

import { useEffect, useState, useCallback } from 'react'

interface Conversation {
  conversation_id: string
  lang: string | null
  first_message_at: string
  last_message_at: string
  message_count: number
  wa_clicked: boolean
  wa_clicked_at: string | null
}

interface Message {
  message_id: string
  role: 'user' | 'assistant'
  content: string
  ts: string
}

function fmt(ts: string): string {
  try {
    return new Date(ts).toLocaleString('es-DO', {
      timeZone: 'America/Santo_Domingo',
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return ts
  }
}

export default function WebChatAdminPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [transcriptLoading, setTranscriptLoading] = useState(false)

  const fetchConversations = useCallback(async (): Promise<Conversation[]> => {
    const res = await fetch('/api/sma/web-chat/conversations')
    if (!res.ok) throw new Error(`Request failed (${res.status})`)
    const data = await res.json()
    return data.conversations ?? []
  }, [])

  // Used by the Refresh button. As an event handler (not an effect) it may set
  // state synchronously.
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setConversations(await fetchConversations())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load conversations')
    } finally {
      setLoading(false)
    }
  }, [fetchConversations])

  // Initial load. State is only set after the await, so we never call setState
  // synchronously inside the effect (react-hooks/set-state-in-effect).
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await fetchConversations()
        if (!cancelled) setConversations(data)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load conversations')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [fetchConversations])

  const openTranscript = async (c: Conversation) => {
    if (openId === c.conversation_id) {
      setOpenId(null)
      setMessages([])
      return
    }
    setOpenId(c.conversation_id)
    setMessages([])
    setTranscriptLoading(true)
    try {
      const res = await fetch(
        `/api/sma/web-chat/conversations?conversationId=${encodeURIComponent(c.conversation_id)}`,
      )
      if (!res.ok) throw new Error(`Request failed (${res.status})`)
      const data = await res.json()
      setMessages(data.messages ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load transcript')
    } finally {
      setTranscriptLoading(false)
    }
  }

  const convertedCount = conversations.filter((c) => c.wa_clicked).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Web Chat</h2>
          <p className="text-sm text-zinc-500">
            Website chatbot conversations. The on-site advisor answers product questions,
            quotes from the official price list, and keeps the WhatsApp CTA. A conversation
            is marked converted when the visitor clicks through to WhatsApp.
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100"
        >
          Refresh
        </button>
      </div>

      <div className="flex gap-6 text-sm text-zinc-600">
        <span>
          Total: <strong className="text-zinc-900">{conversations.length}</strong>
        </span>
        <span>
          Converted: <strong className="text-zinc-900">{convertedCount}</strong>
        </span>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : conversations.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No conversations yet. They will appear once a visitor uses the on-site chatbot.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-zinc-500">
              <tr>
                <th className="px-3 py-2 font-medium">Updated</th>
                <th className="px-3 py-2 font-medium">Lang</th>
                <th className="px-3 py-2 font-medium">Messages</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {conversations.map((c) => (
                <tr key={c.conversation_id} className="align-top">
                  <td className="px-3 py-2 whitespace-nowrap text-zinc-500">
                    {fmt(c.last_message_at)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap uppercase text-zinc-700">
                    {c.lang ?? '—'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-zinc-700">
                    {c.message_count}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {c.wa_clicked ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                        → WhatsApp
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-right">
                    <button
                      onClick={() => void openTranscript(c)}
                      className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100"
                    >
                      {openId === c.conversation_id ? 'Hide' : 'View'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openId && (
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="mb-2 text-xs font-medium text-zinc-500">
            Transcript · <span className="font-mono">{openId}</span>
          </div>
          {transcriptLoading ? (
            <p className="text-sm text-zinc-500">Loading transcript…</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-zinc-500">No messages.</p>
          ) : (
            <div className="space-y-2">
              {messages.map((m) => (
                <div
                  key={m.message_id}
                  className={
                    m.role === 'user'
                      ? 'ml-8 rounded-lg bg-zinc-800 px-3 py-2 text-sm text-white'
                      : 'mr-8 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800'
                  }
                >
                  {m.content}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
