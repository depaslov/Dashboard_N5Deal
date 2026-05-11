'use client'

import { Image as ImageIcon } from 'lucide-react'
import { ACCOUNT_ACCENT, ACCOUNT_BADGE, type AccountSlug } from '@/lib/marketing/constants'
import { cn } from '@/lib/utils'
import type { CalPost } from './types'

export function PostCard({
  post,
  slug,
  onClick,
  compact,
}: {
  post: CalPost
  slug: AccountSlug
  onClick: () => void
  compact?: boolean
}) {
  const isArticle = post.type === 'Article'
  const isPublished = post.status === 'pub'
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left bg-card hover:bg-accent/50 border border-border border-l-2 rounded p-1.5 transition-colors relative',
        isArticle ? 'border-l-amber-600' : ACCOUNT_ACCENT[slug],
        isPublished && 'opacity-60',
      )}
    >
      <div className="flex items-center gap-1 mb-0.5">
        <span
          className={cn(
            'text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded',
            isArticle ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300' : ACCOUNT_BADGE[slug],
          )}
        >
          {post.type}
        </span>
        {post.imageCount > 0 ? (
          <span className="inline-flex items-center gap-0.5 text-[9px] text-muted-foreground">
            <ImageIcon className="h-2.5 w-2.5" />
            {post.imageCount > 1 ? post.imageCount : ''}
          </span>
        ) : null}
        {post.status !== 'idea' ? (
          <span
            className={cn(
              'ml-auto h-1.5 w-1.5 rounded-full',
              post.status === 'wip' && 'bg-blue-500',
              post.status === 'done' && 'bg-emerald-500',
              post.status === 'pub' && 'bg-amber-500',
              post.status === 'skip' && 'bg-red-500',
            )}
          />
        ) : null}
      </div>
      <div className={cn('text-[11px] leading-snug', compact ? 'line-clamp-2' : 'line-clamp-3')}>{post.title}</div>
      {post.platforms?.length && !compact ? (
        <div className="mt-1 flex flex-wrap gap-0.5">
          {post.platforms.slice(0, 3).map((pl) => (
            <span key={pl} className="text-[8px] font-medium px-1 py-0.5 rounded bg-muted text-muted-foreground">
              {pl}
            </span>
          ))}
        </div>
      ) : null}
    </button>
  )
}
