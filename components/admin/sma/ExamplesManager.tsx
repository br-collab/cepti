'use client'

import { useState, useEffect, useCallback } from 'react'

interface Product {
  slug: string
  name: { en: string; es: string }
}

interface Example {
  id: string
  platform: 'facebook' | 'instagram' | 'threads' | null
  product_slug: string | null
  caption: string
  performance_label: 'top' | 'good' | 'reference' | null
  source_note: string | null
  created_at: string
}

const PLATFORMS = [
  { id: '', label: 'All platforms' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'threads', label: 'Threads' },
] as const

const LABELS = [
  { id: '', label: 'No label' },
  { id: 'top', label: 'Top' },
  { id: 'good', label: 'Good' },
  { id: 'reference', label: 'Reference' },
] as const

export default function ExamplesManager() {
  const [examples, setExamples] = useState<Example[]>([])
  const [products, setProducts] = useState<Product[]>([])

  const [caption, setCaption] = useState('')
  const [platform, setPlatform] = useState('')
  const [productSlug, setProductSlug] = useState('')
  const [performanceLabel, setPerformanceLabel] = useState('')
  const [sourceNote, setSourceNote] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadExamples = useCallback(async () => {
    try {
      const res = await fetch('/api/sma/examples')
      if (!res.ok) throw new Error('Failed to load examples')
      const data = await res.json()
      setExamples(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to load examples:', err)
    }
  }, [])

  useEffect(() => {
    loadExamples()
  }, [loadExamples])

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const res = await fetch('/api/products')
        const data = await res.json()
        setProducts(data.products || [])
      } catch (err) {
        console.error('Failed to load products:', err)
      }
    }
    loadProducts()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!caption.trim()) {
      setError('Caption is required')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/sma/examples', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caption: caption.trim(),
          platform: platform || undefined,
          product_slug: productSlug || undefined,
          performance_label: performanceLabel || undefined,
          source_note: sourceNote.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to save example')
      }

      setCaption('')
      setPlatform('')
      setProductSlug('')
      setPerformanceLabel('')
      setSourceNote('')
      await loadExamples()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this example? This cannot be undone.')) return

    try {
      const res = await fetch(`/api/sma/examples/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete example')
      await loadExamples()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const productName = (slug: string | null) => {
    if (!slug) return null
    const p = products.find((pr) => pr.slug === slug)
    return p ? p.name.es : slug
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6">
      <h2 className="text-lg font-medium text-zinc-900">Examples library</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Curate a small set of your best captions. The relevant ones are injected
        into caption generation so drafts match the proven CEPTI voice. Keep it
        high-signal — this is a reference set, not a junk drawer.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="caption" className="block text-sm font-medium text-zinc-700 mb-1">
            Caption *
          </label>
          <textarea
            id="caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Paste one of your best-performing captions here…"
            disabled={loading}
            rows={4}
            className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm text-zinc-900 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:opacity-50"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="platform" className="block text-sm font-medium text-zinc-700 mb-1">
              Platform
            </label>
            <select
              id="platform"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:opacity-50"
            >
              {PLATFORMS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="product" className="block text-sm font-medium text-zinc-700 mb-1">
              Product
            </label>
            <select
              id="product"
              value={productSlug}
              onChange={(e) => setProductSlug(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:opacity-50"
            >
              <option value="">All products</option>
              {products.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name.es}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="label" className="block text-sm font-medium text-zinc-700 mb-1">
              Performance
            </label>
            <select
              id="label"
              value={performanceLabel}
              onChange={(e) => setPerformanceLabel(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:opacity-50"
            >
              {LABELS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="source" className="block text-sm font-medium text-zinc-700 mb-1">
            Source note (optional)
          </label>
          <input
            id="source"
            type="text"
            value={sourceNote}
            onChange={(e) => setSourceNote(e.target.value)}
            placeholder="E.g: highest-engagement post Q1 2026"
            disabled={loading}
            className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm text-zinc-900 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:opacity-50"
          />
        </div>

        {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}

        <button
          type="submit"
          disabled={loading || !caption.trim()}
          className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Save example'}
        </button>
      </form>

      <div className="mt-8 border-t border-zinc-200 pt-6">
        <h3 className="text-sm font-medium text-zinc-700">
          Saved examples ({examples.length})
        </h3>

        {examples.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">
            No examples yet. Add your best captions above.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {examples.map((ex) => (
              <li
                key={ex.id}
                className="rounded-lg border border-zinc-200 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                      {ex.platform
                        ? ex.platform.charAt(0).toUpperCase() + ex.platform.slice(1)
                        : 'All platforms'}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                      {productName(ex.product_slug) || 'All products'}
                    </span>
                    {ex.performance_label && (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        {ex.performance_label}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(ex.id)}
                    className="shrink-0 text-xs font-medium text-red-600 hover:text-red-800"
                  >
                    Delete
                  </button>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-900">
                  {ex.caption}
                </p>
                {ex.source_note && (
                  <p className="mt-2 text-xs text-zinc-500">Source: {ex.source_note}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
