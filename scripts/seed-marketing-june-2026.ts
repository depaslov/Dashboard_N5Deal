// Seeds the Marketing OS calendar with the June 2026 content plan that
// previously lived as JS migration blocks (`_juneN5PlanV1`, `_juneIhorPlanV1`,
// `_juneM2020PostsV1`, `_juneDenysPlanV1`) in the Alina Marketing OS prototype.
//
// Idempotent: skips any post whose (date, title) already exists in the DB.
//
// Usage:
//   npx tsx --require dotenv/config scripts/seed-marketing-june-2026.ts
// Run a second time against Neon:
//   DATABASE_URL="<neon>" npx tsx scripts/seed-marketing-june-2026.ts

import { prisma } from '../lib/db'

const PROJECT_ID = process.env.PROJECT_ID || 'seed-project-n5deal'

// UTC noon avoids timezone drift moving a post into the wrong day.
const D = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 12, 0, 0))

type Acc = 'n5' | 'bk' | 'ih' | 'db'
interface PostSeed {
  acc: Acc
  type: string
  platforms: string[]
  title: string
  content?: string
  date: Date
}

// ─────────────────────────────────────────────────────────────────────────────
// N5DEAL — Tracks A (long-form), B (vertical video), C (Telegram listings),
// Podcast (Ep 4 Trust/Ego), Event (How Revolut Became Revolut).  53 items.
// ─────────────────────────────────────────────────────────────────────────────
const N5_JUNE: PostSeed[] = [
  { acc:'n5', type:'Article', platforms:['Medium'], title:'What US Buyers Actually Want from EU Licenses — Notes from SF and LA', content:'[Track A · Medium] Mon 1. Firsthand signals from SF/LA meetings, what mandates look like, which license types US capital is targeting. CTA → buyer page.', date: D(2026,6,1) },
  { acc:'n5', type:'Company Post', platforms:['LI Company','X/Twitter','Instagram'], title:'End-of-May milestones: 5–6 new investors, 5 new assets, new partners, US trip done', content:'[Track A · Achievement] Wed 3. Photo-based, building in public, LinkedIn primary. No CTA — credibility play.', date: D(2026,6,3) },
  { acc:'n5', type:'Company Post', platforms:['LI Company','X/Twitter'], title:'The valuation gap between US and EU fintech — what we heard on the ground', content:'[Track A · Post] Fri 6. Sharp insight from SF conversations, 400–600 words. CTA → DM EXIT.', date: D(2026,6,6) },
  { acc:'n5', type:'Article', platforms:['Medium'], title:'Q2 2026 Fintech M&A Pulse: What Moved, What Stalled, What Surprised Us', content:'[Track A · Medium] Mon 8. 1,500–2,000 words. The centrepiece authority piece for June. License demand trends, geo shifts, MiCA impact, BaaS consolidation, deal velocity. CTA → marketplace.', date: D(2026,6,8) },
  { acc:'n5', type:'Carousel', platforms:['LI Company','Instagram'], title:'Q2 data carousel — 5–6 key numbers from the Pulse article', content:'[Track A · Post] Wed 10. Visual-first shareable carousel. CTA → DM REPORT.', date: D(2026,6,10) },
  { acc:'n5', type:'Carousel', platforms:['LI Company','Instagram'], title:'H1 achievement recap — platform growth, events, countries, deal flow', content:'[Track A · Post] Sat 14. Infographic carousel (MWC, START, TechChill, Tech.eu, SF, LA). CTA → Follow TG channel.', date: D(2026,6,14) },
  { acc:'n5', type:'Article', platforms:['Medium'], title:'How Revolut Got 30+ Banking Licenses — And Why Most Fintechs Should Just Buy One', content:'[Track A · Medium] Tue 17. Revolut case study adapted for M&A audience, ties licensing to build-vs-buy thesis. CTA → event registration.', date: D(2026,6,17) },
  { acc:'n5', type:'Company Post', platforms:['LI Company','X/Twitter','Instagram'], title:'Event announce — How Revolut Became Revolut (online event)', content:'[Track A · Post] Thu 19. Guest tease, date, what we\'ll cover, why it matters for founders and buyers. CTA → Register.', date: D(2026,6,19) },
  { acc:'n5', type:'Company Post', platforms:['LI Company','X/Twitter','Instagram'], title:'Guest reveal + countdown: 3 days. The $75B machine. Register.', content:'[Track A · Final push] Sat 21. Full guest intro (7+ years at Revolut growth), stakes clear. CTA → Register.', date: D(2026,6,21) },
  { acc:'n5', type:'Company Post', platforms:['LI Company','X/Twitter','Instagram'], title:'Last call — How Revolut Became Revolut · Live tomorrow', content:'[Event · Last call] Mon 22. Email blast + all channels. Final registration push.', date: D(2026,6,22) },
  { acc:'n5', type:'Article', platforms:['Medium'], title:'Crypto vs Stablecoins: Where the Real M&A Value Is in 2026', content:'[Track A · Medium] Mon 22. Stablecoin infrastructure becoming the target, tokenised deposits vs stablecoins, who gets acquired. Ties to US vs World thesis. CTA → crypto listings.', date: D(2026,6,22) },
  { acc:'n5', type:'Company Post', platforms:['LI Company','X/Twitter'], title:'Event recap: 5 things from the person who built Revolut\'s growth engine', content:'[Track A · Post] Thu 26. 5 sharp takeaways, 2–3 sentences each. CTA → recording + July event tease.', date: D(2026,6,26) },
  { acc:'n5', type:'Company Post', platforms:['LI Company','X/Twitter'], title:'What Revolut\'s playbook actually means for fintech M&A', content:'[Track A · Post] Sat 28. Build vs Buy bridge piece. 99% of operators should buy not build. CTA → That\'s literally July\'s event topic.', date: D(2026,6,28) },
  { acc:'n5', type:'Reel', platforms:['Instagram','LI Company','TikTok','YouTube'], title:'SF/LA vlog: What US buyers are really asking about EU licenses', content:'[Track B · Vlog] Mon 1. 45–60s raw footage, text overlays. Show, don\'t tell.', date: D(2026,6,1) },
  { acc:'n5', type:'Reel', platforms:['Instagram','LI Company','TikTok','YouTube'], title:'How to get an EMI license in 30 days — buy vs build', content:'[Track B · Edu] Wed 3. 30–45s, text on screen, step breakdown.', date: D(2026,6,3) },
  { acc:'n5', type:'Reel', platforms:['Instagram','LI Company','TikTok','YouTube'], title:'The real conversations at Startup Grind SF — not the panels', content:'[Track B · Vlog] Fri 6. 30–45s, b-roll from event + to-camera. Sets up Q2 analysis. CTA: Market data drops Monday.', date: D(2026,6,6) },
  { acc:'n5', type:'Reel', platforms:['Instagram','LI Company','TikTok','YouTube'], title:'MiCA is live: 3 things every crypto founder needs to know', content:'[Track B · Edu] Mon 8. 45s, text on screen, numbered.', date: D(2026,6,8) },
  { acc:'n5', type:'Reel', platforms:['Instagram','LI Company','TikTok','YouTube'], title:'PSP vs EMI vs BaaS — which license do you actually need?', content:'[Track B · Edu] Wed 10. 40s, comparison format, simple visuals.', date: D(2026,6,10) },
  { acc:'n5', type:'Reel', platforms:['Instagram','LI Company','TikTok','YouTube'], title:'Ep 4 teaser #1 — one sharp quote, 20s audiogram', content:'[Track B · Pod clip · Ep 4 warm-up] Fri 13. "Trust, Ego & the Deals Nobody Talks About" — no date yet, just intrigue.', date: D(2026,6,13) },
  { acc:'n5', type:'Reel', platforms:['Instagram','LI Company','TikTok','YouTube'], title:'UK crypto regulation 2027: the 18-month countdown starts now', content:'[Track B · Edu] Mon 15. 45s, countdown visual, urgency framing.', date: D(2026,6,15) },
  { acc:'n5', type:'Reel', platforms:['Instagram','LI Company','TikTok','YouTube'], title:'Revolut stats reel — $75B. 68M users. 30+ licenses. Zero shortcuts.', content:'[Track B · Event] Wed 17. 30s kinetic text, fast cuts. CTA → event registration.', date: D(2026,6,17) },
  { acc:'n5', type:'Reel', platforms:['Instagram','LI Company','TikTok','YouTube'], title:'Ep 4 teaser #2 — Have you ever closed a deal just because you liked the person?', content:'[Track B · Pod clip · Ep 4 warm-up] Thu 19. 15–20s, different angle from #1.', date: D(2026,6,19) },
  { acc:'n5', type:'Reel', platforms:['Instagram','LI Company','TikTok','YouTube'], title:'What is RWA tokenisation? Property, gold, funds — tokens in 45 seconds', content:'[Track B · Edu] Sat 21. 45s, simple visuals, explainer.', date: D(2026,6,21) },
  { acc:'n5', type:'Reel', platforms:['Instagram','LI Company','TikTok','YouTube'], title:'VASP registration ≠ license — the difference that kills deals', content:'[Track B · Edu] Mon 22. 30s, myth-busting format.', date: D(2026,6,22) },
  { acc:'n5', type:'Reel', platforms:['Instagram','LI Company','TikTok'], title:'Pre-event hype — Going live in 2 hours · day-of energy', content:'[Track B · Event hype] Wed 25. 15s raw, to-camera.', date: D(2026,6,25) },
  { acc:'n5', type:'Reel', platforms:['Instagram','LI Company','TikTok','YouTube'], title:'Best 45–60s moment from the Revolut live event', content:'[Track B · Event] Fri 27. Cut from recording. YT full + IG/LI/TikTok clip.', date: D(2026,6,27) },
  { acc:'n5', type:'Reel', platforms:['Instagram','LI Company','TikTok','YouTube'], title:'Ep 4 clip #3 — standalone insight on banking rails vs licenses', content:'[Track B · Pod clip] Sat 28. 20–30s.', date: D(2026,6,28) },
  { acc:'n5', type:'Reel', platforms:['Instagram','LI Company','TikTok','YouTube'], title:'Ep 5 warm-up: When the System Works Against You', content:'[Track B · Pod clip · Ep 5 warm-up] Mon 29. 15–20s. Season 2 teaser energy: regulation, compliance, and truth.', date: D(2026,6,29) },
  { acc:'n5', type:'Reel', platforms:['Instagram','LI Company','TikTok','YouTube'], title:'Stablecoins vs tokenised deposits: who wins?', content:'[Track B · Edu] Tue 30. 40s, vs format.', date: D(2026,6,30) },
  { acc:'n5', type:'Company Post', platforms:['Telegram','LI Company'], title:'🏷️ EMI License — active, client base, EU passporting — 🇱🇹 Lithuania', content:'[Track C · Listing] Geo: 🇱🇹 Lithuania. Cross-posted to LinkedIn.', date: D(2026,6,1) },
  { acc:'n5', type:'Company Post', platforms:['Telegram'], title:'🏷️ PSP License — FCA-regulated, banking rails intact — 🇬🇧 UK (FCA)', content:'[Track C · Listing] Geo: 🇬🇧 UK (FCA).', date: D(2026,6,2) },
  { acc:'n5', type:'Company Post', platforms:['Telegram'], title:'🏷️ Crypto Exchange — VARA compliant, operational — 🇦🇪 Dubai', content:'[Track C · Listing] Geo: 🇦🇪 Dubai.', date: D(2026,6,3) },
  { acc:'n5', type:'Company Post', platforms:['Telegram','LI Company'], title:'🏷️ PI License — post-Brexit, active clients — 🇮🇪 Ireland (CBI)', content:'[Track C · Listing] Geo: 🇮🇪 Ireland (CBI). Cross-posted to LinkedIn.', date: D(2026,6,6) },
  { acc:'n5', type:'Company Post', platforms:['Telegram'], title:'🏷️ FINMA Crypto License — premium jurisdiction — 🇨🇭 Switzerland', content:'[Track C · Listing] Geo: 🇨🇭 Switzerland.', date: D(2026,6,8) },
  { acc:'n5', type:'Company Post', platforms:['Telegram','LI Company'], title:'🏷️ EMI License — KNF regulated, undervalued — 🇵🇱 Poland', content:'[Track C · Listing] Geo: 🇵🇱 Poland. Cross-posted to LinkedIn.', date: D(2026,6,9) },
  { acc:'n5', type:'Company Post', platforms:['Telegram'], title:'🏷️ MSB License — cross-border payments gateway — 🇨🇦 Canada', content:'[Track C · Listing] Geo: 🇨🇦 Canada.', date: D(2026,6,10) },
  { acc:'n5', type:'Company Post', platforms:['Telegram'], title:'🏷️ BaaS-enabled EMI — tech stack included — 🇱🇹 Lithuania', content:'[Track C · Listing] Geo: 🇱🇹 Lithuania.', date: D(2026,6,11) },
  { acc:'n5', type:'Company Post', platforms:['Telegram','LI Company'], title:'🏷️ ADGM Crypto License — Abu Dhabi — 🇦🇪 UAE', content:'[Track C · Listing] Geo: 🇦🇪 UAE. Cross-posted to LinkedIn.', date: D(2026,6,13) },
  { acc:'n5', type:'Company Post', platforms:['Telegram','LI Company'], title:'🏷️ Banking License — small bank, full EU passport — 🇲🇹 Malta (MFSA)', content:'[Track C · Listing] Geo: 🇲🇹 Malta (MFSA). Cross-posted to LinkedIn.', date: D(2026,6,15) },
  { acc:'n5', type:'Company Post', platforms:['Telegram'], title:'🏷️ PSP — active, PCI DSS certified — 🇪🇺 EU', content:'[Track C · Listing] Geo: 🇪🇺 EU.', date: D(2026,6,16) },
  { acc:'n5', type:'Company Post', platforms:['Telegram'], title:'🏷️ EMI License — DNB regulated, premium — 🇳🇱 Netherlands', content:'[Track C · Listing] Geo: 🇳🇱 Netherlands.', date: D(2026,6,17) },
  { acc:'n5', type:'Company Post', platforms:['Telegram','LI Company'], title:'🏷️ Crypto VASP — MiCA-ready, restructured — 🇪🇪 Estonia', content:'[Track C · Listing] Geo: 🇪🇪 Estonia. Cross-posted to LinkedIn.', date: D(2026,6,20) },
  { acc:'n5', type:'Company Post', platforms:['Telegram'], title:'🏷️ BNPL Portfolio — pre-regulation, client base — 🇬🇧 UK', content:'[Track C · Listing] Geo: 🇬🇧 UK.', date: D(2026,6,21) },
  { acc:'n5', type:'Company Post', platforms:['Telegram'], title:'🏷️ PI License — FCA, post-Brexit — 🇬🇧 UK (FCA)', content:'[Track C · Listing] Geo: 🇬🇧 UK (FCA).', date: D(2026,6,22) },
  { acc:'n5', type:'Company Post', platforms:['Telegram','LI Company'], title:'🏷️ Stablecoin Platform — licensed, operational — 🇪🇺 EU (MiCA)', content:'[Track C · Listing] Geo: 🇪🇺 EU (MiCA). Cross-posted to LinkedIn.', date: D(2026,6,23) },
  { acc:'n5', type:'Company Post', platforms:['Telegram'], title:'🏷️ EMI License — clean history, ready for acquisition — 🇨🇾 Cyprus', content:'[Track C · Listing] Geo: 🇨🇾 Cyprus.', date: D(2026,6,25) },
  { acc:'n5', type:'Company Post', platforms:['Telegram'], title:'🏷️ Crypto Custody License — institutional grade — 🇨🇭 Switzerland', content:'[Track C · Listing] Geo: 🇨🇭 Switzerland.', date: D(2026,6,26) },
  { acc:'n5', type:'Company Post', platforms:['Telegram','LI Company'], title:'🏷️ Neobank Shell — banking license, no operations — 🇱🇹 Lithuania', content:'[Track C · Listing] Geo: 🇱🇹 Lithuania. Cross-posted to LinkedIn.', date: D(2026,6,27) },
  { acc:'n5', type:'Company Post', platforms:['Telegram'], title:'🏷️ SAMA Licensed Fintech — payments, operational — 🇸🇦 Saudi Arabia', content:'[Track C · Listing] Geo: 🇸🇦 Saudi Arabia.', date: D(2026,6,28) },
  { acc:'n5', type:'Reel', platforms:['YouTube','Instagram','LI Company','TikTok'], title:'🎙 Ep 4 FULL DROP — Trust, Ego & the Deals Nobody Talks About', content:'[Podcast · Episode drop] Mon 23. Full episode on YouTube, Spotify, Apple. When business becomes personal — and why it can kill a deal. 3 clips queued for Mon/Wed/Fri.', date: D(2026,6,23) },
  { acc:'n5', type:'Reel', platforms:['Instagram','LI Company','TikTok','YouTube'], title:'Ep 4 clip #1 — trust vs valuation', content:'[Podcast · Afterburn clip] Wed 25. Pulled from full episode.', date: D(2026,6,25) },
  { acc:'n5', type:'Reel', platforms:['Instagram','LI Company','TikTok','YouTube'], title:'Ep 4 clip #2 — banking rails vs licenses', content:'[Podcast · Afterburn clip] Fri 27. Pulled from full episode.', date: D(2026,6,27) },
  { acc:'n5', type:'Company Post', platforms:['LI Company','YouTube','Instagram'], title:'🔴 LIVE — How Revolut Became Revolut · 60–90 min', content:'[Event · LIVE] Wed 25. Wedge → machine → mistakes → licensing → Q&A. Announce July event at close.', date: D(2026,6,25) },
]

