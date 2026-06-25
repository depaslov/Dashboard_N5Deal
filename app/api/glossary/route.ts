import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'

export const dynamic = 'force-dynamic'

const VALID_LANGUAGES = ['en', 'uk', 'ru']

// Kebab-case slug derived from the phrase: lowercase ASCII letters + digits,
// everything else (Cyrillic, punctuation, multiple spaces) collapses to "-".
// Mirrors the slug format on n5deal.com/glossary so dashboard entries land
// at the right public URL automatically.
function slugify(phrase: string): string {
  return phrase
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining marks
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'entry'
}

// Parse a bulk-import textarea. Auto-detects the per-line separator from:
//   "phrase | definition"
//   "phrase\tdefinition"   (TSV / Markdown table paste)
//   "phrase: definition"
//   "phrase — definition"  (em-dash)
//   "phrase - definition"  (ASCII hyphen, requires surrounding spaces)
// Lines without a separator are skipped (logged in `skipped`). Markdown
// table separator rows (e.g. `|---|---|`) and header rows starting with
// `Phrase` / `Term` are also skipped.
function parseBulk(raw: string): { entries: { phrase: string; definition: string }[]; skipped: string[] } {
  const entries: { phrase: string; definition: string }[] = []
  const skipped: string[] = []
  const lines = raw.split(/\r?\n/)
  for (const rawLine of lines) {
    let line = rawLine.trim()
    if (!line) continue
    // Markdown table cleanups
    if (/^\|?\s*-{3,}/.test(line)) continue // separator row
    line = line.replace(/^\|/, '').replace(/\|$/, '').trim()

    // Header rows
    if (/^(phrase|term|word)\s*[|:\t]/i.test(line)) continue

    // Try separators in priority order: tab, pipe, em-dash, colon, " - "
    const sepRegex = /\t|\s*\|\s*|\s+—\s+|:\s+|\s+-\s+/
    const m = line.match(sepRegex)
    if (!m || m.index === undefined) {
      skipped.push(rawLine)
      continue
    }
    const phrase = line.slice(0, m.index).trim()
    const definition = line.slice(m.index + m[0].length).trim()
    if (!phrase || !definition) {
      skipped.push(rawLine)
      continue
    }
    entries.push({ phrase, definition })
  }
  return { entries, skipped }
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await getOrCreateCurrentProject(userId)
  const { searchParams } = new URL(req.url)
  const language = searchParams.get('language') || undefined
  const q = searchParams.get('q')?.trim()

  const entries = await prisma.glossaryEntry.findMany({
    where: {
      projectId: project.id,
      ...(language && VALID_LANGUAGES.includes(language) ? { language } : {}),
      ...(q
        ? {
            OR: [
              { phrase: { contains: q, mode: 'insensitive' } },
              { definition: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: [{ language: 'asc' }, { phrase: 'asc' }],
  })
  return NextResponse.json({ entries })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const project = await getOrCreateCurrentProject(userId)
  const language = VALID_LANGUAGES.includes(body?.language) ? body.language : 'en'

  // Bulk-paste mode: raw textarea blob → parsed → upserted in one round-trip.
  // Same handler accepts a pre-parsed `entries: [{phrase, definition}]` array
  // for programmatic callers.
  if (typeof body?.raw === 'string' || Array.isArray(body?.entries)) {
    let entries: { phrase: string; definition: string }[] = []
    let skipped: string[] = []
    if (typeof body?.raw === 'string') {
      const parsed = parseBulk(body.raw)
      entries = parsed.entries
      skipped = parsed.skipped
    } else {
      entries = body.entries
        .map((e: any) => ({
          phrase: String(e?.phrase ?? '').trim(),
          definition: String(e?.definition ?? '').trim(),
        }))
        .filter((e: any) => e.phrase.length > 0 && e.definition.length > 0)
    }
    if (entries.length === 0) {
      return NextResponse.json({ error: 'No valid entries detected', skipped }, { status: 400 })
    }

    // Per-batch slug deduplication: if the same phrase appears twice in the
    // pasted block, the second one would collide on (projectId, slug,
    // language). De-dupe by phrase (last-wins) before upserting.
    const byPhrase = new Map<string, { phrase: string; definition: string }>()
    for (const e of entries) byPhrase.set(e.phrase.toLowerCase(), e)
    const deduped = Array.from(byPhrase.values())

    const results = await Promise.all(
      deduped.map((e) =>
        prisma.glossaryEntry.upsert({
          where: {
            projectId_phrase_language: {
              projectId: project.id,
              phrase: e.phrase,
              language,
            },
          },
          update: { definition: e.definition, slug: slugify(e.phrase) },
          create: {
            projectId: project.id,
            phrase: e.phrase,
            definition: e.definition,
            slug: slugify(e.phrase),
            language,
          },
        })
      )
    )
    return NextResponse.json({
      entries: results,
      created: results.length,
      skipped,
      duplicatesInPaste: entries.length - deduped.length,
    })
  }

  // Single-entry mode
  const phrase = String(body?.phrase ?? '').trim()
  const definition = String(body?.definition ?? '').trim()
  if (!phrase || !definition) {
    return NextResponse.json({ error: 'Phrase and definition are required' }, { status: 400 })
  }

  try {
    const created = await prisma.glossaryEntry.upsert({
      where: {
        projectId_phrase_language: {
          projectId: project.id,
          phrase,
          language,
        },
      },
      update: { definition, slug: slugify(phrase) },
      create: {
        projectId: project.id,
        phrase,
        definition,
        slug: slugify(phrase),
        language,
      },
    })
    return NextResponse.json({ entry: created })
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return NextResponse.json({ error: 'Phrase already exists in this language' }, { status: 409 })
    }
    console.error('glossary create error', err)
    return NextResponse.json({ error: 'Could not save entry' }, { status: 500 })
  }
}
