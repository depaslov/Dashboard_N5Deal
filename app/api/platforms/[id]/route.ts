import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertProjectAccess } from '@/lib/project'

export const dynamic = 'force-dynamic'

const VALID_FORMAT_TYPES = ['article', 'post', 'newsletter', 'thread', 'video-description', 'other']
const VALID_LENGTH_UNITS = ['chars', 'words']
const NAME_MAX = 80
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/

async function getPlatformOrNull(userId: string, id: string) {
  const platform = await prisma.platform.findUnique({ where: { id } })
  if (!platform) return null
  const ok = await assertProjectAccess(userId, platform.projectId)
  return ok ? platform : null
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const platform = await getPlatformOrNull(userId, params.id)
  if (!platform) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ platform })
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await getPlatformOrNull(userId, params.id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const data: Record<string, any> = {}

  if (body?.name !== undefined) {
    const n = String(body.name).trim()
    if (!n) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
    if (n.length > NAME_MAX) {
      return NextResponse.json({ error: `Name must be at most ${NAME_MAX} characters` }, { status: 400 })
    }
    data.name = n
  }
  if (body?.slug !== undefined) {
    const s = String(body.slug).trim().toLowerCase()
    if (!s || !SLUG_RE.test(s)) {
      return NextResponse.json({ error: 'Slug must be lowercase letters, numbers, and hyphens only' }, { status: 400 })
    }
    data.slug = s
  }
  if (body?.formatType !== undefined) {
    const ft = String(body.formatType).trim().toLowerCase()
    if (!VALID_FORMAT_TYPES.includes(ft)) {
      return NextResponse.json({ error: `formatType must be one of: ${VALID_FORMAT_TYPES.join(', ')}` }, { status: 400 })
    }
    data.formatType = ft
  }
  if (body?.lengthUnit !== undefined) {
    const u = String(body.lengthUnit).trim().toLowerCase()
    if (!VALID_LENGTH_UNITS.includes(u)) {
      return NextResponse.json({ error: `lengthUnit must be one of: ${VALID_LENGTH_UNITS.join(', ')}` }, { status: 400 })
    }
    data.lengthUnit = u
  }
  for (const k of ['minLength', 'maxLength'] as const) {
    if (body?.[k] !== undefined) {
      if (body[k] === null || body[k] === '') data[k] = null
      else {
        const n = Number(body[k])
        if (!Number.isFinite(n) || n < 0) {
          return NextResponse.json({ error: `${k} must be a non-negative number` }, { status: 400 })
        }
        data[k] = Math.floor(n)
      }
    }
  }
  for (const k of ['tone', 'hashtagRules', 'disclaimers', 'promptFragment'] as const) {
    if (body?.[k] !== undefined) {
      const v = body[k] === null ? '' : String(body[k]).trim()
      data[k] = v || null
    }
  }
  if (body?.isActive !== undefined) data.isActive = body.isActive !== false

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  // Cross-field validation if both bounds are present after merge
  const finalMin = data.minLength !== undefined ? data.minLength : existing.minLength
  const finalMax = data.maxLength !== undefined ? data.maxLength : existing.maxLength
  if (finalMin !== null && finalMax !== null && finalMin !== undefined && finalMax !== undefined && finalMin > finalMax) {
    return NextResponse.json({ error: 'minLength cannot be greater than maxLength' }, { status: 400 })
  }

  try {
    const platform = await prisma.platform.update({ where: { id: params.id }, data })
    return NextResponse.json({ platform })
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return NextResponse.json({ error: 'A platform with this slug already exists' }, { status: 409 })
    }
    console.error('platform update error', err)
    return NextResponse.json({ error: 'Could not update platform' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await getPlatformOrNull(userId, params.id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.platform.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
