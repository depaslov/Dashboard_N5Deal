'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { BarChart3, Search, Link2, Save, RefreshCw, AlertCircle, CheckCircle2, Copy } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface ConnectionValues {
  ga4PropertyId: string
  gscSiteUrl: string
  ahrefsTarget: string
  ahrefsMode: string
  lastSyncedAt: string | null
  lastSyncError: string | null
}

interface Props {
  role: string
  project: { id: string; name: string }
  connection: ConnectionValues
}

export function IntegrationsClient({ role, project, connection }: Props) {
  const router = useRouter()
  const isAdmin = role === 'admin'

  const [ga4PropertyId, setGa4PropertyId] = useState(connection.ga4PropertyId)
  const [gscSiteUrl, setGscSiteUrl] = useState(connection.gscSiteUrl)
  const [ahrefsTarget, setAhrefsTarget] = useState(connection.ahrefsTarget)
  const [ahrefsMode, setAhrefsMode] = useState(connection.ahrefsMode)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const [saEmail, setSaEmail] = useState<string | null>(null)
  const [gscSites, setGscSites] = useState<string[] | null>(null)
  const [gscSitesError, setGscSitesError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/analytics/sites')
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (data?.serviceAccountEmail) setSaEmail(data.serviceAccountEmail)
        if (Array.isArray(data?.sites)) setGscSites(data.sites)
        else if (data?.sites?.__error) setGscSitesError(String(data.sites.__error))
      } catch (err: any) {
        if (!cancelled) setGscSitesError(String(err?.message ?? err))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/analytics/connection', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ga4PropertyId, gscSiteUrl, ahrefsTarget, ahrefsMode }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error ?? 'Could not save')
        return
      }
      toast.success('Integration settings saved')
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const syncNow = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/cron/sync-analytics')
      if (!res.ok) {
        toast.error('Sync failed')
        return
      }
      toast.success('Sync started')
      router.refresh()
    } finally {
      setSyncing(false)
    }
  }

  const copySa = async () => {
    if (!saEmail) return
    await navigator.clipboard.writeText(saEmail)
    toast.success('Service account email copied')
  }

  return (
    <div className="space-y-6">
      {saEmail ? (
        <div className="bg-secondary/50 border border-border p-4 flex items-start gap-3 text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Service account for Google APIs</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add this email as a <b>Viewer</b> in GA4 Property Access, and as a user in GSC → Settings → Users
              and permissions. Then paste the property/site below.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="text-xs bg-background px-2 py-1 border border-border truncate">{saEmail}</code>
              <Button variant="outline" size="sm" onClick={copySa} type="button">
                <Copy className="h-3 w-3" /> Copy
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <form onSubmit={save} className="space-y-6">
        {/* GA4 */}
        <section className="bg-card border border-border shadow-sm">
          <div className="px-6 py-4 border-b border-border flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-display font-semibold text-lg tracking-tight">Google Analytics 4</h2>
            {connection.ga4PropertyId ? (
              <span className="ml-auto inline-flex items-center gap-1 text-[11px] uppercase tracking-widest bg-emerald-500/10 text-emerald-600 px-2 py-1 font-semibold">
                <CheckCircle2 className="h-3 w-3" /> Connected
              </span>
            ) : null}
          </div>
          <div className="p-6 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ga4">Property ID</Label>
              <Input
                id="ga4"
                placeholder="e.g. 515703727"
                value={ga4PropertyId}
                onChange={(e) => setGa4PropertyId(e.target.value)}
                disabled={!isAdmin}
              />
              <p className="text-xs text-muted-foreground">
                GA4 → Admin → Property Settings → Property ID (numeric, not the G-XXXX Measurement ID).
              </p>
            </div>
          </div>
        </section>

        {/* GSC */}
        <section className="bg-card border border-border shadow-sm">
          <div className="px-6 py-4 border-b border-border flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-display font-semibold text-lg tracking-tight">Google Search Console</h2>
            {connection.gscSiteUrl ? (
              <span className="ml-auto inline-flex items-center gap-1 text-[11px] uppercase tracking-widest bg-emerald-500/10 text-emerald-600 px-2 py-1 font-semibold">
                <CheckCircle2 className="h-3 w-3" /> Connected
              </span>
            ) : null}
          </div>
          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gsc">Site URL / property</Label>
              <Input
                id="gsc"
                placeholder="https://n5deal.com/  or  sc-domain:n5deal.com"
                value={gscSiteUrl}
                onChange={(e) => setGscSiteUrl(e.target.value)}
                disabled={!isAdmin}
                list="gsc-sites-datalist"
              />
              {gscSites && gscSites.length > 0 ? (
                <>
                  <datalist id="gsc-sites-datalist">
                    {gscSites.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                  <p className="text-xs text-muted-foreground">
                    {gscSites.length} property(ies) visible to the service account — pick one from suggestions.
                  </p>
                </>
              ) : gscSitesError ? (
                <p className="text-xs text-amber-600">GSC list error: {gscSitesError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  URL-prefix format ends with a slash. Domain properties use the <code>sc-domain:</code> prefix.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Ahrefs */}
        <section className="bg-card border border-border shadow-sm">
          <div className="px-6 py-4 border-b border-border flex items-center gap-2">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-display font-semibold text-lg tracking-tight">Ahrefs</h2>
            {connection.ahrefsTarget ? (
              <span className="ml-auto inline-flex items-center gap-1 text-[11px] uppercase tracking-widest bg-emerald-500/10 text-emerald-600 px-2 py-1 font-semibold">
                <CheckCircle2 className="h-3 w-3" /> Connected
              </span>
            ) : null}
          </div>
          <div className="p-6 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ahrefs">Target</Label>
              <Input
                id="ahrefs"
                placeholder="n5deal.com"
                value={ahrefsTarget}
                onChange={(e) => setAhrefsTarget(e.target.value)}
                disabled={!isAdmin}
              />
              <p className="text-xs text-muted-foreground">Domain without protocol (e.g. n5deal.com).</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ahrefsMode">Scope</Label>
              <select
                id="ahrefsMode"
                value={ahrefsMode}
                onChange={(e) => setAhrefsMode(e.target.value)}
                disabled={!isAdmin}
                className="h-10 w-full px-3 text-sm bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="domain">Domain (root)</option>
                <option value="subdomains">Domain with subdomains</option>
                <option value="exact">Exact URL</option>
                <option value="prefix">URL prefix</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Uses AHREFS_API_TOKEN from the server env.
              </p>
            </div>
          </div>
        </section>

        {/* Actions */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="text-xs text-muted-foreground">
            {connection.lastSyncedAt ? (
              <>Last sync {formatDistanceToNow(new Date(connection.lastSyncedAt), { addSuffix: true })}</>
            ) : (
              <>Never synced</>
            )}
            {connection.lastSyncError ? (
              <span className="ml-2 text-amber-600">— last error: {connection.lastSyncError}</span>
            ) : null}
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <>
                <Button type="button" variant="outline" onClick={syncNow} loading={syncing}>
                  <RefreshCw className="h-4 w-4" /> Sync now
                </Button>
                <Button type="submit" loading={saving}>
                  <Save className="h-4 w-4" /> Save
                </Button>
              </>
            )}
          </div>
        </div>
        {!isAdmin ? (
          <p className="text-xs text-muted-foreground">Only workspace admins can edit integrations.</p>
        ) : null}
      </form>
    </div>
  )
}
