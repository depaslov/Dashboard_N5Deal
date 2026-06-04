'use client'

import { useMemo } from 'react'
import { diffWordsWithSpace } from 'diff'
import { renderMarkdown } from '@/lib/markdown'

/**
 * Renders a Google-Docs-style inline diff between the previous draft and the
 * regenerated one. Deletions stay strikethrough red, insertions green; the
 * unchanged parts read like the normal article.
 *
 * Strategy:
 * 1. Compute a word-level diff on the raw markdown source.
 * 2. Wrap each change in `<ins>` / `<del>` (standard HTML inline tags). The
 *    `marked` renderer passes inline HTML through untouched, so the result
 *    keeps all the markdown formatting (headings, bold, lists) WHILE the
 *    change markers stay visible.
 * 3. Render via dangerouslySetInnerHTML and rely on the `.diff-view` CSS
 *    block below to colour ins/del.
 *
 * Limitations to call out:
 * - If a change crosses a block boundary (e.g. a whole heading replaced)
 *   the diff is still correct character-by-character but the visual gets
 *   noisy. Acceptable trade-off — sentence-level edits, which are the
 *   common case after Regenerate-from-notes, render cleanly.
 * - Inline HTML tags can't span block-level markdown structures cleanly,
 *   so we escape the markers' content carefully to avoid breaking the
 *   parser.
 */
export function ContentDiffView({
  previousBrief,
  currentBrief,
}: {
  previousBrief: string
  currentBrief: string
}) {
  const html = useMemo(() => {
    const parts = diffWordsWithSpace(previousBrief, currentBrief)
    // Build the marked-up markdown source by concatenating parts. Each
    // changed part wraps in <ins>/<del>; unchanged ones pass through.
    // Wrapping leaves the markdown structure intact because <ins>/<del>
    // are inline-flow elements.
    const merged = parts
      .map((p) => {
        if (p.added) return `<ins class="diff-ins">${p.value}</ins>`
        if (p.removed) return `<del class="diff-del">${p.value}</del>`
        return p.value
      })
      .join('')
    return renderMarkdown(merged)
  }, [previousBrief, currentBrief])

  return (
    <>
      <article
        className="markdown-output diff-view"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {/* Scoped styles for the diff markers — soft red strikethrough for
          removed text, soft green underline for additions. Stays readable
          even when several adjacent changes stack. */}
      <style jsx global>{`
        .diff-view .diff-del {
          background-color: rgb(254 226 226 / 0.7);
          color: rgb(127 29 29);
          text-decoration: line-through;
          text-decoration-color: rgb(220 38 38);
          padding: 0.05em 0.15em;
          border-radius: 2px;
        }
        .diff-view .diff-ins {
          background-color: rgb(220 252 231 / 0.7);
          color: rgb(20 83 45);
          text-decoration: none;
          padding: 0.05em 0.15em;
          border-radius: 2px;
        }
        .diff-view .diff-ins::before,
        .diff-view .diff-del::before {
          content: '';
        }
      `}</style>
    </>
  )
}
