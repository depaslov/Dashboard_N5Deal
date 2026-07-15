'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { FileType2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Reusable "Export to Google Docs" button for the static operational report
// pages (/reports/*). Grabs the rendered report HTML from the DOM element with
// id=targetId and sends it to /api/google/docs/create (kind: 'html') — same
// Drive-import flow the Marketing OS reports board uses. Mirrors the OAuth
// auto-resume pattern from reports-board.tsx so first-time connect only needs
// one click.
const PENDING_KEY = 'n5_report_export_pending'

export function ReportExportButton({
  title,
  targetId,
}: {
  title: string
  targetId: string
}) {
  const pathname = usePathname() ?? ''
  const params = useSearchParams()
  const router = useRouter()
  const [creating, setCreating] = useState(false)

  // Keep the OAuth-return effect pointed at the latest closure.
  const exportRef = useRef<() => Promise<void> | undefined>(() => undefined)

  async function exportToDocs() {
    setCreating(true)
    try {
      const html = document.getElementById(targetId)?.innerHTML
      if (!html || html.trim().length === 0) {
        toast.error('Не вдалося зчитати вміст звіту.')
        return
      }

      const status = await fetch('/api/google/status').then((r) => r.json()).catch(() => null)
      if (!status?.configured) {
        toast.error('Google Drive інтеграція не налаштована (GOOGLE_CLIENT_ID / SECRET / REDIRECT_URI).')
        return
      }
      if (!status.connected) {
        try { window.sessionStorage.setItem(PENDING_KEY, '1') } catch { /* private mode */ }
        const returnTo = pathname + (params.toString() ? `?${params.toString()}` : '')
        window.location.href = `/api/auth/google/start?returnTo=${encodeURIComponent(returnTo)}`
        return
      }

      // Open the tab synchronously (before the await) so it isn't blocked as a
      // non-user-gesture popup, then navigate it once the doc URL comes back.
      const tab = window.open('about:blank', '_blank')
      const res = await fetch('/api/google/docs/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'html', title, html }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.docUrl) {
        if (tab) tab.close()
        if (data?.code === 'not_connected') {
          try { window.sessionStorage.setItem(PENDING_KEY, '1') } catch { /* private mode */ }
          const returnTo = pathname + (params.toString() ? `?${params.toString()}` : '')
          window.location.href = `/api/auth/google/start?returnTo=${encodeURIComponent(returnTo)}`
          return
        }
        toast.error(data?.error ?? 'Не вдалося створити Google Doc')
        return
      }
      if (tab) {
        tab.location.href = data.docUrl
        try { tab.opener = null } catch { /* navigation in flight */ }
      } else {
        window.open(data.docUrl, '_blank')
      }
      toast.success('Google Doc створено — відкриваю…')
    } finally {
      setCreating(false)
    }
  }

  exportRef.current = exportToDocs

  // After returning from Google consent the callback appends
  // ?g_oauth=ok|?g_oauth_error=… — toast, strip the params, and auto-resume the
  // export if the operator had one pending.
  useEffect(() => {
    const ok = params.get('g_oauth')
    const err = params.get('g_oauth_error')
    if (!ok && !err) return

    const wasPending =
      typeof window !== 'undefined' && window.sessionStorage.getItem(PENDING_KEY) === '1'
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(PENDING_KEY)

    if (ok === 'ok') {
      toast.success(
        wasPending
          ? 'Google підключено — створюю документ…'
          : 'Google акаунт підключено — натисніть «Export to Google Docs» ще раз.',
        { duration: 5000 },
      )
    }
    if (err) toast.error(`Помилка підключення Google: ${err}`)

    const next = new URLSearchParams(params.toString())
    next.delete('g_oauth')
    next.delete('g_oauth_error')
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)

    if (ok === 'ok' && wasPending) {
      setTimeout(() => { void exportRef.current?.() }, 200)
    }
  }, [params, router, pathname])

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={exportToDocs}
      disabled={creating}
      className="gap-1.5 shrink-0"
    >
      {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileType2 className="h-3.5 w-3.5" />}
      {creating ? 'Створюю…' : 'Export to Google Docs'}
    </Button>
  )
}