// ─────────────────────────────────────────────────────────────────────────────
// N5DEAL — Money 20/20 Amsterdam Day 1-3 (extra 3 items).
// ─────────────────────────────────────────────────────────────────────────────
const N5_M2020: PostSeed[] = [
  { acc:'n5', type:'Company Post', platforms:['LI Company','Instagram','X/Twitter'], title:'N5Deal at Money 20/20 Amsterdam this week. If you\'re hunting EMI, PSP, or crypto licenses and you\'re at the conference — let\'s talk. DM to find us on the floor.', content:'[Money 20/20] Day 1, 10am. Platform meet-up post. Drives floor conversations and DMs from buyers attending. LI + IG.', date: D(2026,6,1) },
  { acc:'n5', type:'Company Post', platforms:['LI Company','Instagram','X/Twitter'], title:'Day 2 at Money 20/20 — most-asked questions from buyers we met today: 1) Where to find clean MiCA-ready crypto assets? 2) Are there any UK EMIs with banking rails intact? 3) Who\'s selling in Lithuania right now? All three are on the platform.', content:'[Money 20/20] Day 2, 4pm. Real buyer questions from floor conversations — direct CTA to listings. Specific and credible.', date: D(2026,6,2) },
  { acc:'n5', type:'Company Post', platforms:['LI Company','Instagram','X/Twitter'], title:'Money 20/20 Amsterdam — 3 days, 27 buyer conversations, 4 new mandates already in the pipeline. The European fintech M&A market is louder than ever. Listings update coming Monday.', content:'[Money 20/20 Wrap] Day 3, 6pm. Quantified results from the event. Sets up next week\'s deal pulse posts. LI + IG + X.', date: D(2026,6,3) },
]

