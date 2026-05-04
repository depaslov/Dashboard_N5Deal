import mammoth from 'mammoth'
import { Document } from 'langchain/document'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { hashContent, syncScopeItems, type SyncResult } from './embedding-store'

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 800,
  chunkOverlap: 100,
})

export function userDocScope(userId: string): string {
  return `userdoc:${userId}`
}

async function extractText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  if (file.type === 'application/pdf') {
    const { extractText: unpdfExtractText, getDocumentProxy } = await import('unpdf')
    const pdf = await getDocumentProxy(new Uint8Array(buffer))
    const { text } = await unpdfExtractText(pdf, { mergePages: true })
    return text ?? ''
  }
  if (
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) })
    return result.value
  }
  if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')) {
    return new TextDecoder().decode(buffer)
  }
  throw new Error('Unsupported file type. Please upload TXT, DOCX, or PDF files.')
}

// Extract + chunk the document. Used for the content-generation flow which
// only needs the text to feed into the prompt — no embedding required.
export async function extractDocumentChunks(file: File): Promise<{
  text: string
  documents: Document[]
}> {
  const text = await extractText(file)
  const chunks = await splitter.splitText(text)
  const documents = chunks.map(
    (chunk, index) =>
      new Document({
        pageContent: chunk,
        metadata: {
          source: file.name,
          chunkIndex: index,
          type: 'user_document',
        },
      }),
  )
  return { text, documents }
}

// Ingest a user-uploaded document into the embedding cache, scoped to a
// specific user so other users cannot read it.
export async function ingestUserDocument(
  userId: string,
  file: File,
): Promise<SyncResult & { fileName: string; chunkCount: number }> {
  if (!userId) throw new Error('userId is required to ingest a document')
  const text = await extractText(file)
  const fileHash = hashContent(`${file.name}:${text}`)
  const chunkTexts = await splitter.splitText(text)

  const result = await syncScopeItems(
    userDocScope(userId),
    [
      {
        key: file.name,
        fileHash,
        chunks: chunkTexts.map((c, i) => ({
          content: c,
          metadata: { source: file.name, chunkIndex: i, type: 'user_document' },
        })),
      },
    ],
  )

  return { ...result, fileName: file.name, chunkCount: chunkTexts.length }
}
