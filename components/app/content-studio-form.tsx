'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Sparkles, Wand2, Copy, X, Upload, ListPlus } from 'lucide-react'
import { renderMarkdown, copyMarkdownAsRich } from '@/lib/markdown'

interface IcpItem { id: string; name: string }
interface PlatformItem { id: string; name: string; slug: string; formatType: string }

interface Props {
  contentType: 'articles' | 'market-news' | 'newsletter' | 'social' | 'link-building' | 'pages'
  title: string
  description: string
  icps: IcpItem[]
  platforms: PlatformItem[]
  features: {
    sourceUrl?: boolean
    document?: boolean
    bulk?: boolean
    seo?: boolean // shows main keywords + word count fields
  }
}

export function ContentStudioForm({ contentType, title, description, icps, platforms, features }: Props) {
  const router = useRouter()

  // Form fields
  const [topic, setTopic] = useState('')
  const [audience, setAudience] = useState('')
  const [keyMessages, setKeyMessages] = useState('')
  const [language, setLanguage] = useState<'en' | 'uk' | 'ru'>('en')
  const [icpIds, setIcpIds] = useState<string[]>([])
  const [platformId, setPlatformId] = useState<string>('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [documentText, setDocumentText] = useState('')
  const [documentName, setDocumentName] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Bulk mode
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkItemsText, setBulkItemsText] = useState('')

  // SEO fields (Pages)
  const [mainKeywordsText, setMainKeywordsText] = useState('')
  const [wordCountMin, setWordCountMin] = useState<number | ''>(950)
  const [wordCountMax, setWordCountMax] = useState<number | ''>(1000)
  const [secondaryAudience, setSecondaryAudience] = useState('')
  const [sectionOutlineText, setSectionOutlineText] = useState('')

  // Assembled prompts (editable)
  const [systemPrompt, setSystemPrompt] = useState('')
  const [userPrompt, setUserPrompt] = useState('')
  const [meta, setMeta] = useState<any>(null)
  // Snapshot of the brief (keywords + internal links + topic) — forwarded
  // to /generate-from-prompt so the server post-processor can enforce
  // keyword MAX + link whitelist + metadata header injection.
  const [assembledBrief, setAssembledBrief] = useState<any>(null)
  const [assembling, setAssembling] = useState(false)

  // Output (single)
  const [output, setOutput] = useState('')
  const [generating, setGenerating] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)

  // Output (bulk)
  const [bulkResults, setBulkResults] = useState<{ topic: string; output: string; status: 'pending' | 'running' | 'done' | 'error'; error?: string }[]>([])
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 })

  const previewHtml = useMemo(() => renderMarkdown(output), [output])

  const toggleIcp = (id: string) =>
    setIcpIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const bulkItems = useMemo(
    () => bulkItemsText.split('\n').map((s) => s.trim()).filter(Boolean),
    [bulkItemsText],
  )

  const sectionOutline = useMemo(
    () => sectionOutlineText.split('\n').map((s) => s.trim()).filter(Boolean),
    [sectionOutlineText],
  )

  // Parse "term:N" or "term" lines into structured main keywords.
  const mainKeywords = useMemo(() => {
    return mainKeywordsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const m = line.match(/^(.+?)\s*:\s*(\d+)\s*$/)
        if (m) return { term: m[1].trim(), minCount: Math.max(1, Number(m[2])) }
        return { term: line, minCount: 1 }
      })
  }, [mainKeywordsText])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const ext = file.name.toLowerCase()
    if (!ext.endsWith('.docx') && !ext.endsWith('.pdf') && !ext.endsWith('.txt')) {
      toast.error('Upload .docx, .pdf, or .txt')
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/content/upload', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data?.error ?? 'Upload failed'); return }
      setDocumentText(data.text ?? '')
      setDocumentName(file.name)
      toast.success(`Loaded ${file.name} (${data.chunkCount ?? 0} chunks)`)
    } finally {
      setUploading(false)
      if (e.target) e.target.value = ''
    }
  }

  const clearDocument = () => {
    setDocumentText('')
    setDocumentName('')
  }

  // Assemble for the topic at hand (in bulk mode, the first item is used for preview).
  const handleAssemble = async () => {
    const previewTopic = bulkMode ? (bulkItems[0] ?? '') : topic
    if (!previewTopic.trim()) {
      toast.error(bulkMode ? 'Add at least one item to the list' : 'Topic is required')
      return
    }
    setAssembling(true)
    try {
      const res = await fetch('/api/content/assemble-prompt', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType, topic: previewTopic, targetAudience: audience, keyMessages, language,
          icpIds, platformId: platformId || null,
          sourceUrl: features.sourceUrl ? sourceUrl : '',
          documentText: features.document ? documentText : '',
          mainKeywords: features.seo ? mainKeywords : [],
          wordCountMin: features.seo && wordCountMin !== '' ? Number(wordCountMin) : undefined,
          wordCountMax: features.seo && wordCountMax !== '' ? Number(wordCountMax) : undefined,
          secondaryAudience: features.seo ? secondaryAudience : '',
          sectionOutline: features.seo ? sectionOutline : [],
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data?.error ?? 'Could not assemble prompt'); return }
      setSystemPrompt(data.systemPrompt)
      setUserPrompt(data.userPrompt)
      setMeta(data.meta)
      setAssembledBrief(data.brief ?? null)
      toast.success(
        bulkMode
          ? `Preview assembled (1/${bulkItems.length} — "${previewTopic.slice(0, 40)}…")`
          : `Prompt assembled${data.meta?.templateName ? ` (${data.meta.templateName})` : ''}`,
      )
    } finally { setAssembling(false) }
  }

  // Stream a single LLM completion. Used by both single and bulk paths.
  // For bulk: each item gets its own assembly + generation, so the prompt
  // includes that item's topic. Returns the full assembled text.
  const streamOneGeneration = async (sys: string, usr: string, onDelta: (s: string) => void, brief?: any) => {
    const res = await fetch('/api/content/generate-from-prompt', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemPrompt: sys, userPrompt: usr, brief: brief ?? null }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data?.error ?? 'Failed to generate')
    }
    if (!res.body) throw new Error('No response body')
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let full = ''
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const t = line.trim()
        if (!t.startsWith('data:')) continue
        const payload = t.slice(5).trim()
        if (!payload || payload === '[DONE]') continue
        try {
          const data = JSON.parse(payload)
          if (data.status === 'processing' && data.delta) { full += data.delta; onDelta(full) }
          else if (data.status === 'completed') { full = data.result || full; onDelta(full) }
          else if (data.status === 'error') throw new Error(data.message)
        } catch {}
      }
    }
    return full
  }

  const handleGenerate = async () => {
    if (!userPrompt.trim()) { toast.error('Assemble the prompt first'); return }

    if (!bulkMode) {
      setGenerating(true); setOutput(''); setSavedId(null)
      try {
        await streamOneGeneration(systemPrompt, userPrompt, setOutput, assembledBrief)
      } catch (err: any) {
        toast.error(err?.message ?? 'Could not generate')
      } finally { setGenerating(false) }
      return
    }

    // Bulk: iterate over items, re-assemble per item so each prompt has
    // that item's topic baked in. We do NOT trust the user-edited prompt
    // here — bulk uses the latest template assembly per item.
    if (bulkItems.length === 0) { toast.error('Add items to the list first'); return }
    setGenerating(true)
    setBulkResults(bulkItems.map((topic) => ({ topic, output: '', status: 'pending' })))
    setBulkProgress({ current: 0, total: bulkItems.length })

    const MAX_ATTEMPTS = 3
    let okCount = 0
    let failCount = 0
    for (let i = 0; i < bulkItems.length; i++) {
      const itemTopic = bulkItems[i]
      setBulkResults((prev) => prev.map((r, idx) => idx === i ? { ...r, status: 'running', output: '', error: undefined } : r))
      setBulkProgress({ current: i + 1, total: bulkItems.length })

      let full = ''
      let lastErr: any = null
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          const r = await fetch('/api/content/assemble-prompt', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contentType, topic: itemTopic, targetAudience: audience, keyMessages, language,
              icpIds, platformId: platformId || null,
              sourceUrl: features.sourceUrl ? sourceUrl : '',
              documentText: features.document ? documentText : '',
              mainKeywords: features.seo ? mainKeywords : [],
              wordCountMin: features.seo && wordCountMin !== '' ? Number(wordCountMin) : undefined,
              wordCountMax: features.seo && wordCountMax !== '' ? Number(wordCountMax) : undefined,
              secondaryAudience: features.seo ? secondaryAudience : '',
              sectionOutline: features.seo ? sectionOutline : [],
            }),
          })
          const a = await r.json()
          if (!r.ok) throw new Error(a?.error ?? 'Assemble failed')
          full = await streamOneGeneration(a.systemPrompt, a.userPrompt, (delta) => {
            setBulkResults((prev) => prev.map((row, idx) => idx === i ? { ...row, output: delta } : row))
          }, a.brief)
          if (!full.trim()) throw new Error('LLM returned empty response')
          lastErr = null
          break
        } catch (err: any) {
          lastErr = err
          full = ''
          if (attempt < MAX_ATTEMPTS) {
            setBulkResults((prev) => prev.map((row, idx) =>
              idx === i ? { ...row, output: '', error: `Retry ${attempt}/${MAX_ATTEMPTS - 1}: ${err?.message ?? 'failed'}` } : row,
            ))
            await new Promise((resolve) => setTimeout(resolve, 1500 * attempt))
          }
        }
      }

      if (lastErr || !full.trim()) {
        failCount++
        setBulkResults((prev) => prev.map((row, idx) =>
          idx === i ? { ...row, status: 'error', output: '', error: lastErr?.message ?? 'Empty response after 3 attempts' } : row,
        ))
        toast.error(`"${itemTopic}": ${lastErr?.message ?? 'failed after retries'}`)
      } else {
        okCount++
        setBulkResults((prev) => prev.map((row, idx) => idx === i ? { ...row, output: full, status: 'done', error: undefined } : row))
      }
    }
    setGenerating(false)
    if (failCount > 0) toast.error(`${failCount} of ${bulkItems.length} pages failed — check the list`)
    else toast.success(`Generated ${okCount} pages`)
  }

  const handleSave = async () => {
    const res = await fetch('/api/content', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contentType, topic, targetAudience: audience, keyMessages, tone: '',
        generatedBrief: output, icpIds,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { toast.error(data?.error ?? 'Could not save'); return }
    setSavedId(data?.content?.id)
    toast.success('Saved')
    router.refresh()
  }

  // Save all completed bulk results as separate GeneratedContent rows.
  const handleSaveBulkAll = async () => {
    const completed = bulkResults.filter((r) => r.status === 'done' && r.output.trim())
    if (completed.length === 0) { toast.error('Nothing to save'); return }
    let ok = 0, failed = 0
    for (const row of completed) {
      const res = await fetch('/api/content', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType, topic: row.topic, targetAudience: audience, keyMessages, tone: '',
          generatedBrief: row.output, icpIds,
        }),
      })
      if (res.ok) ok++; else failed++
    }
    toast.success(`Saved ${ok}${failed ? ` (${failed} failed)` : ''} of ${completed.length}`)
    router.refresh()
  }

  return (
    <div className="space-y-6 max-w-[1100px] mx-auto">
      <div>
        <h1 className="font-display text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>

      {/* STEP 1 — Inputs */}
      <div className="bg-card border border-border shadow-sm p-6 space-y-4 rounded-lg">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="bg-secondary px-2 py-0.5 text-xs">Step 1</span>
            <h2 className="font-semibold">Configure</h2>
          </div>
          {features.bulk && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={bulkMode} onChange={(e) => setBulkMode(e.target.checked)} />
              <ListPlus className="h-3.5 w-3.5" />
              Bulk mode (one page per item)
            </label>
          )}
        </div>

        {bulkMode ? (
          <div className="space-y-1">
            <Label>
              Items list * <span className="text-muted-foreground font-normal">(one per line — each becomes the topic of one generated page)</span>
            </Label>
            <Textarea
              rows={8}
              value={bulkItemsText}
              onChange={(e) => setBulkItemsText(e.target.value)}
              placeholder={'EMI license — UK\nEMI license — Lithuania\nVASP license — Poland\nPI license — Estonia\n…'}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {bulkItems.length} item{bulkItems.length === 1 ? '' : 's'} ready
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <Label>Topic *</Label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="What is this piece about?" />
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Target audience</Label>
            <Input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Who is this for?" />
          </div>
          <div className="space-y-1">
            <Label>Language</Label>
            <select className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm h-10"
              value={language} onChange={(e) => setLanguage(e.target.value as any)}>
              <option value="en">English</option>
              <option value="uk">Ukrainian</option>
              <option value="ru">Russian</option>
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <Label>Key messages (optional)</Label>
          <Textarea rows={2} value={keyMessages} onChange={(e) => setKeyMessages(e.target.value)} />
        </div>

        {features.seo && (
          <>
            <div className="space-y-1">
              <Label>
                Secondary audience <span className="text-muted-foreground font-normal">(optional — appears only in the section relevant to it; primary audience leads every section)</span>
              </Label>
              <Input
                value={secondaryAudience}
                onChange={(e) => setSecondaryAudience(e.target.value)}
                placeholder="e.g. Sellers (when primary is Buyers)"
              />
            </div>

            <div className="space-y-1">
              <Label>
                Section outline <span className="text-muted-foreground font-normal">(optional — exact H2 headings to use, one per line; if empty, system uses standard flow)</span>
              </Label>
              <Textarea
                rows={6}
                value={sectionOutlineText}
                onChange={(e) => setSectionOutlineText(e.target.value)}
                placeholder={'What Is an EMI Licence and How Does the Industry Work?\nHow Does N5Deal Support EMI Licence Acquisition?\nBuy Your EMI Licence Step by Step\nChoose the Right Country and Licence Scope\nWhat Tools and Infrastructure Should You Plan For?\nWhat Is the Next Step?'}
                className="font-mono text-xs"
              />
              {sectionOutline.length > 0 && (
                <p className="text-xs text-muted-foreground">{sectionOutline.length} headings parsed</p>
              )}
            </div>

            <div className="space-y-1">
              <Label>
                Main SEO keywords <span className="text-muted-foreground font-normal">(one per line; append <code className="text-[11px]">:N</code> for min frequency. <strong>First line is the PRIMARY keyword</strong>, rest are secondary.)</span>
              </Label>
              <Textarea
                rows={6}
                value={mainKeywordsText}
                onChange={(e) => setMainKeywordsText(e.target.value)}
                placeholder={'fintech startup:6\nfintech startups:3\nfintech startup companies:1\nbuild fintech startup:1\nlaunch fintech company:2'}
                className="font-mono text-xs"
              />
              {mainKeywords.length > 0 && (
                <p className="text-xs text-muted-foreground">{mainKeywords.length} keyword{mainKeywords.length === 1 ? '' : 's'} parsed</p>
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Min word count</Label>
                <Input type="number" min={100} value={wordCountMin}
                  onChange={(e) => setWordCountMin(e.target.value === '' ? '' : Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label>Max word count</Label>
                <Input type="number" min={100} value={wordCountMax}
                  onChange={(e) => setWordCountMax(e.target.value === '' ? '' : Number(e.target.value))} />
              </div>
            </div>
          </>
        )}

        <div className="space-y-1">
          <Label>ICPs <span className="text-muted-foreground font-normal">(multi-select; tags auto-load as audience interests)</span></Label>
          {icps.length === 0 ? (
            <p className="text-xs text-muted-foreground">No ICPs in this project.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {icps.map((i) => {
                const sel = icpIds.includes(i.id)
                return (
                  <button key={i.id} type="button" onClick={() => toggleIcp(i.id)}
                    className={`px-3 py-1.5 text-sm border ${sel ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:bg-secondary'}`}>
                    {sel ? '✓ ' : ''}{i.name}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="space-y-1">
          <Label>Platform</Label>
          {platforms.length === 0 ? (
            <p className="text-xs text-muted-foreground">No active platforms — go to <a className="underline" href="/platforms">Platforms</a> to add some.</p>
          ) : (
            <select className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm h-10"
              value={platformId} onChange={(e) => setPlatformId(e.target.value)}>
              <option value="">— No platform (use type defaults) —</option>
              {platforms.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.formatType})</option>
              ))}
            </select>
          )}
        </div>

        {features.sourceUrl && (
          <div className="space-y-1">
            <Label>Source URL</Label>
            <Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://… (article you are rephrasing)" />
          </div>
        )}

        {features.document && (
          <div className="space-y-1">
            <Label>
              Reference document <span className="text-muted-foreground font-normal">(optional — upload a TZ / brief / source article as .docx, .pdf, or .txt; or paste text below)</span>
            </Label>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                <Upload className="h-3.5 w-3.5 mr-1" /> {uploading ? 'Uploading…' : 'Upload file'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,.pdf,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              {documentName && (
                <span className="inline-flex items-center gap-2 px-2 py-1 text-xs border border-border bg-card">
                  {documentName}
                  <button type="button" onClick={clearDocument} className="text-muted-foreground hover:text-foreground" aria-label="Remove">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>
            <Textarea
              rows={4}
              value={documentText}
              onChange={(e) => { setDocumentText(e.target.value); if (documentName) setDocumentName('') }}
              placeholder="…or paste reference text here. Auto-populated when you upload a file."
              className="mt-2"
            />
            {documentText && (
              <p className="text-xs text-muted-foreground">{documentText.length.toLocaleString()} chars loaded</p>
            )}
          </div>
        )}

        <Button onClick={handleAssemble} disabled={assembling} className="gap-2">
          <Wand2 className="h-4 w-4" />
          {assembling ? 'Assembling…' : (bulkMode ? `Assemble preview (1 of ${bulkItems.length || '?'})` : 'Assemble prompt')}
        </Button>
      </div>

      {/* STEP 2 — Review prompt */}
      {(systemPrompt || userPrompt) && (
        <div className="bg-card border border-border shadow-sm p-6 space-y-4 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="bg-secondary px-2 py-0.5 text-xs">Step 2</span>
            <h2 className="font-semibold">Review prompt</h2>
            {meta && (
              <span className="text-xs text-muted-foreground">
                Template: {meta.templateName ?? '(fallback)'} · Platform: {meta.platform?.name ?? 'none'} · KB sources: {meta.kbSources?.length ?? 0}
              </span>
            )}
          </div>
          <div className="space-y-1">
            <Label>System prompt</Label>
            <Textarea rows={4} value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} className="font-mono text-xs" />
          </div>
          <div className="space-y-1">
            <Label>User prompt</Label>
            <Textarea rows={14} value={userPrompt} onChange={(e) => setUserPrompt(e.target.value)} className="font-mono text-xs" />
          </div>
          <p className="text-xs text-muted-foreground">
            ≈ {Math.round((systemPrompt.length + userPrompt.length) / 3.5)} tokens. Edit freely before generating.
          </p>
          <Button onClick={handleGenerate} disabled={generating} className="gap-2">
            <Sparkles className="h-4 w-4" />
            {generating
              ? (bulkMode ? `Generating ${bulkProgress.current}/${bulkProgress.total}…` : 'Generating…')
              : (bulkMode ? `Generate all ${bulkItems.length} pages` : 'Generate content')}
          </Button>
          {bulkMode && (
            <p className="text-xs text-muted-foreground">
              Each item re-uses the same template; per-item topic is substituted automatically. You don't need to re-edit the prompt for every item.
            </p>
          )}
        </div>
      )}

      {/* STEP 3 — Bulk output */}
      {bulkMode && bulkResults.length > 0 && (
        <div className="bg-card border border-border shadow-sm p-6 space-y-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="bg-secondary px-2 py-0.5 text-xs">Step 3</span>
              <h2 className="font-semibold">Bulk output</h2>
              <span className="text-xs text-muted-foreground">
                {bulkResults.filter((r) => r.status === 'done').length}/{bulkResults.length} done
                {bulkResults.filter((r) => r.status === 'error').length > 0 && ` · ${bulkResults.filter((r) => r.status === 'error').length} failed`}
              </span>
            </div>
            <Button size="sm" onClick={handleSaveBulkAll} disabled={generating || bulkResults.every((r) => r.status !== 'done')}>
              Save all completed
            </Button>
          </div>
          <div className="space-y-2 max-h-[40rem] overflow-y-auto">
            {bulkResults.map((row, idx) => (
              <details key={idx} className="border border-border bg-background" open={row.status === 'running'}>
                <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer text-sm">
                  <span className={`text-[10px] px-1.5 py-0.5 ${
                    row.status === 'done' ? 'bg-primary text-primary-foreground' :
                    row.status === 'error' ? 'bg-destructive text-destructive-foreground' :
                    row.status === 'running' ? 'bg-secondary' :
                    'bg-muted text-muted-foreground'
                  }`}>{row.status}</span>
                  <span className="font-medium truncate flex-1">{idx + 1}. {row.topic}</span>
                  {row.output && <span className="text-xs text-muted-foreground">{row.output.length.toLocaleString()} chars</span>}
                </summary>
                {row.status === 'error' ? (
                  <div className="p-3 text-xs text-destructive">{row.error}</div>
                ) : row.output ? (
                  <article className="markdown-output px-4 py-3 text-sm border-t border-border"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(row.output) }} />
                ) : (
                  <div className="p-3 text-xs text-muted-foreground">Waiting…</div>
                )}
              </details>
            ))}
          </div>
        </div>
      )}

      {/* STEP 3 — Single output */}
      {!bulkMode && output && (
        <div className="bg-card border border-border shadow-sm p-6 space-y-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="bg-secondary px-2 py-0.5 text-xs">Step 3</span>
              <h2 className="font-semibold">Output</h2>
            </div>
            <div className="flex items-center gap-2">
              {!savedId && <Button size="sm" onClick={handleSave}>Save</Button>}
              <Button size="sm" variant="ghost" onClick={async () => {
                try { await copyMarkdownAsRich(output); toast.success('Copied') } catch { toast.error('Copy failed') }
              }}>
                <Copy className="h-4 w-4 mr-1" /> Copy
              </Button>
            </div>
          </div>
          <article className="markdown-output rounded border border-border bg-background p-5 max-h-[40rem] overflow-y-auto"
            dangerouslySetInnerHTML={{ __html: previewHtml }} />
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">Show raw Markdown</summary>
            <Textarea readOnly value={output} className="mt-2 h-48 text-xs font-mono" />
          </details>
        </div>
      )}
    </div>
  )
}