// ─────────────────────────────────────────────────────────────────────────────
// IHOR VLASOV — Daily LinkedIn cadence for June (82 items, ihj-01..82).
// ─────────────────────────────────────────────────────────────────────────────
const IH_JUNE: PostSeed[] = [
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'Just landed from a Q2 that took me from London to San Francisco to Dublin. 8 events. 3 continents. The one thing I didn\'t expect to hear in every room:', content:'[Hot take] 8am · Personal. Open the month strong. Personal travel angle → market insight. 4 lines max.', date: D(2026,6,1) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'Q2 2026 in one number: 8 events, 14 countries, [X deals in pipeline]. The road was the product this quarter.', content:'[Stat drop] 12pm · Personal. Replace [X] with real N5Deal figure. Simple, specific, personal.', date: D(2026,6,1) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'What US buyers in SF actually asked about EU licenses. They all wanted the same 3 things. Here\'s what surprised me:', content:'[Deal pulse] 6pm · N5Deal. 3 things → 3 lines. Ends with what buyers can find at n5deal.com', date: D(2026,6,1) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'Tech.eu London and Startup Grind SF told me opposite things about fintech M&A. Both were right.', content:'[Hot take] 8am · Personal. Short opener. Then explain the contradiction in 3 lines.', date: D(2026,6,2) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'Twitter mockup: "@IhorVlasov: Compliance used to be a cost. Now it\'s a multiple. One PSP deal in Q2 went from 4x to 6.5x because of RegTech. That\'s not an edge case."', content:'[Mockup] 12pm · Personal · Mockup. Design: white tweet card, dark text, verified badge. Screenshot aesthetic.', date: D(2026,6,2) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'Q2 is done. What was the biggest thing that changed your thinking in the last 3 months? Mine: [Ihor\'s answer in 2 lines]. Now you.', content:'[Question] 6pm · Personal. Give your answer first, then open the floor. Gets comments.', date: D(2026,6,2) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'Dublin surprised me most this quarter. Not because of the deals. Because of who wasn\'t in the room.', content:'[Hot take] 8am · Personal. Dublin Tech Summit angle. Specific observation → broader market point.', date: D(2026,6,3) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'End of May at N5Deal: [X new buyers], [Y new assets], [Z deals in DD]. Here\'s what the pipeline tells us about June demand.', content:'[Deal pulse] 12pm · N5Deal. ▶ Fill with real May closing numbers. Achievement post + forward signal.', date: D(2026,6,3) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'[Q2 fintech M&A news item]. The part nobody is writing about: what this means for license valuations in H2.', content:'[News + take] 6pm · Personal. ▶ Find a live Finextra/FT/Bloomberg story. Always end on the M&A implication.', date: D(2026,6,3) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'Compliance adds 1-2x to your exit price. I documented this on 3 separate deals in Q2 alone. Here\'s the mechanism:', content:'[Stat drop] 8am · Personal. Walk through the mechanism in 4 steps. Specific deal sizes/multiples.', date: D(2026,6,4) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'[Quote from Dublin Tech Summit speaker or notable attendee] + "Here\'s the half of the story they didn\'t cover — the M&A layer."', content:'[Quote] 12pm · Personal. ▶ Find real quote from Dublin event coverage. Position as the person who adds the M&A layer.', date: D(2026,6,4) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'The banking problem I kept hearing at every event this quarter: founders can\'t open accounts in time. That\'s literally what BankStore was built for.', content:'[BankStore] 6pm · BankStore. Travel/event credibility → product relevance. No hard sell.', date: D(2026,6,4) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'London investors want compliance + UK nexus. SF investors want the license and don\'t care about the rest. Here\'s how to pitch to both:', content:'[Hot take] 9am · Personal. Practical. Give the actual pitch angle for each. Founders save this.', date: D(2026,6,5) },
  { acc:'ih', type:'Carousel', platforms:['LinkedIn'], title:'Carousel: "Q2 2026 — 8 events, 3 continents: what I learned at each one." One slide per event (ADGM, Tech.eu, SF, Miami, Maribor, Vienna/Gdansk/Tallinn, Dublin). Each slide: event name + 1 key M&A signal.', content:'[Carousel] 3pm · N5Deal · Carousel. WEEK 1 CAROUSEL. Design: dark bg, purple accents, event photo or icon each slide.', date: D(2026,6,5) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'SF conversations confirmed: US buyers pay 25-35% premium for a clean EU EMI vs building from scratch. Here\'s the data behind that number:', content:'[Deal pulse] 6pm · N5Deal. Specific premium, specific reasoning. CTA → n5deal.com at the end.', date: D(2026,6,5) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'SF vs Europe valuation gap in fintech M&A. EU EMI with €1M ARR marketed locally: 3.5-5x. Same asset, US buyer: 5-8x. Same company. Different buyer base. That\'s the arbitrage.', content:'[Stat drop] 10am · Personal. Sharp contrast format. Very shareable. No fluff.', date: D(2026,6,6) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'The founders who struggle to sell aren\'t overpriced. They\'re over-complicated.', content:'[Hot take] 4pm · Personal. One line. Then 2-3 lines explaining what "over-complicated" means in practice.', date: D(2026,6,6) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'Phone notification mockup: "N5Deal: New EMI listed · Lithuania · €2.3M ARR · 4 qualified buyers already viewing. Tap to review." iOS lock screen style.', content:'[Mockup] 11am · N5Deal · Mockup. Design: iPhone notification card, N5Deal icon. Dark phone background. Clean and viral.', date: D(2026,6,7) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'H1 closes this month. Before setting H2 targets — 3 questions I\'m asking myself. And one I can\'t answer yet.', content:'[Hot take] 6pm · Personal. Reflective Sunday post. High reach. Personal and honest.', date: D(2026,6,7) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'The Q2 2026 Fintech M&A Pulse is live. Here are 5 things that surprised even me — and I live in this market every day.', content:'[Hot take] 8am · N5Deal. Tie to the N5Deal Q2 report article. This post drives traffic to it.', date: D(2026,6,8) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'License demand in Q2 2026: crypto +47%, EMI Europe -12%, PSP CEE +31%. MiCA drove one. DORA drove another. BaaS consolidation drove the third.', content:'[Stat drop] 12pm · Personal. Three-stat breakdown. Each line = one force. Very digestible.', date: D(2026,6,8) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'Q2 at N5Deal: 5 new investors. 5 new assets listed. New partnerships in 3 jurisdictions. The platform now covers [X] countries. Building in public.', content:'[Deal pulse] 6pm · N5Deal. ▶ Fill exact numbers. Achievement credibility post — no CTA needed.', date: D(2026,6,8) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'CEE license deals in Q2: up 40% vs Q2 2025. Everyone looked at London. The real action was in Warsaw, Tallinn, and Maribor. Here\'s why it\'s moving east:', content:'[Stat drop] 8am · Personal. 3 reasons CEE is moving. Specific jurisdictions. Ends with what buyers are paying.', date: D(2026,6,9) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'Twitter mockup: "EMI license in Lithuania 18 months ago: €180K. Same license today: €310K. DORA + MiCA doubled the entry price. Nobody is writing about this."', content:'[Mockup] 12pm · Personal · Mockup. Design: tweet card format. Short, punchy, no replies shown. Pure stat shock.', date: D(2026,6,9) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'CEE or Baltics for fintech right now: Warsaw, Tallinn, Riga, or Vilnius? Drop your pick and the one reason behind it.', content:'[Question] 6pm · Personal. Easy to answer. Gets comments from operators who are actually in those markets.', date: D(2026,6,9) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'BaaS isn\'t dead. It\'s consolidating. That difference matters enormously if you\'re on the buying or selling side.', content:'[Hot take] 8am · Personal. Distinguish consolidation from death. Give 2 examples of recent BaaS M&A activity.', date: D(2026,6,10) },
  { acc:'ih', type:'Carousel', platforms:['LinkedIn'], title:'Carousel: "Q2 2026 — 6 numbers that defined fintech M&A this quarter." One number per slide: crypto license deals, EMI valuations, CEE growth, BaaS consolidation count, avg deal close time, US buyer share.', content:'[Carousel] 12pm · N5Deal · Carousel. WEEK 2 CAROUSEL. Data-forward. Pull from N5Deal Pulse report. Each slide: big number + 2-line context.', date: D(2026,6,10) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'[MiCA stablecoin or crypto licensing story this week]. Most people read this as a regulation story. It\'s actually an M&A story.', content:'[News + take] 6pm · Personal. ▶ Needs live news. Always reframe news as an M&A signal.', date: D(2026,6,10) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'Consensus Miami: 3 crypto M&A signals I picked up that didn\'t make it into any recap thread. The one about stablecoin infrastructure acquisition timing surprised everyone in the room.', content:'[Stat drop] 8am · Personal. Exclusive from-the-room angle. Builds authority from event attendance.', date: D(2026,6,11) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'[React to Consensus Miami coverage or a notable speaker quote]. Here\'s the licensing angle everyone missed.', content:'[Quote] 12pm · Personal. ▶ Find real Consensus coverage. Position as the M&A interpreter.', date: D(2026,6,11) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'Most requested jurisdiction on BankStore in Q2: not UK, not Lithuania. It was [X]. Here\'s what that tells us about where fintech is actually scaling.', content:'[BankStore] 6pm · BankStore. ▶ Fill with real BankStore data. Surprising stat = high reach.', date: D(2026,6,11) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'Raise or sell? The decision looks different in 2026. In 2023, raise was always the first answer. Here\'s the updated framework:', content:'[Hot take] 9am · Personal. Give the actual framework: market conditions, license value, regulatory timeline, buyer demand. Founders save this.', date: D(2026,6,12) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'Active on N5Deal this week: [X] deals in DD. [Y] new buyer mandates from US. Top license being hunted: [Z]. What that tells us about June:', content:'[Deal pulse] 12pm · N5Deal. ▶ Fill with live pipeline data. Short, specific, ends with one forward signal.', date: D(2026,6,12) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'6 months left in 2026. One move only: raise, sell, acquire, or expand jurisdiction. What are you choosing and why?', content:'[Question] 5pm · Personal. Timely. Binary pressure gets engagement. Ihor answers first in the thread.', date: D(2026,6,12) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'3 months. 8 events. London, SF, Miami, Maribor, Vienna, Gdansk, Tallinn, Dublin. The pattern I kept seeing in every room regardless of country:', content:'[Stat drop] 10am · Personal. One universal pattern from all events. Builds the "Ihor is everywhere" personal brand.', date: D(2026,6,13) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'The deals that fell apart in Q2 all had one thing in common. It wasn\'t price.', content:'[Hot take] 4pm · Personal. Leave it there. Let people guess in comments. Follow with explanation in first comment.', date: D(2026,6,13) },
  { acc:'ih', type:'Carousel', platforms:['LinkedIn'], title:'Carousel: "H1 2026 — N5Deal by the numbers." Events: 8. Countries: 14. Deals: [X]. New buyers: [Y]. Platform growth: [Z%]. Slide per achievement category.', content:'[Carousel] 10am · N5Deal · Carousel. WEEK 2 CAROUSEL 2. H1 infographic recap. Include event logos/photos. Builds credibility.', date: D(2026,6,14) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'H1 is almost done. Here\'s the thing I\'d tell myself back in January:', content:'[Hot take] 5pm · Personal. Reflective, personal, honest. Not a humblebrag. Real lesson from the last 6 months.', date: D(2026,6,14) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'Revolut has 30+ banking licenses. They didn\'t build most of them from scratch. That\'s the playbook everyone copies and nobody talks about openly.', content:'[Hot take] 8am · Personal. Set up the week\'s theme. Revolut as a case study for buy vs build.', date: D(2026,6,15) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'Time to get a banking license from scratch in Europe: 18-36 months. Time to acquire an existing one: 60-90 days. That gap is the entire N5Deal thesis in two lines.', content:'[Stat drop] 12pm · Personal. The N5Deal value proposition as a stat contrast. Most reposted format.', date: D(2026,6,15) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'We\'re hosting: "How Revolut Became Revolut" — online event, Jun 24. With someone who was inside the growth machine for 7+ years. Register — link in bio.', content:'[Deal pulse] 6pm · N5Deal. Event announce. Keep it short. Lead with the guest credibility, not the event name.', date: D(2026,6,15) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'Most founders think building is safer than buying. The data from Q2 says the opposite. Here\'s the risk profile side by side:', content:'[Hot take] 8am · Personal. Show both risk profiles in 4-5 bullet points. Practical, saves easily.', date: D(2026,6,16) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'Twitter mockup: "Company A: built their PSP license from scratch. 26 months, €430K, 3 failed audits. Company B: bought a clean one. 67 days, €340K, live in month 3. Same outcome. Very different path."', content:'[Mockup] 12pm · Personal · Mockup. Design: tweet card. Two-company contrast. The numbers do the work.', date: D(2026,6,16) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'Build vs buy for a financial license in Europe — what would you choose today and why? I\'ll post the breakdown after 50 answers.', content:'[Question] 6pm · Personal. Commitment to follow up = higher response rate. Ihor answers in comments with real data.', date: D(2026,6,16) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'H2 2026 is going to look very different from H1. 3 signals I\'m watching right now that tell me that:', content:'[Hot take] 8am · Personal. 3 concrete signals: regulatory, geographic, deal type. Forward-looking credibility post.', date: D(2026,6,17) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'UK license premium: FCA-regulated EMI sells for 20-30% more than an equivalent CBI license in current buyer mandates. Dublin confirmed this. Here\'s what\'s driving the gap:', content:'[Stat drop] 12pm · Personal. Specific numbers from real observations. Dublin event gives this authenticity.', date: D(2026,6,17) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'[FCA or ECB news this week]. This is the regulatory signal that will move license pricing in H2. Here\'s my read:', content:'[News + take] 6pm · Personal. ▶ Needs live regulatory story. Connect to pricing implications.', date: D(2026,6,17) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'Crypto licenses with the fastest time from listing to LOI in 2026: Malta VASP — 21 days. Lithuania CASP — 18 days. UK FCA Crypto — 31 days. Pricing right matters more than jurisdiction.', content:'[Stat drop] 8am · Personal. Specific deal velocity data. Buyers and sellers both save this.', date: D(2026,6,18) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'[React to a notable H2 fintech prediction from a VC or founder] + "Here\'s what this looks like from the M&A side of that same market."', content:'[Quote] 12pm · Personal. ▶ Find a strong H2 prediction post from a known fintech voice. Add the buy-side lens.', date: D(2026,6,18) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'BankStore: average time from sign-up to first banking conversation is now 11 days. Before we existed, the same process took 4-6 months of cold outreach. That\'s the product.', content:'[BankStore] 6pm · BankStore. Stat-led product post. Specific. No marketing language. CTA → bankstore.ai', date: D(2026,6,18) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'The fintech founders who exit well in H2 2026 started preparing in Q1. The ones who didn\'t are going to feel it. Here\'s what preparation actually means:', content:'[Hot take] 9am · Personal. 4-point preparation checklist. Saves well. Generates DMs from founders looking to exit.', date: D(2026,6,19) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'Event in 5 days: "How Revolut Became Revolut." If you\'re a founder or buyer in fintech licensing, this is the one to attend. Here\'s what we\'re covering:', content:'[Deal pulse] 12pm · N5Deal. Second event push. Agenda preview. CTA → registration link.', date: D(2026,6,19) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'Phone notification mockup (iOS lock screen): "N5Deal: Your EMI asset has 3 new buyer matches. Tap to review offers. 2 are from UK-based strategics." N5Deal icon, clean dark phone.', content:'[Mockup] 6pm · N5Deal · Mockup. Design: iPhone lock screen. Platform as part of daily life. High visibility format.', date: D(2026,6,19) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'"When is the right time to exit?" — I get this at every event, every room, every DM. My answer hasn\'t changed in 3 years. Here it is:', content:'[Hot take] 9am · Personal. Give the actual answer. Simple, direct. Not a tease. This one generates DMs.', date: D(2026,6,20) },
  { acc:'ih', type:'Carousel', platforms:['LinkedIn'], title:'Carousel: "Build vs Buy — the financial license decision in 2026." Timeline comparison, cost comparison, risk comparison, which scenario fits each choice. 6 slides.', content:'[Carousel] 3pm · N5Deal · Carousel. WEEK 3 CAROUSEL. Educational. Data-backed. The N5Deal thesis in visual form. Gets shared heavily.', date: D(2026,6,20) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'H2 2026 license demand forecast based on Q2 signals: EMI EU flat to -5%. Crypto EU +40-60%. PSP CEE +25%. UK EMI +15%. Here\'s what\'s driving each number:', content:'[Stat drop] 10am · Personal. One sentence per category explaining the driver. Forward-looking. Sets Ihor up as the forecaster.', date: D(2026,6,21) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'Last week of Q2. One thing the market taught me this year that I didn\'t expect going in:', content:'[Hot take] 5pm · Personal. Honest, brief, specific. Not a victory lap. A real learning.', date: D(2026,6,21) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'The build vs buy debate in fintech licensing ends this week. We have someone who was inside the Revolut licensing machine for 7 years. Tomorrow, 6pm BST.', content:'[Hot take] 8am · Personal. Last event reminder. Frame it as the answer to the build vs buy question raised all week.', date: D(2026,6,22) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'Stablecoin M&A in H1 2026: [X] acquisitions globally, mostly payment infrastructure. Tokenised deposit operators are next. Watching this for Q3.', content:'[Stat drop] 12pm · Personal. ▶ Fill with real stablecoin M&A data. Sets up crypto licensing theme for Q3.', date: D(2026,6,22) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'Final push for tomorrow: "How Revolut Became Revolut." The licensing strategy that took them to 30+ markets isn\'t what most people think it was. Register — link in bio.', content:'[Deal pulse] 6pm · N5Deal. Final event push. Curiosity angle. Short. No fluff.', date: D(2026,6,22) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'Today we\'re live. One thing I\'ll say before we start: Revolut\'s licensing strategy wasn\'t a compliance play. It was a distribution play. That reframe changes everything.', content:'[Hot take] 8am · Personal. Day-of teaser. Single insight to hook attendance. Posted morning of event.', date: D(2026,6,23) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'Revolut\'s 30+ licenses by the math: 14+ jurisdictions, avg saved vs greenfield build: 20 months per license, estimated acquisition cost: ~€280K avg. That\'s 600 engineer-months of saved time.', content:'[Stat drop] 12pm · Personal. Quantify the Revolut playbook. Numbers tell the story without needing the company name in the hook.', date: D(2026,6,23) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'We\'re live in 1 hour. "How Revolut Became Revolut." If you can\'t make it — recording will be available. DM to get it.', content:'[Deal pulse] 7pm · N5Deal. 1-hour countdown. Short post. Builds urgency without spam.', date: D(2026,6,23) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'5 things from last night\'s event that I\'ll be thinking about for weeks. Starting with the one I didn\'t expect:', content:'[Hot take] 8am · Personal. Event recap. Lead with the most surprising insight. Generates engagement from attendees who want to add to the list.', date: D(2026,6,24) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'[Best quote from the Revolut event guest] + "This is the thing most founders building in regulated markets get completely backwards."', content:'[Quote] 12pm · Personal. ▶ Use a real quote from the event. Attribution makes this credible and shareable.', date: D(2026,6,24) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'After last night: do you think Revolut\'s licensing playbook is replicable for a €10M ARR fintech? Yes, no, or it depends — and why.', content:'[Question] 6pm · Personal. Debate starter. All three answers work. Comments will be good.', date: D(2026,6,24) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'Event numbers: [X attendees], [Y countries], [Z questions in the Q&A]. The question nobody expected us to get:', content:'[Stat drop] 8am · Personal. ▶ Fill with real event stats. Unexpected question angle keeps it interesting.', date: D(2026,6,25) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'Recording is live: "How Revolut Became Revolut." 5 key takeaways in the post, full session link in bio. Share with anyone building in regulated fintech.', content:'[Deal pulse] 12pm · N5Deal. Recording drop. Drives traffic and secondary shares.', date: D(2026,6,25) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'The build vs buy debate is settled. Last night confirmed it. 99% of fintech operators should be buying licenses, not building them. Here\'s why the 1% who should build looks like:', content:'[Hot take] 6pm · Personal. Strong take after the event. Ends with the nuanced case to avoid backlash.', date: D(2026,6,25) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'H2 2026 starts in 5 days. Here\'s what the smart money in fintech M&A is positioning for right now — and what most people are missing.', content:'[Hot take] 9am · Personal. Forward-looking. Specific positions: which license types, which geos, which buyer profiles.', date: D(2026,6,26) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'Twitter mockup: market pulse card — "June 2026 Fintech M&A Pulse: Deals closed: [X]. Avg close time: [Y] days. Hottest geo: CEE. Hottest license: FCA Crypto. Next quarter: watch Dublin and Warsaw." Clean data card design.', content:'[Mockup] 12pm · Personal · Mockup. Design: dark card, white text, table-style data. Like a Bloomberg market wrap but for M&A.', date: D(2026,6,26) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'Revolut\'s playbook means one thing for H2: demand for clean operating licenses is going to outpace supply. Especially UK and CEE. Here\'s the implication for buyers and sellers:', content:'[Deal pulse] 6pm · N5Deal. Event aftermath → market implications. Drives people to N5Deal listings.', date: D(2026,6,26) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'June 2026 at N5Deal: [X deals closed]. [Y new buyers]. [Z] active listings heading into Q3. One pattern in the data that\'s new:', content:'[Stat drop] 10am · Personal. ▶ Fill with real June numbers. Monthly stat recap = high credibility.', date: D(2026,6,27) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'H1 done. Honest version: what went exactly right, what took 2x longer than planned, and the one thing I\'d change going into H2.', content:'[Hot take] 4pm · Personal. Vulnerable + specific. Not a highlight reel. Builds real trust.', date: D(2026,6,27) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'Q2 confirmed something I suspected since Q4 2025: the fintech M&A cycle is compressing. Deals that took 9 months 2 years ago are closing in 4-5 now. Here\'s why:', content:'[Hot take] 11am · Personal. Structural market observation. Specific timeframes. High credibility signal.', date: D(2026,6,28) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'H2 2026: what\'s your one big bet in fintech? Raise, acquire, license, or exit? Drop it below — I\'m genuinely curious what the room is doing.', content:'[Question] 5pm · Personal. Last Sunday question of the month. Sets up H2 narrative.', date: D(2026,6,28) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'Q3 preview: 3 events, 2 new jurisdictions, 1 major deal announcement. Here\'s what N5Deal is building towards and why July matters more than people think.', content:'[Hot take] 8am · Personal. Q3 tease. Keeps momentum going. Specific without over-revealing.', date: D(2026,6,29) },
  { acc:'ih', type:'Carousel', platforms:['LinkedIn'], title:'Carousel: "H1 2026 wrap — what the first 6 months of fintech M&A actually looked like." Events map, license demand data, top deals, buyer geography, H2 forecast. 7 slides.', content:'[Carousel] 12pm · N5Deal · Carousel. WEEK 4 CAROUSEL. Summary of everything. Authority piece. Gets saved and reshared in July.', date: D(2026,6,29) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'Q3 pipeline is building. [X] active mandates already. If you\'re buying or selling a licensed financial business in H2 — now is the time to be in the room.', content:'[Deal pulse] 6pm · N5Deal. Q3 pipeline signal. Drives inbound for N5Deal.', date: D(2026,6,29) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'End of Q2. End of H1. One thing I\'d tell every fintech founder heading into H2 2026:', content:'[Hot take] 8am · Personal. Close the month with one clean, direct, honest thought. No list. No hashtags. Just the thing.', date: D(2026,6,30) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'H1 2026 at N5Deal in numbers: [X deals]. [Y countries]. [Z qualified buyers]. Revenue: [A]. The single most important trend heading into H2:', content:'[Stat drop] 12pm · N5Deal. ▶ Fill with real H1 numbers. Last big credibility stat of the month.', date: D(2026,6,30) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'Q2 is officially closed. What was the one moment that defined your quarter? Drop it below.', content:'[Question] 6pm · Personal. Simple close. Good engagement. Low effort to answer = high participation.', date: D(2026,6,30) },
]

