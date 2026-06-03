// Seeds the MarketingReport table with the three Q2 2026 reports that were
// previously baked into the Alina Marketing OS prototype as `r_apr`,
// `r_may_early`, and `r_may_mid`. Without these, /marketing/reports has
// nothing to show until the first AI-generated report lands.
//
// Idempotent on periodLabel — re-running this script will skip any reports
// already present.
//
// Usage (local):
//   npx tsx --require dotenv/config scripts/seed-marketing-reports-q2.ts
// Against Neon:
//   DATABASE_URL="<neon>" npx tsx scripts/seed-marketing-reports-q2.ts

import { prisma } from '../lib/db'

const PROJECT_ID = process.env.PROJECT_ID || 'seed-project-n5deal'

interface ReportSeed {
  title: string
  periodLabel: string
  createdAt: Date
  imgCount: number
  html: string
  notes: string
  notesByChannel: Record<string, string>
  metrics: Record<string, any>
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) Early-April baseline report (1–13 April 2026)
// ─────────────────────────────────────────────────────────────────────────────
const APR_METRICS = {
  instagram: { followers: 1204, reach: 63400, impressions: 110_000, engagement: 5520, adSpend: 184.92, ctr: 3.6, costPerView: 0.27 },
  youtube:   { views: 2400, watchTime: 6.7, retention: 50.7, videoViews: 161, shorts992: 992, totalSubs: null },
  linkedin:  { impressions: 635, uniqueReaders: 202, clicks: 78, reactions: 25, comments: 3, engRate: 16.7 },
}

