import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'

export const dynamic = 'force-dynamic'

const VALID_CATEGORIES = ['ai', 'brand', 'compliance', 'competitor', 'other']
const VALID_SEVERITIES = ['warn', 'block']
const VALID_LANGUAGES = ['any', 'en', 'uk', 'ru']

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await getOrCreateCurrentProject(userId)
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category') || undefined
  const language = searchParams.get('language') || undefined

  const words = await prisma.redFlagWord.findMany({
    where: {
      projectId: project.id,
      ...(category ? { category } : {}),
      ...(language ? { language } : {}),
    },
    orderBy: [{ category: 'asc' }, { word: 'asc' }],
  })
  return NextResponse.json({ words })
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

  // Bulk mode: { words: [{word, category?, severity?, reason?, language?}, ...] }
  if (Array.isArray(body?.words)) {
    const items = body.words
      .map((w: any) => ({
        word: String(w?.word ?? '').trim(),
        category: VALID_CATEGORIES.includes(w?.category) ? w.category : 'ai',
        severity: VALID_SEVERITIES.includes(w?.severity) ? w.severity : 'warn',
        reason: w?.reason ? String(w.reason).trim() : null,
        language: VALID_LANGUAGES.includes(w?.language) ? w.language : 'any',
      }))
      .filter((w: any) => w.word.length > 0)

    if (items.length === 0) {
      return NextResponse.json({ error: 'No valid words provided' }, { status: 400 })
    }

    const results = await Promise.all(
      items.map((item: any) =>
        prisma.redFlagWord.upsert({
          where: {
            projectId_word_language: {
              projectId: project.id,
              word: item.word,
              language: item.language,
            },
          },
          update: { category: item.category, severity: item.severity, reason: item.reason },
          create: { ...item, projectId: project.id },
        })
      )
    )
    return NextResponse.json({ words: results, created: results.length })
  }

  // Single mode
  const word = String(body?.word ?? '').trim()
  if (!word) return NextResponse.json({ error: 'Word is required' }, { status: 400 })

  const category = VALID_CATEGORIES.includes(body?.category) ? body.category : 'ai'
  const severity = VALID_SEVERITIES.includes(body?.severity) ? body.severity : 'warn'
  const language = VALID_LANGUAGES.includes(body?.language) ? body.language : 'any'
  const reason = body?.reason ? String(body.reason).trim() : null

  try {
    const created = await prisma.redFlagWord.upsert({
      where: {
        projectId_word_language: {
          projectId: project.id,
          word,
          language,
        },
      },
      update: { category, severity, reason },
      create: { projectId: project.id, word, category, severity, language, reason },
    })
    return NextResponse.json({ word: created })
  } catch (err) {
    console.error('red-flag create error', err)
    return NextResponse.json({ error: 'Could not save red flag' }, { status: 500 })
  }
}
