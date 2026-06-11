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
  // Tasks page uses the SAME LinkBuildingItem table as Link Building, just
  // filtered to the task-like type family. Keeps the form + activity log
  // + board views in one place; the two pages diverge only on the type
  // filter and the "Add link" vs "Add task" labels.
  { slug: 'tasks', label: 'Tasks', href: '/marketing/tasks' },
  { slug: 'analytics', label: 'Analytics', href: '/marketing/analytics' },
  { slug: 'reports', label: 'Reports', href: '/marketing/reports' },
  { slug: 'strategy', label: 'Strategy', href: '/marketing/strategy' },
  { slug: 'brands', label: 'Brands', href: '/marketing/brands' },
] as const

// =============================================================================
// LINK BUILDING — types, statuses, colors
// =============================================================================

export const LB_TYPES = [
  // ─── General-task family ────────────────────────────────────────────
  // Anything that isn't a real backlink-earning activity. These hide the
  // link-specific fields in the form (targetSite / anchor / DR / cost /
  // live URL) and route to /marketing/tasks-andrew instead of the Link
  // Building page. Operators treat the board as a general work tracker
  // for this side of the table.
  { k: 'task', label: 'Task' },
  { k: 'article', label: 'Site article' },
  { k: 'market_news', label: 'Market news' },
  { k: 'medium', label: 'Medium article' },
  { k: 'seo', label: 'SEO' },

  // ─── Real link-building activities ─────────────────────────────────
  // Live on /marketing/linkbuilding. All of these target an external
  // site to earn a backlink to n5deal / bankstore / etc.
  { k: 'profile', label: 'Profile link' },
  { k: 'web20', label: 'Web 2.0' },
  { k: 'crowd', label: 'Crowd marketing' },
  { k: 'outreach', label: 'Cold outreach' },
  { k: 'guest_post', label: 'Guest post' },
  { k: 'resource', label: 'Resource page' },
  { k: 'partner', label: 'Partner backlink' },
  { k: 'directory', label: 'Directory listing' },
  { k: 'hari', label: 'HARO / press' },
  { k: 'other', label: 'Other' },
] as const
export type LBType = (typeof LB_TYPES)[number]['k']

// Task-like types route to Tasks Andrew; everything else stays on Link
// Building. Centralised so the page filters, the form modal's link-only
// field gate, and the classify-endpoint scan all agree on the cut.
// IMPORTANT: kept as a plain string list (not a Set) because Prisma's
// `in:` clause takes an array directly.
export const LB_TASK_LIKE_TYPES = ['task', 'article', 'market_news', 'medium', 'seo'] as const
export const LB_TASK_LIKE_SET: ReadonlySet<string> = new Set(LB_TASK_LIKE_TYPES)
export function isTaskLikeType(type: string): boolean {
  return LB_TASK_LIKE_SET.has(type)
}

// Types where the "link placement" fields (target site, anchor text, DR,
// cost, live URL, contact info) are meaningful. The full task-like family
// (task / article / market_news / medium / seo) all hide those fields in
// the form because the operator isn't earning a backlink for any of them.
export const LB_LINK_TYPES: ReadonlySet<LBType> = new Set(
  LB_TYPES.filter((t) => !LB_TASK_LIKE_SET.has(t.k)).map((t) => t.k),
)
export function isLinkType(type: string): boolean {
  return LB_LINK_TYPES.has(type as LBType)
}

// Workflow:  planned → in_progress → approved → published
//            (followup and declined are side branches)
// "approved" sits between "in_progress" and "published" — the operator has
// finished the work but the link isn't live yet / hasn't been signed off
// for publishing. Captured separately from "published" so the Activity log
// can show an explicit approval moment.
export const LB_STATUSES = [
  { k: 'planned', label: 'Planned', dot: 'bg-slate-400' },
  { k: 'in_progress', label: 'In Progress', dot: 'bg-blue-500' },
  { k: 'approved', label: 'Approved', dot: 'bg-violet-500' },
  { k: 'followup', label: 'Follow-up', dot: 'bg-amber-500' },
  { k: 'published', label: 'Published', dot: 'bg-emerald-500' },
  { k: 'declined', label: 'Declined', dot: 'bg-red-500' },
] as const
export type LBStatus = (typeof LB_STATUSES)[number]['k']

export const LB_STATUS_BADGE: Record<LBStatus, string> = {
  planned: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  approved: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  followup: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  published: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  declined: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
}
