'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Loader2, PlayCircle, RotateCw } from 'lucide-react'
import { toast } from 'sonner'

// Client-side trigger for POST /api/marketing/seed-july-2026. Two paths:
//   - "Seed" (default): first-time creation; if the DB already has a prior
//     seed marker the endpoint returns 409 with an actionable hint.
//   - "Force reseed": purges prior auto-seeded rows and re-runs. Manually
//     edited rows without the seed marker survive.
//
// Result summary is toast + inline count so the operator can verify the
// 25 / 10 / 6 / 10 / 12 / 3 split without switching tabs.
export function SeedButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ seeded: number; byType: Record<string, number> } | null>(
    null,
  )

  async function seed(force: boolean) {
    setBusy(true)
    try {
      const url = force
        ? '/api/marketing/seed-july-2026?force=true'
        : '/api/marketing/seed-july-2026'
      const res = await fetch(url, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 409) {
          toast.error(
            `Already seeded (${data?.existing ?? '?'} rows exist). Use "Force reseed" to purge and re-run.`,
          )
        } else {
          toast.error(data?.error ?? `Seed failed (${res.status})`)
        }
        return
      }
      setResult({ seeded: data?.seeded ?? 0, byType: data?.byType ?? {} })
      toast.success(`Seeded ${data?.seeded ?? 0} items into LinkBuilding + Tasks`)
      router.refresh()
    } catch (e) {
      toast.error((e as Error)?.message ?? 'Network error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border rounded-lg p-4 bg-muted/20">
      <div className="flex flex-wrap items-start gap-4 justify-between">
        <div className="flex-1 min-w-[250px]">
          <div className="font-semibold text-sm mb-1">Розкидати по LinkBuilding + Tasks</div>
          <div className="text-xs text-muted-foreground leading-relaxed">
            Створить 66 items у Marketing OS: 25 articles + 6 market news у Tasks board, 10 Medium
            (WEB 2.0) + 10 profiles + 12 Reddit crowd + 3 paid outreach у LinkBuilding board. Кожен
            item з датою за тижневою розбивкою (див. вище), status = planned. Ідемпотентно — якщо
            вже посіджено, попередить.
          </div>
        </div>
        <div className="flex flex-col gap-2 flex-shrink-0">
          <Button size="sm" onClick={() => seed(false)} disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Створюю…
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4 mr-1" />
                Seed
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (!confirm('Це видалить попередній auto-seed і створить наново. Продовжити?')) return
              seed(true)
            }}
            disabled={busy}
          >
            <RotateCw className="h-3.5 w-3.5 mr-1" />
            Force reseed
          </Button>
        </div>
      </div>

      {result ? (
        <div className="mt-3 pt-3 border-t text-xs">
          <div className="font-medium mb-1">Створено {result.seeded} items:</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
            {Object.entries(result.byType).map(([type, count]) => (
              <span key={type}>
                <strong className="text-foreground">{count}</strong> × {type}
              </span>
            ))}
          </div>
          <div className="mt-2 text-muted-foreground">
            Перевірити на{' '}
            <a href="/marketing/linkbuilding" className="text-primary underline">
              LinkBuilding
            </a>{' '}
            і{' '}
            <a href="/marketing/tasks" className="text-primary underline">
              Tasks
            </a>{' '}
            вкладках.
          </div>
        </div>
      ) : null}
    </div>
  )
}
