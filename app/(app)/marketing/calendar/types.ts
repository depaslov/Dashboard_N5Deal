export interface CalAccount {
  id: string
  slug: string
  name: string
  color: string
}

export interface CalPost {
  id: string
  accountId: string
  accountSlug: string
  type: string
  title: string
  content: string
  platforms: string[]
  scheduledFor: string // ISO
  status: string // idea | wip | done | pub | skip
  notes: string
  postUrl: string
  imageCount: number
}
