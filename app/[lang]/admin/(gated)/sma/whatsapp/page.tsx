'use client'

import { useEffect, useState, useCallback } from 'react'

interface Conversation {
  conversation_id: string
  whatsapp_user_id: string
  first_message_at: string
  last_message_at: string
  handed_off_to_human: boolean
  handoff_reason: string | null
  last_message_preview: string | null
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

export default function WhatsAppAdminPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const fetchConversations = useCallback(async (): Promise<Conversation[]> => {
    const res = await fetch('/api/sma/whatsapp/conversations')
    if (!res.ok) throw new Error(`Request failed (${res.status})`)
    const data = await res.json()
    return data.conversations ?? []
  }, [])

  // Used by the Refresh button and after a take-over toggle. As an event
  // handler (not an effect) it may set state synchronously.
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

  const toggleHandoff = async (c: Conversation) => {
    setBusyId(c.conversation_id)
    try {
      const res = await fetch('/api/sma/whatsapp/conversations', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          conversation_id: c.conversation_id,
          handed_off_to_human: !c.handed_off_to_human,
          reason: 'manual',
        }),
      })
      if (!res.ok) throw new Error(`Request failed (${res.status})`)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update conversation')
    } finally {
      setBusyId(null)
    }
  }

  const handedOffCount = conversations.filter((c) => c.handed_off_to_human).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">WhatsApp Advisor</h2>
          <p className="text-sm text-zinc-500">
            Inbound conversations. The bot answers autonomously within guardrails and
            hands off to a human for prices, quotes, complaints, or anything it can&apos;t
            answer confidently. Handed-off threads are answered in the WhatsApp Business app.
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
          Handed off: <strong className="text-zinc-900">{handedOffCount}</strong>
        </span>
        <span>
          Bot-handled:{' '}
          <strong className="text-zinc-900">{conversations.length - handedOffCount}</strong>
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
          No conversations yet. They will appear once the WhatsApp webhook receives its
          first inbound message.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-zinc-500">
              <tr>
                <th className="px-3 py-2 font-medium">Customer</th>
                <th className="px-3 py-2 font-medium">Last message</th>
                <th className="px-3 py-2 font-medium">Updated</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {conversations.map((c) => (
                <tr key={c.conversation_id} className="align-top">
                  <td className="px-3 py-2 font-mono text-xs text-zinc-700">
                    {c.whatsapp_user_id}
                  </td>
                  <td className="px-3 py-2 text-zinc-700 max-w-md">
                    {c.last_message_preview ?? <span className="text-zinc-400">—</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-zinc-500">
                    {fmt(c.last_message_at)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {c.handed_off_to_human ? (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        Human{c.handoff_reason ? ` · ${c.handoff_reason}` : ''}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                        Bot
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-right">
                    <button
                      onClick={() => void toggleHandoff(c)}
                      disabled={busyId === c.conversation_id}
                      className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                    >
                      {c.handed_off_to_human ? 'Return to bot' : 'Take over'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
