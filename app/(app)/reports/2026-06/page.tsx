import Link from 'next/link'
import { ArrowLeft, Star } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'N5Deal — Звіт за червень 2026',
}

// ────────────────────────────────────────────────────────────────────────────
// N5Deal — місячний операційний звіт за червень 2026.
// Формат співпадає з PDF-зразком (Link Building — травень 2026): секції
// з таблицями KPI, планами по текстам і LB, вставки для контекстних
// коментарів. Джерела даних: git log за червень (58 commits) + плани з
// PDF брифу.
// ────────────────────────────────────────────────────────────────────────────

// Класи для таблиць що дзеркалять PDF (чорний header, тонкі бордери).
const th = 'bg-black text-white text-left px-3 py-2 text-xs font-bold uppercase tracking-wide border border-gray-300'
const td = 'px-3 py-2 text-sm border border-gray-300 align-top'
const tdMuted = 'px-3 py-2 text-sm border border-gray-300 align-top text-muted-foreground'

export default function JuneReportPage() {
  return (
    <div className="max-w-[1100px] mx-auto pb-24">
      <Link
        href="/reports"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Всі звіти
      </Link>

      {/* ── Огляд ─────────────────────────────────────────────────────────── */}
      <section className="mb-10">
        <h1 className="text-3xl font-bold mb-2">N5Deal — Звіт за червень 2026</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Період: 1 – 30 червня 2026 · Contents · Link Building · Dashboard / Vibecoding
        </p>

        <div className="rounded-lg border-l-4 border-primary bg-muted/30 p-4">
          <div className="flex items-start gap-3">
            <Star className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-sm leading-relaxed">
              <strong>Головне за місяць:</strong> написано 36 нових сторінок — базова M&amp;A / Deal
              Rooms серія (15) + розширення на fintech licensing, cross-border deal mechanics і
              regulatory topics (21). Розміщено 5 профілів і 7 crowd-відповідей (crowd-акаунт після
              цього перманентно забанили — треба переходити на резервний), WEB 2.0 у процесі і
              закриваються 1 липня,
              і <strong>нарешті закупились першими платними outreach-розміщеннями</strong> через{' '}
              <a
                href="https://prnews.io/sites/208157-luckysevenprnewsio.html"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-primary"
              >
                PRNews.io — Lucky Seven
              </a>
              . На дешборді — 58 комітів: новий модуль Press Releases (AP Style для платних wire-ів),
              окремий Glossary модуль (публічний /glossary фід), повна Docker + Hostinger
              інфраструктура для self-host deployment, і Google Docs інтеграція для експорту
              згенерованого контенту.
            </div>
          </div>
        </div>
      </section>

      {/* ── Стратегічні KPI ───────────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3">Стратегічні KPI</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>KPI / Напрямок</th>
                <th className={th}>Травень (факт)</th>
                <th className={th}>Червень (факт)</th>
                <th className={th}>Липень (ціль)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={td}>Розміщені беклінки (Profiles)</td>
                <td className={td}>10</td>
                <td className={td}>
                  <strong>5</strong>
                </td>
                <td className={td}>10+ (в т.ч. відновлення crowd)</td>
              </tr>
              <tr>
                <td className={td}>WEB 2.0</td>
                <td className={td}>5</td>
                <td className={td}>
                  <strong>у процесі</strong> (закриття 1 липня)
                </td>
                <td className={td}>7+</td>
              </tr>
              <tr>
                <td className={td}>Crowd-відповіді</td>
                <td className={td}>3 (Quora)</td>
                <td className={td}>
                  <strong>7 → акаунт забанили</strong>
                </td>
                <td className={td}>10+ (з нового акаунта / Reddit)</td>
              </tr>
              <tr>
                <td className={td}>Нові тексти для блогу</td>
                <td className={td}>20+</td>
                <td className={td}>
                  <strong>36</strong> (15 M&amp;A / Deal Rooms + 21 licensing / fintech)
                </td>
                <td className={td}>25+</td>
              </tr>
              <tr>
                <td className={td}>Платні розміщення (outreach)</td>
                <td className={td}>—</td>
                <td className={td}>
                  <strong>PRNews.io / Lucky Seven</strong> — перша закупка
                </td>
                <td className={td}>2–4 guest posts / press releases</td>
              </tr>
              <tr>
                <td className={td}>Dashboard / Vibecoding</td>
                <td className={td}>MVP-модулі</td>
                <td className={td}>
                  <strong>58 commits · 5 нових модулів</strong>
                </td>
                <td className={td}>Deploy на Hostinger + holding-tool</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Написані сторінки ─────────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3">Написані сторінки (Content Studio)</h2>
        <p className="text-sm text-muted-foreground mb-4">
          36 статей за місяць. Дві серії: (1) базова M&amp;A / Deal Rooms — 15 текстів під запуск
          основного pillar-контенту, (2) розширення на fintech licensing, cross-border deal
          mechanics і regulatory topics — 21 текст. Формати: Guides, Checklists, How-to, Listicles,
          Comparisons, FAQ, Explainers, Industry. Усі за ТЗ і compliance (Red Flags / 256 термінів),
          довжина 700–1&nbsp;200 слів, 3–5 внутрішніх посилань на статтю.
        </p>

        <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-2">
          Серія 1: M&amp;A / Deal Rooms (KD 10–30)
        </h3>
        <div className="overflow-x-auto mb-6">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>#</th>
                <th className={th}>Тема статті</th>
                <th className={th}>Тип</th>
                <th className={th}>KD</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['1', 'What Is an M&A Deal Room?', 'Guide', '12'],
                ['2', 'M&A Due Diligence Checklist for Buyers', 'Checklist', '18'],
                ['3', 'How to Set Up a Virtual Data Room for M&A', 'How-to', '15'],
                ['4', 'M&A Deal Pipeline Management Best Practices', 'Guide', '22'],
                ['5', 'Top 10 Mistakes in M&A Document Management', 'Listicle', '14'],
                ['6', 'Buyer vs Seller Permissions in Deal Rooms', 'Explainer', '10'],
                ['7', 'How to Track Deal Progress in M&A Platforms', 'How-to', '20'],
                ['8', 'Top 7 Tools for M&A Workflow Automation', 'Listicle', '25'],
                ['9', 'Virtual Data Room vs Cloud Storage: What\'s the Difference', 'Comparison', '18'],
                ['10', 'M&A Integration Planning: Step-by-Step Guide', 'Guide', '28'],
                ['11', 'How Banks Use Deal Platforms for M&A Advisory', 'Industry', '30'],
                ['12', 'Top 10 M&A Deal Sourcing Tips for 2026', 'Listicle', '22'],
                ['13', 'Deal Room vs Traditional M&A Process: A Comparison', 'Comparison', '20'],
                ['14', 'FAQ: Everything About M&A Deal Rooms', 'FAQ', '12'],
                ['15', 'Best Practices for Securing M&A Documents', 'Guide', '26'],
              ].map(([n, title, type, kd]) => (
                <tr key={n}>
                  <td className={td}>{n}</td>
                  <td className={td}>{title}</td>
                  <td className={td}>{type}</td>
                  <td className={td}>{kd}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-2">
          Серія 2: Fintech licensing, deal mechanics, regulatory
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>#</th>
                <th className={th}>Тема статті</th>
                <th className={th}>Тип</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['16', 'FCA vs CBI: Which UK or Irish License Is Worth More in M&A', 'Comparison'],
                ['17', 'MSB License in Canada: The Underrated Gateway to North American Payments', 'Guide'],
                ['18', 'PI License in the UK Post-Brexit: What\'s Changed and What It Costs Now', 'Explainer'],
                ['19', 'VASP Registration vs Full Crypto License: What\'s the Difference', 'Comparison'],
                ['20', 'Passporting in the EU After MiCA: What Still Works and What Doesn\'t', 'Explainer'],
                ['21', 'The Hidden Costs of Maintaining a Fintech License', 'Guide'],
                ['22', 'Distressed Fintech Assets: How to Buy Low Without Buying Trouble', 'How-to'],
                ['23', 'How to Value a Fintech License in M&A: The Metrics That Matter', 'How-to'],
                ['24', 'Earn-outs in Fintech M&A: When They Work and When They Destroy Deals', 'Explainer'],
                ['25', 'The 90-Day Pre-Sale Checklist for Fintech Founders', 'Checklist'],
                ['26', 'How Regulatory Fines Affect Fintech Valuations (And How to Recover)', 'Guide'],
                ['27', 'Cross-Border M&A: How to Structure a Deal Between EU and Gulf Entities', 'How-to'],
                ['28', 'RWA Tokenisation in the UAE: A Practical Guide for Asset Issuers', 'Guide'],
                ['29', 'Crypto Adoption in the Gulf: ADGM, DIFC, and VARA Compared', 'Comparison'],
                ['30', 'Hong Kong vs Singapore: Which Asian Hub Wins for Fintech M&A', 'Comparison'],
                ['31', 'The Netherlands as EU Fintech Hub: DNB Licensing', 'Guide'],
                ['32', 'AI-Powered KYC: How Automation Is Changing the Value of Compliance-Heavy Fintechs', 'Industry'],
                ['33', 'The Real Cost of a Data Breach for a Licensed Fintech', 'Explainer'],
                ['34', 'The Anatomy of a Failed Fintech Deal: 5 Real Reasons Transactions Collapse', 'Listicle'],
                ['35', 'What Buyers Actually Read in a Fintech Information Memorandum', 'Explainer'],
                ['36', 'How Long Does a Fintech M&A Deal Actually Take? A Realistic Timeline', 'Guide'],
              ].map(([n, title, type]) => (
                <tr key={n}>
                  <td className={td}>{n}</td>
                  <td className={td}>{title}</td>
                  <td className={td}>{type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Link Building ─────────────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3">Link Building — червень 2026</h2>
        <p className="text-sm text-muted-foreground mb-4">
          За червень фактично розміщено 5 Profile-беклінків і 7 Crowd-відповідей (після чого
          crowd-акаунт перманентно забанили — треба заводити резервний або переходити на Reddit).
          WEB 2.0 у процесі, закриття 1 липня. Перша закупка платних outreach-розміщень пройшла
          через{' '}
          <a
            href="https://prnews.io/sites/208157-luckysevenprnewsio.html"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-primary"
          >
            PRNews.io / Lucky Seven
          </a>
          .
        </p>

        <div className="overflow-x-auto mb-4">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>Напрямок</th>
                <th className={th}>Факт червень</th>
                <th className={th}>Ціль було</th>
                <th className={th}>Статус / коментар</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={td}>Profiles</td>
                <td className={td}>
                  <strong>5</strong>
                </td>
                <td className={td}>7</td>
                <td className={td}>Розміщено. Не добрали 2 через час на переключення після бану crowd</td>
              </tr>
              <tr>
                <td className={td}>WEB 2.0</td>
                <td className={td}>
                  <strong>у процесі</strong>
                </td>
                <td className={td}>7</td>
                <td className={td}>Закриваємо 1 липня (перетікає у липневий звіт)</td>
              </tr>
              <tr className="bg-destructive/5">
                <td className={td}>Crowd</td>
                <td className={td}>
                  <strong>7 → бан</strong>
                </td>
                <td className={td}>7</td>
                <td className={td}>
                  Посилання проставлені, але crowd-акаунт після цього <strong>перманентно забанили</strong>.
                  Резервний акаунт / перехід на Reddit — задача на липень
                </td>
              </tr>
              <tr className="bg-primary/5">
                <td className={td}>
                  <strong>Paid outreach</strong>
                </td>
                <td className={td}>
                  <strong>1 закупка</strong>
                </td>
                <td className={td}>—</td>
                <td className={td}>
                  Закупили платне розміщення на{' '}
                  <a
                    href="https://prnews.io/sites/208157-luckysevenprnewsio.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-primary"
                  >
                    Lucky Seven через PRNews.io
                  </a>
                  . Перший платний channel у нашому LB-міксі
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="rounded-md bg-muted/50 p-3 text-sm space-y-2">
          <div>
            <strong>Що змінилося з травня:</strong>
          </div>
          <ul className="list-disc list-inside space-y-1">
            <li>Кількісно менше беклінків (5 профілів vs 10 у травні) — час пішов на обробку бану crowd-акаунта</li>
            <li>
              <strong>Crowd-акаунт перманентно забанили</strong> після 7 постів — треба заводити
              резервний або переходити на Reddit
            </li>
            <li>WEB 2.0 shifted timing — закриття перетікає на 1 липня</li>
            <li>
              <strong>Перша платна закупка</strong> (PRNews.io / Lucky Seven) — новий тип каналу
              у нашому LB-міксі, дозволяє тестувати outreach на високих DR донорах без outreach-циклів
            </li>
          </ul>
        </div>
      </section>

      {/* ── Dashboard / Vibecoding ────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3">Dashboard / Vibecoding — червень 2026</h2>
        <p className="text-sm text-muted-foreground mb-4">
          58 commits за місяць. 5 нових функціональних областей + повна production deployment
          інфраструктура. Розбивка по темах нижче.
        </p>

        <div className="space-y-5">
          {[
            {
              title: 'Content Studio — генерація сторінок',
              items: [
                'Регенерація з нотатками + пам’ять корекцій (LLM бачить попередні виправлення)',
                'Anti-cliche filter: заборонена лексика і framing правила enforced детерміністично',
                'Fuzzy anchor matching — manually-set анкори більше не пропадають',
                'Keyword coverage rescue: другий LLM-виклик у контексті коли якогось терміну не вистачило',
                'Link enforcer підтримує кілька brief entries з однаковою URL',
                'Save-flow guaranteed: text який згенерувався = text який зберігся (top-up прибрано)',
                'Diff-view після Regenerate-from-notes (стиль Google Docs)',
                'Duplicate brief → new "Copy of…" draft',
                'Manual status-colour tag поруч з title',
                'Copy + notes button — експорт з inline note markers',
              ],
            },
            {
              title: 'Press Releases — новий content type',
              items: [
                'AP Style генерація reusing page brief pipeline',
                'Paid-distribution hard gates baked in: title ≤ 116 chars, body ≤ 500 words',
                'Exactly 2 internal links (nofollow / redirect handled by publisher)',
                'Ad label ("Advertisement" / "На правах реклами" по мові) як перший рядок',
                'Server-side enforcement + WARNING postFixes для violations',
                'Boilerplate ("About Company") автоматично з Knowledge Base',
                'Quotes генеруються в voice компанії; редагуються в editor',
                'Reminder про "Do not show on homepage" CMS-флаг публішера',
              ],
            },
            {
              title: 'Glossary — новий модуль',
              items: [
                'Two-column admin page (phrase + definition)',
                'CRUD інлайн: add / edit / delete',
                'Bulk import: auto-detect separator (tab, |, —, :, TSV, Markdown table)',
                'Slug auto-derived для публічного /glossary фіду на n5deal.com',
                'Per-project + per-language (en / uk / ru) unique constraints',
                'Search + language filter у toolbar',
              ],
            },
            {
              title: 'Marketing OS — контент-планування',
              items: [
                'Bulk-import content plan з JSON',
                'Seed June 2026 content plan (n5deal + BankStore + Ihor + Denys)',
                '4-tab strategy split: Strategy / Four-path / Social / Link Building',
                'Full Q2-Q4 strategy doc import',
                'Marketing Reports: 3 baseline звіти для Q2 2026',
                'Marketing Calendar: 18 site-articles з LB-плану дзеркально',
                'AI-extract content plan from HTML/MD/PDF + merge into existing',
                'Import-and-merge: upload doc, top up only what’s missing',
                'Strategy Notes tab: free-form HTML нотатки прикріплюються до модуля',
              ],
            },
            {
              title: 'LinkBuilding / Tasks',
              items: [
                'Split from general Tasks — окрема "Tasks Andrew" вкладка',
                'AI-driven reclassification: sweep general tasks у Tasks Andrew',
                'Approval workflow + audit-trail timeline',
                'Title-only quick-add + drag-to-status на Board view',
                '"task" type — той самий board, простіша форма для non-link work',
                'Seed June 2026 плану + bulk-import для майбутніх місяців',
                'View toggle + month shift stay on the current page',
                'Bracket-prefix migrator + per-row type',
                'market_news / article / medium / seo route у Tasks Andrew',
              ],
            },
            {
              title: 'Google Docs інтеграція',
              items: [
                'Real Drive API integration — creates the doc з контентом',
                'OAuth flow: auto-resume створення після consent screen',
                'about:blank fix — placeholder tab needs opener access',
                'Bold / italic preservation on import',
                'Arial styling + broader style coverage',
                '"Open in Google Docs" button на articles / pages',
                'Reports: import HTML / MD / PDF / text + auto-extract stats',
              ],
            },
            {
              title: 'Content editor / annotations',
              items: [
                'Inline annotations замість free-form Notes panel',
                'Annotations list moved to right column + expand/collapse',
                'Personal Notes scratchpad поруч з текстом',
                'Click note card → jump to highlight у body',
                'Capture context at actual selection, not first match',
                'Use saved context to pick the right occurrence',
                'Wrap inline-element-crossing selections',
                'Soft-sky-blue highlight замість жовтого',
              ],
            },
            {
              title: 'Auth / Settings',
              items: [
                'Forgot-password flow: Resend email + token + new screen',
                'In-app password reset: admin sets, self-change card',
              ],
            },
            {
              title: 'Deployment infrastructure',
              items: [
                'Multi-stage Dockerfile (Node 20-alpine, standalone output, non-root)',
                'docker-compose.yml: app + Nginx + Certbot sidecar + Obsidian mount',
                'nginx/n5deal.conf: reverse proxy, TLS-ready, SSE-friendly (300s, no buffering)',
                'scripts/setup-vm.sh: one-time VM bootstrap (Docker, firewall, swap, deploy user)',
                'scripts/deploy.sh: git pull → detect schema changes → rebuild → healthcheck',
                'scripts/deploy-vault.sh: rsync Obsidian vault → VM з локальної машини',
                '.env.production.example + DEPLOYMENT.md (10-section guide)',
                '/api/health endpoint для container readiness',
              ],
            },
            {
              title: 'Prompts / quality',
              items: [
                'N5Deal terminology / positioning ruleset baked into усі генерації',
                'Article generation: enforce banned vocab / framing rules deterministically',
                'AI-generate site articles from a topic',
              ],
            },
          ].map((section) => (
            <div key={section.title} className="border rounded-md p-4">
              <div className="font-semibold text-sm mb-2">{section.title}</div>
              <ul className="text-sm space-y-1 list-disc list-inside marker:text-muted-foreground">
                {section.items.map((item, i) => (
                  <li key={i} className="pl-1">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── План на липень ────────────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3">План на липень 2026</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Фокус липня: закриття перенесених WEB 2.0, відновлення crowd (резервний акаунт / Reddit),
          розширення платних outreach-розміщень через PRNews.io, production deploy на Hostinger,
          робота над holding-tool модулем.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>Напрямок</th>
                <th className={th}>Ціль</th>
                <th className={th}>Примітка</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={td}>WEB 2.0 (carry-over)</td>
                <td className={td}>Закрити 7 (з червня)</td>
                <td className={tdMuted}>Закривається 1 липня — це перше що йде у липневий звіт</td>
              </tr>
              <tr>
                <td className={td}>Profiles</td>
                <td className={td}>10+</td>
                <td className={tdMuted}>Наздогнати недобрані 2 з червня + звичайна квота</td>
              </tr>
              <tr>
                <td className={td}>Crowd (відновлення)</td>
                <td className={td}>10+ відповідей</td>
                <td className={tdMuted}>
                  Резервний Quora-акаунт або перехід на Reddit. Без bulk-постингу з одного акаунта —
                  щоб уникнути повторного бану
                </td>
              </tr>
              <tr>
                <td className={td}>Paid outreach</td>
                <td className={td}>2–4 розміщення</td>
                <td className={tdMuted}>
                  Продовження PRNews.io (Lucky Seven чи інші донори з їхньої панелі) + тест іншої
                  outreach-платформи для порівняння цін/якості
                </td>
              </tr>
              <tr>
                <td className={td}>Content Studio</td>
                <td className={td}>20+ нових сторінок</td>
                <td className={tdMuted}>M&A-тематика + перші press releases на реальні події</td>
              </tr>
              <tr>
                <td className={td}>Dashboard</td>
                <td className={td}>Deploy на Hostinger VPS</td>
                <td className={tdMuted}>
                  Provision VPS → setup-vm.sh → cert → перший live deploy. Далі — holding-tool модуль
                </td>
              </tr>
              <tr>
                <td className={td}>Marketing OS</td>
                <td className={td}>Нові модулі</td>
                <td className={tdMuted}>Розширення reports + Marketing Calendar</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Джерела ───────────────────────────────────────────────────────── */}
      <section className="pt-4 border-t text-xs text-muted-foreground">
        <p>
          <strong>Джерела даних:</strong> git log (58 commits за 1 – 30 червня 2026), плановий
          документ Linkbuilding_Vibecoding, поточні tasks у Marketing OS. Дані заповнюються по
          факту виконання; клацніть цифри у таблиці KPI щоб побачити деталі у відповідних розділах
          дашборда.
        </p>
      </section>
    </div>
  )
}