const APR_HTML = `<div class="rv"><h1>N5Deal — Marketing Report</h1><div class="rp">April 2026 &middot; 1–13 April &middot; Instagram &middot; YouTube &middot; LinkedIn</div><h2>Instagram — @n5deal</h2><h3>Page stats as of 13 April 2026</h3><div class="mg"><div class="mc"><div class="mv">1,204</div><div class="ml">Followers</div></div><div class="mc"><div class="mv">64</div><div class="ml">Posts</div></div><div class="mc"><div class="mv">91.7K</div><div class="ml">Profile Views (30d)</div></div></div><h3>Ads — 14 days &middot; 7 campaigns &middot; spent $184.92</h3><div class="mg"><div class="mc"><div class="mv">110K</div><div class="ml">Views</div><div class="md up">+109% vs prev</div></div><div class="mc"><div class="mv">63.4K</div><div class="ml">Reach</div><div class="md up">+160%</div></div><div class="mc"><div class="mv">5,520</div><div class="ml">Post Engagements</div><div class="md up">+100%</div></div><div class="mc"><div class="mv">$184.92</div><div class="ml">Total Ad Spend</div></div></div><h3>Campaign: M&amp;A Talks Ep.1 &middot; 8 Apr &middot; $8/day &middot; spent $42.14</h3><div class="fnr"><div class="fns"><div class="fnv">12,955</div><div class="fnl">Ad impressions</div><div class="fns2">Instagram Reel</div></div><div class="fns"><div class="fnv">4,034</div><div class="fnl">3+ sec views</div><div class="fns2">31% of impressions</div></div><div class="fns"><div class="fnv">465</div><div class="fnl">YouTube clicks</div><div class="fns2">CTR 3.6%</div></div><div class="fns"><div class="fnv">183</div><div class="fnl">Page loaded</div><div class="fns2">39% of clicks</div></div><div class="fns"><div class="fnv">154</div><div class="fnl">Video views</div><div class="fns2">84% of arrivals</div></div></div><div class="ins">Instagram counts a click immediately after tap. YouTube counts only if the page actually loaded. The 39% gap is normal for mobile traffic.</div><div class="mg"><div class="mc"><div class="mv">$42.14</div><div class="ml">Spent ($8/day budget)</div></div><div class="mc"><div class="mv">$0.23</div><div class="ml">Cost per YouTube visit</div></div><div class="mc"><div class="mv">$0.27</div><div class="ml">Cost per video view</div></div><div class="mc"><div class="mv">8,320</div><div class="ml">Unique reach</div></div></div><h2>YouTube — N5Deal Channel</h2><h3>Last 28 days &middot; YouTube Studio</h3><div class="mg"><div class="mc"><div class="mv">2,400</div><div class="ml">Total Views (28d)</div></div><div class="mc"><div class="mv">6.7h</div><div class="ml">Watch Time</div></div><div class="mc"><div class="mv">50.7%</div><div class="ml">Shorts Retention</div><div class="md up">Above avg (~45%)</div></div><div class="mc"><div class="mv">29</div><div class="ml">Real-time views (48h)</div></div></div><h3>M&amp;A Talks Ep.1 — published 7 April &middot; 18:39</h3><div class="mg"><div class="mc"><div class="mv">7</div><div class="ml">Organic views (pre-ads)</div></div><div class="mc"><div class="mv">154</div><div class="ml">Views from ads ($42)</div></div><div class="mc"><div class="mv">161</div><div class="ml">Total views</div></div><div class="mc"><div class="mv">3.0h</div><div class="ml">Watch Time</div></div></div><h3>Top content (28 days)</h3><table><tr><th>#</th><th>Title</th><th>Type</th><th>Views</th></tr><tr><td>1</td><td>We&#39;re launching M&amp;A Talks — No scripts. No filters...</td><td>Short</td><td>992</td></tr><tr><td>2</td><td>Short &middot; 31 March 2026</td><td>Short</td><td>841</td></tr><tr><td>3</td><td>Short &middot; 30 March 2026</td><td>Short</td><td>432</td></tr><tr><td>4</td><td>M&amp;A Talks Ep.1 — The Reality of Deals, Banks &amp; Founders</td><td>Video</td><td>161</td></tr></table><h3>Traffic sources</h3><div class="mg"><div class="mc"><div class="mv">54.4%</div><div class="ml">External sites</div></div><div class="mc"><div class="mv">23.1%</div><div class="ml">Browse / recommendations</div></div><div class="mc"><div class="mv">94.2%</div><div class="ml">External: instagram.com</div></div><div class="mc"><div class="mv">1.2%</div><div class="ml">External: linkedin.com</div></div></div><div class="ins">Instagram is the primary driver to the YouTube channel (94.2% of external traffic). The ad campaign was the main engine.</div><h2>LinkedIn — Organic Content</h2><h3>1–11 April 2026 &middot; LinkedIn Analytics Export</h3><div class="mg"><div class="mc"><div class="mv">635</div><div class="ml">Impressions</div></div><div class="mc"><div class="mv">202</div><div class="ml">Unique readers</div></div><div class="mc"><div class="mv">78</div><div class="ml">Clicks</div></div><div class="mc"><div class="mv">25</div><div class="ml">Reactions</div></div><div class="mc"><div class="mv">3</div><div class="ml">Comments</div></div><div class="mc"><div class="mv">~16.7%</div><div class="ml">Avg Eng. Rate</div></div></div><h3>Posts detail</h3><table><tr><th>Post</th><th>Author</th><th>Date</th><th>Impr.</th><th>Clicks</th><th>CTR</th><th>Likes</th><th>Eng.%</th></tr><tr><td>3 Founders in one room — M&amp;A Talks Ep.1 launch</td><td>alina hiba</td><td>08 Apr</td><td>110</td><td>25</td><td>22.7%</td><td>5</td><td>29.1%</td></tr><tr><td>ADGM &amp; DIFC after Eid — GCC Fintech Licenses</td><td>Ihor Vlasov</td><td>07 Apr</td><td>117</td><td>2</td><td>1.7%</td><td>4</td><td>6.8%</td></tr><tr><td>Easter added 2 weeks to your deal timeline</td><td>alina hiba</td><td>04 Apr</td><td>79</td><td>13</td><td>16.5%</td><td>5</td><td>24.1%</td></tr><tr><td>Successful exits start with a quiet April conversation</td><td>alina hiba</td><td>01 Apr</td><td>108</td><td>31</td><td>28.7%</td><td>4</td><td>36.1%</td></tr><tr><td>Article — The 6-Month M&amp;A Countdown</td><td>alina hiba</td><td>01 Apr</td><td>74</td><td>4</td><td>5.4%</td><td>3</td><td>9.5%</td></tr><tr><td style="font-weight:700">Total</td><td></td><td></td><td style="font-weight:700">488</td><td style="font-weight:700">75</td><td style="font-weight:700">15.4%</td><td style="font-weight:700">21</td><td style="font-weight:700">21.1%</td></tr></table><h2>Key Insights</h2><div class="ins">Ad M&amp;A Talks Ep.1: $0.27 per video view is a strong result for B2B. CTR 3.6% is well above average for video ads (benchmark: 1–2%).</div><div class="ins">LinkedIn peak: 08 Apr (194 impressions) — coincides with M&amp;A Talks Ep.1 launch post. CTR 22.7% on that post is excellent for B2B.</div><div class="ins">94.2% of YouTube external traffic came from Instagram. Instagram is the primary growth driver for the channel.</div><div class="ins">YouTube Shorts retention at 50.7% — above platform average (~45%). Short-form content is performing well.</div></div>`

