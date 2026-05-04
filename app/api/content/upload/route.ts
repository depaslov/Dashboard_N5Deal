import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { extractDocumentChunks } from '@/lib/document-processor'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const { text, documents } = await extractDocumentChunks(file)

    return NextResponse.json({
      success: true,
      fileName: file.name,
      text,
      chunkCount: documents.length,
    })
  } catch (error: any) {
    console.error('Content document upload error:', error)
    return NextResponse.json(
      { error: error?.message ?? 'Failed to process document' },
      { status: 500 },
    )
  }
}
