'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowLeft, Pencil, Trash2, Save, X, Loader2,
  Bold, Italic, Underline, List, ListOrdered, Heading2, Heading3,
  Link2, Eraser, Undo2, Redo2, Code2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ReportExportButton } from '@/components/app/report-export-button'

export interface ReportData {
  id: string
  slug: string
  title: string
  periodLabel: string
  subtitle: string | null
  kind: string
  bodyHtml: string
}

export function ReportPageClient({ report }: { report: ReportData }) {
  const router = useRouter()
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Draft metadata + body (initialised from props each time we enter edit).
  const [title, setTitle] = useState(report.title)
  const [periodLabel, setPeriodLabel] = useState(report.periodLabel)
  const [subtitle, setSubtitle] = useState(report.subtitle ?? '')
  const [kind, setKind] = useState(report.kind)
  const [bodyHtml, setBodyHtml] = useState(report.bodyHtml)
  const [showSource, setShowSource] = useState(false)

  const editorRef = useRef<HTMLDivElement>(null)

  function enterEdit() {
    setTitle(report.title)
    setPeriodLabel(report.periodLabel)
    setSubtitle(report.subtitle ?? '')
    setKind(report.kind)
    setBodyHtml(report.bodyHtml)
    setShowSource(false)
    setMode('edit')
  }

  function exec(cmd: string, value?: string) {
    editorRef.current?.focus()
    // execCommand is deprecated but remains the most dependency-free way to
    // drive a contentEditable surface across browsers.
    document.execCommand(cmd, false, value)
  }

  async function save() {
    // Pull the latest HTML from whichever surface is active.
    const finalHtml = showSource ? bodyHtml : (editorRef.current?.innerHTML ?? bodyHtml)
    setSaving(true)
    try {
      const res = await fetch(`/api/reports/${report.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, periodLabel, subtitle, kind, bodyHtml: finalHtml }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error ?? 'Не вдалося зберегти')
        return
      }
      toast.success('Звіт збережено')
      setMode('view')
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!confirm('Видалити цей звіт? Дію не можна скасувати.')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/reports/${report.id}`, { method: 'DELETE' })
      if (!res.ok) {
        toast.error('Не вдалося видалити')
        return
      }
      toast.success('Звіт видалено')
      router.push('/reports')
      router.refresh()
    } finally {
      setDeleting(false)
    }
  }

  // ── VIEW ──────────────────────────────────────────────────────────────────
  if (mode === 'view') {
    return (
      <div className="max-w-[1100px] mx-auto pb-24">
        <div className="flex items-center justify-between gap-3 mb-4">
          <Link href="/reports" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Всі звіти
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={enterEdit} className="gap-1.5">
              <Pencil className="h-3.5 w-3.5" /> Редагувати
            </Button>
            <ReportExportButton title={report.title} targetId="report-export-root" />
            <Button variant="outline" size="sm" onClick={remove} disabled={deleting} className="gap-1.5 text-destructive hover:text-destructive">
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
        <div id="report-export-root" dangerouslySetInnerHTML={{ __html: report.bodyHtml }} />
      </div>
    )
  }

  // ── EDIT ──────────────────────────────────────────────────────────────────
  const toolBtn = 'inline-flex items-center justify-center h-8 w-8 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors'
  return (
    <div className="max-w-[1100px] mx-auto pb-24">
      <div className="flex items-center justify-between gap-3 mb-4">
        <span className="text-sm font-medium">Редагування звіту</span>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={save} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? 'Збереження…' : 'Зберегти'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMode('view')} disabled={saving} className="gap-1.5">
            <X className="h-3.5 w-3.5" /> Скасувати
          </Button>
        </div>
      </div>

      {/* Metadata (shown on the reports index card) */}
      <div className="grid gap-3 sm:grid-cols-2 mb-4 bg-muted/30 border border-border rounded-lg p-4">
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Назва (для списку)</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full text-sm border border-border rounded px-2 py-1.5 bg-background" />
        </div>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Період</label>
          <input value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} className="mt-1 w-full text-sm border border-border rounded px-2 py-1.5 bg-background" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Підзаголовок (для картки в списку)</label>
          <textarea value={subtitle} onChange={(e) => setSubtitle(e.target.value)} rows={2} className="mt-1 w-full text-sm border border-border rounded px-2 py-1.5 bg-background" />
        </div>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Тип</label>
          <select value={kind} onChange={(e) => setKind(e.target.value)} className="mt-1 w-full text-sm border border-border rounded px-2 py-1.5 bg-background">
            <option value="recap">Звіт (recap)</option>
            <option value="plan">План (plan)</option>
          </select>
        </div>
      </div>

      {/* Formatting toolbar */}
      <div className="sticky top-14 z-10 flex flex-wrap items-center gap-0.5 bg-card border border-border rounded-lg px-2 py-1.5 mb-3 shadow-sm">
        <button type="button" className={toolBtn} title="Жирний" onClick={() => exec('bold')}><Bold className="h-4 w-4" /></button>
        <button type="button" className={toolBtn} title="Курсив" onClick={() => exec('italic')}><Italic className="h-4 w-4" /></button>
        <button type="button" className={toolBtn} title="Підкреслення" onClick={() => exec('underline')}><Underline className="h-4 w-4" /></button>
        <span className="w-px h-5 bg-border mx-1" />
        <button type="button" className={toolBtn} title="Заголовок H2" onClick={() => exec('formatBlock', 'h2')}><Heading2 className="h-4 w-4" /></button>
        <button type="button" className={toolBtn} title="Заголовок H3" onClick={() => exec('formatBlock', 'h3')}><Heading3 className="h-4 w-4" /></button>
        <button type="button" className={toolBtn} title="Абзац" onClick={() => exec('formatBlock', 'p')}><span className="text-xs font-semibold">¶</span></button>
        <span className="w-px h-5 bg-border mx-1" />
        <button type="button" className={toolBtn} title="Маркований список" onClick={() => exec('insertUnorderedList')}><List className="h-4 w-4" /></button>
        <button type="button" className={toolBtn} title="Нумерований список" onClick={() => exec('insertOrderedList')}><ListOrdered className="h-4 w-4" /></button>
        <button type="button" className={toolBtn} title="Посилання" onClick={() => { const url = window.prompt('URL посилання:'); if (url) exec('createLink', url) }}><Link2 className="h-4 w-4" /></button>
        <button type="button" className={toolBtn} title="Прибрати форматування" onClick={() => exec('removeFormat')}><Eraser className="h-4 w-4" /></button>
        <span className="w-px h-5 bg-border mx-1" />
        <button type="button" className={toolBtn} title="Скасувати" onClick={() => exec('undo')}><Undo2 className="h-4 w-4" /></button>
        <button type="button" className={toolBtn} title="Повторити" onClick={() => exec('redo')}><Redo2 className="h-4 w-4" /></button>
        <span className="w-px h-5 bg-border mx-1" />
        <button
          type="button"
          className={`${toolBtn} ${showSource ? 'bg-secondary text-foreground' : ''}`}
          title="HTML-код"
          onClick={() => {
            if (!showSource) {
              // Visual → source: capture current DOM.
              setBodyHtml(editorRef.current?.innerHTML ?? bodyHtml)
            }
            setShowSource((s) => !s)
          }}
        >
          <Code2 className="h-4 w-4" />
        </button>
      </div>

      {showSource ? (
        <textarea
          value={bodyHtml}
          onChange={(e) => setBodyHtml(e.target.value)}
          className="w-full min-h-[500px] font-mono text-xs border border-border rounded-lg p-4 bg-background"
          spellCheck={false}
        />
      ) : (
        <div
          key={report.id + '-editor'}
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className="min-h-[400px] border border-border rounded-lg p-6 focus:outline-none focus:ring-2 focus:ring-primary/40"
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      )}
      <p className="text-xs text-muted-foreground mt-2">
        Редагуйте текст прямо у звіті (клікніть у будь-яку клітинку таблиці чи абзац). Панель зверху —
        для форматування. «&lt;/&gt;» відкриває HTML-код для складніших правок.
      </p>
    </div>
  )
}