// ─────────────────────────────────────────────────────────────────────────────
// 2) Early-May report — 1 Apr → 1 May (28-day window)
// ─────────────────────────────────────────────────────────────────────────────
const MAY_EARLY_METRICS = {
  instagram: { followers: 1193, reach: 63820, impressions: 55072, engagement: 279, profileVisits: 631, linkTaps: 12 },
  youtube:   { subscribers: 6, views: 6918, watchTime: 418, impressions: 8760, ctr: 0.79 },
  linkedin:  { followers: 767, reach: 323000, impressions: 329068, clicks: 106, leads: 0, spend: 367, organic: 2352, sponsored: 326716 },
  website: {
    sessions: 439, engagedSessions: 251, engagementRate: 57.18, avgEngagementTime: 43,
    eventsPerSession: 6.01, eventCount: 2639,
    sources: [
      { name: '(direct) / (none)',                 sessions: 271, pct: 61.73, engaged: 154, engRate: 56.83, avgTime: '32s',     eventsPerSession: 5.51,  events: 1492 },
      { name: 'superadmin.n5deals.com / referral', sessions: 70,  pct: 15.95, engaged: 44,  engRate: 62.86, avgTime: '32s',     eventsPerSession: 5.77,  events: 404 },
      { name: 'google / organic',                  sessions: 27,  pct: 6.15,  engaged: 13,  engRate: 48.15, avgTime: '38s',     eventsPerSession: 8.48,  events: 229 },
      { name: 'chatgpt.com / referral',            sessions: 24,  pct: 5.47,  engaged: 10,  engRate: 41.67, avgTime: '46s',     eventsPerSession: 5.75,  events: 138 },
      { name: 'n5bank.com / referral',             sessions: 22,  pct: 5.01,  engaged: 16,  engRate: 72.73, avgTime: '48s',     eventsPerSession: 6.64,  events: 146 },
      { name: 'linkedin.com / referral',           sessions: 6,   pct: 1.37,  engaged: 2,   engRate: 33.33, avgTime: '6m 27s',  eventsPerSession: 7.67,  events: 46 },
      { name: '127.0.0.1:8000 / referral',         sessions: 4,   pct: 0.91,  engaged: 3,   engRate: 75.00, avgTime: '31s',     eventsPerSession: 6.00,  events: 24 },
      { name: '(not set)',                         sessions: 2,   pct: 0.46,  engaged: 0,   engRate: 0,     avgTime: '51s',     eventsPerSession: 2.00,  events: 4 },
      { name: 'chatgpt.com / (not set)',           sessions: 2,   pct: 0.46,  engaged: 2,   engRate: 100,   avgTime: '11m 17s', eventsPerSession: 10.00, events: 20 },
      { name: 'ig / social',                       sessions: 2,   pct: 0.46,  engaged: 0,   engRate: 0,     avgTime: '0s',      eventsPerSession: 3.00,  events: 6 },
    ],
  },
}