// ─────────────────────────────────────────────────────────────────────────────
// IHOR VLASOV — Money 20/20 Amsterdam 3-day arc (Jun 1-3).
// ─────────────────────────────────────────────────────────────────────────────
const IH_M2020: PostSeed[] = [
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'Day 1 at Money 20/20 Amsterdam. The opening keynote signal nobody is talking about: payment infrastructure consolidation is accelerating, and the buyers are no longer just strategic — they\'re financial.', content:'[Money 20/20 Day 1] 11am · Personal. On-the-ground at Amsterdam. Specific signal from the keynote room → M&A implication. Sharp and short.', date: D(2026,6,1) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'Money 20/20 Day 2. Three conversations on the floor today told me the same thing: the next 18 months of fintech M&A will be defined by who controls the licensing infrastructure, not who has the slickest product.', content:'[Money 20/20 Day 2] 2pm · Personal. Floor conversations → thesis. The view from inside the room everyone is reading about from the outside.', date: D(2026,6,2) },
  { acc:'ih', type:'Text Post', platforms:['LinkedIn'], title:'Money 20/20 Amsterdam wraps. 3 days. ~8,000 attendees. 5 deals I expect to see announced before Q3 — based on conversations that happened in side rooms, not main stages.', content:'[Money 20/20 Wrap] 5pm · Personal. Event wrap with specific forward signals. Drives credibility for Ihor as the M&A interpreter at every major event.', date: D(2026,6,3) },
]

