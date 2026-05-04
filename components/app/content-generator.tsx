'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Upload, X, Sparkles, Copy } from 'lucide-react'
import { renderMarkdown, copyMarkdownAsRich } from '@/lib/markdown'

interface IcpOption {
  id: string
  name: string
}

interface TagItem {
  id: string
  name: string
  color: string | null
}

interface Props {
  defaultType?: string
  icps?: IcpOption[]
  projectRedFlags?: any[]
  projectInternalLinks?: any[]
}

export function ContentGenerator({ defaultType, icps = [] }: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [uploadedDocumentName, setUploadedDocumentName] = useState('')
  const [uploadedDocumentText, setUploadedDocumentText] = useState('')
  const [uploadingDocument, setUploadingDocument] = useState(false)

  const [topic, setTopic] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [selectedIcpIds, setSelectedIcpIds] = useState<string[]>([])
  const [icpTags, setIcpTags] = useState<TagItem[]>([])
  const [loadingTags, setLoadingTags] = useState(false)
  const [output, setOutput] = useState('')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const contentType = (defaultType ?? 'article') as string

  // Reload tags whenever the selection changes. We refetch all selected ICPs
  // and dedupe by tag id, so toggling a single ICP keeps the union correct
  // without holding stale per-ICP caches.
  const refreshTagsForSelection = async (icpIdSet: string[]) => {
    if (icpIdSet.length === 0) {
      setIcpTags([])
      return
    }
    setLoadingTags(true)
    try {
      const responses = await Promise.all(
        icpIdSet.map((id) =>
          fetch(`/api/icps/${id}/tags`)
            .then((r) => (r.ok ? r.json() : { tags: [] }))
            .catch(() => ({ tags: [] })),
        ),
      )
      const dedup = new Map<string, TagItem>()
      for (const r of responses) {
        for (const t of r.tags ?? []) dedup.set(t.id, t)
      }
      setIcpTags(Array.from(dedup.values()).sort((a, b) => a.name.localeCompare(b.name)))
    } finally {
      setLoadingTags(false)
    }
  }

  const toggleIcp = (icpId: string) => {
    setSelectedIcpIds((prev) => {
      const next = prev.includes(icpId) ? prev.filter((id) => id !== icpId) : [...prev, icpId]
      refreshTagsForSelection(next)
      return next
    })
  }

  const removeTag = (tagId: string) => {
    setIcpTags((prev) => prev.filter((t) => t.id !== tagId))
  }

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.includes('text') && !file.name.endsWith('.docx')) {
      toast.error('Please upload a TXT or DOCX file')
      return
    }

    setUploadingDocument(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/content/upload', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? 'Failed to upload document')
      }

      const data = await res.json()
      setUploadedDocumentName(data.fileName)
      setUploadedDocumentText(data.text ?? '')
      toast.success(`Document uploaded: ${data.fileName}`)
    } catch (err) {
      console.error('Document upload error:', err)
      toast.error('Could not upload document')
    } finally {
      setUploadingDocument(false)
      if (e.target) e.target.value = ''
    }
  }

  const persistContent = async (generatedBrief: string): Promise<string | null> => {
    setSaving(true)
    try {
      const res = await fetch('/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType,
          topic,
          targetAudience,
          keyMessages: '',
          tone: '',
          generatedBrief,
          icpIds: selectedIcpIds,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error ?? 'Could not save brief')
      }
      const id = data?.content?.id as string | undefined
      return id ?? null
    } finally {
      setSaving(false)
    }
  }

  const handleGenerate = async () => {
    if (!topic.trim() || !targetAudience.trim()) {
      toast.error('Topic and target audience are required')
      return
    }

    if (!uploadedDocumentText) {
      toast.error('Please upload a document first')
      return
    }

    setGenerating(true)
    setOutput('')
    setSavedId(null)
    let cached = false

    try {
      const res = await fetch('/api/content/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType,
          topic,
          targetAudience,
          keyMessages: '',
          icpIds: selectedIcpIds,
          documentText: uploadedDocumentText,
          documentName: uploadedDocumentName,
          // Force English output and Markdown structure for the simple form.
          brief: {
            language: 'en',
            useH2: true,
            useH3: true,
            useLists: true,
            icpIds: selectedIcpIds,
            lsiKeywords: icpTags.map((t) => t.name),
          },
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? 'Failed to generate content')
      }

      if (!res.body) {
        throw new Error('No response body')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const payload = trimmed.slice(5).trim()
          if (!payload || payload === '[DONE]') continue
          try {
            const data = JSON.parse(payload)
            if (data.status === 'cached') {
              cached = true
            } else if (data.status === 'processing' && data.delta) {
              fullText += data.delta
              setOutput(fullText)
            } else if (data.status === 'completed') {
              fullText = data.result || fullText
              setOutput(fullText)
            } else if (data.status === 'error') {
              throw new Error(data.message || 'Generation failed upstream')
            }
          } catch {}
        }
      }

      if (!fullText.trim()) {
        throw new Error('Empty response from generator')
      }

      const id = await persistContent(fullText)
      if (id) {
        setSavedId(id)
        toast.success(cached ? 'Reused a near-identical brief' : 'Content generated and saved')
        router.push(`/content/${id}`)
        router.refresh()
      } else {
        toast.success('Content generated (could not save automatically)')
      }
    } catch (err: any) {
      console.error('Generation error:', err)
      toast.error(err?.message ?? 'Could not generate content')
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = async () => {
    try {
      await copyMarkdownAsRich(output)
      toast.success('Copied (rich text + markdown)')
    } catch {
      toast.error('Could not copy')
    }
  }

  const previewHtml = useMemo(() => renderMarkdown(output), [output])

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Upload section */}
      <div className="bg-card border border-border shadow-sm p-8 space-y-4 rounded-lg">
        <div className="flex items-center gap-3">
          <Upload className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">1. Upload document</h2>
        </div>

        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingDocument}
          >
            {uploadingDocument ? 'Uploading…' : 'Choose file'}
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.docx"
            onChange={handleDocumentUpload}
            className="hidden"
          />

          {uploadedDocumentName && (
            <div className="rounded-lg border border-border bg-muted p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{uploadedDocumentName}</span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setUploadedDocumentName('')
                    setUploadedDocumentText('')
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Generation parameters */}
      <div className="bg-card border border-border shadow-sm p-8 space-y-4 rounded-lg">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">2. Generate content</h2>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="topic" className="text-sm font-medium">
              Topic *
            </Label>
            <Input
              id="topic"
              placeholder="What should the new content be about?"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={generating}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="audience" className="text-sm font-medium">
              Target audience *
            </Label>
            <Input
              id="audience"
              placeholder="Who is this content for?"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              disabled={generating}
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-sm font-medium">
              ICPs <span className="text-muted-foreground font-normal">(optional — multi-select; tags from all selected ICPs auto-load as keywords)</span>
            </Label>
            {icps.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">No ICPs in this project yet.</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {icps.map((i) => {
                  const selected = selectedIcpIds.includes(i.id)
                  return (
                    <button
                      key={i.id}
                      type="button"
                      onClick={() => toggleIcp(i.id)}
                      disabled={generating}
                      className={`px-3 py-1.5 text-sm border transition-colors disabled:opacity-50 ${
                        selected
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card border-border hover:bg-secondary'
                      }`}
                      aria-pressed={selected}
                    >
                      {selected ? '✓ ' : ''}{i.name}
                    </button>
                  )
                })}
              </div>
            )}

            {selectedIcpIds.length > 0 && (
              <div className="mt-3 min-h-[1.75rem]">
                {loadingTags ? (
                  <p className="text-xs text-muted-foreground">Loading tags…</p>
                ) : icpTags.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No tags assigned to {selectedIcpIds.length === 1 ? 'this ICP' : 'these ICPs'}.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {icpTags.map((t) => (
                      <span
                        key={t.id}
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs border bg-card"
                        style={t.color ? { borderColor: t.color } : undefined}
                      >
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: t.color ?? '#94a3b8' }}
                        />
                        {t.name}
                        <button
                          type="button"
                          onClick={() => removeTag(t.id)}
                          disabled={generating}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                          aria-label={`Remove ${t.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <Button
            onClick={handleGenerate}
            disabled={generating || !uploadedDocumentText}
            className="w-full"
            size="lg"
          >
            {generating ? 'Generating…' : 'Generate'}
          </Button>
        </div>
      </div>

      {/* Output section */}
      {output && (
        <div className="bg-card border border-border shadow-sm p-8 space-y-4 rounded-lg">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Generated content</h2>
            <div className="flex items-center gap-2">
              {!savedId ? (
                <Button
                  variant="default"
                  size="sm"
                  onClick={async () => {
                    try {
                      const id = await persistContent(output)
                      if (id) {
                        setSavedId(id)
                        toast.success('Saved')
                        router.push(`/content/${id}`)
                        router.refresh()
                      }
                    } catch (e: any) {
                      toast.error(e?.message ?? 'Could not save')
                    }
                  }}
                  loading={saving}
                >
                  Save
                </Button>
              ) : null}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="gap-1"
              >
                <Copy className="h-4 w-4" />
                Copy
              </Button>
            </div>
          </div>
          <article
            className="markdown-output rounded border border-border bg-background p-5 max-h-[32rem] overflow-y-auto"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none">Show raw Markdown</summary>
            <Textarea value={output} readOnly className="mt-2 h-64 text-xs font-mono" />
          </details>
        </div>
      )}
    </div>
  )
}
