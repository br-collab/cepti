'use client'

import { useState, useEffect } from 'react'

interface Product {
  slug: string
  name: { en: string; es: string }
}

export default function NewContentForm({ onSuccess }: { onSuccess: () => Promise<void> }) {
  const [productSlug, setProductSlug] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [angle, setAngle] = useState('')
  const [mediaMode, setMediaMode] = useState<'pictures' | 'video' | 'both'>('both')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load products on mount
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const response = await fetch('/api/products')
        const data = await response.json()
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

    if (!productSlug) {
      setError('Please select a product')
      return
    }

    setLoading(true)
    try {
      const includePictures = mediaMode === 'pictures' || mediaMode === 'both'
      const includeVideo = mediaMode === 'video' || mediaMode === 'both'

      const res = await fetch('/api/sma/coordinator/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: productSlug, // Send product slug as topic for backward compatibility
          notes: angle.trim() || undefined,
          includePictures,
          includeVideo,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to generate draft')
      }

      // Clear form
      setProductSlug('')
      setAngle('')

      // Refresh queue
      await onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="product" className="block text-sm font-medium text-zinc-700 mb-1">
          Product *
        </label>
        <select
          id="product"
          value={productSlug}
          onChange={(e) => setProductSlug(e.target.value)}
          disabled={loading || products.length === 0}
          className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:opacity-50"
        >
          <option value="">Select a product...</option>
          {products.map((product) => (
            <option key={product.slug} value={product.slug}>
              {product.name.en}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="angle" className="block text-sm font-medium text-zinc-700 mb-1">
          Content Angle / Focus (optional)
        </label>
        <textarea
          id="angle"
          value={angle}
          onChange={(e) => setAngle(e.target.value)}
          placeholder="E.g: emphasize installation speed, highlight eco-friendly aspects, focus on premium quality"
          disabled={loading}
          rows={3}
          className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm text-zinc-900 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:opacity-50"
        />
      </div>

      <div className="space-y-3 border-t border-zinc-200 pt-4">
        <label className="block text-sm font-medium text-zinc-700">Visual Content</label>
        <div className="space-y-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMediaMode('pictures')}
              disabled={loading}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md border transition-colors ${
                mediaMode === 'pictures'
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'bg-white text-zinc-900 border-zinc-300 hover:border-zinc-900'
              } disabled:opacity-50`}
            >
              🖼️ Pictures Only
            </button>
            <button
              type="button"
              onClick={() => setMediaMode('video')}
              disabled={loading}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md border transition-colors ${
                mediaMode === 'video'
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'bg-white text-zinc-900 border-zinc-300 hover:border-zinc-900'
              } disabled:opacity-50`}
            >
              🎬 Video Only
            </button>
            <button
              type="button"
              onClick={() => setMediaMode('both')}
              disabled={loading}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md border transition-colors ${
                mediaMode === 'both'
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'bg-white text-zinc-900 border-zinc-300 hover:border-zinc-900'
              } disabled:opacity-50`}
            >
              🎬📸 Both
            </button>
          </div>
          <p className="text-xs text-zinc-500">
            {mediaMode === 'video' && 'Generates a 45-second narrative video showcasing the product transformation.'}
            {mediaMode === 'pictures' && 'Attaches 1-3 representative product images.'}
            {mediaMode === 'both' && 'Generates video + attaches individual product images.'}
          </p>
        </div>
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {loading ? (
          <>
            <span className="animate-spin mr-2">⏳</span>
            Generating...
          </>
        ) : (
          'Generate Draft'
        )}
      </button>
    </form>
  )
}