const MAY_EARLY_HTML = `<div class="rv"><h1>N5Deal — Marketing Report</h1><div class="rp">Early May 2026 &middot; 1 Apr — 1 May 2026 &middot; Instagram &middot; YouTube &middot; LinkedIn &middot; Website (GA)</div><div class="ins"><strong>Headline.</strong> Major paid Instagram push (~$367 on LinkedIn ads alone) drove 329K impressions but 0 leads — the conversion problem from prior reports is now systemic. Instagram reach grew +94% but follow conversion -40%. YouTube watch time hit 418h — content is converting. Website 439 sessions with strong engagement (57%).</div><h2>Instagram — @n5deal</h2><div class="mg"><div class="mc"><div class="mv">1,193</div><div class="ml">Followers</div></div><div class="mc"><div class="mv">63,820</div><div class="ml">Reach</div><div class="md up">+94%</div></div><div class="mc"><div class="mv">55,072</div><div class="ml">Impressions</div></div><div class="mc"><div class="mv">279</div><div class="ml">Engagements</div></div><div class="mc"><div class="mv">631</div><div class="ml">Profile Visits</div></div><div class="mc"><div class="mv">12</div><div class="ml">Link Taps</div><div class="md dn">low conversion</div></div></div><div class="ins">Paid dominated organic ~9:1. Reach grew but follow conversion crisis at -40% — strategy needs rebalancing.</div><h2>YouTube — N5Deal Channel</h2><div class="mg"><div class="mc"><div class="mv">6,918</div><div class="ml">Views</div></div><div class="mc"><div class="mv">418h</div><div class="ml">Watch Time</div></div><div class="mc"><div class="mv">+6</div><div class="ml">Subscribers</div></div><div class="mc"><div class="mv">8,760</div><div class="ml">Impressions</div></div><div class="mc"><div class="mv">0.79%</div><div class="ml">Impressions CTR</div></div></div><div class="ins">Strong momentum — M&amp;A Talks Ep.2 teaser performing at 1,468 views. Content quality is driving retention.</div><h2>LinkedIn — N5Deal Page</h2><div class="mg"><div class="mc"><div class="mv">329,068</div><div class="ml">Impressions</div></div><div class="mc"><div class="mv">326,716</div><div class="ml">Sponsored</div></div><div class="mc"><div class="mv">2,352</div><div class="ml">Organic</div></div><div class="mc"><div class="mv">106</div><div class="ml">Clicks</div></div><div class="mc"><div class="mv">0</div><div class="ml">Leads</div><div class="md dn">conversion broken</div></div><div class="mc"><div class="mv">$367</div><div class="ml">Ad Spend</div></div><div class="mc"><div class="mv">767</div><div class="ml">Followers</div></div></div><div class="ins"><strong>Concern.</strong> $367 ad spend → 106 clicks → 0 leads. CRM conversion signal is not flowing into LinkedIn Campaign Manager. Top priority to fix before scaling.</div><h2>Website — n5deal.com (Google Analytics)</h2><div class="mg"><div class="mc"><div class="mv">439</div><div class="ml">Sessions</div></div><div class="mc"><div class="mv">251</div><div class="ml">Engaged Sessions</div></div><div class="mc"><div class="mv">57.18%</div><div class="ml">Engagement Rate</div></div><div class="mc"><div class="mv">43s</div><div class="ml">Avg Time</div></div><div class="mc"><div class="mv">6.01</div><div class="ml">Events / Session</div></div><div class="mc"><div class="mv">2,639</div><div class="ml">Total Events</div></div></div><h3>Top traffic sources</h3><table><tr><th>Source / Medium</th><th>Sessions</th><th>Engaged</th><th>Eng. Rate</th><th>Avg Time</th></tr><tr><td>(direct) / (none)</td><td>271 (61.7%)</td><td>154</td><td>56.8%</td><td>32s</td></tr><tr><td>superadmin.n5deals.com / referral</td><td>70 (16.0%)</td><td>44</td><td>62.9%</td><td>32s</td></tr><tr><td>google / organic</td><td>27 (6.2%)</td><td>13</td><td>48.2%</td><td>38s</td></tr><tr><td>chatgpt.com / referral</td><td>24 (5.5%)</td><td>10</td><td>41.7%</td><td>46s</td></tr><tr><td>n5bank.com / referral</td><td>22 (5.0%)</td><td>16</td><td>72.7%</td><td>48s</td></tr></table></div>`

// ─────────────────────────────────────────────────────────────────────────────
// 3) Mid-May report — 21 Apr → 20 May 2026 (rich full HTML)
// ─────────────────────────────────────────────────────────────────────────────
const MAY_MID_METRICS = {
  instagram: { followers: 1193, reach: 15547, impressions: 21023, engagement: 3108, adSpend: 109.92, linkTaps: 727, ctr: 3.56 },
  youtube:   { subscribers: 6, views: 4647, watchTime: 7.7 },
  linkedin:  {
    followers: 765, impressions: 255355, reach: 5310, organic: 2982, sponsored: 252373,
    clicks: 22, reactions: 140, comments: 3, leads: 0, spend: 57.11,
  },
  website: {
    sessions: 405, engagedSessions: 223, engagementRate: 55.06, avgEngagementTime: 45,
    eventsPerSession: 6.67, eventCount: 2703,
    sources: [
      { name: '(direct) / (none)',                 sessions: 168, pct: 41.48, engaged: 79, engRate: 47.02, avgTime: '27s',    eventsPerSession: 4.70,  events: 789 },
      { name: 'superadmin.n5deals.com / referral', sessions: 96,  pct: 23.70, engaged: 65, engRate: 67.71, avgTime: '54s',    eventsPerSession: 6.75,  events: 648 },
      { name: 'google / organic',                  sessions: 88,  pct: 21.73, engaged: 52, engRate: 59.09, avgTime: '52s',    eventsPerSession: 9.10,  events: 801 },
      { name: 'chatgpt.com / referral',            sessions: 14,  pct: 3.46,  engaged: 7,  engRate: 50.00, avgTime: '31s',    eventsPerSession: 4.14,  events: 58 },
      { name: 'n5bank.com / referral',             sessions: 9,   pct: 2.22,  engaged: 7,  engRate: 77.78, avgTime: '3m 53s', eventsPerSession: 16.00, events: 144 },
      { name: 'app.clickup.com / referral',        sessions: 8,   pct: 1.98,  engaged: 6,  engRate: 75.00, avgTime: '1m 01s', eventsPerSession: 12.88, events: 103 },
      { name: 'linkedin / paid_social',            sessions: 6,   pct: 1.48,  engaged: 3,  engRate: 50.00, avgTime: '1m 42s', eventsPerSession: 10.50, events: 63 },
      { name: 'ig / social',                       sessions: 4,   pct: 0.99,  engaged: 1,  engRate: 25.00, avgTime: '12s',    eventsPerSession: 4.00,  events: 16 },
      { name: 'linkedin.com / referral',           sessions: 4,   pct: 0.99,  engaged: 1,  engRate: 25.00, avgTime: '3s',     eventsPerSession: 3.00,  events: 12 },
      { name: 'web.telegram.org / referral',       sessions: 3,   pct: 0.74,  engaged: 0,  engRate: 0,     avgTime: '0s',     eventsPerSession: 2.00,  events: 6 },
    ],
  },
}

