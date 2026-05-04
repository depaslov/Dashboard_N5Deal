import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getOrCreateCurrentProject } from '@/lib/project'
import { queryRAG, queryUserDocumentRAG } from '@/lib/rag'
import { embeddingsAvailable } from '@/lib/embeddings'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limit = rateLimit(`rag:${userId}`, 30, 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many queries. Please wait a moment.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } },
    )
  }

  if (!embeddingsAvailable()) {
    return NextResponse.json(
      { error: 'No embeddings provider is configured (set ABACUSAI_API_KEY or OPENAI_API_KEY).' },
      { status: 503 },
    )
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const question = String(body?.question ?? '').trim().slice(0, 2000)
  const fileName = String(body?.fileName ?? '').trim().slice(0, 255)
  if (!question) {
    return NextResponse.json({ error: 'Question is required' }, { status: 400 })
  }

  try {
    let result
    if (fileName) {
      result = await queryUserDocumentRAG(userId, fileName, question)
    } else {
      const project = await getOrCreateCurrentProject(userId)
      result = await queryRAG(project.id, question)
    }

    return NextResponse.json({ answer: result.answer })
  } catch (error: any) {
    console.error('RAG query error:', error)
    return NextResponse.json(
      { error: error?.message ?? 'Failed to process RAG query' },
      { status: 500 },
    )
  }
}
