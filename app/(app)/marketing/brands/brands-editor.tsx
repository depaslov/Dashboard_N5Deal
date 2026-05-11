'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Trash2, Circle, CircleDot, CheckCircle2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

export interface Deliverable {
  id: string
  text: string
  status: 'todo' | 'inprogress' | 'done'
  priority: 'urgent' | 'high' | 'medium' | 'low'
}

export interface BrandData {
  id: string
  slug: string
  name: string
  tagline: string
  pitch: string
  features: string[]
  deliverables: Deliverable[]
  notes: string
}

const PRIORITY_BADGE: Record<Deliverable['priority'], string> = {
  urgent: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  high: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  low: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
}

const STATUS_ICONS: Record<Deliverable['status'], React.ReactNode> = {
  todo: <Circle className="h-4 w-4" />,
  inprogress: <CircleDot className="h-4 w-4 text-blue-600" />,
  done: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
}

const STATUS_CYCLE: Record<Deliverable['status'], Deliverable['status']> = {
  todo: 'inprogress',
  inprogress: 'done',
  done: 'todo',
}

export function BrandsEditor({ initial }: { initial: BrandData[] }) {
  const router = useRouter()
  const [brands, setBrands] = useState<BrandData[]>(initial)
  const [saving, setSaving] = useState<string | null>(null)

  async function patch(id: string, fields: Partial<BrandData>) {
    setSaving(id)
    try {
      const res = await fetch(`/api/marketing/brands/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.error ?? 'Save failed')
        return false
      }
      router.refresh()
      return true
    } finally {
      setSaving(null)
    }
  }

  function updateLocal(id: string, fields: Partial<BrandData>) {
    setBrands((prev) => prev.map((b) => (b.id === id ? { ...b, ...fields } : b)))
  }

  function toggleDeliverableStatus(brandId: string, delivId: string) {
    const brand = brands.find((b) => b.id === brandId)
    if (!brand) return
    const next = brand.deliverables.map((d) => (d.id === delivId ? { ...d, status: STATUS_CYCLE[d.status] } : d))
    updateLocal(brandId, { deliverables: next })
    patch(brandId, { deliverables: next })
  }

  function updateDeliverableText(brandId: string, delivId: string, text: string) {
    const brand = brands.find((b) => b.id === brandId)
    if (!brand) return
    const next = brand.deliverables.map((d) => (d.id === delivId ? { ...d, text } : d))
    updateLocal(brandId, { deliverables: next })
    patch(brandId, { deliverables: next })
  }

  function updateDeliverablePriority(brandId: string, delivId: string, priority: Deliverable['priority']) {
    const brand = brands.find((b) => b.id === brandId)
    if (!brand) return
    const next = brand.deliverables.map((d) => (d.id === delivId ? { ...d, priority } : d))
    updateLocal(brandId, { deliverables: next })
    patch(brandId, { deliverables: next })
  }

  function addDeliverable(brandId: string) {
    const brand = brands.find((b) => b.id === brandId)
    if (!brand) return
    const next = [
      ...brand.deliverables,
      { id: `d_${Date.now()}`, text: 'New deliverable', status: 'todo' as const, priority: 'medium' as const },
    ]
    updateLocal(brandId, { deliverables: next })
    patch(brandId, { deliverables: next })
  }

  function removeDeliverable(brandId: string, delivId: string) {
    const brand = brands.find((b) => b.id === brandId)
    if (!brand) return
    const next = brand.deliverables.filter((d) => d.id !== delivId)
    updateLocal(brandId, { deliverables: next })
    patch(brandId, { deliverables: next })
  }

  return (
    <div className="space-y-6">
      {brands.map((b) => (
        <section key={b.id} className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
          <header className="border-l-4 border-primary px-5 py-4 space-y-1">
            <Input
              defaultValue={b.name}
              onBlur={(e) => { if (e.target.value !== b.name) { updateLocal(b.id, { name: e.target.value }); patch(b.id, { name: e.target.value }) } }}
              className="font-display text-xl font-semibold tracking-tight border-0 px-0 shadow-none h-auto py-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
            />
            <Input
              defaultValue={b.tagline}
              placeholder="Tagline"
              onBlur={(e) => { if (e.target.value !== b.tagline) { updateLocal(b.id, { tagline: e.target.value }); patch(b.id, { tagline: e.target.value }) } }}
              className="text-sm text-muted-foreground border-0 px-0 shadow-none h-auto py-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
            />
          </header>
          <div className="px-5 pb-5 space-y-4">
            <div>
              <Label>Canonical pitch</Label>
              <Textarea
                defaultValue={b.pitch}
                onBlur={(e) => { if (e.target.value !== b.pitch) { updateLocal(b.id, { pitch: e.target.value }); patch(b.id, { pitch: e.target.value }) } }}
                rows={3}
                placeholder="Describe what this brand actually does, in the team's own words."
                className="italic"
              />
            </div>

            {b.features.length ? (
              <div>
                <Label>Features</Label>
                <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                  {b.features.map((f, i) => (
                    <Input
                      key={i}
                      defaultValue={f}
                      onBlur={(e) => {
                        const next = [...b.features]
                        next[i] = e.target.value
                        if (next.join('|') !== b.features.join('|')) { updateLocal(b.id, { features: next }); patch(b.id, { features: next }) }
                      }}
                      className="text-xs bg-muted/30"
                    />
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Deliverables</Label>
                <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => addDeliverable(b.id)}>
                  <Plus className="h-3 w-3" /> Add
                </Button>
              </div>
              <ul className="space-y-1.5">
                {b.deliverables.map((d) => (
                  <li key={d.id} className="flex items-center gap-2 bg-muted/30 rounded px-2.5 py-1.5">
                    <button
                      type="button"
                      onClick={() => toggleDeliverableStatus(b.id, d.id)}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Toggle status"
                    >
                      {STATUS_ICONS[d.status]}
                    </button>
                    <Input
                      defaultValue={d.text}
                      onBlur={(e) => { if (e.target.value !== d.text) updateDeliverableText(b.id, d.id, e.target.value) }}
                      className={cn('flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-auto py-0', d.status === 'done' && 'line-through text-muted-foreground')}
                    />
                    <Select
                      value={d.priority}
                      onValueChange={(v) => updateDeliverablePriority(b.id, d.id, v as Deliverable['priority'])}
                    >
                      <SelectTrigger className="h-6 w-[90px] text-[10px] border-0 bg-transparent shadow-none focus:ring-0 focus:ring-offset-0">
                        <Badge variant="secondary" className={cn('text-[10px]', PRIORITY_BADGE[d.priority])}>
                          {d.priority}
                        </Badge>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="urgent">urgent</SelectItem>
                        <SelectItem value="high">high</SelectItem>
                        <SelectItem value="medium">medium</SelectItem>
                        <SelectItem value="low">low</SelectItem>
                      </SelectContent>
                    </Select>
                    <button
                      type="button"
                      onClick={() => removeDeliverable(b.id, d.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Remove"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
                {b.deliverables.length === 0 ? (
                  <li className="text-xs text-muted-foreground italic px-2.5 py-1.5">No deliverables yet</li>
                ) : null}
              </ul>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                defaultValue={b.notes}
                onBlur={(e) => { if (e.target.value !== b.notes) { updateLocal(b.id, { notes: e.target.value }); patch(b.id, { notes: e.target.value }) } }}
                rows={2}
                placeholder="Free-form notes about this brand…"
              />
            </div>
          </div>
        </section>
      ))}

      {saving ? (
        <div className="fixed bottom-4 right-4 bg-card border border-border rounded-md px-3 py-1.5 text-xs shadow-md">
          Saving…
        </div>
      ) : null}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">{children}</div>
}