const MAY_MID_HTML = `<div class="rv"><h1>N5Deal — Marketing Report</h1>
<div class="rp">Mid-May 2026 &middot; 21 Apr — 20 May 2026 &middot; Instagram &middot; YouTube &middot; LinkedIn &middot; Website (GA)</div>
<div class="ins"><strong>Headline.</strong> Paid Instagram drove most of the activity: $109.92 across two campaigns produced 727 link clicks. Reel format beat carousel ~2x on cost ($0.10 vs $0.21 CPC) and on CTR (4.6% vs 2.8%). YouTube watch time dropped 41% but subscribers ticked up +6. LinkedIn N5Deal page exploded to 255K impressions (+222%) — almost entirely sponsored content. $57 LinkedIn ad spend produced 0 leads (same conversion problem as last report). Website traffic stable at 405 sessions with notably stronger engagement quality from google/organic (now 22% of traffic, up from 6%).</div>
<h2>Instagram — @n5deal</h2><h3>Last 30 days &middot; 21 Apr — 20 May 2026</h3>
<div class="mg">
<div class="mc"><div class="mv">21,023</div><div class="ml">Views</div><div class="md">77.5% from ads</div></div>
<div class="mc"><div class="mv">15,547</div><div class="ml">Accounts reached</div><div class="md dn">−81.2% vs prev 30d</div></div>
<div class="mc"><div class="mv">3,108</div><div class="ml">Post engagements (ads)</div><div class="md">2 boosted posts combined</div></div>
<div class="mc"><div class="mv">727</div><div class="ml">Link clicks (ads)</div><div class="md up">$0.15 blended CPC</div></div>
<div class="mc"><div class="mv">$109.92</div><div class="ml">Ad spend</div><div class="md">across 2 campaigns</div></div>
<div class="mc"><div class="mv">3.56%</div><div class="ml">Blended CTR</div><div class="md">weighted avg</div></div>
</div>
<h3>Ad campaign breakdown</h3>
<table><tr><th>Campaign</th><th>Format</th><th>Spent</th><th>Days</th><th>Views</th><th>Link Clicks</th><th>CPC</th><th>CTR</th><th>Engagement</th></tr>
<tr><td>M&amp;A Talks Ep.2 — No scripts</td><td>Reel &middot; 20s</td><td>$40.11</td><td>5</td><td>8,353</td><td>396</td><td>$0.10</td><td>4.6%</td><td>2,776</td></tr>
<tr><td>Exits are engineered — not announced</td><td>Post &middot; static</td><td>$69.81</td><td>8</td><td>11,662</td><td>331</td><td>$0.21</td><td>2.8%</td><td>332</td></tr></table>
<div class="ins"><strong>Insight.</strong> Reels are clearly the cheaper, higher-engagement format on Instagram right now. The Ep.2 Reel ad cost half as much per click as the carousel and got 4.6% CTR vs 2.8%. But the hook rate (31%) vs hold rate (5.6%) gap shows the same issue as previous reports: <em>strong opening, weak middle.</em> People click in, then leave by second 5.</div>
<div class="ins"><strong>Concern.</strong> Accounts reached dropped −81.2% vs the previous 28-day window. Organic-only reach is clearly insufficient — to hold reach steady, sustained paid budget of ~$5–6/day across two concurrent campaigns looks necessary based on what&#39;s working.</div>
<h2>YouTube — N5Deal</h2><h3>Last 28 days &middot; 23 Apr — 20 May 2026</h3>
<div class="mg">
<div class="mc"><div class="mv">4,647</div><div class="ml">Views</div><div class="md">about same as prev 28d</div></div>
<div class="mc"><div class="mv">7.7h</div><div class="ml">Watch time</div><div class="md dn">−41% vs prev 28d</div></div>
<div class="mc"><div class="mv">+6</div><div class="ml">Subscribers gained</div><div class="md up">+500% vs prev 28d</div></div>
<div class="mc"><div class="mv">7</div><div class="ml">Realtime subscribers</div><div class="md">last 48h</div></div>
</div>
<h3>Top content (28d)</h3>
<table><tr><th>Video</th><th>Published</th><th>Duration</th><th>Avg view %</th><th>Views</th></tr>
<tr><td>M&amp;A Talks Ep.2 coming soon (teaser)</td><td>24 Apr 2026</td><td>0:10</td><td>37.2%</td><td>1,466</td></tr>
<tr><td>M&amp;A Talks Ep.3 coming soon (recent)</td><td>17 May 2026</td><td>0:11</td><td>42.7%</td><td>1,418</td></tr>
<tr><td>M&amp;A Talks Ep.2 SOON</td><td>29 Apr 2026</td><td>0:13</td><td>65.0%</td><td>1,318</td></tr>
<tr><td>M&amp;A Talks Ep.3 coming soon</td><td>13 May 2026</td><td>0:06</td><td>23.6%</td><td>277</td></tr></table>
<div class="ins"><strong>Insight.</strong> Shorts are doing the work — the top 3 videos are all teaser/coming-soon shorts. The Ep.2 SOON short has the best avg-view percentage at 65% but only 1,318 views; the 1,466-view top short retains just 37%. Trade-off between reach and depth.</div>
<div class="ins"><strong>Concern.</strong> 41% watch-time drop while views are roughly flat means people are clicking but not staying. If shorts grow but long-form watch time keeps falling, channel growth becomes vanity.</div>
<h2>LinkedIn — N5Deal page &middot; Campaign Manager</h2><h3>Page analytics &middot; 20 Apr — 19 May 2026</h3>
<div class="mg">
<div class="mc"><div class="mv">255,355</div><div class="ml">Impressions</div><div class="md up">+222.1%</div></div>
<div class="mc"><div class="mv">140</div><div class="ml">Reactions</div><div class="md up">+89.2%</div></div>
<div class="mc"><div class="mv">3</div><div class="ml">Comments</div><div class="md">0%</div></div>
<div class="mc"><div class="mv">2,982</div><div class="ml">Organic impr.</div><div class="md">1.2% of total</div></div>
<div class="mc"><div class="mv">252,373</div><div class="ml">Sponsored impr.</div><div class="md">98.8% of total</div></div>
<div class="mc"><div class="mv">765</div><div class="ml">Followers</div><div class="md">end of period</div></div>
</div>
<h3>Campaign Manager &middot; 1 — 21 May 2026 (IXNI creative)</h3>
<div class="mg">
<div class="mc"><div class="mv">5,310</div><div class="ml">Reach</div><div class="md">paid</div></div>
<div class="mc"><div class="mv">22</div><div class="ml">Clicks</div><div class="md">paid</div></div>
<div class="mc"><div class="mv">$57.11</div><div class="ml">Spend</div><div class="md">$2.60 per click</div></div>
<div class="mc"><div class="mv">0</div><div class="ml">Leads</div><div class="md dn">conversion still 0</div></div>
<div class="mc"><div class="mv">1.2%</div><div class="ml">Share of Voice</div><div class="md up">+0.94 vs prev 30d</div></div>
</div>
<div class="ins"><strong>Insight.</strong> Impressions ballooned 222% almost entirely because of sponsored content — organic share is just 1.2% (2,982 / 255,355). Engagement on the giant impression base is only 0.06%. The 0 leads from $57 ad spend repeats the conversion problem from the previous report. Need to revisit Lead conversion setup — LinkedIn flagged "Stream conversion signals from your CRM."</div>
<h2>Website — n5deal.com (Google Analytics)</h2><h3>Last 28 days &middot; 23 Apr — 20 May 2026</h3>
<div class="mg">
<div class="mc"><div class="mv">405</div><div class="ml">Sessions</div><div class="md dn">−7.7% vs prev (439)</div></div>
<div class="mc"><div class="mv">223</div><div class="ml">Engaged sessions</div><div class="md dn">−11.2% vs prev (251)</div></div>
<div class="mc"><div class="mv">55.06%</div><div class="ml">Engagement rate</div><div class="md dn">−3.7% vs prev (57.18%)</div></div>
<div class="mc"><div class="mv">45s</div><div class="ml">Avg time / session</div><div class="md up">+4.7% vs prev (43s)</div></div>
<div class="mc"><div class="mv">6.67</div><div class="ml">Events / session</div><div class="md up">+11% vs prev (6.01)</div></div>
<div class="mc"><div class="mv">2,703</div><div class="ml">Event count</div><div class="md up">+2.4% vs prev (2,639)</div></div>
</div>
<h3>Top traffic sources</h3>
<table><tr><th>Source / Medium</th><th>Sessions</th><th>Engaged</th><th>Eng. Rate</th><th>Avg Time</th><th>Events / Session</th><th>Events</th></tr>
<tr><td>(direct) / (none)</td><td>168 (41.5%)</td><td>79</td><td>47.0%</td><td>27s</td><td>4.70</td><td>789</td></tr>
<tr><td>superadmin.n5deals.com / referral</td><td>96 (23.7%)</td><td>65</td><td>67.7%</td><td>54s</td><td>6.75</td><td>648</td></tr>
<tr><td>google / organic</td><td>88 (21.7%)</td><td>52</td><td>59.1%</td><td>52s</td><td>9.10</td><td>801</td></tr>
<tr><td>chatgpt.com / referral</td><td>14 (3.5%)</td><td>7</td><td>50.0%</td><td>31s</td><td>4.14</td><td>58</td></tr>
<tr><td>n5bank.com / referral</td><td>9 (2.2%)</td><td>7</td><td>77.8%</td><td>3m 53s</td><td>16.00</td><td>144</td></tr>
<tr><td>app.clickup.com / referral</td><td>8 (2.0%)</td><td>6</td><td>75.0%</td><td>1m 01s</td><td>12.88</td><td>103</td></tr>
<tr><td>linkedin / paid_social</td><td>6 (1.5%)</td><td>3</td><td>50.0%</td><td>1m 42s</td><td>10.50</td><td>63</td></tr></table>
<div class="ins"><strong>Insight.</strong> google/organic moved up to #3 with 88 sessions (21.7%) — strong improvement vs prior report (27 sessions, 6.2%). High engagement: 59% engaged, 52s avg, 9 events/session. SEO work is paying off. linkedin / paid_social tracked separately now: 6 sessions from $57 spend = $9.52 per visit — expensive for the volume.</div>
<div class="ins"><strong>Outliers worth noting.</strong> n5bank.com referral: only 9 sessions but a 3m 53s average time and 16 events per session — extreme engagement quality. app.clickup.com referral (8 sessions, 75% engagement) is internal team or partner traffic — worth filtering out of analyst-level metrics.</div>
<h2>Cross-channel takeaways</h2>
<div class="ins"><strong>1. Reels beat everything on cost-efficiency.</strong> Ep.2 Reel ad ran $0.10 per click vs $0.21 for the carousel. CTR 4.6% vs 2.8%. Engagement 2,776 vs 332. Next Instagram boost should default to short vertical video unless there&#39;s a specific reason to use static.</div>
<div class="ins"><strong>2. The "great hook, weak hold" problem is consistent.</strong> Reel hook rate 31%, hold rate 5.6%. YouTube shorts top out at 65% avg view but most are below 40%. The first 3–5 seconds work; the middle doesn&#39;t.</div>
<div class="ins"><strong>3. LinkedIn ad spend is the most expensive channel with the worst conversion.</strong> $57 → 22 clicks → 0 leads. Either fix the CRM signal so LinkedIn can optimize (top priority) or pause this budget and reallocate to Instagram Reels which clearly convert.</div>
<div class="ins"><strong>4. SEO is working.</strong> google/organic went from 27 sessions to 88 sessions period-over-period — the biggest organic gain of any channel.</div>
</div>`

