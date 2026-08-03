'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function NewReportButton() {
  const router = useRouter()
  const [creating, setCreating] = useState(false)

  async function create() {
    const title = window.prompt('Назва звіту?', 'Новий звіт')
    if (title === null) return
    const periodLabel = window.prompt('Період? (напр. Серпень 2026)', '') ?? ''
    setCreating(true)
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, periodLabel }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.report?.slug) {
        toast.error(data?.error ?? 'Не вдалося створити звіт')
        return
      }
      toast.success('Звіт створено — відкриваю редактор')
      router.push(`/reports/${data.report.slug}`)
      router.refresh()
    } finally {
      setCreating(false)
    }
  }

  return (
    <Button onClick={create} disabled={creating} className="gap-2">
      {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
      Новий звіт
    </Button>
  )
}
