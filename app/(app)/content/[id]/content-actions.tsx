'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Copy, Download, Files, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { copyMarkdownAsRich } from '@/lib/markdown'

export function ContentActions({ id, brief, topic }: { id: string; brief: string; topic: string }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [duplicating, setDuplicating] = useState(false)

  const copy = async () => {
    try {
      await copyMarkdownAsRich(brief ?? '')
      toast.success('Copied (rich text + markdown)')
    } catch {
      toast.error('Could not copy')
    }
  }

  const download = () => {
    try {
      const blob = new Blob([brief ?? ''], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const safeName = (topic ?? 'brief').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)
      a.href = url
      a.download = `${safeName || 'brief'}.md`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Could not download')
    }
  }

  const remove = async () => {
    if (!confirm('Delete this brief?')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/content/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        toast.error('Could not delete')
        return
      }
      toast.success('Deleted')
      router.push('/content')
      router.refresh()
    } finally {
      setDeleting(false)
    }
  }

  // Server copies every field (brief, briefData, folder, notes, ICPs) into
  // a new draft titled "Copy of …" and navigates the operator straight to
  // it. Annotations are NOT copied — they're anchored to specific text
  // positions in the source and would either match by accident or drift
  // the moment the copy is edited.
  const duplicate = async () => {
    setDuplicating(true)
    try {
      const res = await fetch(`/api/content/${id}/duplicate`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.id) {
        toast.error(data?.error ?? 'Could not duplicate')
        return
      }
      toast.success(`Duplicated as "${data.topic}"`)
      router.push(`/content/${data.id}`)
      router.refresh()
    } catch {
      toast.error('Could not duplicate')
    } finally {
      setDuplicating(false)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={copy}>
        <Copy className="h-4 w-4" /> Copy
      </Button>
      <Button variant="outline" onClick={download}>
        <Download className="h-4 w-4" /> Download
      </Button>
      <Button variant="outline" onClick={duplicate} loading={duplicating}>
        <Files className="h-4 w-4" /> Duplicate
      </Button>
      <Button variant="outline" onClick={remove} loading={deleting} className="text-destructive hover:text-destructive">
        <Trash2 className="h-4 w-4" /> Delete
      </Button>
    </div>
  )
}