// ─────────────────────────────────────────────────────────────────────────────
// DENYS BETS — Banker observations, ~2/week. 8 items.
// ─────────────────────────────────────────────────────────────────────────────
const DB_JUNE: PostSeed[] = [
  { acc:'db', type:'Text Post', platforms:['LinkedIn'], title:'End of Q2 from the banking side. The pattern across every fintech opening accounts this quarter: founders learned to walk in with the documentation a risk officer needs before being asked. That\'s a real shift from 2024.', content:'[Pillar 1 · Banking Reality] 9am. Observation post. Single shift, specific, calm tone. No CTA. Tue Jun 2 — paired with Ihor\'s Q2 wrap content.', date: D(2026,6,2) },
  { acc:'db', type:'Text Post', platforms:['LinkedIn'], title:'Three companies. One rule I\'ve held this quarter: every Monday I look at one number per company. The week is built around what that number tells me. Everything else is reaction.', content:'[Pillar 2 · Building in Parallel] 10am. Operator\'s note. Personal, short, no CTA. Fri Jun 5 — adjacent to Ihor\'s 8 events 3 continents Q2 vibe.', date: D(2026,6,5) },
  { acc:'db', type:'Text Post', platforms:['LinkedIn'], title:'Q2 license-pricing data tells one story: the gap between paper compliance and operational compliance is now visible to buyers. A clean MiCA-ready crypto licence sells for 30-40% above one that still needs work. The market finally rewards discipline.', content:'[Pillar 5 · Market Signal] 8am. Banker\'s read of the Q2 data Ihor publishes the same week. Specific gap, specific number range. Tue Jun 9.', date: D(2026,6,9) },
  { acc:'db', type:'Carousel', platforms:['LinkedIn'], title:'Banking infrastructure decisions that move a fintech valuation by 20-40%: account redundancy, multi-jurisdiction rails, treasury automation, FX governance, KYC pipeline. Five slides on what good looks like.', content:'[Pillar 3 · Infrastructure Layer] 11am. Carousel. CFO/founder save piece. The structural argument. Fri Jun 12. Image-first carousel.', date: D(2026,6,12) },
  { acc:'db', type:'Text Post', platforms:['LinkedIn'], title:'Banks underwrite a bought licence faster than a built one. That sentence answers 80% of the build-vs-buy question for founders who think the answer is about cost. It\'s about how the next institution evaluating you reads your file.', content:'[Pillar 1 · Banking Reality] 9am. Banker\'s POV on build vs buy. One sharp line + insider mechanism. Tue Jun 16 — adjacent to Ihor\'s Build vs Buy week.', date: D(2026,6,16) },
  { acc:'db', type:'Text Post', platforms:['LinkedIn'], title:'The operators I\'ve watched build well over the last three years all share one habit: they were calm in the meeting where everyone else was loud. That pattern has never been wrong. I trust it more than any pitch deck.', content:'[Pillar 4 · People & Judgment] 5pm. Observation about good operators. Not motivational — observed. Thu Jun 18.', date: D(2026,6,18) },
  { acc:'db', type:'Text Post', platforms:['LinkedIn'], title:'After last night\'s Revolut conversation: the licensing playbook everyone admires is replicable, but only if you understand it as a distribution play and not a compliance play. Banks read it the same way. That reframe is the entire lesson.', content:'[Pillar 1 · Banking Reality] 12pm. Response to the Revolut event — adds the banking lens to Ihor\'s recap. Wed Jun 24.', date: D(2026,6,24) },
  { acc:'db', type:'Text Post', platforms:['LinkedIn'], title:'H2 from the banking side: the businesses that will be acquired in the next 6 months are the ones whose money infrastructure can be diligenced in 30 days. The rest will quietly come off the market. That\'s the filter.', content:'[Pillar 5 · Market Signal] 11am. H2 forecast from the banking POV. Specific filter. Sets up his July content. Sat Jun 27.', date: D(2026,6,27) },
]

