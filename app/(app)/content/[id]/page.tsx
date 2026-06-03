import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertProjectAccess } from '@/lib/project'
import { PageHeader } from '@/components/app/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, FileText, BookOpen, Linkedin, Send, Clock, Globe, Target, ShieldAlert, Link2, Star, ExternalLink } from 'lucide-react'
import { ContentActions } from './content-actions'
import { ContentEditor } from './content-editor'
import { AnnotationsProvider, AnnotationsList } from './content-annotations'
import { format } from 'date-fns'
import type { BriefData } from '@/lib/content-brief'

export const dynamic = 'force-dynamic'

const TYPES: Record<string, { label: string; icon: any }> = {
  article: { label: 'Article', icon: FileText },
  catalog: { label: 'Catalog', icon: BookOpen },
  linkedin: { label: 'LinkedIn Post', icon: Linkedin },
  telegram: { label: 'Telegram Post', icon: Send },
}

export default async function ContentDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string
  const content = await prisma.generatedContent.findUnique({
    where: { id: params.id },
    include: {
      createdBy: true,
      annotations: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!content) notFound()
  const canAccess = await assertProjectAccess(userId, content.projectId)
  if (!canAccess) notFound()

  const meta = TYPES[content.contentType] ?? TYPES.article
  const Icon = meta.icon
  const brief = (content.briefData as unknown) as BriefData | null

  const initialAnnotations = content.annotations.map((a: any) => ({
    id: a.id,
    selectedText: a.selectedText,
    note: a.note,
    contextBefore: a.contextBefore,
    contextAfter: a.contextAfter,
    resolved: a.resolved,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  }))

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/content" className="gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Content Studio
          </Link>
        </Button>
      </div>

      <PageHeader
        title={content.topic}
        description={`${meta.label} for ${content.targetAudience}`}
        actions={<ContentActions id={content.id} brief={content.generatedBrief} topic={content.topic} />}
      />

      <AnnotationsProvider contentId={content.id} initialAnnotations={initialAnnotations}>
      <div className="grid gap-6 md:grid-cols-3 xl:grid-cols-12">
        <aside className="md:col-span-1 xl:col-span-3 space-y-4">
          <div className="bg-card border border-border shadow-sm p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center bg-primary text-primary-foreground">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                  Format
                </p>
                <p className="text-sm font-semibold">{meta.label}</p>
              </div>
            </div>
            <div className="mt-5 space-y-3 text-sm">
              <Meta label="Target audience" value={content.targetAudience} />
              <Meta label="Tone" value={content.tone} />
              <Meta label="Key messages" value={content.keyMessages} />
              {brief?.pageUrl ? <Meta label="Page URL" value={brief.pageUrl} icon={<Globe className="h-3 w-3" />} /> : null}
              {brief?.goal ? <Meta label="Goal" value={brief.goal} icon={<Target className="h-3 w-3" />} /> : null}
              {brief?.language ? <Meta label="Language" value={brief.language.toUpperCase()} /> : null}
              {brief?.wordCountMin || brief?.wordCountMax ? (
                <Meta
                  label="Word count"
                  value={`${brief.wordCountMin ?? '—'} – ${brief.wordCountMax ?? '—'}`}
                />
              ) : null}
              <Meta label="Created by" value={content?.createdBy?.name ?? '—'} />
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                  Created at
                </p>
                <p className="mt-0.5 text-sm inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(new Date(content.createdAt), 'MMM d, yyyy • HH:mm')}
                </p>
              </div>
            </div>
          </div>

          {brief?.mainKeywords && brief.mainKeywords.length > 0 ? (
            <div className="bg-card border border-border shadow-sm p-5">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                Main keywords
              </p>
              <div className="mt-2 space-y-1">
                {brief.mainKeywords.map((k) => (
                  <div key={k.term} className="flex items-center justify-between text-xs">
                    <span className="font-mono">{k.term}</span>
                    <Badge variant="secondary" className="text-[10px]">≥ {k.minCount}</Badge>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {brief?.lsiKeywords && brief.lsiKeywords.length > 0 ? (
            <div className="bg-card border border-border shadow-sm p-5">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                LSI keywords
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {brief.lsiKeywords.map((k) => (
                  <Badge key={k} variant="outline" className="text-[10px] normal-case">
                    {k}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}

          {brief?.internalLinks && brief.internalLinks.length > 0 ? (
            <div className="bg-card border border-border shadow-sm p-5">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold flex items-center gap-1">
                <Link2 className="h-3 w-3" /> Internal links ({brief.internalLinks.length})
              </p>
              <div className="mt-3 space-y-3">
                {brief.internalLinks.map((link, idx) => {
                  const regex = new RegExp(`\\]\\(${link.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`, 'g')
                  const occurrences = (content.generatedBrief.match(regex) || []).length
                  const used = occurrences > 0
                  return (
                    <div key={idx} className="border-l-2 pl-3" style={{ borderColor: used ? 'hsl(var(--primary))' : 'hsl(var(--muted))' }}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold truncate">{link.anchor}</p>
                        {link.priority === 'must' ? (
                          <Badge variant="default" className="text-[9px] gap-0.5">
                            <Star className="h-2.5 w-2.5" /> MUST
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px]">nice</Badge>
                        )}
                      </div>
                      <a href={link.url} target="_blank" rel="noopener noreferrer" className="mt-1 text-[10px] text-muted-foreground hover:text-primary inline-flex items-center gap-1 font-mono break-all">
                        {link.url}
                        <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                      </a>
                      {link.context ? (
                        <p className="mt-1 text-[10px] text-muted-foreground italic line-clamp-2">{link.context}</p>
                      ) : null}
                      <p className="mt-1.5 text-[10px] font-semibold">
                        {used ? (
                          <span className="text-primary">✓ Used {occurrences}×</span>
                        ) : (
                          <span className={link.priority === 'must' ? 'text-destructive' : 'text-muted-foreground'}>
                            {link.priority === 'must' ? '⚠ Not inserted' : '○ Not inserted'}
                          </span>
                        )}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}

          {brief?.redFlags && brief.redFlags.length > 0 ? (
            <div className="bg-card border border-border shadow-sm p-5">
              <p className="text-[10px] uppercase tracking-widest text-destructive font-semibold flex items-center gap-1">
                <ShieldAlert className="h-3 w-3" /> Red flags (brief-level)
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {brief.redFlags.map((r) => (
                  <Badge key={r.word} variant="destructive" className="text-[10px] normal-case">
                    {r.word}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
        </aside>

        <section className="md:col-span-2 xl:col-span-6 bg-card border border-border shadow-sm p-6">
          <ContentEditor
            id={content.id}
            initialBrief={content.generatedBrief}
          />
        </section>

        <aside className="md:col-span-3 xl:col-span-3">
          <div className="xl:sticky xl:top-4">
            <AnnotationsList />
          </div>
        </aside>
      </div>
      </AnnotationsProvider>
    </div>
  )
}

function Meta({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</p>
      <p className="mt-0.5 text-sm text-foreground whitespace-pre-wrap inline-flex items-center gap-1">
        {icon}
        {value || '—'}
      </p>
    </div>
  )
}