const REPORTS: ReportSeed[] = [
  {
    title: 'N5Deal Marketing Report — April 2026',
    periodLabel: 'April 2026 · 1–13 April',
    createdAt: new Date('2026-04-15T10:00:00Z'),
    imgCount: 3,
    html: APR_HTML,
    metrics: APR_METRICS,
    notes: '',
    notesByChannel: { instagram: '', youtube: '', linkedin: '', website: '' },
  },
  {
    title: 'N5Deal Marketing Report — Early May 2026',
    periodLabel: '1 Apr — 1 May 2026',
    createdAt: new Date('2026-05-05T10:00:00Z'),
    imgCount: 9,
    html: MAY_EARLY_HTML,
    metrics: MAY_EARLY_METRICS,
    notes: 'Generated from 9 screenshots (Instagram Insights, YouTube Studio, Medium Analytics, LinkedIn Campaign Manager). Paid Instagram push dominated reach — 89.4% of 55K views from ads. YouTube M&A Talks content gaining traction. LinkedIn ads reaching but not converting.',
    notesByChannel: {
      instagram: 'Major reach growth +94% but follow conversion crisis at -40%. Paid dominated organic 9:1 ratio suggests strategy needs rebalancing.',
      youtube:   'Strong momentum with 6,918 watch time hours. M&A Talks EP2 teaser performing at 1,468 views. Content quality driving retention.',
      linkedin:  'Paid campaigns reaching 66K but 0 lead conversion. CTR and targeting need optimization — budget efficiency low.',
      website:   '',
    },
  },
  {
    title: 'N5Deal Marketing Report — Mid-May 2026',
    periodLabel: '21 Apr — 20 May 2026',
    createdAt: new Date('2026-05-22T10:00:00Z'),
    imgCount: 13,
    html: MAY_MID_HTML,
    metrics: MAY_MID_METRICS,
    notes: 'Paid Instagram drove most activity: $109.92 across two campaigns produced 727 link clicks. Reel format beat carousel ~2x on cost ($0.10 vs $0.21 CPC) and on CTR (4.6% vs 2.8%). YouTube watch time -41% but +6 subs. LinkedIn N5Deal page hit 255K impressions (+222%) — almost entirely sponsored. $57 LinkedIn ad spend = 0 leads (same conversion problem). Website 405 sessions, google/organic now #3 source at 22% — SEO gaining traction.',
    notesByChannel: {
      instagram: 'Two ad campaigns: M&A Talks Ep.2 Reel ($40 → 396 clicks, $0.10 CPC, 4.6% CTR — winner) and Exits-are-engineered carousel ($70 → 331 clicks, $0.21 CPC, 2.8% CTR). Reels beat carousels 2x on cost-efficiency. Hook rate 31% is decent but hold rate 5.6% means audience drops fast — only first 3 seconds work out of a 20-second video. Reach -81% vs prior period — paid push not sustained, organic alone too thin.',
      youtube:   '4,647 views (~flat). Watch time 7.7h, down 41% — concerning. Subscribers +6 (+500% vs prior). M&A Talks shorts driving views: Ep.2 teaser 1,466 views, Ep.3 teaser 1,418. Long-form view-through still the weak link.',
      linkedin:  'Page impressions exploded to 255,355 (+222%) — but 252K of those are sponsored. Organic only 2,982 (1.2% of total). 140 reactions (+89%), 3 comments, 3 reposts. Campaign Manager: 5.31K reach, 22 clicks, $57.11 spent, 0 leads. Same conversion problem as last report. LinkedIn flagged CRM signal missing — top priority to fix.',
      website:   '405 sessions, 55% engagement, 45s avg. Top: direct (41%), superadmin.n5deals.com (24%), google/organic (22%). SEO gaining: google/organic went from 27 sessions last report to 88 here — biggest organic gain. n5bank.com referrals tiny (9) but extreme engagement quality (3m 53s avg, 16 events/session) — high-intent crossover traffic. linkedin/paid_social = $9.52/session, expensive for the volume.',
    },
  },
]

