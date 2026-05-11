// Seed the Marketing OS module: 4 social accounts, the original ~150-post
// content plan ported from the Alina HTML prototype, 3 brand cards, and the
// Q2 strategy (budget + goals + channel directives).
//
// Idempotent: re-runs upsert existing rows by stable keys.
//
// Usage:
//   npx tsx --require dotenv/config scripts/seed-marketing-os.ts        # local
//   DATABASE_URL="<neon>" npx tsx --require dotenv/config scripts/seed-marketing-os.ts

import { prisma } from '../lib/db'

const PROJECT_ID = 'seed-project-n5deal'

const ACCOUNTS = [
  { slug: 'n5', name: 'N5Deal',       color: 'hsl(217 91% 51%)', description: 'M&A platform for the financial sector',                sortOrder: 0 },
  { slug: 'bk', name: 'BankStore',    color: 'hsl(220 14% 13%)', description: 'Banking infrastructure for startups',                  sortOrder: 1 },
  { slug: 'ih', name: 'Ihor Vlasov',  color: 'hsl(262 82% 56%)', description: 'Personal brand — fintech M&A commentary',              sortOrder: 2 },
  { slug: 'db', name: 'Denys Bets',   color: 'hsl(160 79% 32%)', description: 'Personal brand — banking reality / operator angle',    sortOrder: 3 },
]

const D = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0, 0)

