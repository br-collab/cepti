'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface Product {
  slug: string
  name: { en: string; es: string }
}

interface VideoJob {
  id: string
  request_id: string | null
  status: 'pending' | 'done' | 'failed'
  product_slug: string | null
  source_image_url: string
  prompt: string | null
  duration: number
  video_url: string | null
  error: string | null
  created_at: string
  updated_at: string
}

const POLL_INTERVAL_MS = 5000

export default function VideoLab() {
  const [products, setProducts] = useState<Product[]>([])
  const [productSlug, setProductSlug] = useState('')
  const [prompt, setPrompt] = useState('')
  const [duration, setDuration] = useState(6)
  const [resolution, setResolution] = useState<'480p' | '720p' | '1080p'>('720p')
  const [jobs, setJobs] = useState<VideoJob[]>([])
  const [loading, setLoading] = useState(false)
  const [statusLabel, setStatusLabel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [beforeFile, setBeforeFile] = useState<File | null>(null)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const loadJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/sma/video/jobs')
      if (!res.ok) return
      const data = (await res.json()) as VideoJob[]
      setJobs(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to load video jobs:', err)
    }
  }, [])

  // Load products + initial jobs
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
    loadJobs()
  }, [loadJobs])

  // Poll while any job is pending; stop when none remain.
  useEffect(() => {
    const hasPending = jobs.some((j) => j.status === 'pending')

    if (hasPending && !pollRef.current) {
      pollRef.current = setInterval(loadJobs, POLL_INTERVAL_MS)
    } else if (!hasPending && pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [jobs, loadJobs])

  const handleGenerate = async () => {
    setError(null)
    // A product is required only when there's no "before" photo to animate.
    if (!productSlug && !beforeFile) {
      setError('Please select a product or upload a before photo')
      return
    }

    setLoading(true)
    try {
      let sourceImageUrl: string | undefined

      // If a "before" photo was selected, upload it first to get a public URL.
      if (beforeFile) {
        setStatusLabel('Uploading...')
        const formData = new FormData()
        formData.append('file', beforeFile)
        const uploadRes = await fetch('/api/sma/video/upload', {
          method: 'POST',
          body: formData,
        })
        if (!uploadRes.ok) {
          const data = await uploadRes.json().catch(() => ({}))
          throw new Error(data.error || 'Failed to upload before photo')
        }
        const uploadData = (await uploadRes.json()) as { url?: string }
        if (!uploadData.url) {
          throw new Error('Upload did not return a URL')
        }
        sourceImageUrl = uploadData.url
      }

      setStatusLabel('Generating...')
      const res = await fetch('/api/sma/video/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productSlug: productSlug || undefined,
          sourceImageUrl,
          prompt: prompt.trim() || undefined,
          duration,
          resolution,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to start video generation')
      }

      setPrompt('')
      setBeforeFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      await loadJobs()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
      setStatusLabel(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <label htmlFor="video-product" className="block text-sm font-medium text-zinc-700 mb-1">
            Product
          </label>
          <select
            id="video-product"
            value={productSlug}
            onChange={(e) => setProductSlug(e.target.value)}
            disabled={loading || products.length === 0}
            className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:opacity-50"
          >
            <option value="">Select a product...</option>
            {products.map((product) => (
              <option key={product.slug} value={product.slug}>
                {product.name.es}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="video-before" className="block text-sm font-medium text-zinc-700 mb-1">
            Before photo (optional)
          </label>
          <input
            ref={fileInputRef}
            id="video-before"
            type="file"
            accept="image/*"
            onChange={(e) => setBeforeFile(e.target.files?.[0] ?? null)}
            disabled={loading}
            className="block w-full text-sm text-zinc-700 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-800 disabled:opacity-50"
          />
          <p className="text-xs text-zinc-500 mt-1">
            Upload a bare-wall photo for a before&rarr;after reveal, or leave blank to animate the
            product image.
          </p>
        </div>

        <div>
          <label htmlFor="video-prompt" className="block text-sm font-medium text-zinc-700 mb-1">
            Prompt (optional)
          </label>
          <textarea
            id="video-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Leave blank for a tasteful slow camera reveal of the finish."
            disabled={loading}
            rows={3}
            className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm text-zinc-900 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:opacity-50"
          />
        </div>

        <div>
          <label htmlFor="video-duration" className="block text-sm font-medium text-zinc-700 mb-1">
            Duration (seconds, 4–10)
          </label>
          <input
            id="video-duration"
            type="number"
            min={4}
            max={10}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            disabled={loading}
            className="w-28 px-3 py-2 border border-zinc-300 rounded-md text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:opacity-50"
          />
          <p className="text-xs text-zinc-500 mt-1">Approx. cost: ${(duration * 0.08).toFixed(2)} at $0.08/sec.</p>
        </div>

        <div>
          <label htmlFor="video-resolution" className="block text-sm font-medium text-zinc-700 mb-1">
            Quality
          </label>
          <select
            id="video-resolution"
            value={resolution}
            onChange={(e) => setResolution(e.target.value as '480p' | '720p' | '1080p')}
            disabled={loading}
            className="w-40 px-3 py-2 border border-zinc-300 rounded-md text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:opacity-50"
          >
            <option value="480p">480p — fastest</option>
            <option value="720p">720p — standard</option>
            <option value="1080p">1080p — highest</option>
          </select>
          <p className="text-xs text-zinc-500 mt-1">
            Higher quality looks better but may take longer to generate.
          </p>
        </div>

        {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}

        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading || (!productSlug && !beforeFile)}
          className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {loading ? (
            <>
              <span className="animate-spin mr-2">⏳</span>
              {statusLabel || 'Starting...'}
            </>
          ) : (
            'Generate video'
          )}
        </button>
      </div>

      <div className="border-t border-zinc-200 pt-4 space-y-3">
        <h3 className="text-sm font-medium text-zinc-700">Recent jobs</h3>
        {jobs.length === 0 ? (
          <p className="text-sm text-zinc-500">No video jobs yet.</p>
        ) : (
          <ul className="space-y-3">
            {jobs.map((job) => (
              <li key={job.id} className="rounded-lg border border-zinc-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium text-zinc-900">
                    {job.product_slug || 'unknown product'}
                    <span className="ml-2 text-xs font-normal text-zinc-500">{job.duration}s</span>
                  </div>
                  <div className="text-xs">
                    {job.status === 'pending' && (
                      <span className="inline-flex items-center text-amber-600">
                        <span className="animate-spin mr-1">⏳</span>
                        pending
                      </span>
                    )}
                    {job.status === 'done' && <span className="text-green-600">✓ done</span>}
                    {job.status === 'failed' && <span className="text-red-600">✕ failed</span>}
                  </div>
                </div>

                {job.status === 'done' && job.video_url && (
                  <video
                    controls
                    src={job.video_url}
                    className="mt-2 w-full max-w-md rounded-md border border-zinc-200"
                  />
                )}

                {job.status === 'failed' && job.error && (
                  <p className="mt-2 text-xs text-red-600">{job.error}</p>
                )}

                <p className="mt-2 text-xs text-zinc-400 break-all">Source: {job.source_image_url}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
