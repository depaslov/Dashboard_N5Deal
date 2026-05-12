// Static lookups for the Marketing OS module. These mirror the original
// ACC/TYPES/PMAP/ACC_DEF_PLATS tables from the standalone HTML prototype but
// live in TypeScript so we can share them between server + client code.

export type AccountSlug = 'n5' | 'bk' | 'ih' | 'db'

export const ACCOUNT_META: Record<AccountSlug, { name: string; color: string; lbl: string }> = {
  n5: { name: 'N5Deal', color: 'hsl(217 91% 51%)', lbl: 'n5' },
  bk: { name: 'BankStore', color: 'hsl(220 14% 13%)', lbl: 'bk' },
  ih: { name: 'Ihor Vlasov', color: 'hsl(262 82% 56%)', lbl: 'ih' },
  db: { name: 'Denys Bets', color: 'hsl(160 79% 32%)', lbl: 'db' },
}

export const ACCOUNT_ORDER: AccountSlug[] = ['n5', 'bk', 'ih', 'db']

export const POST_TYPES_BY_ACCOUNT: Record<AccountSlug, string[]> = {
  n5: ['Article', 'Company Post', 'Founder Post', 'Reel', 'Thread', 'Story', 'Carousel'],
  bk: ['Article', 'Company Post', 'Reel', 'Carousel', 'Thread'],
  ih: ['Text Post', 'Carousel', 'Repost', 'Thread'],
  db: ['Text Post', 'Carousel', 'Repost'],
}

export const ALL_PLATFORMS = [
  'LI Company',
  'LI Founder',
  'LinkedIn',
  'Instagram',
  'X/Twitter',
  'Threads',
  'YouTube',
  'Medium',
  'Newsletter',
  'Reddit',
  'Telegram',
  'Website',
] as const

export type Platform = (typeof ALL_PLATFORMS)[number]

export const DEFAULT_PLATFORMS: Record<AccountSlug, Platform[]> = {
  n5: ['LI Company', 'LI Founder', 'Instagram', 'X/Twitter', 'Threads'],
  bk: ['LI Company', 'Instagram', 'Medium'],
  ih: ['LinkedIn'],
  db: ['LinkedIn'],
}

export const POST_STATUSES = ['idea', 'wip', 'done', 'pub', 'skip'] as const
export type PostStatus = (typeof POST_STATUSES)[number]

export const POST_STATUS_LABEL: Record<PostStatus, string> = {
  idea: 'Idea',
  wip: 'In Progress',
  done: 'Done',
  pub: 'Published',
  skip: 'Skipped',
}

// Tailwind utility groups by account — used for left-border accents on cards
// so colours stay in tokens land instead of hard-coded hex.
export const ACCOUNT_ACCENT: Record<AccountSlug, string> = {
  n5: 'border-l-blue-600',
  bk: 'border-l-slate-900',
  ih: 'border-l-violet-600',
  db: 'border-l-emerald-600',
}

export const ACCOUNT_BADGE: Record<AccountSlug, string> = {
  n5: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  bk: 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-200',
  ih: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  db: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
}

export const MARKETING_NAV = [
  { slug: 'home', label: 'Home', href: '/marketing' },
  { slug: 'calendar', label: 'Calendar', href: '/marketing/calendar' },
  { slug: 'linkbuilding', label: 'Link Building', href: '/marketing/linkbuilding' },
  { slug: 'seo', label: 'SEO Tracker', href: '/marketing/seo' },
  { slug: 'analytics', label: 'Analytics', href: '/marketing/analytics' },
  { slug: 'reports', label: 'Reports', href: '/marketing/reports' },
  { slug: 'strategy', label: 'Strategy', href: '/marketing/strategy' },
  { slug: 'brands', label: 'Brands', href: '/marketing/brands' },
] as const

// =============================================================================
// LINK BUILDING — types, statuses, colors
// =============================================================================

export const LB_TYPES = [
  { k: 'outreach', label: 'Cold outreach' },
  { k: 'guest_post', label: 'Guest post' },
  { k: 'resource', label: 'Resource page' },
  { k: 'partner', label: 'Partner backlink' },
  { k: 'directory', label: 'Directory listing' },
  { k: 'hari', label: 'HARO / press' },
  { k: 'other', label: 'Other' },
] as const
export type LBType = (typeof LB_TYPES)[number]['k']

export const LB_STATUSES = [
  { k: 'planned', label: 'Planned', dot: 'bg-slate-400' },
  { k: 'in_progress', label: 'In Progress', dot: 'bg-blue-500' },
  { k: 'followup', label: 'Follow-up', dot: 'bg-amber-500' },
  { k: 'published', label: 'Published', dot: 'bg-emerald-500' },
  { k: 'declined', label: 'Declined', dot: 'bg-red-500' },
] as const
export type LBStatus = (typeof LB_STATUSES)[number]['k']

export const LB_STATUS_BADGE: Record<LBStatus, string> = {
  planned: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  followup: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  published: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  declined: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
}

// =============================================================================
// SEO TRACKER — intent / locale / cluster defaults
// =============================================================================

export const SEO_INTENTS = [
  { k: 'informational', label: 'Informational' },
  { k: 'commercial', label: 'Commercial' },
  { k: 'transactional', label: 'Transactional' },
  { k: 'navigational', label: 'Navigational' },
] as const
export type SeoIntent = (typeof SEO_INTENTS)[number]['k']

export const SEO_LOCALES = [
  { k: 'global', label: 'Global' },
  { k: 'uk', label: 'UK' },
  { k: 'us', label: 'US' },
  { k: 'eu', label: 'EU' },
  { k: 'ua', label: 'Ukraine' },
] as const

// Suggested clusters seeded from the project's 8 SEO clusters (Project.md).
// Free-text — users can add their own.
export const SEO_CLUSTERS_SUGGESTED = [
  'EMI', 'PSP', 'MSB', 'VASP', 'Crypto', 'Fintech', 'Banking', 'M&A',
] as const

export function seoPositionBadge(position: number | null | undefined): string {
  if (position === null || position === undefined) return 'bg-muted text-muted-foreground'
  if (position <= 3) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
  if (position <= 10) return 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
  if (position <= 30) return 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
}