// Posts ported verbatim from the BASE array in the HTML prototype.
// Stable id = "mkt-<original-id>" so re-runs upsert in place.
const POSTS: { id: string; accSlug: string; type: string; platforms: string[]; title: string; date: Date }[] = [
  // N5Deal
  { id: 'n01', accSlug: 'n5', type: 'Article',       platforms: ['Website'],                                         title: 'ADGM, DIFC, SAMA: What Happened to License Demand After Eid?', date: D(2026, 4, 6) },
  { id: 'n02', accSlug: 'n5', type: 'Company Post',  platforms: ['LI Company','X/Twitter','Threads','Instagram'],    title: '"What we\'re hearing from ADGM & DIFC after Eid." — LI, X, Threads, Reddit, Insta', date: D(2026, 4, 7) },
  { id: 'n03', accSlug: 'n5', type: 'Article',       platforms: ['Medium','Newsletter'],                             title: 'Cross-Border Deals: EU Payment Startups Selling into the Gulf', date: D(2026, 4, 8) },
  { id: 'n04', accSlug: 'n5', type: 'Thread',        platforms: ['X/Twitter','LI Company'],                          title: '[Thread] "The real bridge: EU founders, Gulf buyers, and what gets funded."', date: D(2026, 4, 8) },
  { id: 'n05', accSlug: 'n5', type: 'Article',       platforms: ['Website'],                                         title: '"We\'re a Gulf Buyer, We Want EU Licenses": What This Actually Means', date: D(2026, 4, 10) },
  { id: 'n06', accSlug: 'n5', type: 'Reel',          platforms: ['Instagram','LI Company'],                          title: '[Reel] "3 questions every Gulf buyer asks before looking at an EU license."', date: D(2026, 4, 10) },
  { id: 'n07', accSlug: 'n5', type: 'Article',       platforms: ['YouTube'],                                         title: 'ep 2.1 — short + reel + tiktok', date: D(2026, 4, 13) },
  { id: 'n08', accSlug: 'n5', type: 'Article',       platforms: ['Medium','Newsletter'],                             title: 'BaaS Is Not Dead: It\'s Consolidating (And That\'s Where the Money Is)', date: D(2026, 4, 14) },
  { id: 'n09', accSlug: 'n5', type: 'Company Post',  platforms: ['LI Company','X/Twitter','Threads'],                title: '"BaaS isn\'t dead. It\'s just getting bought." — LI, X, Reddit, Insta, Threads', date: D(2026, 4, 15) },
  { id: 'n10', accSlug: 'n5', type: 'Article',       platforms: ['Medium'],                                          title: 'What a BaaS-Enabled EMI Is Worth in 2026', date: D(2026, 4, 16) },
  { id: 'n11', accSlug: 'n5', type: 'Article',       platforms: ['Website'],                                         title: 'Buying Distressed Fintech Assets Without Blowing Up Your Balance Sheet', date: D(2026, 4, 17) },
  { id: 'n12', accSlug: 'n5', type: 'Reel',          platforms: ['Instagram','LI Company'],                          title: '[Storytell] "3 rules for buying a distressed fintech and sleeping at night."', date: D(2026, 4, 17) },
  { id: 'n13', accSlug: 'n5', type: 'Article',       platforms: ['YouTube'],                                         title: 'ep 2.2 — short + reel + tiktok', date: D(2026, 4, 20) },
  { id: 'n14', accSlug: 'n5', type: 'Article',       platforms: ['Medium','Newsletter'],                             title: 'Tech.eu London: What We\'re Watching in UK & EU Fintech', date: D(2026, 4, 21) },
  { id: 'n15', accSlug: 'n5', type: 'Company Post',  platforms: ['LI Company','X/Twitter','Instagram'],              title: '"Heading to Tech.eu: here\'s who we want to meet."', date: D(2026, 4, 21) },
  { id: 'n16', accSlug: 'n5', type: 'Article',       platforms: ['Medium','Newsletter'],                             title: 'Live from London: Who\'s Still Buying, and at What Multiples?', date: D(2026, 4, 22) },
  { id: 'n17', accSlug: 'n5', type: 'Reel',          platforms: ['Instagram','LI Company'],                          title: '[Reel] "What London investors are actually buying in Q2."', date: D(2026, 4, 22) },
  { id: 'n18', accSlug: 'n5', type: 'Article',       platforms: ['YouTube'],                                         title: 'ep 2.3 — short + reel + tiktok', date: D(2026, 4, 23) },
  { id: 'n19', accSlug: 'n5', type: 'Founder Post',  platforms: ['LI Founder','X/Twitter','Instagram'],              title: '"London is still the king. Here\'s what Tech.eu confirmed for me."', date: D(2026, 4, 23) },
  { id: 'n20', accSlug: 'n5', type: 'Article',       platforms: ['Website'],                                         title: 'London, Warsaw, Barcelona in One Week: 5 M&A Signals', date: D(2026, 4, 24) },
  { id: 'n21', accSlug: 'n5', type: 'Company Post',  platforms: ['LI Company','X/Twitter','Threads'],                title: '"We\'re heading to SF. This is the mandate we\'re carrying."', date: D(2026, 4, 24) },
  { id: 'n22', accSlug: 'n5', type: 'Article',       platforms: ['YouTube'],                                         title: 'ep 2.4 — short + reel + tiktok', date: D(2026, 4, 25) },
  { id: 'n23', accSlug: 'n5', type: 'Article',       platforms: ['Website'],                                         title: 'Bridging the Atlantic: US Investor Mandates for EU Fintechs', date: D(2026, 4, 27) },
  { id: 'n24', accSlug: 'n5', type: 'Thread',        platforms: ['X/Twitter','LI Company'],                          title: '[Thread] "5 signals for European fintech M&A after London / Warsaw / Barcelona."', date: D(2026, 4, 27) },
  { id: 'n25', accSlug: 'n5', type: 'Founder Post',  platforms: ['LI Founder','X/Twitter'],                          title: '[Thread] "SF vs Europe: the valuation gap nobody talks about openly."', date: D(2026, 4, 28) },
  { id: 'n26', accSlug: 'n5', type: 'Article',       platforms: ['Medium','Newsletter'],                             title: 'Live from San Francisco: What US Buyers Want from EU Licenses', date: D(2026, 4, 29) },
  { id: 'n27', accSlug: 'n5', type: 'Thread',        platforms: ['X/Twitter','LI Company'],                          title: '[Thread] "Raise or sell? The decision framework for 2026."', date: D(2026, 4, 29) },
  { id: 'n28', accSlug: 'n5', type: 'Article',       platforms: ['Medium'],                                          title: 'Raise or Sell? The Framework We Use with Founders in SF', date: D(2026, 4, 30) },
  { id: 'n29', accSlug: 'n5', type: 'Reel',          platforms: ['Instagram','LI Company'],                          title: '[Reel] "5 exit mistakes I hear in SF every year."', date: D(2026, 4, 30) },
  { id: 'n30', accSlug: 'n5', type: 'Article',       platforms: ['Website'],                                         title: 'Compliance Used to Kill Deals. In 2026, It Creates Them.', date: D(2026, 5, 4) },
  { id: 'n31', accSlug: 'n5', type: 'Company Post',  platforms: ['LI Company','X/Twitter','Threads'],                title: '"Compliance used to be a cost center. Now it\'s a multiple driver."', date: D(2026, 5, 4) },
  { id: 'n32', accSlug: 'n5', type: 'Founder Post',  platforms: ['LI Founder','X/Twitter'],                          title: '"Compliance used to scare founders. Now it adds 1-2x to your exit price."', date: D(2026, 5, 5) },
  { id: 'n33', accSlug: 'n5', type: 'Article',       platforms: ['Medium','Newsletter'],                             title: 'How RegTech Adds a Premium to PSP & EMI Valuations', date: D(2026, 5, 6) },
  { id: 'n34', accSlug: 'n5', type: 'Thread',        platforms: ['X/Twitter'],                                       title: '[Thread] "How automated compliance changes your exit price."', date: D(2026, 5, 6) },
  { id: 'n35', accSlug: 'n5', type: 'Founder Post',  platforms: ['LI Founder'],                                      title: '"Real example: how automated compliance changed the multiple on a PSP deal."', date: D(2026, 5, 7) },
  { id: 'n36', accSlug: 'n5', type: 'Article',       platforms: ['Website'],                                         title: '3 RegTech Signals from Barcelona Every Buyer Should Note', date: D(2026, 5, 8) },
  { id: 'n37', accSlug: 'n5', type: 'Reel',          platforms: ['Instagram','LI Company'],                          title: '[Reel] "3 RegTech signals from Barcelona in 60 seconds."', date: D(2026, 5, 8) },
  { id: 'n38', accSlug: 'n5', type: 'Article',       platforms: ['Website'],                                         title: 'CEE Fintech M&A: The Smart Money Trade of 2026', date: D(2026, 5, 11) },
  { id: 'n39', accSlug: 'n5', type: 'Company Post',  platforms: ['LI Company','X/Twitter','Threads'],                title: '"Everyone looks at London. Smart money looks at CEE."', date: D(2026, 5, 11) },
  { id: 'n40', accSlug: 'n5', type: 'Article',       platforms: ['Medium','Newsletter'],                             title: 'Live from Podim: 400 Investors, 1,300 Meetings, One Theme', date: D(2026, 5, 13) },
  { id: 'n41', accSlug: 'n5', type: 'Reel',          platforms: ['Instagram','LI Company'],                          title: '[Reel] "What deal-making in Maribor actually looks like."', date: D(2026, 5, 13) },
  { id: 'n42', accSlug: 'n5', type: 'Founder Post',  platforms: ['LI Founder','X/Twitter'],                          title: '"Why US buyers are hunting CEE founders specifically. It\'s not just about cost."', date: D(2026, 5, 14) },
  { id: 'n43', accSlug: 'n5', type: 'Article',       platforms: ['Website'],                                         title: 'Why CEE Is the Next Wave of Fintech Exits', date: D(2026, 5, 15) },
  { id: 'n44', accSlug: 'n5', type: 'Thread',        platforms: ['X/Twitter','LI Company'],                          title: '[Thread] "3 reasons CEE is the next wave of fintech M&A."', date: D(2026, 5, 15) },
  { id: 'n45', accSlug: 'n5', type: 'Article',       platforms: ['Website'],                                         title: 'Three Events in One Week: Vienna, Gdansk, Tallinn', date: D(2026, 5, 18) },
  { id: 'n46', accSlug: 'n5', type: 'Company Post',  platforms: ['LI Company','X/Twitter','Threads'],                title: '"Three events, one week. Here\'s what we\'re hunting for."', date: D(2026, 5, 18) },
  { id: 'n47', accSlug: 'n5', type: 'Reel',          platforms: ['Instagram','LI Founder'],                          title: '[Reel Founder] "3 cities, 5 days: Vienna to Gdansk to Tallinn."', date: D(2026, 5, 19) },
  { id: 'n48', accSlug: 'n5', type: 'Article',       platforms: ['Medium','Newsletter'],                             title: 'Women-Led Fintechs in M&A: What the Data Actually Shows', date: D(2026, 5, 20) },
  { id: 'n49', accSlug: 'n5', type: 'Thread',        platforms: ['X/Twitter','LI Company'],                          title: '[Thread] "What the data actually says about women-led fintech exits."', date: D(2026, 5, 20) },
  { id: 'n50', accSlug: 'n5', type: 'Article',       platforms: ['Website'],                                         title: 'What the Latitude59 Pitch Competition Tells Us About Valuations', date: D(2026, 5, 22) },
  { id: 'n51', accSlug: 'n5', type: 'Reel',          platforms: ['Instagram','LI Company'],                          title: '[Reel] "What early-stage pitches in Tallinn tell us about future exits."', date: D(2026, 5, 22) },
  { id: 'n52', accSlug: 'n5', type: 'Article',       platforms: ['Website'],                                         title: 'FCA vs CBI: Which UK/Irish License Is Actually Worth More in M&A?', date: D(2026, 5, 25) },
  { id: 'n53', accSlug: 'n5', type: 'Company Post',  platforms: ['LI Company','X/Twitter','Threads'],                title: '"FCA or CBI? The answer might surprise you."', date: D(2026, 5, 25) },
  { id: 'n54', accSlug: 'n5', type: 'Article',       platforms: ['Medium','Newsletter'],                             title: 'Live from Dublin: The Irish Fintech Mandate We\'re Carrying', date: D(2026, 5, 27) },
  { id: 'n55', accSlug: 'n5', type: 'Thread',        platforms: ['X/Twitter','LI Company'],                          title: '[Thread] "We\'re in Dublin. Here\'s the mandate we\'re carrying."', date: D(2026, 5, 27) },
  { id: 'n56', accSlug: 'n5', type: 'Article',       platforms: ['Medium'],                                          title: 'Dublin Done: What the UK & Irish Market Looks Like for H2 2026', date: D(2026, 5, 28) },
  { id: 'n57', accSlug: 'n5', type: 'Founder Post',  platforms: ['LI Founder','X/Twitter'],                          title: '"H2 2026 outlook: where the capital is going and which licenses will be in short supply."', date: D(2026, 5, 28) },
  { id: 'n58', accSlug: 'n5', type: 'Reel',          platforms: ['Instagram','LI Company'],                          title: '[Reel] "Dublin is done. Here\'s the H2 outlook for UK/Ireland."', date: D(2026, 5, 29) },

  // BankStore
  { id: 'b01', accSlug: 'bk', type: 'Article',       platforms: ['Website','LI Company'],                            title: 'Why Startups Get Rejected by Banks: The Risk Model They Never Show You (~1,200w)', date: D(2026, 4, 13) },
  { id: 'b02', accSlug: 'bk', type: 'Company Post',  platforms: ['Instagram','LI Company'],                          title: 'Why modern companies operate 3-5 banks. Not complexity — infrastructure. [Single graphic]', date: D(2026, 4, 14) },
  { id: 'b03', accSlug: 'bk', type: 'Company Post',  platforms: ['Instagram','LI Company'],                          title: 'Why startups get rejected by banks. It\'s not about your idea. [Text-heavy, pain hook]', date: D(2026, 4, 16) },
  { id: 'b04', accSlug: 'bk', type: 'Article',       platforms: ['Website','Medium'],                                title: 'How Banks Actually Evaluate Startups: Business Model, Jurisdiction, Risk Profile (~1,400w)', date: D(2026, 4, 17) },
  { id: 'b05', accSlug: 'bk', type: 'Company Post',  platforms: ['Instagram'],                                       title: '40-60% of startups are rejected in first 6 months. The reasons are never explained. [Stat post]', date: D(2026, 4, 17) },
  { id: 'b06', accSlug: 'bk', type: 'Article',       platforms: ['Website','Medium'],                                title: 'The Real Cost of Cross-Border Payments: A Data Guide for Founders (~1,800w)', date: D(2026, 4, 20) },
  { id: 'b07', accSlug: 'bk', type: 'Carousel',      platforms: ['Instagram','LI Company'],                          title: 'The real cost of cross-border payments. You think 0.5%. You\'re paying 3%. [Carousel, 7 slides]', date: D(2026, 4, 21) },
  { id: 'b08', accSlug: 'bk', type: 'Company Post',  platforms: ['Instagram'],                                       title: 'At $100k/month international ops: $2-5k gone. Every month. Most founders don\'t track it.', date: D(2026, 4, 23) },
  { id: 'b09', accSlug: 'bk', type: 'Article',       platforms: ['Website'],                                         title: 'The FX Stack Guide: How to Stop Overpaying on International Transfers (~1,200w)', date: D(2026, 4, 24) },
  { id: 'b10', accSlug: 'bk', type: 'Company Post',  platforms: ['Instagram'],                                       title: 'Looks predictable. Feels controlled. 2.5% per transaction. [Design post]', date: D(2026, 4, 24) },
  { id: 'b11', accSlug: 'bk', type: 'Carousel',      platforms: ['Instagram','LI Company'],                          title: 'What actually happens after you apply to a bank. Inside the decision process. [Carousel, 8 slides]', date: D(2026, 4, 28) },
  { id: 'b12', accSlug: 'bk', type: 'Article',       platforms: ['Website','Medium'],                                title: 'Why Startup Banking Is Still Broken in 2026: A Structural Analysis (~1,400w)', date: D(2026, 4, 29) },
  { id: 'b13', accSlug: 'bk', type: 'Company Post',  platforms: ['Instagram','LI Company'],                          title: 'Startup banking in 2026 is still broken. Not outdated — structurally misaligned. [Statement]', date: D(2026, 4, 29) },
  { id: 'b14', accSlug: 'bk', type: 'Article',       platforms: ['Website'],                                         title: 'Inside the Bank Application Process: What Happens After You Submit (~1,300w)', date: D(2026, 5, 1) },
  { id: 'b15', accSlug: 'bk', type: 'Company Post',  platforms: ['Instagram','LI Company'],                          title: 'We don\'t move money. We design the system behind it. [Single brand post]', date: D(2026, 5, 1) },
  { id: 'b16', accSlug: 'bk', type: 'Article',       platforms: ['Website','LI Company'],                            title: 'Banking Infrastructure as Portfolio Risk: What VCs Need to Know (~1,200w)', date: D(2026, 5, 4) },
  { id: 'b17', accSlug: 'bk', type: 'Carousel',      platforms: ['LI Company'],                                      title: 'Your portfolio has a banking infrastructure problem. Nobody\'s tracking it. [Carousel, 8 slides, VC]', date: D(2026, 5, 5) },
  { id: 'b18', accSlug: 'bk', type: 'Carousel',      platforms: ['LI Company'],                                      title: 'We send you the right startups. Pre-matched. Pre-screened. Before they apply. [Carousel]', date: D(2026, 5, 6) },
  { id: 'b19', accSlug: 'bk', type: 'Article',       platforms: ['Website'],                                         title: 'What Banks Actually Gain from the Startup Economy (~1,300w, B2B angle)', date: D(2026, 5, 8) },
  { id: 'b20', accSlug: 'bk', type: 'Company Post',  platforms: ['Instagram','LI Company'],                          title: '30% of KYB first submissions fail. This is a profile fit problem, not a paperwork problem.', date: D(2026, 5, 8) },
  { id: 'b21', accSlug: 'bk', type: 'Article',       platforms: ['Website','Medium'],                                title: 'Top 10 Neo Banks for Startups in 2026: What They Don\'t Tell You (~1,500w)', date: D(2026, 5, 11) },
  { id: 'b22', accSlug: 'bk', type: 'Company Post',  platforms: ['Instagram','LI Company'],                          title: 'Mercury, Airwallex, and Wise — what each one does and what none of them cover. [Comparison grid]', date: D(2026, 5, 11) },
  { id: 'b23', accSlug: 'bk', type: 'Company Post',  platforms: ['LI Company','Instagram'],                          title: 'Capital One just bought Brex for $5.15B. Here\'s what that means for your startup. [News]', date: D(2026, 5, 13) },
  { id: 'b24', accSlug: 'bk', type: 'Article',       platforms: ['Website'],                                         title: 'Mercury vs Airwallex vs Wise: An Honest Guide for International Startups (~2,000w)', date: D(2026, 5, 15) },
  { id: 'b25', accSlug: 'bk', type: 'Company Post',  platforms: ['Instagram','LI Company'],                          title: 'We mapped the startup banking market. Here\'s the layer no one else built. [Competitor map]', date: D(2026, 5, 15) },
  { id: 'b26', accSlug: 'bk', type: 'Article',       platforms: ['Website','Medium'],                                title: 'Why Modern Companies Need 3-5 Banks', date: D(2026, 5, 18) },
  { id: 'b27', accSlug: 'bk', type: 'Carousel',      platforms: ['Instagram','LI Company'],                          title: 'How to build your banking stack from scratch. The 5-provider framework. [Carousel]', date: D(2026, 5, 19) },
  { id: 'b28', accSlug: 'bk', type: 'Company Post',  platforms: ['Instagram','LI Company'],                          title: 'Your FX setup costs more than your SaaS subscriptions combined. [Compare]', date: D(2026, 5, 20) },
  { id: 'b29', accSlug: 'bk', type: 'Article',       platforms: ['Website'],                                         title: 'How to Build Your Banking Stack from Scratch (~1,400w)', date: D(2026, 5, 22) },
  { id: 'b30', accSlug: 'bk', type: 'Company Post',  platforms: ['Instagram','LI Company'],                          title: '5 signs your banking infrastructure is already wrong. (Most founders have at least 3.) [Checklist]', date: D(2026, 5, 22) },
  { id: 'b31', accSlug: 'bk', type: 'Article',       platforms: ['Website','Medium'],                                title: 'Banking Infrastructure at $1M ARR (~1,500w)', date: D(2026, 5, 25) },
  { id: 'b32', accSlug: 'bk', type: 'Company Post',  platforms: ['Instagram','LI Company'],                          title: 'At $1M ARR your banking setup should look completely different from day one. [$1M ARR diagram]', date: D(2026, 5, 26) },
  { id: 'b33', accSlug: 'bk', type: 'Repost',        platforms: ['LI Company'],                                      title: '[Relevant fintech news repost + 2-3 line comment]', date: D(2026, 5, 27) },
  { id: 'b34', accSlug: 'bk', type: 'Article',       platforms: ['Website'],                                         title: 'KYB Compliance Guide: What Startups Need at Every Stage (~1,200w)', date: D(2026, 5, 29) },
  { id: 'b35', accSlug: 'bk', type: 'Company Post',  platforms: ['Instagram','LI Company'],                          title: 'The navigation map most founders never see. From incorporation to multi-bank to scaling. [Map]', date: D(2026, 5, 29) },

  // Ihor Vlasov (selected — 20 entries; can re-import the rest later if needed)
  { id: 'i01', accSlug: 'ih', type: 'Text Post',     platforms: ['LinkedIn'],                                        title: '[Text] Most founders underestimate licensing risk when scaling into the EU — personal stance', date: D(2026, 4, 14) },
  { id: 'i02', accSlug: 'ih', type: 'Text Post',     platforms: ['LinkedIn'],                                        title: '[Text] How DD actually works on an EMI deal — a mechanism most get wrong', date: D(2026, 4, 15) },
  { id: 'i03', accSlug: 'ih', type: 'Carousel',      platforms: ['LinkedIn'],                                        title: '[Carousel] BankStore — Why startups get rejected. Not your idea. Your profile.', date: D(2026, 4, 16) },
  { id: 'i04', accSlug: 'ih', type: 'Carousel',      platforms: ['LinkedIn'],                                        title: '[Carousel] N5Deal — Active buy-side mandates: what buyers are looking for this week', date: D(2026, 4, 17) },
  { id: 'i06', accSlug: 'ih', type: 'Carousel',      platforms: ['LinkedIn'],                                        title: '[Carousel] Market Overview — Week in fintech M&A: key deals, numbers, trends', date: D(2026, 4, 13) },
  { id: 'i07', accSlug: 'ih', type: 'Text Post',     platforms: ['LinkedIn'],                                        title: '[Text] London is still the king — what Tech.eu confirmed for me (personal stance)', date: D(2026, 4, 21) },
  { id: 'i13', accSlug: 'ih', type: 'Text Post',     platforms: ['LinkedIn'],                                        title: '[Text] SF vs Europe: the valuation gap nobody talks about openly', date: D(2026, 4, 28) },
  { id: 'i19', accSlug: 'ih', type: 'Text Post',     platforms: ['LinkedIn'],                                        title: '[Text] Compliance used to scare founders. Now it\'s what adds 1-2x to your exit price.', date: D(2026, 5, 5) },
  { id: 'i25', accSlug: 'ih', type: 'Text Post',     platforms: ['LinkedIn'],                                        title: '[Text] Why US buyers are hunting CEE founders specifically. It\'s not about cost.', date: D(2026, 5, 12) },
  { id: 'i27', accSlug: 'ih', type: 'Carousel',      platforms: ['LinkedIn'],                                        title: '[Carousel] N5Deal — CEE fintech: why smart money looks beyond London', date: D(2026, 5, 15) },
  { id: 'i30', accSlug: 'ih', type: 'Text Post',     platforms: ['LinkedIn'],                                        title: '[Text] 3 cities, 5 days: what I actually observed at Vienna, Gdansk, Tallinn', date: D(2026, 5, 19) },
  { id: 'i35', accSlug: 'ih', type: 'Text Post',     platforms: ['LinkedIn'],                                        title: '[Text] FCA or CBI? The answer depends on who your buyer is.', date: D(2026, 5, 26) },
  { id: 'i36', accSlug: 'ih', type: 'Text Post',     platforms: ['LinkedIn'],                                        title: '[Text] H2 2026 outlook: where the capital is going and which licenses will be scarce', date: D(2026, 5, 27) },

  // Denys Bets
  { id: 'd01', accSlug: 'db', type: 'Text Post',     platforms: ['LinkedIn'],                                        title: 'Banks don\'t reject your startup because they don\'t like startups. They reject you because you haven\'t answered the three questions every risk officer asks first.', date: D(2026, 4, 13) },
  { id: 'd02', accSlug: 'db', type: 'Carousel',      platforms: ['LinkedIn'],                                        title: 'Most startups spend 6 months trying to open the right bank account. It\'s a matching problem — and no one was solving it. bankstore.ai', date: D(2026, 4, 15) },
  { id: 'd03', accSlug: 'db', type: 'Text Post',     platforms: ['LinkedIn'],                                        title: 'EU payment licensing approvals dropped 23% this quarter. That number tells you everything about where the next M&A wave is coming from.', date: D(2026, 4, 17) },
  { id: 'd05', accSlug: 'db', type: 'Text Post',     platforms: ['LinkedIn'],                                        title: 'London is still pricing fintech M&A at a premium. Here\'s the one thing Tech.eu confirmed this week.', date: D(2026, 4, 23) },
  { id: 'd07', accSlug: 'db', type: 'Text Post',     platforms: ['LinkedIn'],                                        title: 'Raise or sell. In 2026, for most licensed fintech operators, the calculation is clearer than it\'s ever been.', date: D(2026, 4, 29) },
  { id: 'd10', accSlug: 'db', type: 'Carousel',      platforms: ['LinkedIn'],                                        title: 'Compliance used to be a cost center. In 2026, it\'s a valuation multiplier. bankstore.ai context', date: D(2026, 5, 7) },
  { id: 'd11', accSlug: 'db', type: 'Text Post',     platforms: ['LinkedIn'],                                        title: 'Barcelona. RegTech is no longer a compliance play. It\'s an M&A play. Three signals from this week that confirm it.', date: D(2026, 5, 9) },
  { id: 'd14', accSlug: 'db', type: 'Text Post',     platforms: ['LinkedIn'],                                        title: 'Maribor. 400 investors, 1,300 meetings. The theme nobody wrote about: CEE operators with EU licenses selling at multiples that would have been impossible 18 months ago.', date: D(2026, 5, 15) },
  { id: 'd15', accSlug: 'db', type: 'Text Post',     platforms: ['LinkedIn'],                                        title: 'Vienna, Gdansk, Tallinn. Three cities, five days, four meetings that changed how I think about something I thought I understood.', date: D(2026, 5, 19) },
  { id: 'd18', accSlug: 'db', type: 'Text Post',     platforms: ['LinkedIn'],                                        title: 'FCA or CBI. The question most founders ask. The answer depends on one thing: who your eventual buyer is.', date: D(2026, 5, 25) },
  { id: 'd19', accSlug: 'db', type: 'Text Post',     platforms: ['LinkedIn'],                                        title: 'H2 2026. The licenses that will be in short supply: CBI-regulated EMIs, FCA-authorized PIs with passporting. The window is Q3.', date: D(2026, 5, 27) },
  { id: 'd20', accSlug: 'db', type: 'Text Post',     platforms: ['LinkedIn'],                                        title: 'Q2 done. One thing I\'d do differently. One thing I wouldn\'t change. Nothing else.', date: D(2026, 5, 29) },
]

