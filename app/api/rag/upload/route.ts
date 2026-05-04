import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ingestUserDocument } from '@/lib/document-processor'
import { embeddingsAvailable } from '@/lib/embeddings'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limit = rateLimit(`rag-upload:${userId}`, 10, 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many uploads. Please wait a moment.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } },
    )
  }

  if (!embeddingsAvailable()) {
    return NextResponse.json(
      { error: 'No embeddings provider is configured (set ABACUSAI_API_KEY or OPENAI_API_KEY).' },
      { status: 503 },
    )
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const result = await ingestUserDocument(userId, file)

    return NextResponse.json({
      success: true,
      fileName: result.fileName,
      chunkCount: result.chunkCount,
      embedded: result.embedded,
      reused: result.reused,
    })
  } catch (error: any) {
    console.error('Document upload error:', error)
    return NextResponse.json(
      { error: error?.message ?? 'Failed to process document' },
      { status: 500 },
    )
  }
}
