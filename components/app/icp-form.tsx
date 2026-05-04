'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Plus, X, Save, Trash2 } from 'lucide-react'

interface IcpData {
  id?: string
  name: string
  industry: string
  companySize: string
  painPoints: string[]
  goals: string[]
  demographics: string
  budgetRange: string
  decisionProcess: string
}

interface Props {
  mode: 'create' | 'edit'
  icp?: IcpData
}

export function IcpForm({ mode, icp }: Props) {
  const router = useRouter()
  const [data, setData] = useState<IcpData>(
    icp ?? {
      name: '',
      industry: '',
      companySize: '',
      painPoints: [],
      goals: [],
      demographics: '',
      budgetRange: '',
      decisionProcess: '',
    }
  )
  const [painInput, setPainInput] = useState('')
  const [goalInput, setGoalInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const addItem = (field: 'painPoints' | 'goals', value: string) => {
    const v = value.trim()
    if (!v) return
    setData((d) => ({ ...d, [field]: [...(d?.[field] ?? []), v] }))
  }

  const removeItem = (field: 'painPoints' | 'goals', idx: number) => {
    setData((d) => ({
      ...d,
      [field]: (d?.[field] ?? []).filter((_, i) => i !== idx),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!data.name.trim() || !data.industry.trim()) {
      toast.error('Name and industry are required')
      return
    }
    setLoading(true)
    try {
      const url = mode === 'create' ? '/api/icps' : `/api/icps/${icp?.id}`
      const method = mode === 'create' ? 'POST' : 'PUT'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json?.error ?? 'Failed to save ICP')
        return
      }
      toast.success(mode === 'create' ? 'ICP created' : 'ICP updated')
      router.push('/icps')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!icp?.id) return
    if (!confirm('Delete this ICP? This cannot be undone.')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/icps/${icp.id}`, { method: 'DELETE' })
      if (!res.ok) {
        toast.error('Could not delete ICP')
        return
      }
      toast.success('ICP deleted')
      router.push('/icps')
      router.refresh()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-card border border-border shadow-sm p-6 space-y-5">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Profile name *</Label>
            <Input
              id="name"
              required
              placeholder="e.g. Fintech Founder"
              value={data.name}
              onChange={(e) => setData({ ...data, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="industry">Industry / Sector *</Label>
            <Input
              id="industry"
              required
              placeholder="e.g. Fintech / Payments"
              value={data.industry}
              onChange={(e) => setData({ ...data, industry: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="companySize">Company size</Label>
            <Input
              id="companySize"
              placeholder="e.g. 10–100 employees"
              value={data.companySize}
              onChange={(e) => setData({ ...data, companySize: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="budgetRange">Budget range</Label>
            <Input
              id="budgetRange"
              placeholder="e.g. €150K – €2M"
              value={data.budgetRange}
              onChange={(e) => setData({ ...data, budgetRange: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="demographics">Demographics</Label>
          <Textarea
            id="demographics"
            rows={2}
            placeholder="e.g. Founders and C-level, 28–45, EU / UK, technical background"
            value={data.demographics}
            onChange={(e) => setData({ ...data, demographics: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="decisionProcess">Decision-making process</Label>
          <Textarea
            id="decisionProcess"
            rows={2}
            placeholder="e.g. Founder-led; legal advisor involvement; 2–8 week cycle"
            value={data.decisionProcess}
            onChange={(e) => setData({ ...data, decisionProcess: e.target.value })}
          />
        </div>
      </div>

      {/* Pain points */}
      <div className="bg-card border border-border shadow-sm p-6">
        <h3 className="font-display font-semibold text-lg tracking-tight">Pain points</h3>
        <p className="text-xs text-muted-foreground mt-0.5 mb-4">Add the top frustrations this ICP faces.</p>
        <div className="flex gap-2">
          <Input
            placeholder="Add a pain point…"
            value={painInput}
            onChange={(e) => setPainInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addItem('painPoints', painInput)
                setPainInput('')
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              addItem('painPoints', painInput)
              setPainInput('')
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {(data?.painPoints ?? []).length > 0 ? (
          <ul className="mt-4 space-y-2">
            {(data?.painPoints ?? []).map((p, idx) => (
              <li key={idx} className="flex items-start gap-2 bg-secondary/60 px-3 py-2 text-sm">
                <span className="flex-1">{p}</span>
                <button
                  type="button"
                  onClick={() => removeItem('painPoints', idx)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Remove"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* Goals */}
      <div className="bg-card border border-border shadow-sm p-6">
        <h3 className="font-display font-semibold text-lg tracking-tight">Goals & Objectives</h3>
        <p className="text-xs text-muted-foreground mt-0.5 mb-4">What outcomes is this ICP trying to achieve?</p>
        <div className="flex gap-2">
          <Input
            placeholder="Add a goal…"
            value={goalInput}
            onChange={(e) => setGoalInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addItem('goals', goalInput)
                setGoalInput('')
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              addItem('goals', goalInput)
              setGoalInput('')
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {(data?.goals ?? []).length > 0 ? (
          <ul className="mt-4 space-y-2">
            {(data?.goals ?? []).map((g, idx) => (
              <li key={idx} className="flex items-start gap-2 bg-secondary/60 px-3 py-2 text-sm">
                <span className="flex-1">{g}</span>
                <button
                  type="button"
                  onClick={() => removeItem('goals', idx)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Remove"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2">
        {mode === 'edit' ? (
          <Button
            type="button"
            variant="outline"
            onClick={handleDelete}
            loading={deleting}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={() => router.push('/icps')}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            <Save className="h-4 w-4" /> {mode === 'create' ? 'Create ICP' : 'Save changes'}
          </Button>
        </div>
      </div>
    </form>
  )
}