async function main() {
  const project = await prisma.project.findUnique({ where: { id: PROJECT_ID } })
  if (!project) throw new Error(`Project ${PROJECT_ID} not found`)

  // Idempotency: skip any report already in the DB for this project with a
  // matching periodLabel.
  const existing = await prisma.marketingReport.findMany({
    where: { projectId: PROJECT_ID },
    select: { periodLabel: true },
  })
  const have = new Set(existing.map((r) => r.periodLabel))

  let inserted = 0
  let skipped = 0
  for (const r of REPORTS) {
    if (have.has(r.periodLabel)) { skipped++; continue }
    await prisma.marketingReport.create({
      data: {
        projectId: PROJECT_ID,
        title: r.title,
        periodLabel: r.periodLabel,
        html: r.html,
        notes: r.notes,
        notesByChannel: r.notesByChannel,
        metrics: r.metrics,
        imgCount: r.imgCount,
        createdAt: r.createdAt,
      },
    })
    inserted++
  }

  console.log(`\nQ2 2026 marketing reports:`)
  console.log(`  In plan:   ${REPORTS.length}`)
  console.log(`  Inserted:  ${inserted}`)
  console.log(`  Skipped:   ${skipped}`)
  console.log('')
}

main()
  .catch((e) => { console.error('ERROR:', e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
