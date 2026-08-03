import Link from 'next/link'
import { ArrowLeft, Star } from 'lucide-react'
import { ReportExportButton } from '@/components/app/report-export-button'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'N5Deal — Звіт за липень 2026',
}

// ────────────────────────────────────────────────────────────────────────────
// N5Deal — місячний операційний звіт (ретроспектива) за липень 2026.
// Джерела даних: список опублікованих матеріалів (8 статей блогу + 4 Medium),
// Ahrefs overview (backlinks / DR / organic / AI responses), Ahrefs traffic by
// location, GA4 (Organic Google Search, landing page + query string).
// Стиль дзеркалить червневий звіт (reports/2026-06).
// ────────────────────────────────────────────────────────────────────────────

const th = 'bg-black text-white text-left px-3 py-2 text-xs font-bold uppercase tracking-wide border border-gray-300'
const td = 'px-3 py-2 text-sm border border-gray-300 align-top'
const tdMuted = 'px-3 py-2 text-sm border border-gray-300 align-top text-muted-foreground'
const up = 'text-emerald-600 font-semibold'

export default function JulyReportPage() {
  return (
    <div className="max-w-[1100px] mx-auto pb-24">
      <div className="flex items-center justify-between gap-3 mb-4">
        <Link
          href="/reports"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Всі звіти
        </Link>
        <ReportExportButton title="N5Deal — Звіт за липень 2026" targetId="report-export-root" />
      </div>

      <div id="report-export-root">
        {/* ── Огляд ─────────────────────────────────────────────────────────── */}
        <section className="mb-10">
          <h1 className="text-3xl font-bold mb-2">N5Deal — Звіт за липень 2026</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Період: 1 – 31 липня 2026 · Contents · Link Building · SEO / AI-видимість
          </p>

          <div className="rounded-lg border-l-4 border-primary bg-muted/30 p-4">
            <div className="flex items-start gap-3">
              <Star className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="text-sm leading-relaxed">
                <strong>Головне за місяць:</strong> опубліковано <strong>8 статей у блог</strong>{' '}
                (buyer-focused M&amp;A / fintech licensing) + <strong>4 матеріали на Medium</strong> (WEB 2.0).
                Різкий ріст лінк-профілю: <strong>Domain Rating 6 → 11</strong> (+5), беклінків{' '}
                <strong>+201</strong> (607 усього), реферальних доменів <strong>+179</strong> (455 усього).
                Уперше <strong>з&apos;явилась органіка</strong>: 65 візитів (Ahrefs), 8 органічних ключів,
                value $51 — <em>минулого місяця органічного трафіку не було, тож це перша поява, а не
                «ріст» (ймовірно баг Ahrefs у попередніх даних)</em>. У GA4 за місяць 184 кліки /
                51 648 показів. Уперше <strong>AI-згадки</strong>: Google AI Mode (2) і Perplexity (1).
              </div>
            </div>
          </div>
        </section>

        {/* ── Стратегічні KPI ───────────────────────────────────────────────── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold mb-3">Стратегічні KPI — червень → липень</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={th}>Показник</th>
                  <th className={th}>Червень</th>
                  <th className={th}>Липень</th>
                  <th className={th}>Δ</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Статті в блог', '13', '8', '−5'],
                  ['Medium (WEB 2.0)', '6', '4', '−2'],
                  ['Domain Rating (DR)', '6', '11', '+5'],
                  ['Беклінки', '406', '607', '+201'],
                  ['Реферальні домени', '276', '455', '+179'],
                  ['Органічні ключі', '—', '8', 'вперше'],
                  ['Органічний трафік (Ahrefs)', '—', '65', 'вперше'],
                  ['Traffic value', '—', '$51', 'вперше'],
                  ['AI-згадки (AI Mode + Perplexity)', '0', '3', '+3'],
                ].map(([k, jun, jul, d]) => {
                  const pos = d.startsWith('+') || d === 'вперше'
                  return (
                    <tr key={k}>
                      <td className={td}>{k}</td>
                      <td className={tdMuted}>{jun}</td>
                      <td className={td}><strong>{jul}</strong></td>
                      <td className={td}>
                        <span className={pos ? up : ''}>{d}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Органічний трафік і ключі позначені «вперше»: минулого місяця органіки не було зовсім —
            вона з&apos;явилась лише цього місяця. Місячні «дельти» Ahrefs для органіки не показані як
            «ріст», бо базового періоду фактично не існує (ймовірно баг Ahrefs у попередніх даних).
            DR / беклінки / реф. домени — реальний результат лінкбілдингу.
          </p>
        </section>

        {/* ── Backlink / SEO profile (Ahrefs) ───────────────────────────────── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold mb-3">Backlink &amp; SEO-профіль (Ahrefs)</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Основний драйвер місяця — лінкбілдинг і зростання авторитету домену. DR виріс удвічі
            (6 → 11), додалось 179 нових реферальних доменів.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={th}>Метрика</th>
                  <th className={th}>Значення</th>
                  <th className={th}>Δ за місяць</th>
                  <th className={th}>Коментар</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Domain Rating (DR)', '11', '+5', 'Авторитет домену; подвоєння за місяць'],
                  ['URL Rating (UR)', '5', '—', 'Рейтинг головної сторінки'],
                  ['Ahrefs Rank (AR)', '15 533 503', '▲ 10 490 821', 'Глобальна позиція домену'],
                  ['Беклінки', '607', '+201', 'All-time: 702'],
                  ['Реферальні домени', '455', '+179', 'All-time: 464'],
                  ['Органічні ключі', '8', 'вперше', 'Top-3: 0 (ще попереду)'],
                  ['Органічний трафік', '65', 'вперше', 'Traffic value $51; минулого місяця органіки не було'],
                  ['Платний трафік / ключі / Ads', '0', '—', 'Платний канал не використовувався'],
                ].map(([m, v, d, c]) => (
                  <tr key={m}>
                    <td className={td}>{m}</td>
                    <td className={td}><strong>{v}</strong></td>
                    <td className={td}><span className={d.startsWith('+') || d.startsWith('▲') ? up : ''}>{d}</span></td>
                    <td className={tdMuted}>{c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mt-6 mb-2">
            Органічний трафік за локаціями (Ahrefs — усього 65)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={th}>Локація</th>
                  <th className={th}>Трафік</th>
                  <th className={th}>Частка</th>
                  <th className={th}>Ключі</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['🇦🇪 ОАЕ', '37', '56.9%', '1'],
                  ['🇬🇧 Велика Британія', '12', '18.5%', '1'],
                  ['🇪🇪 Естонія', '6', '9.2%', '1'],
                  ['🇷🇺 росія', '5', '7.7%', '5'],
                  ['🇺🇦 Україна', '5', '7.7%', '1'],
                ].map(([loc, t, s, k]) => (
                  <tr key={loc}>
                    <td className={td}>{loc}</td>
                    <td className={td}>{t}</td>
                    <td className={td}>{s}</td>
                    <td className={td}>{k}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Ця органіка з&apos;явилась уперше цього місяця (минулого — нуль). ОАЕ — домінантний ринок
            (56.9%), що збігається з фокусом контенту на Gulf / MENA (ADGM, DIFC, VARA, Bitcoin MENA).
            росія тягне 5 ключів при малому трафіку.
          </p>
        </section>

        {/* ── AI-видимість ──────────────────────────────────────────────────── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold mb-3">AI-видимість (AI responses — новий індекс)</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Перші згадки бренду в AI-пошуку. Google AI Mode процитував 2 сторінки, Perplexity — 1.
            AI Overviews, ChatGPT, Gemini, Copilot поки без згадок.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={th}>Платформа</th>
                  <th className={th}>Відповіді</th>
                  <th className={th}>Сторінки</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Google AI Mode', '2', '2'],
                  ['Perplexity', '1', '1'],
                  ['AI Overviews', '0', '0'],
                  ['ChatGPT', '0', '0'],
                  ['Gemini', '0', '0'],
                  ['Copilot', '0', '0'],
                  ['Grok (paused)', '0', '0'],
                ].map(([p, r, pg]) => {
                  const active = Number(r) > 0
                  return (
                    <tr key={p}>
                      <td className={td}>{p}</td>
                      <td className={active ? td : tdMuted}>{active ? <strong className={up}>{r} (+{r})</strong> : r}</td>
                      <td className={active ? td : tdMuted}>{active ? <strong>{pg}</strong> : pg}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Органічний трафік (GA4) ───────────────────────────────────────── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold mb-3">Органічний трафік — Google Search (GA4)</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Дані за липень 2026 (Organic Google Search): <strong>184 кліки</strong>,{' '}
            <strong>51 648 показів</strong>, CTR 0.36%, середня позиція 20.18 (є куди рости — багато
            сторінок на 2–3 сторінці видачі). Це фактично перший місяць з органічними даними, тож
            коректного порівняння з попереднім періодом немає.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              ['Organic clicks', '184'],
              ['Impressions', '51 648'],
              ['CTR', '0.36%'],
              ['Сер. позиція', '20.18'],
              ['Active users', '36'],
              ['Engaged sessions', '135'],
              ['Лендингів у видачі', '429+'],
              ['Топ-сторінка', '/ (97 кліків)'],
            ].map(([label, val]) => (
              <div key={label} className="border rounded-md p-3">
                <div className="text-lg font-bold">{val}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={th}>#</th>
                  <th className={th}>Сторінка</th>
                  <th className={th}>Кліки</th>
                  <th className={th}>Покази</th>
                  <th className={th}>CTR</th>
                  <th className={th}>Сер. позиція</th>
                  <th className={th}>Users</th>
                  <th className={th}>Engaged</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['1', '/', '97', '710', '13.66%', '6.48', '22', '60'],
                  ['2', '/articles/155-psp-licensing-key-requirements-and-challenges-for-2026', '6', '1 138', '0.53%', '8.69', '0', '0'],
                  ['3', '/all-listing/482-payment-uganda', '5', '8', '62.5%', '5.38', '2', '4'],
                  ['4', '/incorporation-license/crypto/license-description/crypto-exchange-license', '5', '8 535', '0.06%', '20.74', '1', '0'],
                  ['5', '/events/bitcoin-mena-2026-bitcoin-focused-conference-in-abu-dhabi', '4', '388', '1.03%', '7.66', '0', '0'],
                  ['6', '/incorporation-license/crypto', '3', '3 684', '0.08%', '32.12', '0', '0'],
                  ['7', '/incorporation-license/fintech/fintech-lithuania-e-money-institution-license', '3', '1 145', '0.26%', '27.82', '0', '0'],
                  ['8', '/incorporation-license/fintech/license-description/money-transmitter-license', '3', '1 161', '0.26%', '30.75', '0', '0'],
                  ['9', '/all-listing/479-payment-nigeria', '2', '27', '7.41%', '11.30', '2', '2'],
                  ['10', '/events/web-summit-2026-global-technology-and-startup-conference', '2', '567', '0.35%', '8.41', '0', '0'],
                ].map(([n, page, clicks, impr, ctr, pos, users, eng]) => (
                  <tr key={n}>
                    <td className={td}>{n}</td>
                    <td className={`${td} text-xs break-all`}>{page}</td>
                    <td className={td}>{clicks}</td>
                    <td className={td}>{impr}</td>
                    <td className={td}>{ctr}</td>
                    <td className={td}>{pos}</td>
                    <td className={td}>{users}</td>
                    <td className={td}>{eng}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Джерело: GA4 — Organic Google Search, вимір «Landing page + query string». Топ-10 із 429+
            лендингів. Головна дає 53% кліків; crypto-exchange-license має 8,5k показів при позиції
            20.7 — кандидат №1 на оптимізацію (великий попит, ще низько).
          </p>
        </section>

        {/* ── Обсяг публікацій + лінкбілдинг ─────────────────────────────────── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold mb-3">Обсяг публікацій</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Фокус контенту — buyer-side M&amp;A (як купувати ліцензований фінтех, оцінка активів,
            due diligence) та порівняння юрисдикцій. Конкретні теми — у Content Studio / контент-плані.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ['8', 'статей у блог'],
              ['4', 'публікації WEB 2.0 (Medium)'],
              ['—', 'Profiles (посилання буде додано)'],
              ['—', 'ще WEB 2.0 (посилання буде додано)'],
            ].map(([val, label]) => (
              <div key={label} className="border rounded-md p-4">
                <div className="text-3xl font-bold">{val}</div>
                <div className="text-xs text-muted-foreground mt-1">{label}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Посилання на <strong>Profiles</strong> і <strong>WEB 2.0</strong> будуть додані згодом —
            щойно надішлеш, впишу їх у таблицю з донорами / DR (як у червневому звіті).
          </p>
        </section>
      </div>
    </div>
  )
}
