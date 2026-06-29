'use client'

import { useCallback, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

export interface SelectedMedia {
  url: string
  type: 'image' | 'video'
}

interface UploadedItem {
  id: string
  name: string
  url: string
  type: 'image' | 'video'
  selected: boolean
}

const MAX_BYTES = 30 * 1024 * 1024 // 30MB — must match the sign route

/**
 * Upload method decision:
 * We prefer the supabase-js browser client's `uploadToSignedUrl(path, token, file)`
 * because it handles the PUT, content-type, and Storage response parsing for us
 * and is the documented happy path for signed uploads. It needs a browser client
 * built from the NEXT_PUBLIC_* envs. Those are not guaranteed to be wired in every
 * deploy (server runtime uses SUPABASE_URL / SUPABASE_ANON_KEY), so when they are
 * absent we fall back to a raw `fetch(signedUrl, { method: 'PUT', body: file })`,
 * which works against the signed URL without any client SDK or public anon key.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const browserClient =
  SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null

const BUCKET = 'sma-uploads'

function mediaType(contentType: string): 'image' | 'video' | null {
  if (contentType.startsWith('image/')) return 'image'
  if (contentType.startsWith('video/')) return 'video'
  return null
}

export default function MediaPicker({
  onChange,
  disabled,
}: {
  onChange: (selected: SelectedMedia[]) => void
  disabled?: boolean
}) {
  const [items, setItems] = useState<UploadedItem[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const emit = useCallback(
    (next: UploadedItem[]) => {
      onChange(next.filter((i) => i.selected).map((i) => ({ url: i.url, type: i.type })))
    },
    [onChange],
  )

  const uploadOne = useCallback(async (file: File): Promise<UploadedItem | string> => {
    const type = mediaType(file.type)
    if (!type) {
      return `${file.name}: only images and videos are allowed`
    }
    if (file.size > MAX_BYTES) {
      return `${file.name}: exceeds the 30MB limit`
    }

    // 1. Ask the server to mint a signed upload URL.
    const signRes = await fetch('/api/sma/uploads/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      }),
    })
    if (!signRes.ok) {
      const data = await signRes.json().catch(() => ({}))
      return `${file.name}: ${data.error || 'failed to get upload URL'}`
    }
    const { path, token, signedUrl, publicUrl } = (await signRes.json()) as {
      path: string
      token: string
      signedUrl: string
      publicUrl: string
    }

    // 2. Upload directly to Storage (never through a Next route → no 4.5MB cap).
    if (browserClient) {
      const { error } = await browserClient.storage
        .from(BUCKET)
        .uploadToSignedUrl(path, token, file, { contentType: file.type })
      if (error) {
        return `${file.name}: upload failed (${error.message})`
      }
    } else {
      const putRes = await fetch(signedUrl, {
        method: 'PUT',
        body: file,
        headers: { 'content-type': file.type },
      })
      if (!putRes.ok) {
        return `${file.name}: upload failed (${putRes.status})`
      }
    }

    return {
      id: `${path}`,
      name: file.name,
      url: publicUrl,
      type,
      selected: true,
    }
  }, [])

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList)
      if (files.length === 0) return
      setUploading(true)
      setErrors([])
      const newErrors: string[] = []
      const newItems: UploadedItem[] = []

      for (const file of files) {
        try {
          const result = await uploadOne(file)
          if (typeof result === 'string') {
            newErrors.push(result)
          } else {
            newItems.push(result)
          }
        } catch (err) {
          newErrors.push(`${file.name}: ${err instanceof Error ? err.message : 'unexpected error'}`)
        }
      }

      if (newErrors.length > 0) setErrors(newErrors)
      if (newItems.length > 0) {
        setItems((prev) => {
          const next = [...prev, ...newItems]
          emit(next)
          return next
        })
      }
      setUploading(false)
    },
    [emit, uploadOne],
  )

  const toggle = useCallback(
    (id: string) => {
      setItems((prev) => {
        const next = prev.map((i) => (i.id === id ? { ...i, selected: !i.selected } : i))
        emit(next)
        return next
      })
    },
    [emit],
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragActive(false)
      if (disabled) return
      if (e.dataTransfer.files?.length) {
        void handleFiles(e.dataTransfer.files)
      }
    },
    [disabled, handleFiles],
  )

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setDragActive(true)
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`flex flex-col items-center justify-center rounded-md border-2 border-dashed px-4 py-6 text-center text-sm transition-colors ${
          dragActive ? 'border-emerald-600 bg-emerald-50' : 'border-zinc-300 bg-white hover:border-zinc-400'
        } ${disabled ? 'opacity-50' : 'cursor-pointer'}`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          disabled={disabled}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <span className="font-medium text-zinc-700">Drag & drop media here</span>
        <span className="text-xs text-zinc-500">or click to choose images / videos (≤30MB each)</span>
        {uploading && (
          <span className="mt-2 text-xs text-zinc-500">
            <span className="animate-spin mr-1 inline-block">⏳</span>Uploading…
          </span>
        )}
      </div>

      {errors.length > 0 && (
        <div className="space-y-1 rounded bg-red-50 p-2 text-xs text-red-600">
          {errors.map((e, i) => (
            <div key={i}>{e}</div>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => toggle(item.id)}
              disabled={disabled}
              title={item.name}
              className={`relative aspect-square overflow-hidden rounded-md border-2 transition-colors disabled:opacity-50 ${
                item.selected ? 'border-emerald-600 ring-2 ring-emerald-600' : 'border-zinc-300 bg-white hover:border-zinc-400'
              }`}
            >
              {item.type === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.url} alt={item.name} className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full flex-col items-center justify-center bg-zinc-100 p-1 text-zinc-600">
                  <span className="text-2xl">🎬</span>
                  <span className="mt-1 line-clamp-2 break-all text-[10px] leading-tight">{item.name}</span>
                </span>
              )}
              {item.selected && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[10px] text-white">
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <p className="text-xs text-zinc-500">
          {items.filter((i) => i.selected).length} selected — selected media will be used as the post attachments.
        </p>
      )}
    </div>
  )
}
