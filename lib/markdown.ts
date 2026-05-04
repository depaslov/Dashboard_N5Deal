import { Marked } from 'marked'

// Single shared parser with GFM and no raw-HTML pass-through.
// Output is treated as trusted: it comes from our own LLM pipeline, never
// from user paste, so we leave inline tags rendered. If the threat model
// ever changes, swap in DOMPurify on the result.
const marked = new Marked({
  gfm: true,
  breaks: false,
})

export function renderMarkdown(input: string): string {
  if (!input) return ''
  return marked.parse(input, { async: false }) as string
}

export async function copyMarkdownAsRich(markdown: string): Promise<void> {
  if (!markdown) throw new Error('Nothing to copy')
  const html = renderMarkdown(markdown)

  if (typeof window !== 'undefined' && (window as any).ClipboardItem && navigator.clipboard?.write) {
    try {
      const blobHtml = new Blob([html], { type: 'text/html' })
      const blobText = new Blob([markdown], { type: 'text/plain' })
      // ClipboardItem accepts both mime types; pasting into rich-text editors
      // (Google Docs, Notion, Word) takes the HTML, plain editors take text.
      // eslint-disable-next-line no-undef
      const item = new (window as any).ClipboardItem({
        'text/html': blobHtml,
        'text/plain': blobText,
      })
      await navigator.clipboard.write([item])
      return
    } catch {
      // Fall through to plain-text fallback below.
    }
  }
  await navigator.clipboard.writeText(markdown)
}
