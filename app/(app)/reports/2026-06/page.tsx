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
              <strong>Головне за місяць:</strong> написано 15 нових сторінок під тематику M&amp;A / Deal
              Rooms, розміщено 25+ беклінків з розширенням на Reddit, guest-пости і dev-платформи, і{' '}
              <strong>нарешті закупились першими платними розміщеннями</strong> (guest-пости на
              нішевих DR-донорах). На дешборді — 58 комітів: новий модуль Press Releases (AP Style
              для платних wire-ів), окремий Glossary модуль (публічний /glossary фід), повна
              Docker + Hostinger інфраструктура для self-host deployment, і Google Docs
              інтеграція для експорту згенерованого контенту.
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
                <td className={td}>Розміщені беклінки</td>
                <td className={td}>20</td>
                <td className={td}>
                  <strong>25+</strong>
                </td>
                <td className={td}>30+</td>
              </tr>
              <tr>
                <td className={td}>Нові тексти для блогу</td>
                <td className={td}>20+</td>
                <td className={td}>
                  <strong>15</strong>
                </td>
                <td className={td}>20+</td>
              </tr>
              <tr>
                <td className={td}>Crowd-відповіді</td>
                <td className={td}>3 (Quora)</td>
                <td className={td}>
                  <strong>7</strong> (Quora + Reddit)
                </td>
                <td className={td}>10+</td>
              </tr>
              <tr>
                <td className={td}>Нові типи донорів</td>
                <td className={td}>—</td>
                <td className={td}>
                  <strong>Reddit, guest-пости, dev-платформи</strong>
                </td>
                <td className={td}>Niche, industry blogs</td>
              </tr>
              <tr>
                <td className={td}>Платні розміщення</td>
                <td className={td}>—</td>
                <td className={td}>
                  <strong>Перший пакет закритий</strong>
                </td>
                <td className={td}>2–4 guest posts</td>
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
          15 статей за місяць. Формати: Guides, Checklists, How-to, Listicles, Comparisons, FAQ,
          Explainers. Усі за ТЗ і compliance (Red Flags / 256 термінів), довжина 700–1&nbsp;200 слів,
          KD-фокус 10–30, 3–5 внутрішніх посилань на статтю.
        </p>
        <div className="overflow-x-auto">
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
      </section>

      {/* ── Link Building ─────────────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3">Link Building — червень 2026</h2>
        <p className="text-sm text-muted-foreground mb-4">
          За червень розміщено 25+ відстежуваних посилань. Розширення на нові типи донорів
          (Reddit, guest-пости, dev-платформи) та контекстні розміщення під свіжі блог-статті.
          Outreach-донори — за вибіркою вебмайстра.
        </p>

        <div className="overflow-x-auto mb-4">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>Напрямок</th>
                <th className={th}>К-сть</th>
                <th className={th}>Ціль</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={td}>Profiles</td>
                <td className={td}>7</td>
                <td className={td}>Розширення брендового сліду + DR-донори</td>
              </tr>
              <tr>
                <td className={td}>WEB 2.0</td>
                <td className={td}>7</td>
                <td className={td}>Контентні беклінки на блог-статті</td>
              </tr>
              <tr>
                <td className={td}>Crowd</td>
                <td className={td}>7</td>
                <td className={td}>Експертні відповіді + контекст-лінки (Quora + Reddit)</td>
              </tr>
              <tr>
                <td className={td}>Guest / Niche</td>
                <td className={td}>2–4</td>
                <td className={td}>Тематичні DR-беклінки, вищий траст</td>
              </tr>
              <tr className="bg-primary/5">
                <td className={td}>
                  <strong>Paid placements</strong>
                </td>
                <td className={td}>
                  <strong>Перший пакет</strong>
                </td>
                <td className={td}>
                  Закупили перший пакет платних guest-пост-розміщень. Нішеві DR-донори; деталі —
                  у LB-таблиці на дешборді
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="rounded-md bg-muted/50 p-3 text-sm">
          <strong>Що змінилося з травня:</strong> у травні LB був чисто organic (Profiles + WEB 2.0
          + Quora). У червні додався Reddit-crowd + перша платна закупка. Guest / Niche направок —
          вперше з’явився у розкладці.
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
          Фокус липня: production deploy на Hostinger, розширення платних розміщень, продовження
          контентної генерації через Content Studio, робота над holding-tool модулем.
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
                <td className={td}>Content Studio</td>
                <td className={td}>20+ нових сторінок</td>
                <td className={tdMuted}>M&A-тематика + перші press releases на реальні події</td>
              </tr>
              <tr>
                <td className={td}>Link Building</td>
                <td className={td}>30+ беклінків</td>
                <td className={tdMuted}>Розширення на niche / industry блоги, 2–4 guest-пости</td>
              </tr>
              <tr>
                <td className={td}>Crowd</td>
                <td className={td}>10+ відповідей</td>
                <td className={tdMuted}>Reddit регулярні відповіді + продовження Quora</td>
              </tr>
              <tr>
                <td className={td}>Paid placements</td>
                <td className={td}>2–4 guest-пости</td>
                <td className={tdMuted}>Продовження закупки на нішевих DR-донорах</td>
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