const ALL_POSTS: PostSeed[] = [...N5_JUNE, ...N5_M2020, ...IH_JUNE, ...IH_M2020, ...DB_JUNE]

async function main() {
  const project = await prisma.project.findUnique({ where: { id: PROJECT_ID } })
  if (!project) throw new Error(`Project ${PROJECT_ID} not found on this DB`)

  const accounts = await prisma.socialAccount.findMany({
    where: { projectId: PROJECT_ID },
    select: { id: true, slug: true },
  })
  const accBySlug = new Map(accounts.map((a) => [a.slug, a.id]))
  for (const slug of ['n5', 'bk', 'ih', 'db']) {
    if (!accBySlug.has(slug)) throw new Error(`Missing SocialAccount slug=${slug} — seed the marketing prototype first`)
  }

  // Build the idempotency key off (yyyy-mm-dd, title) so re-runs are safe.
  const existing = await prisma.socialPost.findMany({
    where: {
      projectId: PROJECT_ID,
      scheduledFor: {
        gte: new Date(Date.UTC(2026, 5, 1)),
        lt: new Date(Date.UTC(2026, 6, 1)),
      },
    },
    select: { title: true, scheduledFor: true },
  })
  const seen = new Set(existing.map((p) => `${p.scheduledFor.toISOString().slice(0, 10)}|${p.title}`))

  let inserted = 0
  let skipped = 0
  for (const p of ALL_POSTS) {
    const key = `${p.date.toISOString().slice(0, 10)}|${p.title}`
    if (seen.has(key)) { skipped++; continue }
    const accountId = accBySlug.get(p.acc)!
    await prisma.socialPost.create({
      data: {
        projectId: PROJECT_ID,
        accountId,
        type: p.type,
        title: p.title,
        content: p.content ?? null,
        platforms: p.platforms,
        scheduledFor: p.date,
        status: 'idea',
        images: [],
      },
    })
    inserted++
    seen.add(key)
  }

  console.log(`\nJune 2026 marketing content plan:`)
  console.log(`  N5Deal (Track A/B/C/Podcast/Event): ${N5_JUNE.length}`)
  console.log(`  N5Deal (Money 20/20):              ${N5_M2020.length}`)
  console.log(`  Ihor Vlasov (daily cadence):       ${IH_JUNE.length}`)
  console.log(`  Ihor Vlasov (Money 20/20):         ${IH_M2020.length}`)
  console.log(`  Denys Bets (banker observations):  ${DB_JUNE.length}`)
  console.log(`  ───`)
  console.log(`  Total in plan:                     ${ALL_POSTS.length}`)
  console.log(`  Inserted:                          ${inserted}`)
  console.log(`  Skipped (already in DB):           ${skipped}\n`)
}

main()
  .catch((e) => { console.error('ERROR:', e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
