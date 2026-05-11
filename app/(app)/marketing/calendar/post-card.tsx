'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Image as ImageIcon, CheckCircle2 } from 'lucide-react'
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
  const router = useRouter()
  const [toggling, setToggling] = useState(false)
  const isArticle = post.type === 'Article'
  const isPublished = post.status === 'pub'

  async function togglePublished(e: React.MouseEvent) {
    e.stopPropagation()
    setToggling(true)
    try {
      const res = await fetch(`/api/marketing/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: isPublished ? 'idea' : 'pub' }),
      })
      if (!res.ok) { toast.error('Failed'); return }
      router.refresh()
    } finally {
      setToggling(false)
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick() }}
      className={cn(
        'group/post w-full text-left bg-card hover:bg-accent/50 border border-border border-l-2 rounded p-1.5 transition-colors relative cursor-pointer',
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
      <button
        type="button"
        onClick={togglePublished}
        disabled={toggling}
        title={isPublished ? 'Unmark as posted' : 'Mark as posted'}
        className={cn(
          'absolute -bottom-1 -right-1 h-5 w-5 inline-flex items-center justify-center rounded-full border shadow-sm transition-all',
          isPublished
            ? 'opacity-100 bg-amber-500 text-white border-amber-600 hover:bg-amber-600'
            : 'opacity-0 group-hover/post:opacity-100 bg-card border-border text-muted-foreground hover:text-emerald-600 hover:border-emerald-600',
        )}
        aria-label={isPublished ? 'Unmark as posted' : 'Mark as posted'}
      >
        <CheckCircle2 className="h-3 w-3" />
      </button>
    </div>
  )
}