const BRANDS = [
  {
    slug: 'n5',
    name: 'N5Deal.com',
    tagline: 'A fintech/banking listings + reports platform',
    pitch: '"Platform from banks to banks" with deal stream feature and Open Price element. Modern visual identity. Founder personal brand: Egor.',
    features: ['Deal Stream feature (Rodion lead)', 'Open Price on listings', 'Reports as product moat', 'Modern visual identity'],
    deliverables: [
      { id: 'n5-d1', text: 'Anatomy of a Fintech #1: Revolut — carousel + article + PDF', status: 'todo', priority: 'high' },
      { id: 'n5-d2', text: 'Anatomy of a Fintech #2: Wise — follow-up', status: 'todo', priority: 'medium' },
      { id: 'n5-d3', text: 'SEO automation pipeline — traffic generation', status: 'inprogress', priority: 'high' },
      { id: 'n5-d4', text: 'Reports as recurring deliverable — PDF, website links', status: 'todo', priority: 'medium' },
    ],
    sortOrder: 0,
  },
  {
    slug: 'bs',
    name: 'BankStore',
    tagline: '"Layer of Fintech (Banking)" — Business-side platform',
    pitch: 'You need SEPA. You need SWIFT. You want the cheapest acquiring for your clients. Use BankStore. One profile, one click — and the full list of providers, with each provider\'s transaction fee, is shown to you side-by-side. Push Apply and track your onboarding with each bank from one dashboard. The system keeps adding new banks — ~10 new banks every week — and each one offers something different.',
    features: ['One profile — one click fan-out', 'Side-by-side fee comparison', 'Multi-bank onboarding tracker', '~10 new banks/week', 'Daily-use platform (not one-time)'],
    deliverables: [
      { id: 'bs-d1', text: 'URGENT: BS product promo reel — new visual language', status: 'todo', priority: 'urgent' },
      { id: 'bs-d2', text: '"Who are we?" one-liner — must surface in Google', status: 'todo', priority: 'urgent' },
      { id: 'bs-d3', text: 'Website hero update — use canonical pitch', status: 'todo', priority: 'high' },
      { id: 'bs-d4', text: 'Google Ads launch — live in June', status: 'todo', priority: 'medium' },
    ],
    sortOrder: 1,
  },
  {
    slug: 'ma',
    name: 'M&A House',
    tagline: 'Newest brand — foundational work in progress',
    pitch: 'Early stage brand. Most foundational work still open. Focus on logo finalisation and design strategy.',
    features: ['Logo in development', 'Design strategy alignment', 'Content template structure', 'Team integration planning'],
    deliverables: [
      { id: 'ma-d1', text: 'Logo finalisation — in progress', status: 'inprogress', priority: 'high' },
      { id: 'ma-d2', text: 'Combined design strategy — with M&A operations', status: 'todo', priority: 'medium' },
      { id: 'ma-d3', text: 'Post template — for content creation', status: 'todo', priority: 'low' },
      { id: 'ma-d4', text: 'Background images — Friday deadline', status: 'todo', priority: 'medium' },
    ],
    sortOrder: 2,
  },
]

