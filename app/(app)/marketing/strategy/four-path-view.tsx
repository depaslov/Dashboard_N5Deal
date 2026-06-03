'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Four-path channel strategy — DR / Awareness / Lead Gen / Product Promotion
// Each channel has one primary job, some support a second path.
// ─────────────────────────────────────────────────────────────────────────────

type Pillar = 'dr' | 'aw' | 'lg' | 'pp'
type Status = 'active' | 'light' | 'planned' | 'none'

interface ChannelCard {
  name: string
  desc: string
  volume: string
  pillars: Pillar[]
  status: Status
}

// Pillar styling — match the prototype's palette but in dashboard's HSL system.
const PILLAR_META: Record<Pillar, { label: string; color: string; chip: string; ring: string }> = {
  dr: { label: 'DR',         color: '#5B41B5', chip: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200', ring: 'border-violet-400' },
  aw: { label: 'Awareness',  color: '#0A66C2', chip: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',         ring: 'border-blue-400' },
  lg: { label: 'Lead gen',   color: '#10B981', chip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200', ring: 'border-emerald-400' },
  pp: { label: 'Product',    color: '#E1306C', chip: 'bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-200',         ring: 'border-pink-400' },
}

const STATUS_META: Record<Status, { label: string; dot: string }> = {
  active:  { label: 'Active',      dot: 'bg-emerald-500' },
  light:   { label: 'Light',       dot: 'bg-amber-500' },
  planned: { label: 'Planned',     dot: 'bg-amber-500' },
  none:    { label: 'Not started', dot: 'bg-red-500' },
}

// ────────────────────────────────────────────────────────────────────────────
// KPI targets across the four paths
// ────────────────────────────────────────────────────────────────────────────
const TARGETS: { value: string; label: string }[] = [
  { value: '+1,500',  label: 'TG subscribers from listings' },
  { value: '15K+',    label: 'LinkedIn impressions' },
  { value: '50K+',    label: 'Reel views total' },
  { value: '150+',    label: 'Event registrations' },
  { value: '15–25',   label: 'Inbound DMs from content' },
  { value: '4',       label: 'Products featured/month' },
  { value: '2K+',     label: 'Medium reads total' },
  { value: '30%+',    label: 'LI visitor→follower rate' },
]

// ────────────────────────────────────────────────────────────────────────────
// Pillar 1 — DR (Domain rating + backlinks + SEO)
// ────────────────────────────────────────────────────────────────────────────
const DR_CHANNELS: ChannelCard[] = [
  { name: 'n5deal.com blog', desc: 'On-site SEO articles. Phase 1: KD 10–25, Phase 2: KD 30, Phase 3: KD 35–55. 700–1,200 words, FAQ blocks, internal links, organic CTAs to product.', volume: '15–20 articles/month', pillars: ['dr', 'lg'], status: 'active' },
  { name: 'Medium', desc: 'Thought leadership, M&A insights, case studies. Each links back to n5deal.com core pages. DA ~95 backlinks. Market commentary — not same content as on-site SEO.', volume: '4 articles/month (1/week)', pillars: ['dr', 'aw'], status: 'active' },
  { name: 'PR publications', desc: 'Finextra, The Block, TechCrunch (tier 1), Fintech Futures, AltFi, EU-Startups (tier 2). Pitch context not platform — N5Deal appears inside stories, not as the subject.', volume: '2–4 placements/month · $800–3,000', pillars: ['dr', 'aw'], status: 'light' },
  { name: 'Reddit', desc: 'r/fintech, r/startups, r/entrepreneur, r/payments. Genuine answers with natural links. Reddit threads rank extremely well in Google. Zero promotion.', volume: '3–5 contributions/week', pillars: ['dr', 'aw'], status: 'none' },
  { name: 'Guest posts + partner links', desc: 'Co-authored pieces with legal firms, fintech consultants, M&A advisors. We give visibility — they link back. High-trust DA 30+ backlinks that double as partnership building.', volume: '2–3 links/month', pillars: ['dr'], status: 'light' },
  { name: 'Free platforms', desc: 'Product Hunt, Indie Hackers, Hacker News, Crunchbase, AngelList. Permanent backlinks from high-authority domains. Set up once, update quarterly.', volume: 'Periodic', pillars: ['dr'], status: 'light' },
]

// ────────────────────────────────────────────────────────────────────────────
// Pillar 2 — Awareness (Reach + recognition + new audiences)
// ────────────────────────────────────────────────────────────────────────────
const AW_CHANNELS: ChannelCard[] = [
  { name: 'Instagram reels', desc: 'Highest organic reach potential. Educational explainers ("how to get an EMI license"), vlog/event cuts, podcast clips. Reaches people who\'ve never heard of N5Deal.', volume: '2–3 reels/week', pillars: ['aw'], status: 'active' },
  { name: 'TikTok', desc: 'Same reels, cross-posted. Different audience — younger founders, crypto-native, startup operators. Minimal extra effort: same files, different upload.', volume: '2–3/week (cross-post from IG)', pillars: ['aw'], status: 'none' },
  { name: 'YouTube shorts', desc: 'Same clips, third platform. YouTube\'s algorithm is separate — surfaces to completely different audience than IG or TikTok.', volume: '2–3/week (cross-post)', pillars: ['aw'], status: 'none' },
  { name: 'YouTube full episodes', desc: 'Podcast home. Long-form builds deep trust. 60-min viewer = 10x more likely to remember you. Descriptions link to n5deal.com (DR bonus).', volume: '1 episode / 2 weeks', pillars: ['aw', 'lg'], status: 'active' },
  { name: 'X (Twitter)', desc: 'Fintech Twitter — founders, VCs, regulators. Threads repurposed from Medium articles, hot takes, live event commentary. Threads get indexed by Google.', volume: '2 threads + 3–5 posts/week', pillars: ['aw', 'dr'], status: 'light' },
  { name: 'LinkedIn organic posts', desc: 'Most aligned channel. 34% visitor→follower conversion. Mix of awareness (data, achievements, commentary) and lead gen (CTA posts, listings).', volume: '2 posts/week', pillars: ['aw', 'lg'], status: 'active' },
  { name: 'Online events', desc: 'Jun: Revolut (TOFU) → Jul: Build vs Buy (MOFU) → Aug: What Buyers Value (BOFU) → Sep: California offline (conversion). Each qualifies for the next.', volume: '1/month online + Sep offline', pillars: ['aw', 'lg'], status: 'planned' },
]

// ────────────────────────────────────────────────────────────────────────────
// Pillar 3 — Lead Gen (DMs + sign-ups + deal pipeline)
// ────────────────────────────────────────────────────────────────────────────
const LG_CHANNELS: ChannelCard[] = [
  { name: 'LinkedIn newsletter', desc: '"N5Deal Market Pulse" — weekly/biweekly. Captures emails via LinkedIn\'s native subscription. Condensed Medium article + deal signals + featured listing.', volume: '1/week or biweekly', pillars: ['lg', 'aw'], status: 'none' },
  { name: 'Telegram channel', desc: 'Closest to action. Structured deal feed — listings, market signals, deal context. Growth via parsing (1K–2K/mo), paid placements ($500–1,500), ecosystem integration.', volume: '3–5 listings/week', pillars: ['lg'], status: 'active' },
  { name: 'WhatsApp channel', desc: 'Same function as TG, different audience. Gulf buyers, MENA, older operators. Mirror TG listing content. Low effort — same posts, different platform.', volume: '3–5 listings/week (mirror TG)', pillars: ['lg'], status: 'none' },
  { name: 'Email nurture', desc: 'Fed by: events, LI newsletter, Medium CTAs, website sign-ups. Sequence: welcome → featured listings → market pulse → event invite → deal access.', volume: 'Automated sequence + periodic sends', pillars: ['lg'], status: 'light' },
  { name: 'Website SEO pages', desc: 'Core pages: EMI license, PSP license, buy fintech, sell fintech, banking license, crypto license. Highest-intent leads arrive here via DR work. Conversion-optimised.', volume: 'Optimise ongoing', pillars: ['lg'], status: 'active' },
]

// ────────────────────────────────────────────────────────────────────────────
// Pillar 4 — Product Promotion (Turning products into content that sells)
// ────────────────────────────────────────────────────────────────────────────
type Prio = 'high' | 'mid' | 'low'
interface PromoCard extends ChannelCard { priority: Prio }
const PP_CHANNELS: PromoCard[] = [
  { name: 'Asset ID — "Make a decision in 30 seconds"', desc: 'The core differentiator. Show it working — not explain it. Every listing post is implicitly an Asset ID promotion. Dedicated content shows the before/after: messy broker PDF vs clean Asset ID card.', volume: 'Ongoing via listings + 1 dedicated piece/month', pillars: ['pp', 'lg'], status: 'active', priority: 'high' },
  { name: 'Deal Search / AI Matchmaking — "Tinder for assets"', desc: 'The AI angle makes this the most content-friendly product. Demo reels showing matches in action. "Months of manual scouting → seconds of precision filtering." The free-to-paid funnel (5 free matches → finder\'s fee) is the CTA.', volume: '1 reel + 1 post/month', pillars: ['pp', 'aw'], status: 'planned', priority: 'high' },
  { name: 'License Incorporation — "Fastest jurisdictions"', desc: 'Already the backbone of SEO content ("how to get an EMI license", "PSP license cost"). Product promo = educational reels that naturally end with "we do this for you." Data-driven content on timelines, costs, and passporting hubs.', volume: '2 edu reels + 1 article/month (SEO overlap)', pillars: ['pp', 'dr'], status: 'active', priority: 'high' },
  { name: 'Fintech Architect — "Choose your stage"', desc: 'Founder-led content = the promotion itself. Every podcast episode, event appearance, and thought leadership post is Fintech Architect marketing. "Building with straws vs bricks." The tiers (Launch → Exit) become carousel content showing "which stage are you?"', volume: 'Woven into podcast + events + 1 carousel/month', pillars: ['pp', 'aw'], status: 'planned', priority: 'high' },
  { name: 'Outreach Package + Investment Outreach', desc: 'High-ticket B2B service. Not promoted with reels — promoted through case studies, results posts ("we connected X sellers with Y buyers in Z weeks"), and DM-driven LinkedIn posts. Event recap posts naturally funnel here.', volume: '1–2 case study posts/month', pillars: ['pp', 'lg'], status: 'planned', priority: 'high' },
  { name: 'Valuation Uplift — "Don\'t sell a shell"', desc: '"Static Asset vs Operating Asset" — the before/after is inherently visual. Reels showing: empty license = €1M, add card program + FX engine + KYC = €5M. Directly ties to Fintech Builder and License Incorporation. "Maximise Your Multiple."', volume: '1 reel + 1 post/month', pillars: ['pp', 'aw', 'lg'], status: 'planned', priority: 'mid' },
  { name: 'Get Free Valuation — top-of-funnel lead magnet', desc: '"Know Your Worth" — the easiest CTA to put at the end of any content piece. Every article, every post about exits or selling can end with "get your free valuation." This is the lead capture entry point for sellers. Upsells to Valuation Uplift and Asset ID.', volume: 'CTA in 50%+ of seller-facing content', pillars: ['pp', 'lg'], status: 'light', priority: 'mid' },
  { name: 'Data Room (VDR) — "The Fintech Vault"', desc: 'SEO-driven promotion. Articles about "M&A due diligence checklist" and "data room setup" from the linkbuilding plan naturally promote this. "Compliance-first Data Room" positioning differentiates from generic VDRs.', volume: 'Part of SEO content strategy (on-site articles)', pillars: ['pp', 'dr'], status: 'active', priority: 'mid' },
  { name: 'Participant Verification (KYF) — "The Gold Standard"', desc: 'Trust differentiator. Best promoted by contrasting N5Deal against Telegram groups and unverified broker lists. Every time the market has a scam or fraud story, KYF becomes relevant content.', volume: 'Reactive — tie to market news + 1 post/quarter', pillars: ['pp', 'aw'], status: 'planned', priority: 'mid' },
]

// ────────────────────────────────────────────────────────────────────────────
// Priority launch order for new channels
// ────────────────────────────────────────────────────────────────────────────
const LAUNCH_ORDER: { n: number; name: string; desc: string; effort: string }[] = [
  { n: 1, name: 'TikTok + YT Shorts',    desc: 'zero extra content, just upload same reels. Free reach.',           effort: '5 min/day' },
  { n: 2, name: 'LinkedIn Newsletter',   desc: 'set up once, feeds from existing content. Owned audience.',         effort: '2 hr/week' },
  { n: 3, name: 'WhatsApp Channel',      desc: 'mirror TG listings. 30 min setup. Gulf/MENA reach.',                effort: '5 min/day' },
  { n: 4, name: 'X thread strategy',     desc: 'repurpose Medium articles into threads. High fintech reach.',       effort: '1 hr/week' },
  { n: 5, name: 'Reddit',                desc: 'genuine answers in r/fintech, r/startups. Needs authenticity.',     effort: '30 min/day' },
  { n: 6, name: 'Guest posts',           desc: 'systematise partner link exchanges. Highest DR per link.',          effort: '2–3 hr/week' },
  { n: 7, name: 'Email nurture',         desc: 'build sequence once, runs automatically.',                          effort: 'One-time setup' },
]

// ────────────────────────────────────────────────────────────────────────────
// Products & services
// ────────────────────────────────────────────────────────────────────────────
interface ProductCard { num: string; name: string; desc: string; priority: Prio; status?: Status; statusLabel?: string; notes?: string }
const PRODUCTS_HIGH: ProductCard[] = [
  { num: '0.1', name: 'Listing Assets',                       desc: 'The foundation — listing regulated financial assets for sale. Commission-based (success fee on closed deals). Everything else on the platform is built on top of this.', priority: 'high', status: 'active', statusLabel: 'Live' },
  { num: '1',   name: 'Asset ID',                             desc: 'Digital passport for financial assets — standardises complex data, decision-ready in 30 seconds. Pro and light versions. Subscription tiers for creation (pricing under review).', priority: 'high', status: 'active', statusLabel: 'Live', notes: 'ICP: Sellers, buyers, brokers, M&A teams. Will add investment, multi-licenses (holdings), state-specific. Need light version for clients/partners with share options. Automate L2 detail (teaser auto-populating). Buyer package: retainer for asset search + KYF + predictive valuation.' },
  { num: '0.2', name: 'License Incorporation',                desc: 'Getting licenses from scratch (EMI, CASP, VASP, etc.) in 36+ regions. Fee by license type and jurisdiction via partner network. Funnel into Fintech Builder.', priority: 'high', status: 'light', statusLabel: 'Manual', notes: 'ICP: Startups, businesses expanding or seeking valuation uplift. Marketing: "Fastest Jurisdictions" / "Passporting Hubs." Goes hand-in-hand with Fintech Builder. Partners take their cut + N5Deal gets monthly support payments.' },
  { num: '4',   name: 'Deal Search',                          desc: 'Smart matching based on jurisdiction, license type, price range, preferences — with assigned "match values." "Tinder for assets" / "AI Matchmaking." Limited free matches → finder\'s fee.', priority: 'high', status: 'light', statusLabel: 'Needs checking', notes: 'ICP: All buyer types, brokers, investors, family offices, M&A teams. Marketing: "Replace months of manual scouting with seconds of precision filtering." Multiple monetisation options under review.' },
  { num: '8',   name: 'Fintech Architect',                    desc: 'What founders offer. Modular consulting by stage: market entry → growth → M&A roll-up → IPO/exit. Advisory, legal/regulatory, modelling, partnerships, PM, bank intros. Alt name: Fintech Supporter.', priority: 'high', status: 'light', statusLabel: 'Manual', notes: '9 tiers: Launch, Accelerate, Dominate, Scale, Transform, Conquer, Consolidate, Consolidate+, Exit. Monthly retainers (3-month min) + success fees. Can market together or separately. 1-month trial possible.' },
  { num: '11/12', name: 'Investment + Investment Outreach',   desc: 'Investment services and systematic outreach connecting investors with opportunities. Monthly retainer, minimum commitment. Same priority as outreach package.', priority: 'high' },
]
const PRODUCTS_MID: ProductCard[] = [
  { num: '0.3', name: 'Fintech Builder (Constructor)',        desc: 'Build from scratch or add to existing: licenses, team, tech stack, regulatory framework. All building blocks in one place — bank connections, software, staff, licenses. "Building with straws vs bricks."', priority: 'mid', status: 'active', statusLabel: 'On website', notes: 'ICP: Startups, businesses looking for expansion options. Marketing: Skip 80% of mistakes by building with experts. Compound fees: license + ops setup + optional founder assistance.' },
  { num: '0.4', name: 'User Cabinet (Platform)',              desc: 'Centralised workspace: negotiations, deal stages, comms, docs, transaction progress. "M&A without Telegram chaos." / "Track deals from LOI to Closing."', priority: 'mid', status: 'light', statusLabel: 'In progress', notes: 'No monetisation yet. Potential: white-label/SaaS, storage fees, seat-based. "The Audit Shield" — prevents document leakage and deal-killer errors.' },
  { num: '2',   name: 'Deal Flow Manager',                    desc: 'CRM/Dashboard for all deal stages. Customisable flow, secure disclosure. "Pipeline Pro" / "M&A without the Mess." From Excel chaos to bank-grade interface.', priority: 'mid', status: 'light', statusLabel: 'Needs testing' },
  { num: '3',   name: 'Data Room (VDR)',                      desc: '"The Fintech Vault." Secure storage with fintech-specific folders. Built into platform; also sold separately to brokers, VC founders, audit firms. Per-deal and package pricing (under review).', priority: 'mid', status: 'active', statusLabel: 'Complete' },
  { num: '7',   name: 'Get Free Valuation',                   desc: 'Lead magnet calculator: multiplier analysis + market comparison. Free (captures contact data) — upsells to Valuation Uplift and Asset ID. "Know Your Worth."', priority: 'mid', status: 'light', statusLabel: 'Formula exists', notes: 'Formula not fully incorporated. Free + Pro paid option (pricing needs BA check). First step for any founder considering exit in 12 months.' },
  { num: '9',   name: 'Participant Verification (KYF)',       desc: '"The Gold Standard." Multi-level verification of identity, capital (buyers), asset ownership (sellers). Contrasts N5Deal against noisy TG groups and unverified broker lists.', priority: 'mid', status: 'light', statusLabel: 'In progress' },
  { num: '10',  name: 'Valuation Uplift',                     desc: '"Maximise Your Multiple." Add licenses, bank accounts, rails, software, staff — AI suggests best add-ons. Static Asset → Operating Asset. "Don\'t sell a shell — sell an operating ecosystem."', priority: 'mid', status: 'light', statusLabel: 'Partial', notes: 'ICP: Sellers pre-exit + buyers expanding/seeking compliance. Smart algorithm: best options / what you\'re missing / where you\'re NOT making money.' },
  { num: '13',  name: 'License Maintenance',                  desc: 'Planned: updates, reports, audits — service charge + commission. Keeps licenses compliant.', priority: 'mid', status: 'none', statusLabel: 'Planned' },
  { num: '14',  name: 'Outstaffing',                          desc: 'Sourcing C-level people (one-time commission) or nominees with ongoing % (CEO, C-level, AML officers, etc.).', priority: 'mid' },
  { num: '15',  name: 'Education',                            desc: 'Staff education on payments, banking, compliance, regulatory frameworks.', priority: 'mid' },
]
const PRODUCTS_LOW: ProductCard[] = [
  { num: '—', name: 'Platform Promotions',          desc: 'Monthly promotion packages for sellers/partners on the platform.', priority: 'low' },
  { num: '—', name: 'AI Deal Match',                desc: 'Sub-product of Deal Search. Limited free deals/year → subscription-based. Packages for VCs and investors.', priority: 'low' },
  { num: '—', name: 'Emergency Services ("Fintech Ambulance")', desc: 'Crisis help: key person death, blocked accounts, revoked licenses, cybersecurity, stolen money. Subscription-based.', priority: 'low' },
  { num: '—', name: 'Roll-up Advisory',             desc: 'Best deal options, story-building, educating owners. Retainer + KPI from valuation uplift. Uses Tracxn for BA trends.', priority: 'low' },
  { num: '—', name: 'Exit Strategy / Pre-IPO',      desc: 'Bespoke advisory for largest transactions. Large retainers + % from valuation rise KPI.', priority: 'low' },
  { num: '—', name: 'Jurisdiction Portal / Reports', desc: 'Searchable database: licensing requirements, timelines, costs for 36+ countries. Reports, portal, or gated content. Subscription option. Funnels into Fintech Builder.', priority: 'low' },
]

// ────────────────────────────────────────────────────────────────────────────
// View
// ────────────────────────────────────────────────────────────────────────────
export function FourPathView() {
  const [filter, setFilter] = useState<'all' | Pillar>('all')
  const isOn = (p: Pillar[]) => filter === 'all' || p.includes(filter)

  return (
    <div className="space-y-8">
      {/* Intro */}
      <div>
        <h2 className="text-lg font-bold tracking-tight mb-1">Four-path channel strategy</h2>
        <p className="text-sm text-muted-foreground">Every channel has one primary job. Some support a second path. None do all four equally.</p>
      </div>

      {/* KPI targets */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {TARGETS.map((t) => (
          <div key={t.label} className="bg-card border border-border rounded-lg p-3.5">
            <div className="text-xl font-bold tabular-nums">{t.value}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mt-0.5 leading-tight">{t.label}</div>
          </div>
        ))}
      </div>

      {/* Pillar filter */}
      <div className="flex flex-wrap gap-1.5">
        <FilterPill active={filter === 'all'} onClick={() => setFilter('all')}>All channels</FilterPill>
        {(['dr', 'aw', 'lg', 'pp'] as Pillar[]).map((p) => {
          const m = PILLAR_META[p]
          return (
            <FilterPill key={p} active={filter === p} onClick={() => setFilter(p)} accent={m.color}>
              {m.label}
            </FilterPill>
          )
        })}
      </div>

      {/* Pillars */}
      <PillarSection title="Primary: DR" sub="Domain rating + backlinks + SEO" pillar="dr" channels={DR_CHANNELS} isOn={isOn} />
      <PillarSection title="Primary: Awareness" sub="Reach + recognition + new audiences" pillar="aw" channels={AW_CHANNELS} isOn={isOn} />
      <PillarSection title="Primary: Lead gen" sub="DMs + sign-ups + deal pipeline" pillar="lg" channels={LG_CHANNELS} isOn={isOn} />
      <PromotionSection channels={PP_CHANNELS} isOn={isOn} />

      {/* Launch order */}
      <section className="bg-card border border-border rounded-lg p-5">
        <h3 className="font-semibold mb-3">Priority launch order — new channels</h3>
        <ol className="space-y-1.5">
          {LAUNCH_ORDER.map((l) => (
            <li key={l.n} className="grid items-center gap-3 text-sm" style={{ gridTemplateColumns: '24px 1fr auto' }}>
              <span className="inline-flex w-6 h-6 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">{l.n}</span>
              <span><span className="font-semibold text-foreground">{l.name}</span> <span className="text-muted-foreground">— {l.desc}</span></span>
              <span className="text-[11px] text-muted-foreground tabular-nums">{l.effort}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Products & services */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight mb-1">Products &amp; services — what we&apos;re actually selling</h2>
          <p className="text-sm text-muted-foreground">Ordered by marketing priority. Pricing is under review and not included.</p>
        </div>

        <ProductGroup title="High priority"   sub="Core revenue drivers — market first" prio="high" items={PRODUCTS_HIGH} />
        <ProductGroup title="Middle priority" sub="Platform features + services — build alongside core" prio="mid" items={PRODUCTS_MID} />
        <ProductGroup title="Low priority"    sub="Future roadmap + niche services" prio="low" items={PRODUCTS_LOW} />
      </section>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────────
function FilterPill({ children, active, onClick, accent }: { children: React.ReactNode; active: boolean; onClick: () => void; accent?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-1 text-xs font-semibold rounded-full border transition-colors',
        active ? 'bg-secondary text-foreground' : 'bg-card text-muted-foreground hover:text-foreground',
      )}
      style={active && accent ? { borderColor: accent, color: accent } : { borderColor: 'hsl(var(--border))' }}
    >
      {children}
    </button>
  )
}

function PillarHeader({ pillar, title, sub }: { pillar: Pillar; title: string; sub: string }) {
  const m = PILLAR_META[pillar]
  return (
    <header className="flex items-center gap-2 flex-wrap">
      <span className={cn('text-[10px] uppercase tracking-widest font-bold px-2.5 py-1 rounded', m.chip)}>{title}</span>
      <span className="text-xs text-muted-foreground">{sub}</span>
    </header>
  )
}

function ChannelCardItem({ ch, dim }: { ch: ChannelCard; dim?: boolean }) {
  const status = STATUS_META[ch.status]
  return (
    <div className={cn('bg-card border border-border rounded-lg p-3.5 grid gap-2', dim && 'opacity-30')} style={{ gridTemplateColumns: '1fr auto' }}>
      <div>
        <div className="font-semibold text-sm leading-tight">{ch.name}</div>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{ch.desc}</p>
        <p className="text-[11px] text-muted-foreground/80 mt-1.5 italic">{ch.volume}</p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <div className="flex flex-wrap gap-1 justify-end">
          {ch.pillars.map((p) => (
            <span key={p} className={cn('text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded', PILLAR_META[p].chip)}>
              {PILLAR_META[p].label}
            </span>
          ))}
        </div>
        <div className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className={cn('w-1.5 h-1.5 rounded-full', status.dot)} />
          {status.label}
        </div>
      </div>
    </div>
  )
}

function PillarSection({ title, sub, pillar, channels, isOn }: { title: string; sub: string; pillar: Pillar; channels: ChannelCard[]; isOn: (p: Pillar[]) => boolean }) {
  return (
    <section className="space-y-3">
      <PillarHeader pillar={pillar} title={title} sub={sub} />
      <div className="space-y-1.5">
        {channels.map((c) => <ChannelCardItem key={c.name} ch={c} dim={!isOn(c.pillars)} />)}
      </div>
    </section>
  )
}

const PRIO_META: Record<Prio, { label: string; chip: string }> = {
  high: { label: 'High', chip: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200' },
  mid:  { label: 'Mid',  chip: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200' },
  low:  { label: 'Low',  chip: 'bg-muted text-muted-foreground' },
}

function PromotionSection({ channels, isOn }: { channels: PromoCard[]; isOn: (p: Pillar[]) => boolean }) {
  return (
    <section className="space-y-3">
      <PillarHeader pillar="pp" title="Path 4: Product promotion" sub="Turning products into content that sells" />
      <div className="space-y-1.5">
        {channels.map((c) => (
          <div key={c.name} className={cn('bg-card border border-border rounded-lg p-3.5 grid gap-2', !isOn(c.pillars) && 'opacity-30')} style={{ gridTemplateColumns: '1fr auto' }}>
            <div>
              <div className="font-semibold text-sm leading-tight">{c.name}</div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{c.desc}</p>
              <p className="text-[11px] text-muted-foreground/80 mt-1.5 italic">{c.volume}</p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <div className="flex flex-wrap gap-1 justify-end">
                {c.pillars.map((p) => (
                  <span key={p} className={cn('text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded', PILLAR_META[p].chip)}>
                    {PILLAR_META[p].label}
                  </span>
                ))}
              </div>
              <span className={cn('text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded', PRIO_META[c.priority].chip)}>{PRIO_META[c.priority].label}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function ProductGroup({ title, sub, prio, items }: { title: string; sub: string; prio: Prio; items: ProductCard[] }) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <div className="space-y-2">
      <header className="flex items-center gap-2 flex-wrap">
        <span className={cn('text-[10px] uppercase tracking-widest font-bold px-2.5 py-1 rounded', PRIO_META[prio].chip)}>{title}</span>
        <span className="text-xs text-muted-foreground">{sub}</span>
      </header>
      <div className="space-y-1.5">
        {items.map((p) => {
          const opened = open === p.name
          const hasNotes = !!p.notes
          return (
            <div key={p.name} className="bg-card border border-border rounded-lg p-3.5">
              <div className="grid gap-2" style={{ gridTemplateColumns: '1fr auto' }}>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">{p.num}</span>
                    <div className="font-semibold text-sm">{p.name}</div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{p.desc}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={cn('text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded', PRIO_META[p.priority].chip)}>{PRIO_META[p.priority].label}</span>
                  {p.status ? (
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                      <span className={cn('w-1.5 h-1.5 rounded-full', STATUS_META[p.status].dot)} />
                      {p.statusLabel ?? STATUS_META[p.status].label}
                    </span>
                  ) : null}
                </div>
              </div>
              {hasNotes ? (
                <>
                  <button
                    type="button"
                    onClick={() => setOpen(opened ? null : p.name)}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    <ChevronDown className={cn('h-3 w-3 transition-transform', opened && 'rotate-180')} />
                    {opened ? 'Hide notes' : 'Details & notes'}
                  </button>
                  {opened ? (
                    <div className="mt-2 p-2.5 bg-amber-50 dark:bg-amber-950/30 border-l-2 border-amber-500 rounded text-xs leading-relaxed text-amber-900 dark:text-amber-200">
                      {p.notes}
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
