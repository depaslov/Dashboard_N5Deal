'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2, CheckCircle2, Undo2 } from 'lucide-react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LB_TYPES, LB_STATUSES } from '@/lib/marketing/constants'
import type { LbItem } from './lb-board'

type Mode =
  | { kind: 'create'; defaultDate?: string }
  | { kind: 'edit'; item: LbItem }
  | null

export function LbFormModal({ mode, onClose }: { mode: Mode; onClose: () => void }) {
  const router = useRouter()
  const open = mode !== null
  const isEdit = mode?.kind === 'edit'

  const [title, setTitle] = useState('')
  const [targetSite, setTargetSite] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [anchorText, setAnchorText] = useState('')
  const [destinationUrl, setDestinationUrl] = useState('')
  const [type, setType] = useState('outreach')
  const [status, setStatus] = useState('planned')
  const [scheduledFor, setScheduledFor] = useState('')
  const [publishedDate, setPublishedDate] = useState('')
  const [liveUrl, setLiveUrl] = useState('')
  const [dr, setDr] = useState('')
  const [cost, setCost] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!mode) return
    if (mode.kind === 'edit') {
      const i = mode.item
      setTitle(i.title); setTargetSite(i.targetSite); setContactName(i.contactName); setContactEmail(i.contactEmail)
      setAnchorText(i.anchorText); setDestinationUrl(i.destinationUrl); setType(i.type); setStatus(i.status)
      setScheduledFor(i.scheduledFor.slice(0, 10))
      setPublishedDate(i.publishedDate ? i.publishedDate.slice(0, 10) : '')
      setLiveUrl(i.liveUrl); setDr(i.dr !== null ? String(i.dr) : ''); setCost(i.cost !== null ? String(i.cost) : ''); setNotes(i.notes)
    } else {
      setTitle(''); setTargetSite(''); setContactName(''); setContactEmail('')
      setAnchorText(''); setDestinationUrl(''); setType('outreach'); setStatus('planned')
      setScheduledFor((mode.defaultDate ?? new Date().toISOString()).slice(0, 10))
      setPublishedDate(''); setLiveUrl(''); setDr(''); setCost(''); setNotes('')
    }
  }, [mode])

  async function save() {
    if (!title.trim()) { toast.error('Title is required'); return }
    if (!scheduledFor) { toast.error('Date is required'); return }
    setSaving(true)
    try {
      const body = {
        title: title.trim(),
        targetSite: targetSite.trim() || undefined,
        contactName: contactName.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        anchorText: anchorText.trim() || undefined,
        destinationUrl: destinationUrl.trim() || undefined,
        type,
        status,
        scheduledFor: new Date(scheduledFor + 'T12:00:00').toISOString(),
        publishedDate: publishedDate ? new Date(publishedDate + 'T12:00:00').toISOString() : null,
        liveUrl: liveUrl.trim() || undefined,
        dr: dr ? parseInt(dr, 10) : null,
        cost: cost ? parseFloat(cost) : null,
        notes: notes.trim() || undefined,
      }
      const url = isEdit ? `/api/marketing/linkbuilding/${mode!.item.id}` : '/api/marketing/linkbuilding'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data?.error ?? 'Save failed'); return }
      toast.success(isEdit ? 'Updated' : 'Added')
      router.refresh(); onClose()
    } finally { setSaving(false) }
  }

  // Quick-approve action in the edit modal: flip the task status to
  // "approved" and PATCH straight away. The dedicated route handler picks
  // up the transition and writes an 'approved' row into the activity log
  // (see [id]/route.ts). Same handler covers the inverse case — moving
  // away from "approved" logs an 'unapproved' entry. Mirrors what an
  // operator would do by hand: change status, hit save — collapsed into
  // one button so the workflow is obvious.
  async function toggleApprove() {
    if (!isEdit) return
    const nextStatus = status === 'approved' ? 'in_progress' : 'approved'
    setSaving(true)
    try {
      const res = await fetch(`/api/marketing/linkbuilding/${mode!.item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data?.error ?? 'Could not update status'); return }
      setStatus(nextStatus)
      toast.success(nextStatus === 'approved' ? 'Approved' : 'Approval reverted')
      router.refresh()
    } finally { setSaving(false) }
  }

  async function remove() {
    if (!isEdit) return
    if (!confirm('Delete this link building item?')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/marketing/linkbuilding/${mode!.item.id}`, { method: 'DELETE' })
      if (!res.ok) { toast.error('Delete failed'); return }
      toast.success('Deleted')
      router.refresh(); onClose()
    } finally { setDeleting(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit link building item' : 'New link building item'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="lb-title">Title / topic <span className="text-destructive">*</span></Label>
            <Input
              id="lb-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Guest post on Sifted about CEE fintech M&A"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="lb-site">Target site / domain</Label>
              <Input id="lb-site" value={targetSite} onChange={(e) => setTargetSite(e.target.value)} placeholder="sifted.eu" />
            </div>
            <div>
              <Label htmlFor="lb-anchor">Anchor text</Label>
              <Input id="lb-anchor" value={anchorText} onChange={(e) => setAnchorText(e.target.value)} placeholder="fintech M&A platform" />
            </div>
          </div>

          <div>
            <Label htmlFor="lb-dest">Destination URL on n5deal.com</Label>
            <Input id="lb-dest" value={destinationUrl} onChange={(e) => setDestinationUrl(e.target.value)} placeholder="https://n5deal.com/buyer" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="lb-contact-name">Contact name</Label>
              <Input id="lb-contact-name" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Editor name" />
            </div>
            <div>
              <Label htmlFor="lb-contact-email">Contact email</Label>
              <Input id="lb-contact-email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="editor@..." />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="lb-type">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="lb-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LB_TYPES.map((t) => <SelectItem key={t.k} value={t.k}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="lb-status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="lb-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LB_STATUSES.map((s) => <SelectItem key={s.k} value={s.k}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="lb-scheduled">Scheduled / outreach date <span className="text-destructive">*</span></Label>
              <Input id="lb-scheduled" type="date" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="lb-published">Published date (if live)</Label>
              <Input id="lb-published" type="date" value={publishedDate} onChange={(e) => setPublishedDate(e.target.value)} />
            </div>
          </div>

          <div>
            <Label htmlFor="lb-live">Live URL (after publication)</Label>
            <Input id="lb-live" type="url" value={liveUrl} onChange={(e) => setLiveUrl(e.target.value)} placeholder="https://sifted.eu/articles/..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="lb-dr">Domain Rating (DR)</Label>
              <Input id="lb-dr" type="number" min="0" max="100" value={dr} onChange={(e) => setDr(e.target.value)} placeholder="0–100" />
            </div>
            <div>
              <Label htmlFor="lb-cost">Cost ($)</Label>
              <Input id="lb-cost" type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" />
            </div>
          </div>

          <div>
            <Label htmlFor="lb-notes">Notes</Label>
            <Textarea id="lb-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Pitch angle, follow-up plan, response notes..." />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {isEdit ? (
            <>
              <Button variant="destructive" onClick={remove} disabled={saving || deleting} className="mr-auto gap-1.5">
                <Trash2 className="h-3.5 w-3.5" /> {deleting ? 'Deleting…' : 'Delete'}
              </Button>
              {status === 'approved' ? (
                <Button
                  variant="outline"
                  onClick={toggleApprove}
                  disabled={saving || deleting}
                  className="gap-1.5"
                  title="Revert this task back to In Progress"
                >
                  <Undo2 className="h-3.5 w-3.5" /> Revert approval
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={toggleApprove}
                  disabled={saving || deleting}
                  className="gap-1.5 border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-300 dark:hover:bg-violet-950"
                  title="Mark this task as approved (logs an Approved event)"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                </Button>
              )}
            </>
          ) : null}
          <Button variant="outline" onClick={onClose} disabled={saving || deleting}>Cancel</Button>
          <Button onClick={save} disabled={saving || deleting}>{saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add item'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