const STRATEGY = {
  activeBudgetMonth: 'april',
  budget: {
    april: {
      linkBuilding: { min: 1300, max: 1800, actual: 0,   purpose: 'Validate rankings + CTR' },
      linkedin:     { min: 600,  max: 600,  actual: 264, purpose: 'Test audience + intent' },
      instagram:    { min: 0,    max: 300,  actual: 0,   purpose: 'Rebuild, not scale' },
      pr:           { min: 300,  max: 800,  actual: 191, purpose: 'Credibility layer' },
      free:         { min: 0,    max: 0,    actual: 0,   purpose: 'Free linkbuilding + distribution' },
    },
    may: {
      linkBuilding: { min: 1800, max: 2500, actual: 0, purpose: 'Push pages into higher positions' },
      linkedin:     { min: 1000, max: 1500, actual: 0, purpose: 'Scale winning audience + creatives' },
      instagram:    { min: 300,  max: 600,  actual: 0, purpose: 'Controlled testing — new structure' },
      pr:           { min: 800,  max: 1500, actual: 0, purpose: 'Stronger placements + authority' },
      free:         { min: 0,    max: 0,    actual: 0, purpose: 'Continue distribution' },
    },
    june: {
      linkBuilding: { min: 2500, max: 3500, actual: 0, purpose: 'Strengthen positions + expand keywords' },
      linkedin:     { min: 2000, max: 3000, actual: 0, purpose: 'Stable acquisition channel' },
      instagram:    { min: 800,  max: 1200, actual: 0, purpose: 'Support channel — awareness + retarget' },
      pr:           { min: 1500, max: 3000, actual: 0, purpose: 'Consistent visibility in market' },
      free:         { min: 0,    max: 0,    actual: 0, purpose: 'Ongoing support' },
    },
  },
  goals: {
    seo: {
      impressions: { baseline: 1890, target: 4000,  actual: 1890, unit: '',  label: 'Impressions' },
      ctr:         { baseline: 1.6,  target: 2.75,  actual: 1.6,  unit: '%', label: 'CTR' },
      clicks:      { baseline: 31,   target: 90,    actual: 31,   unit: '',  label: 'Clicks' },
    },
    linkedin: {
      followers:    { baseline: 710, target: 850, actual: 756, unit: '',  label: 'Followers' },
      newFollowers: { baseline: 37,  target: 60,  actual: 37,  unit: '',  label: 'New Followers' },
      adCtr:        { baseline: 0,   target: 1.0, actual: 0.14, unit: '%', label: 'Ad CTR' },
    },
    instagram: {
      adCtr:      { baseline: 1.3,  target: 1.5, actual: 1.3,  unit: '%', label: 'Ad CTR' },
      followConv: { baseline: 0.03, target: 0.5, actual: 0.07, unit: '%', label: 'Follow Conversion' },
    },
  },
  channelDirectives: {
    seo:       { title: 'SEO',                color: '#10B981', body: 'Validate output. CTR fix is main priority. Lock 6 core pages: EMI, PSP, buy/sell fintech, banking, crypto licenses.' },
    linkedin:  { title: 'LinkedIn',           color: '#0A66C2', body: 'Most aligned channel — 34% visitor→follow already. Test controlled paid traffic. EU/UK primary.' },
    instagram: { title: 'Instagram',          color: '#E1306C', body: 'Currently buys attention but does not convert. Reactivating — rebuild before scale.' },
    pr:        { title: 'PR',                 color: '#7C3AED', body: 'Credibility layer, not traffic. Target 2-4 real placements in fintech/founder media.' },
  },
}

