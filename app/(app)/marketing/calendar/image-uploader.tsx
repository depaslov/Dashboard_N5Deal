'use client'

import { useRef } from 'react'
import { Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// Down-scales an image to maxWidth pixels (keeping aspect ratio) and returns
// a JPEG data URL at quality 0.78. Mirrors the HTML prototype so DB rows
// stay reasonably small.
function fileToResizedDataUrl(file: File, maxWidth: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width)
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('canvas ctx unavailable'))
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.78))
      }
      img.onerror = () => reject(new Error('Image load failed'))
      img.src = String(e.target?.result ?? '')
    }
    reader.onerror = () => reject(new Error('FileReader failed'))
    reader.readAsDataURL(file)
  })
}

const NO_IMG_TYPES = new Set(['Thread', 'Text Post'])
const MULTI_IMG_TYPES = new Set(['Carousel'])

export function ImageUploader({
  type,
  images,
  onChange,
}: {
  type: string
  images: string[]
  onChange: (next: string[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  if (NO_IMG_TYPES.has(type)) {
    return (
      <div className="bg-muted/30 border border-dashed border-border rounded p-3 text-xs text-muted-foreground italic text-center">
        No image needed for <span className="font-semibold not-italic">{type}</span> — text-only format
      </div>
    )
  }

  const isMulti = MULTI_IMG_TYPES.has(type)
  const max = isMulti ? 10 : 1
  const canAdd = images.length < max

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/'))
    const next = [...images]
    for (const f of arr) {
      if (!isMulti) next.length = 0
      if (next.length >= max) break
      try {
        const url = await fileToResizedDataUrl(f, 800)
        next.push(url)
      } catch (err) {
        toast.error('Image upload failed: ' + (err as Error).message)
      }
    }
    onChange(next)
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mt-1.5">
        {images.map((src, i) => (
          <div key={i} className="relative h-18 w-18 rounded overflow-hidden border border-border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="w-full h-full object-cover" />
            {isMulti ? (
              <div className="absolute bottom-0.5 left-0.5 bg-black/65 text-white text-[9px] font-bold px-1.5 py-0.5 rounded leading-tight">
                {i + 1}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => onChange(images.filter((_, idx) => idx !== i))}
              className="absolute top-0.5 right-0.5 h-5 w-5 inline-flex items-center justify-center bg-black/65 text-white rounded-full text-xs"
              aria-label="Remove"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {canAdd ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={cn(
              'h-18 w-18 flex flex-col items-center justify-center border-2 border-dashed rounded cursor-pointer transition-colors',
              'border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 hover:border-primary',
            )}
          >
            <Plus className="h-5 w-5 mb-0.5" />
            <span className="text-[10px] font-bold">{images.length === 0 ? 'Upload' : 'Add'}</span>
          </button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={isMulti}
        hidden
        onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }}
      />
      {isMulti ? (
        <p className="text-[10px] text-muted-foreground mt-1.5 italic">
          Drop multiple at once · max {max} · auto-resized to 800px
        </p>
      ) : null}
    </div>
  )
}
