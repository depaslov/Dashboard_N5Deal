'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
  // Per-brief internal links — markdown or arrow / pipe format.
  // When non-empty, overrides the project library entirely.
  const [internalLinksText, setInternalLinksText] = useState('')
  // LSI / supporting keywords (use ≥1× each, can be inflected).
  const [lsiKeywordsText, setLsiKeywordsText] = useState('')

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
  // Always-visible stream telemetry so failures don't end up as a blank screen.
  const [streamStats, setStreamStats] = useState<{
    chunks: number
    rawChars: number
    finalChars: number
    sawCompleted: boolean
    state: 'idle' | 'streaming' | 'done' | 'error' | 'empty'
    error?: string
    postFixes?: string[]
  }>({ chunks: 0, rawChars: 0, finalChars: 0, sawCompleted: false, state: 'idle' })

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

  // Parse section outline supporting both flat headings AND headings with
  // bulleted subtopics. Lines without a bullet prefix are H2 headings; lines
  // starting with - / * / • / "N." become subtopics of the most recent heading.
  // Optional "## " prefix on heading lines is stripped.
  const sectionStructure = useMemo(() => {
    const out: { heading: string; subtopics: string[] }[] = []
    for (const raw of sectionOutlineText.split('\n')) {
      const line = raw.trim()
      if (!line || line.startsWith('#')) {
        // Allow "## heading" — treat as heading, strip prefix
        if (line.startsWith('##')) {
          const h = line.replace(/^##?\s*/, '').trim()
          if (h) out.push({ heading: h, subtopics: [] })
        }
        continue
      }
      const subMatch = line.match(/^(?:[-*•]|\d+\.)\s+(.+)$/)
      if (subMatch) {
        const sub = subMatch[1].trim()
        if (out.length === 0) out.push({ heading: sub, subtopics: [] })
        else out[out.length - 1].subtopics.push(sub)
      } else {
        out.push({ heading: line, subtopics: [] })
      }
    }
    return out
  }, [sectionOutlineText])

  // Legacy flat list (just heading strings) — kept for template-rendering path.
  const sectionOutline = useMemo(
    () => sectionStructure.map((s) => s.heading),
    [sectionStructure],
  )

  // LSI keywords — one per line, no count needed (target is ≥1× each).
  const lsiKeywords = useMemo(
    () => lsiKeywordsText.split('\n').map((s) => s.trim()).filter(Boolean),
    [lsiKeywordsText],
  )

  // Parse keyword lines. Supports:
  //   "term"            → minCount=1
  //   "term:N"          → minCount=N
  //   "term:MIN-MAX"    → minCount=MIN, maxCount=MAX  (hard upper limit, used by post-processor)
  // Dash variations accepted: -, –, —
  const mainKeywords = useMemo(() => {
    return mainKeywordsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const range = line.match(/^(.+?)\s*:\s*(\d+)\s*[-–—]\s*(\d+)\s*$/)
        if (range) {
          const min = Math.max(1, Number(range[2]))
          const max = Math.max(min, Number(range[3]))
          return { term: range[1].trim(), minCount: min, maxCount: max }
        }
        const m = line.match(/^(.+?)\s*:\s*(\d+)\s*$/)
        if (m) return { term: m[1].trim(), minCount: Math.max(1, Number(m[2])) }
        return { term: line, minCount: 1 }
      })
  }, [mainKeywordsText])

  // Extract internal links from an uploaded TZ document.
  //
  // Supports the canonical Ukrainian TZ format the team uses:
  //   1. Fintech License
  //   URL: https://n5deal.com/incorporation-license/fintech
  //   Анкор: fintech license
  //
  // Plus English / Russian variants ("Anchor:" / "Якорь:") and raw
  // markdown links `[anchor](url)` that may appear in pasted TZs.
  //
  // Pairs are formed by scanning line-by-line, tracking the most recent
  // URL: and Anchor: lines, and flushing them when a numbered list item
  // (or bullet) signals a new block.
  const extractedTzLinks = useMemo(() => {
    if (!documentText.trim()) return []
    const out: { url: string; anchor: string; priority: 'must' | 'nice' }[] = []
    const seen = new Set<string>()

    // Pass 1 — line-scan for "URL: …" + "Анкор: …" pairs
    const lines = documentText.split('\n').map((l) => l.trim())
    let pendingUrl = ''
    let pendingAnchor = ''
    const flush = () => {
      const url = pendingUrl.replace(/[.,;]+$/, '').trim()
      const anchor = pendingAnchor.trim()
      pendingUrl = ''; pendingAnchor = ''
      if (!url || !anchor || seen.has(url)) return
      seen.add(url)
      out.push({ url, anchor, priority: 'must' })
    }
    for (const line of lines) {
      // Numbered / bulleted boundary — flush whatever we collected so far
      if (/^\d+\.\s/.test(line) || /^[-*•]\s/.test(line)) {
        if (pendingUrl && pendingAnchor) flush()
      }
      const urlM = line.match(/(?:URL|Url|url|Посилання|Ссылка)\s*[:：]\s*(https?:\/\/[^\s]+)/i)
      if (urlM) {
        if (pendingUrl && pendingAnchor) flush()
        pendingUrl = urlM[1]
        continue
      }
      const anchorM = line.match(/(?:Анкор|Anchor|Якорь|Анкор-текст|Anchor text)\s*[:：]\s*(.+)/i)
      if (anchorM) {
        if (pendingUrl && pendingAnchor) flush()
        pendingAnchor = anchorM[1]
        continue
      }
    }
    if (pendingUrl && pendingAnchor) flush()

    // Pass 2 — also catch raw markdown links scattered in the TZ
    const mdRe = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g
    let m: RegExpExecArray | null
    while ((m = mdRe.exec(documentText)) !== null) {
      const url = m[2].trim()
      const anchor = m[1].trim()
      if (!url || !anchor || seen.has(url)) continue
      seen.add(url)
      out.push({ url, anchor, priority: 'must' })
    }

    return out
  }, [documentText])

  // Auto-fill the per-brief internal links textarea from the TZ when a TZ
  // is uploaded AND the user hasn't started typing their own links there.
  // Won't overwrite manual edits — checks for emptiness first.
  useEffect(() => {
    if (extractedTzLinks.length === 0) return
    if (internalLinksText.trim().length > 0) return
    const formatted = extractedTzLinks
      .map((l) => `[${l.anchor}](${l.url}) — must`)
      .join('\n')
    setInternalLinksText(formatted)
    toast.success(`Imported ${extractedTzLinks.length} link${extractedTzLinks.length === 1 ? '' : 's'} from the TZ`)
    // We deliberately only watch extractedTzLinks; running again when
    // internalLinksText changes would create a loop or block legitimate
    // user edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extractedTzLinks])

  // Parse per-brief internal links from a paste-friendly textarea.
  // Supported formats (one link per line, mix-and-match):
  //   [anchor](url) — must         markdown style with trailing priority
  //   [anchor](url) - must         dash works too
  //   [anchor](url)                priority defaults to nice
  //   anchor -> url must           arrow style
  //   anchor | url | must          pipe style
  // Priority keywords (case-insensitive): "must" | "nice". Anything else is ignored.
  const briefInternalLinks = useMemo(() => {
    const out: { url: string; anchor: string; priority: 'must' | 'nice' }[] = []
    for (const raw of internalLinksText.split('\n')) {
      const line = raw.trim()
      if (!line || line.startsWith('#')) continue
      let anchor = '', url = '', priority: 'must' | 'nice' = 'nice'

      // markdown: [anchor](url) optionally followed by — must / - must / : must
      const md = line.match(/^\[([^\]]+)\]\(([^)]+)\)\s*(?:[—\-:]\s*(must|nice))?\s*$/i)
      if (md) {
        anchor = md[1].trim(); url = md[2].trim(); priority = (md[3]?.toLowerCase() === 'must' ? 'must' : 'nice')
        if (anchor && url) out.push({ anchor, url, priority })
        continue
      }
      // arrow: anchor -> url [must]
      const arrow = line.match(/^(.+?)\s*->\s*(\S+?)\s*(must|nice)?\s*$/i)
      if (arrow) {
        anchor = arrow[1].trim(); url = arrow[2].trim(); priority = (arrow[3]?.toLowerCase() === 'must' ? 'must' : 'nice')
        if (anchor && url) out.push({ anchor, url, priority })
        continue
      }
      // pipe: anchor | url [| must]
      const pipe = line.split('|').map((p) => p.trim())
      if (pipe.length >= 2 && pipe[1]) {
        anchor = pipe[0]; url = pipe[1]; priority = (pipe[2]?.toLowerCase() === 'must' ? 'must' : 'nice')
        if (anchor && url) out.push({ anchor, url, priority })
        continue
      }
    }
    return out
  }, [internalLinksText])

  // The links actually sent to the generator. Manual textarea wins; if it's
  // empty we fall back to whatever was auto-extracted from the uploaded TZ.
  // This removes the earlier fragility where, if the auto-fill effect didn't
  // populate the textarea, the system silently fell back to the project library.
  const effectiveLinks = useMemo(
    () => (briefInternalLinks.length > 0 ? briefInternalLinks : extractedTzLinks),
    [briefInternalLinks, extractedTzLinks],
  )

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
          lsiKeywords: features.seo ? lsiKeywords : [],
          wordCountMin: features.seo && wordCountMin !== '' ? Number(wordCountMin) : undefined,
          wordCountMax: features.seo && wordCountMax !== '' ? Number(wordCountMax) : undefined,
          secondaryAudience: features.seo ? secondaryAudience : '',
          sectionOutline: features.seo ? sectionOutline : [],
          sectionStructure: features.seo ? sectionStructure : [],
          internalLinks: effectiveLinks.length > 0 ? effectiveLinks : undefined,
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
    setStreamStats({ chunks: 0, rawChars: 0, finalChars: 0, sawCompleted: false, state: 'streaming' })
    const res = await fetch('/api/content/generate-from-prompt', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemPrompt: sys, userPrompt: usr, brief: brief ?? null }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      const msg = data?.error ?? 'Failed to generate'
      setStreamStats((s) => ({ ...s, state: 'error', error: msg }))
      throw new Error(msg)
    }
    if (!res.body) {
      setStreamStats((s) => ({ ...s, state: 'error', error: 'No response body' }))
      throw new Error('No response body')
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let full = ''
    let buffer = ''
    let processingCount = 0
    let sawCompleted = false
    let postFixes: string[] | undefined = undefined
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
          if (data.status === 'processing' && data.delta) {
            full += data.delta
            processingCount++
            onDelta(full)
            // Update telemetry every 5 chunks so render doesn't thrash
            if (processingCount % 5 === 0) {
              setStreamStats((s) => ({ ...s, chunks: processingCount, rawChars: full.length }))
            }
          } else if (data.status === 'completed') {
            sawCompleted = true
            const finalText = (typeof data.result === 'string' && data.result.length > 0) ? data.result : full
            full = finalText
            onDelta(finalText)
            postFixes = data.postFixes
            console.log(`[studio] completed event — result: ${data.result?.length ?? 0} chars, accumulated stream: ${processingCount} chunks. Final: ${finalText.length} chars.`)
            if (data.postFixes?.length) console.log('[studio] postprocess fixes:', data.postFixes)
          } else if (data.status === 'error') {
            const msg = data.message ?? 'Upstream error'
            setStreamStats((s) => ({ ...s, state: 'error', error: msg, chunks: processingCount, rawChars: full.length }))
            throw new Error(msg)
          }
        } catch (e) {
          if (e instanceof Error && e.message && !e.message.startsWith('Unexpected')) {
            throw e
          }
          console.warn('[studio] SSE parse error on payload:', payload.slice(0, 120))
        }
      }
    }
    console.log(`[studio] stream done — sawCompleted: ${sawCompleted}, processingChunks: ${processingCount}, finalLength: ${full.length}`)
    setStreamStats({
      chunks: processingCount,
      rawChars: processingCount > 0 ? full.length : 0,
      finalChars: full.length,
      sawCompleted,
      state: full.length === 0 ? 'empty' : 'done',
      postFixes,
    })
    return full
  }

  const handleGenerate = async () => {
    if (!userPrompt.trim()) { toast.error('Assemble the prompt first'); return }

    if (!bulkMode) {
      setGenerating(true); setOutput(''); setSavedId(null)
      try {
        const final = await streamOneGeneration(systemPrompt, userPrompt, setOutput, assembledBrief)
        // Defensive: if the stream finished but state never updated (race
        // with React batching, or some chunk got swallowed), force the
        // final text into the output state so the user can see it.
        if (final && final.length > 0) {
          setOutput(final)
        } else {
          toast.error('Generation finished but no text was returned. Check browser console + Network tab.')
        }
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
              sectionStructure: features.seo ? sectionStructure : [],
              internalLinks: effectiveLinks.length > 0 ? effectiveLinks : undefined,
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
                Section outline <span className="text-muted-foreground font-normal">
                  (H2 headings with optional H3 subtopics. Heading on its own line, subtopics on indented bullets <code className="text-[11px]">- subtopic</code>.
                  Empty = system uses its standard flow.)
                </span>
              </Label>
              <Textarea
                rows={10}
                value={sectionOutlineText}
                onChange={(e) => setSectionOutlineText(e.target.value)}
                placeholder={'Launch Your Fintech Business With a CFA License\n- What Is a CFA License and Who Needs It\n- Financial Activities Allowed Under a CFA License\n- How CFA Licensing Supports Investment Companies\nWhy a CFA License Is Essential for Modern Financial Companies\n- Key Benefits of Obtaining a CFA License\n- How a CFA License Builds Trust and Regulatory Compliance\n- Why Investment Firms Choose Licensed Structures'}
                className="font-mono text-xs"
              />
              {sectionStructure.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {sectionStructure.length} H2 heading{sectionStructure.length === 1 ? '' : 's'} parsed
                  {sectionStructure.some((s) => s.subtopics.length > 0) ? (
                    <> · {sectionStructure.reduce((n, s) => n + s.subtopics.length, 0)} subtopic{sectionStructure.reduce((n, s) => n + s.subtopics.length, 0) === 1 ? '' : 's'}</>
                  ) : null}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label>
                Main SEO keywords <span className="text-muted-foreground font-normal">
                  (one per line. <strong>First line is PRIMARY</strong>, rest are secondary. Formats:
                  <code className="text-[11px]"> term:N</code> = min N×;
                  <code className="text-[11px]"> term:MIN-MAX</code> = exact range (post-processor caps at MAX);
                  <code className="text-[11px]"> term</code> alone = min 1×.)
                </span>
              </Label>
              <Textarea
                rows={6}
                value={mainKeywordsText}
                onChange={(e) => setMainKeywordsText(e.target.value)}
                placeholder={'CFA license:5-6\nfinancial services license:2-3\ninvestment business license:1-2\nfintech licensing solutions:1-2\nregulated financial company:1-2\nfinancial compliance requirements:1\nAML and KYC procedures:1'}
                className="font-mono text-xs"
              />
              {mainKeywords.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {mainKeywords.length} keyword{mainKeywords.length === 1 ? '' : 's'} parsed
                  {mainKeywords.some((k: any) => k.maxCount) ? (
                    <> · {mainKeywords.filter((k: any) => k.maxCount).length} with explicit MIN-MAX range</>
                  ) : null}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label>
                LSI / supporting keywords <span className="text-muted-foreground font-normal">
                  (one per line. Target: ≥60% of these appear ≥1× in the page; inflection allowed.)
                </span>
              </Label>
              <Textarea
                rows={6}
                value={lsiKeywordsText}
                onChange={(e) => setLsiKeywordsText(e.target.value)}
                placeholder={'incorporation license\ninvestment management license\ncapital markets regulation\nlicensed financial institution\ncross-border financial services\nfintech regulatory compliance\nfinancial services provider\nfinancial business incorporation'}
                className="font-mono text-xs"
              />
              {lsiKeywords.length > 0 && (
                <p className="text-xs text-muted-foreground">{lsiKeywords.length} LSI keyword{lsiKeywords.length === 1 ? '' : 's'} parsed</p>
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

            <div className="space-y-1">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <Label>
                  Internal links from this brief <span className="text-muted-foreground font-normal">
                    (one per line — if filled, these ANCHORS are used verbatim and the project library is ignored.
                    Format: <code className="text-[11px]">[anchor](url) — must</code> or <code className="text-[11px]">anchor → url must</code>)
                  </span>
                </Label>
                {extractedTzLinks.length > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      const formatted = extractedTzLinks
                        .map((l) => `[${l.anchor}](${l.url}) — must`)
                        .join('\n')
                      setInternalLinksText(formatted)
                      toast.success(`Replaced with ${extractedTzLinks.length} link${extractedTzLinks.length === 1 ? '' : 's'} from the TZ`)
                    }}
                  >
                    Re-import from TZ ({extractedTzLinks.length})
                  </Button>
                ) : null}
              </div>
              <Textarea
                rows={5}
                value={internalLinksText}
                onChange={(e) => setInternalLinksText(e.target.value)}
                placeholder={'[buy a licensed business](https://n5deal.com/buyer) — must\n[licensed business marketplace](https://n5deal.com/all-listing) — must\n[frequently asked questions](https://n5deal.com/faq) — must'}
                className="font-mono text-xs"
              />
              {briefInternalLinks.length > 0 ? (
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  {briefInternalLinks.length} link{briefInternalLinks.length === 1 ? '' : 's'} parsed —
                  project library will be IGNORED, only these anchors will be sent to the LLM and accepted by the post-processor.
                </p>
              ) : extractedTzLinks.length > 0 ? (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  TZ contains {extractedTzLinks.length} link{extractedTzLinks.length === 1 ? '' : 's'} but they haven't been imported here yet. Click "Re-import from TZ" above to load them, or paste manually.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Empty = system uses the active links from the project library. Upload a TZ in the next step — links with <code className="text-[11px]">URL: …</code> + <code className="text-[11px]">Анкор: …</code> blocks are auto-imported here.
                </p>
              )}
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

      {/* STEP 3 — Stream telemetry (always visible during/after a single generation) */}
      {!bulkMode && streamStats.state !== 'idle' && (
        <div className={`rounded-lg border p-4 text-sm ${
          streamStats.state === 'error' || streamStats.state === 'empty'
            ? 'border-destructive/50 bg-destructive/5'
            : streamStats.state === 'streaming'
              ? 'border-primary/30 bg-primary/5'
              : 'border-emerald-500/30 bg-emerald-500/5'
        }`}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="font-medium">
              {streamStats.state === 'streaming' && <>⏳ Streaming… {streamStats.chunks} chunks · {streamStats.rawChars.toLocaleString()} chars so far</>}
              {streamStats.state === 'done' && <>✓ Done — {streamStats.finalChars.toLocaleString()} chars, {streamStats.chunks} chunks streamed</>}
              {streamStats.state === 'empty' && <>⚠️ Stream finished but no text — see diagnostics below</>}
              {streamStats.state === 'error' && <>✗ Error: {streamStats.error}</>}
            </div>
          </div>
          {(streamStats.state === 'empty' || streamStats.state === 'error') && (
            <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
              <div>• Stream chunks received: <strong>{streamStats.chunks}</strong></div>
              <div>• Raw text accumulated: <strong>{streamStats.rawChars.toLocaleString()}</strong> chars</div>
              <div>• Server "completed" event seen: <strong>{streamStats.sawCompleted ? 'yes' : 'no'}</strong></div>
              <div className="pt-1">
                {streamStats.chunks === 0
                  ? <>The upstream LLM returned 0 content chunks. Most common causes: rate limit, safety filter, wrong API key, or the model spent its budget on reasoning. Check the dev-server terminal for <code className="text-[11px]">[generate-from-prompt]</code> log lines.</>
                  : <>Stream produced text but the final result was empty after post-processing. Check the dev-server terminal for the <code className="text-[11px]">[generate-from-prompt] post-processed length</code> log line.</>
                }
              </div>
            </div>
          )}
          {streamStats.postFixes && streamStats.postFixes.length > 0 && (
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer">Show {streamStats.postFixes.length} post-processor fix{streamStats.postFixes.length === 1 ? '' : 'es'}</summary>
              <ul className="mt-1.5 ml-4 list-disc space-y-0.5">
                {streamStats.postFixes.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </details>
          )}
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