async function main() {
  // 1. Verify project
  const project = await prisma.project.findUnique({ where: { id: PROJECT_ID } })
  if (!project) throw new Error(`Project ${PROJECT_ID} not found — run safe-seed first`)

  // 2. Upsert accounts
  const accBySlug: Record<string, string> = {}
  for (const a of ACCOUNTS) {
    const acc = await prisma.socialAccount.upsert({
      where: { projectId_slug: { projectId: PROJECT_ID, slug: a.slug } },
      create: { projectId: PROJECT_ID, ...a },
      update: { name: a.name, color: a.color, description: a.description, sortOrder: a.sortOrder },
    })
    accBySlug[a.slug] = acc.id
  }
  console.log(`✓ Social accounts: ${ACCOUNTS.length}`)

  // 3. Upsert posts (deterministic IDs so re-runs are no-ops)
  let postsCreated = 0
  let postsUpdated = 0
  for (const p of POSTS) {
    const id = `mkt-${p.id}`
    const accountId = accBySlug[p.accSlug]
    if (!accountId) continue
    const before = await prisma.socialPost.findUnique({ where: { id } })
    await prisma.socialPost.upsert({
      where: { id },
      create: {
        id,
        projectId: PROJECT_ID,
        accountId,
        type: p.type,
        title: p.title,
        platforms: p.platforms,
        scheduledFor: p.date,
        status: 'idea',
      },
      update: {
        accountId,
        type: p.type,
        title: p.title,
        platforms: p.platforms,
        scheduledFor: p.date,
      },
    })
    if (before) postsUpdated++; else postsCreated++
  }
  console.log(`✓ Social posts — created: ${postsCreated}, updated: ${postsUpdated}`)

  // 4. Upsert brands
  for (const b of BRANDS) {
    await prisma.brand.upsert({
      where: { projectId_slug: { projectId: PROJECT_ID, slug: b.slug } },
      create: { projectId: PROJECT_ID, ...b },
      update: { name: b.name, tagline: b.tagline, pitch: b.pitch, features: b.features, deliverables: b.deliverables, sortOrder: b.sortOrder },
    })
  }
  console.log(`✓ Brands: ${BRANDS.length}`)

  // 5. Upsert strategy
  await prisma.marketingStrategy.upsert({
    where: { projectId: PROJECT_ID },
    create: { projectId: PROJECT_ID, ...STRATEGY },
    update: STRATEGY,
  })
  console.log(`✓ Marketing strategy seeded`)
}

main()
  .catch((e) => { console.error('ERROR:', e?.message ?? e); process.exit(1) })
  .finally(() => prisma.$disconnect())
