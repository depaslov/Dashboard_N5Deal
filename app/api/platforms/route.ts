import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateCurrentProject } from '@/lib/project'

export const dynamic = 'force-dynamic'

const VALID_FORMAT_TYPES = ['article', 'post', 'newsletter', 'thread', 'video-description', 'other']
const VALID_LENGTH_UNITS = ['chars', 'words']
const NAME_MAX = 80
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

interface ParsedInput {
  name: string
  slug: string
  formatType: string
  minLength: number | null
  maxLength: number | null
  lengthUnit: string
  tone: string | null
  hashtagRules: string | null
  disclaimers: string | null
  promptFragment: string | null
  isActive: boolean
}

function coerceInput(body: any, partial = false): ParsedInput | { error: string } {
  const out: Partial<ParsedInput> = {}

  if (body?.name !== undefined || !partial) {
    const name = String(body?.name ?? '').trim()
    if (!name) return { error: 'Name is required' }
    if (name.length > NAME_MAX) return { error: `Name must be at most ${NAME_MAX} characters` }
    out.name = name
  }

  if (body?.slug !== undefined) {
    const slug = String(body.slug).trim().toLowerCase()
    if (slug && !SLUG_RE.test(slug)) {
      return { error: 'Slug must be lowercase letters, numbers, and hyphens only' }
    }
    out.slug = slug || (out.name ? slugify(out.name) : '')
  } else if (out.name && !partial) {
    out.slug = slugify(out.name)
  }

  if (body?.formatType !== undefined || !partial) {
    const ft = String(body?.formatType ?? '').trim().toLowerCase()
    if (!ft) return { error: 'formatType is required' }
    if (!VALID_FORMAT_TYPES.includes(ft)) {
      return { error: `formatType must be one of: ${VALID_FORMAT_TYPES.join(', ')}` }
    }
    out.formatType = ft
  }

  if (body?.lengthUnit !== undefined) {
    const u = String(body.lengthUnit).trim().toLowerCase()
    if (!VALID_LENGTH_UNITS.includes(u)) {
      return { error: `lengthUnit must be one of: ${VALID_LENGTH_UNITS.join(', ')}` }
    }
    out.lengthUnit = u
  } else if (!partial) {
    out.lengthUnit = 'chars'
  }

  for (const k of ['minLength', 'maxLength'] as const) {
    if (body?.[k] !== undefined) {
      if (body[k] === null || body[k] === '') {
        out[k] = null
      } else {
        const n = Number(body[k])
        if (!Number.isFinite(n) || n < 0) return { error: `${k} must be a non-negative number` }
        out[k] = Math.floor(n)
      }
    } else if (!partial) {
      out[k] = null
    }
  }

  if (
    out.minLength !== null && out.minLength !== undefined &&
    out.maxLength !== null && out.maxLength !== undefined &&
    out.minLength > out.maxLength
  ) {
    return { error: 'minLength cannot be greater than maxLength' }
  }

  for (const k of ['tone', 'hashtagRules', 'disclaimers', 'promptFragment'] as const) {
    if (body?.[k] !== undefined) {
      const v = body[k] === null ? '' : String(body[k]).trim()
      out[k] = v || null
    } else if (!partial) {
      out[k] = null
    }
  }

  if (body?.isActive !== undefined) {
    out.isActive = body.isActive !== false
  } else if (!partial) {
    out.isActive = true
  }

  return out as ParsedInput
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await getOrCreateCurrentProject(userId)
  const { searchParams } = new URL(req.url)
  const includeInactive = searchParams.get('includeInactive') === 'true'

  const platforms = await prisma.platform.findMany({
    where: { projectId: project.id, ...(includeInactive ? {} : { isActive: true }) },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json({ platforms })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = coerceInput(body, false)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const project = await getOrCreateCurrentProject(userId)
  try {
    const platform = await prisma.platform.create({
      data: { projectId: project.id, ...parsed },
    })
    return NextResponse.json({ platform }, { status: 201 })
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return NextResponse.json({ error: 'A platform with this slug already exists' }, { status: 409 })
    }
    console.error('platform create error', err)
    return NextResponse.json({ error: 'Could not create platform' }, { status: 500 })
  }
}
