'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  ALL_PLATFORMS,
  DEFAULT_PLATFORMS,
  POST_STATUSES,
  POST_STATUS_LABEL,
  POST_TYPES_BY_ACCOUNT,
  type AccountSlug,
} from '@/lib/marketing/constants'
import { cn } from '@/lib/utils'
import { ImageUploader } from './image-uploader'
import type { CalAccount, CalPost } from './types'

type Mode =
  | { kind: 'create'; defaultDate: string; defaultAccountId?: string }
  | { kind: 'edit'; post: CalPost }
  | null

interface Props {
  accounts: CalAccount[]
  mode: Mode
  onClose: () => void
}

export function PostFormModal({ accounts, mode, onClose }: Props) {
  const router = useRouter()
  const open = mode !== null
  const isEdit = mode?.kind === 'edit'

  const [accountId, setAccountId] = useState('')
  const [type, setType] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [date, setDate] = useState('')
  const [platforms, setPlatforms] = useState<string[]>([])
  const [status, setStatus] = useState('idea')
  const [notes, setNotes] = useState('')
  const [postUrl, setPostUrl] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [imagesLoading, setImagesLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Re-seed form whenever mode changes
  useEffect(() => {
    if (!mode) return
    if (mode.kind === 'edit') {
      const p = mode.post
      setAccountId(p.accountId)
      setType(p.type)
      setTitle(p.title)
      setContent(p.content)
      setDate(p.scheduledFor.slice(0, 10))
      setPlatforms(p.platforms)
      setStatus(p.status)
      setNotes(p.notes)
      setPostUrl(p.postUrl)
      // Server-rendered card only has imageCount, not the base64 blobs —
      // fetch them lazily so the modal stays light on listing pages.
      if (p.imageCount > 0) {
        setImagesLoading(true)
        setImages([])
        fetch(`/api/marketing/posts/${p.id}`)
          .then((r) => r.json())
          .then((d) => setImages((d.post?.images as string[] | undefined) ?? []))
          .catch(() => setImages([]))
          .finally(() => setImagesLoading(false))
      } else {
        setImages([])
      }
    } else {
      const acc = mode.defaultAccountId ?? accounts[0]?.id ?? ''
      const accSlug = (accounts.find((a) => a.id === acc)?.slug ?? 'n5') as AccountSlug
      const types = POST_TYPES_BY_ACCOUNT[accSlug] ?? ['Post']
      setAccountId(acc)
      setType(types[0] ?? 'Post')
      setTitle('')
      setContent('')
      setDate(mode.defaultDate)
      setPlatforms(DEFAULT_PLATFORMS[accSlug] ?? [])
      setStatus('idea')
      setNotes('')
      setPostUrl('')
      setImages([])
    }
  }, [mode, accounts])

  const selectedSlug = useMemo(() => {
    return (accounts.find((a) => a.id === accountId)?.slug ?? 'n5') as AccountSlug
  }, [accountId, accounts])

  const availableTypes = POST_TYPES_BY_ACCOUNT[selectedSlug] ?? ['Post']

  function togglePlatform(p: string) {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))
  }

  async function save() {
    if (!title.trim() && !content.trim()) {
      toast.error('Title or content is required')
      return
    }
    if (!date) {
      toast.error('Date is required')
      return
    }
    setSaving(true)
    try {
      // Normalize date to noon local time so it lands cleanly in a day cell
      const dt = new Date(date + 'T12:00:00')
      const body = {
        accountId,
        type,
        title: title.trim() || content.trim().slice(0, 80),
        content: content || undefined,
        platforms,
        scheduledFor: dt.toISOString(),
        status,
        notes: notes || undefined,
        postUrl: postUrl || '',
        images,
      }
      const url = isEdit ? `/api/marketing/posts/${mode!.post.id}` : '/api/marketing/posts'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error ?? 'Save failed')
        return
      }
      toast.success(isEdit ? 'Updated' : 'Created')
      router.refresh()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!isEdit) return
    if (!confirm('Delete this post?')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/marketing/posts/${mode!.post.id}`, { method: 'DELETE' })
      if (!res.ok) {
        toast.error('Delete failed')
        return
      }
      toast.success('Deleted')
      router.refresh()
      onClose()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit post' : 'New post'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="account">Account</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger id="account">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="inline-flex items-center gap-2">
                        <span className="inline-block h-2 w-2 rounded-full" style={{ background: a.color }} />
                        {a.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="type">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="title">
              Title <span className="text-muted-foreground font-normal text-[10px]">(short — what it's about)</span>
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short hook or topic..."
            />
          </div>

          <div>
            <Label htmlFor="content">
              Content <span className="text-muted-foreground font-normal text-[10px]">(the actual post copy)</span>
            </Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              placeholder="What people will read on the platform..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POST_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {POST_STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Platforms</Label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {ALL_PLATFORMS.map((p) => {
                const on = platforms.includes(p)
                return (
                  <button
                    type="button"
                    key={p}
                    onClick={() => togglePlatform(p)}
                    className={cn(
                      'text-xs font-medium px-2.5 py-1 rounded border transition-colors',
                      on
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-card text-muted-foreground hover:bg-accent',
                    )}
                  >
                    {p}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <Label>Image(s)</Label>
            {imagesLoading ? (
              <div className="text-xs text-muted-foreground italic py-2">Loading attached images…</div>
            ) : (
              <ImageUploader type={type} images={images} onChange={setImages} />
            )}
          </div>

          <div>
            <Label htmlFor="notes">
              Notes <span className="text-muted-foreground font-normal text-[10px]">(internal — angle, reference, todo)</span>
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Angle, hook, reference..."
            />
          </div>

          <div>
            <Label htmlFor="url">Post URL (after publishing)</Label>
            <Input
              id="url"
              type="url"
              value={postUrl}
              onChange={(e) => setPostUrl(e.target.value)}
              placeholder="https://linkedin.com/posts/..."
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {isEdit ? (
            <Button variant="destructive" onClick={remove} disabled={saving || deleting} className="mr-auto gap-1.5">
              <Trash2 className="h-3.5 w-3.5" />
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          ) : null}
          <Button variant="outline" onClick={onClose} disabled={saving || deleting}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || deleting}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add post'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
