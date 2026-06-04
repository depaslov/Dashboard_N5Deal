'use client'

import { cn } from '@/lib/utils'

/**
 * Auto status dot next to each content title. Orange when the piece has
 * at least one unresolved annotation (means "review pending — there are
 * notes on this one"), otherwise rendered as a quiet dashed placeholder
 * so the row layout stays consistent across tagged and untagged items.
 *
 * The whole thing is read-only — the dot is purely a function of the
 * annotation count so the operator can't accidentally lie about review
 * state. To clear it: resolve the annotations on the source document
 * (Regenerate-from-notes resolves them in bulk).
 */
export function AnnotationStatusDot({
  unresolvedCount,
  totalCount,
  size = 'md',
}: {
  unresolvedCount: number
  totalCount?: number
  size?: 'sm' | 'md'
}) {
  const dotSize = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'

  if (unresolvedCount <= 0) {
    return (
      <span
        className={cn('inline-block rounded-full border border-dashed border-border shrink-0', dotSize)}
        aria-label="No pending notes"
        title={totalCount && totalCount > 0 ? `${totalCount} resolved note${totalCount === 1 ? '' : 's'}` : 'No notes'}
      />
    )
  }

  const label = `${unresolvedCount} pending note${unresolvedCount === 1 ? '' : 's'}${
    totalCount && totalCount > unresolvedCount
      ? ` (${totalCount - unresolvedCount} resolved)`
      : ''
  }`

  return (
    <span
      className={cn('inline-block rounded-full bg-orange-500 shrink-0 ring-2 ring-orange-500/20', dotSize)}
      aria-label={label}
      title={label}
    />
  )
}
