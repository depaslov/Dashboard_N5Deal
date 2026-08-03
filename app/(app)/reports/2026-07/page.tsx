import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowLeft, Star, AlertTriangle } from 'lucide-react'
import { ReportExportButton } from '@/components/app/report-export-button'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'N5Deal — Загальний звіт за липень 2026',
}

// ────────────────────────────────────────────────────────────────────────────
// N5Deal — загальний операційний звіт за липень 2026.
// Джерела: Ahrefs (backlinks / organic / AI responses), GA4 (сторінки + воронка),
// LinkedIn Analytics (3 фаундери + сторінка компанії), X / Threads, реєстр лідів.
// Підготовлено 3 серпня 2026.
// ────────────────────────────────────────────────────────────────────────────

const th = 'bg-black text-white text-left px-3 py-2 text-xs font-bold uppercase tracking-wide border border-gray-300'
const td = 'px-3 py-2 text-sm border border-gray-300 align-top'
const tdMuted = 'px-3 py-2 text-sm border border-gray-300 align-top text-muted-foreground'
const up = 'text-emerald-600 font-semibold'

// «ДІЯ» — рекомендація до дії (amber callout).
function Action({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-950/20 px-3 py-2.5 text-sm my-3 leading-relaxed">
      <strong className="text-amber-700 dark:text-amber-400">ДІЯ:</strong> {children}
    </div>
  )
}

function H2({ children }: { children: ReactNode }) {
  return <h2 className="text-xl font-bold mb-3">{children}</h2>
}

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
        <ReportExportButton title="N5Deal — Загальний звіт за липень 2026" targetId="report-export-root" />
      </div>

      <div id="report-export-root">
        {/* ── Головне за місяць ──────────────────────────────────────────────── */}
        <section className="mb-10">
          <h1 className="text-3xl font-bold mb-2">N5Deal — Загальний звіт за липень 2026</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Період: 1–31 липня 2026 · SEO · Контент · Лінкбілдинг · Соціальні мережі · Трафік · Ліди
          </p>

          <H2>Головне за місяць</H2>
          <div className="rounded-lg border-l-4 border-primary bg-muted/30 p-4 mb-4">
            <div className="flex items-start gap-3">
              <Star className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="text-sm leading-relaxed">
                Липень — перший місяць, у якому N5Deal одночасно отримав вимірюваний органічний
                канал і масштабне охоплення в соціальних мережах. Обидва напрями стартували фактично
                з нуля, тому місяць правильніше читати як <strong>точку відліку, а не як приріст</strong>.
              </div>
            </div>
          </div>

          <ul className="text-sm space-y-2 leading-relaxed list-disc list-inside marker:text-muted-foreground mb-4">
            <li><strong>Лінкбілдинг</strong> дав основний результат по SEO: Domain Rating 6 → 11, +201 беклінк (607), +179 реферальних доменів (455).</li>
            <li>Уперше з&apos;явилась <strong>органіка</strong>: 8 ключів, 65 візитів за Ahrefs, traffic value $51. У GA4 — 184 кліки при 51 648 показах.</li>
            <li>Перші згадки бренду в <strong>AI-пошуку</strong>: Google AI Mode — 2, Perplexity — 1. Плюс 6 сесій на сайт із chatgpt.com.</li>
            <li><strong>LinkedIn</strong> трьох фаундерів дав 245 287 показів і 155 684 охоплених учасників за місяць — з них 83% на акаунті Ігоря.</li>
            <li>Опубліковано <strong>10 статей у блог, 8 WEB 2.0, 8 Profiles</strong>. Закрито три інфраструктурні задачі: конкурентний аналіз, GA4 + Clarity, нові сторінки сайту.</li>
            <li>Запущено регулярне ведення LinkedIn Єгора і акаунти в <strong>X (Twitter)</strong> — і особистий, і брендовий.</li>
          </ul>

          <div className="rounded-lg border-l-4 border-red-500 bg-red-50 dark:bg-red-950/20 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm leading-relaxed">
                <strong>Головний ризик місяця:</strong> зростання тримається на кількох окремих постах
                і на першій хвилі лінкбілдингу. У GA4 <strong>не зафіксовано жодної ключової події</strong>,
                тобто трафік поки не переведений у вимірювані заявки. Це головний блокер серпня —
                деталі в розділі «Трафік і воронка».
              </div>
            </div>
          </div>
        </section>

        {/* ── Зведені показники ─────────────────────────────────────────────── */}
        <section className="mb-10">
          <H2>Зведені показники</H2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={th}>Показник</th>
                  <th className={th}>Червень</th>
                  <th className={th}>Липень</th>
                  <th className={th}>Зміна</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Статті в блог', '13', '10', '−3'],
                  ['WEB 2.0 (Medium)', '6', '8', '+2'],
                  ['Profiles (лінкбілдинг)', '7', '8', '+1'],
                  ['Domain Rating (DR)', '6', '11', '+5'],
                  ['Беклінки', '406', '607', '+201'],
                  ['Реферальні домени', '276', '455', '+179'],
                  ['Органічні ключі', '—', '8', 'уперше'],
                  ['Органічний трафік (Ahrefs)', '—', '65', 'уперше'],
                  ['Traffic value', '—', '$51', 'уперше'],
                  ['AI-згадки (AI Mode + Perplexity)', '0', '3', '+3'],
                  ['Покази LinkedIn (3 фаундери)', 'н/д', '245 287', 'перший замір'],
                  ['Переходи на сайт із LinkedIn', 'н/д', '338', 'перший замір'],
                  ['Сесії на сайті (GA4, очищені)', 'н/д', '449', 'перший замір'],
                ].map(([k, jun, jul, d]) => {
                  const pos = d.startsWith('+') || d === 'уперше' || d === 'перший замір'
                  return (
                    <tr key={k}>
                      <td className={td}>{k}</td>
                      <td className={tdMuted}>{jun}</td>
                      <td className={td}><strong>{jul}</strong></td>
                      <td className={td}><span className={pos ? up : ''}>{d}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            Показники, позначені «уперше» та «перший замір», не мають базового періоду — місяць до
            цього органіки і соцаналітики по цих акаунтах не існувало. Дельти по DR, беклінках і
            реферальних доменах — реальний результат лінкбілдингу.
          </p>
        </section>

        {/* ── 1. SEO, контент і лінкбілдинг ─────────────────────────────────── */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">1. SEO, контент і лінкбілдинг</h2>

          <h3 className="text-lg font-bold mb-2">Backlink-профіль (Ahrefs)</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Основний драйвер місяця. DR виріс майже вдвічі, реферальна база збільшилась у 1,6 раза.
          </p>
          <div className="overflow-x-auto mb-6">
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
                  ['Domain Rating (DR)', '11', '+5', 'Авторитет домену'],
                  ['URL Rating (UR)', '5', '—', 'Рейтинг головної сторінки'],
                  ['Ahrefs Rank (AR)', '15 533 503', '▲ 10 490 821', 'Глобальна позиція домену'],
                  ['Беклінки', '607', '+201', 'All-time: 702'],
                  ['Реферальні домени', '455', '+179', 'All-time: 464'],
                  ['Органічні ключі', '8', 'уперше', 'Top-3: 0'],
                  ['Органічний трафік', '65', 'уперше', 'Traffic value $51'],
                  ['Платний трафік / Ads', '0', '—', 'Канал не використовувався'],
                ].map(([m, v, d, c]) => {
                  const pos = d.startsWith('+') || d.startsWith('▲') || d === 'уперше'
                  return (
                    <tr key={m}>
                      <td className={td}>{m}</td>
                      <td className={td}><strong>{v}</strong></td>
                      <td className={td}><span className={pos ? up : ''}>{d}</span></td>
                      <td className={tdMuted}>{c}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <h3 className="text-lg font-bold mb-2">Органічний трафік за локаціями</h3>
          <div className="overflow-x-auto mb-3">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={th}>Локація</th>
                  <th className={th}>Трафік</th>
                  <th className={th}>Частка</th>
                  <th className={th}>Ключі</th>
                  <th className={th}>Читання</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['🇦🇪 ОАЕ', '37', '56,9%', '1', 'Домінантний ринок'],
                  ['🇬🇧 Велика Британія', '12', '18,5%', '1', 'Цільовий'],
                  ['🇪🇪 Естонія', '6', '9,2%', '1', 'Цільовий'],
                  ['🇷🇺 росія', '5', '7,7%', '5', 'Нецільовий'],
                  ['🇺🇦 Україна', '5', '7,7%', '1', 'Внутрішній'],
                ].map(([loc, t, s, k, r]) => (
                  <tr key={loc}>
                    <td className={td}>{loc}</td>
                    <td className={td}>{t}</td>
                    <td className={td}>{s}</td>
                    <td className={td}>{k}</td>
                    <td className={tdMuted}>{r}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted-foreground mb-1 leading-relaxed">
            ОАЕ дають 56,9% усієї органіки з одного ключа — це прямий наслідок фокусу контенту на
            Gulf/MENA (ADGM, DIFC, VARA, Bitcoin MENA). Водночас росія тягне 5 ключів із 8 при
            мінімальному трафіку: половина видимості домену припадає на ринок, з якого не буде угод.
          </p>
          <Action>
            Перевірити, за якими саме запитами ранжуємось у ру-сегменті, і чи не тягне це
            нерелевантні сторінки в індекс. Для серпня — цілитись у другий ключ по ОАЕ і по UK.
          </Action>

          <h3 className="text-lg font-bold mb-2 mt-6">Google Search (GA4) — сторінки</h3>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            184 кліки, 51 648 показів, CTR 0,36%, середня позиція 20,18. Понад 429 лендингів уже
            присутні у видачі — тобто база сторінок є, але переважно на 2–3 сторінці.
          </p>
          <div className="overflow-x-auto mb-3">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={th}>Сторінка</th>
                  <th className={th}>Кліки</th>
                  <th className={th}>Покази</th>
                  <th className={th}>CTR</th>
                  <th className={th}>Сер. позиція</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['/ (головна)', '97', '710', '13,66%', '6,48'],
                  ['/articles/155-psp-licensing-key-requirements-and-challenges-for-2026', '6', '1 138', '0,53%', '8,69'],
                  ['/all-listing/482-payment-uganda', '5', '8', '62,5%', '5,38'],
                  ['/incorporation-license/crypto/license-description/crypto-exchange-license', '5', '8 535', '0,06%', '20,74'],
                  ['/events/bitcoin-mena-2026-bitcoin-focused-conference-in-abu-dhabi', '4', '388', '1,03%', '7,66'],
                  ['/incorporation-license/crypto', '3', '3 684', '0,08%', '32,12'],
                  ['/incorporation-license/fintech/fintech-lithuania-e-money-institution-license', '3', '1 145', '0,26%', '27,82'],
                  ['/incorporation-license/fintech/license-description/money-transmitter-license', '3', '1 161', '0,26%', '30,75'],
                  ['/all-listing/479-payment-nigeria', '2', '27', '7,41%', '11,30'],
                  ['/events/web-summit-2026-global-technology-and-startup-conference', '2', '567', '0,35%', '8,41'],
                ].map(([page, clicks, impr, ctr, pos]) => (
                  <tr key={page}>
                    <td className={`${td} text-xs break-all`}>{page}</td>
                    <td className={td}>{clicks}</td>
                    <td className={td}>{impr}</td>
                    <td className={td}>{ctr}</td>
                    <td className={td}>{pos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted-foreground mb-1 leading-relaxed">
            Головна дає 53% усіх кліків. Найцінніший інсайт — сторінка crypto-exchange-license:
            8 535 показів при позиції 20,74 і CTR 0,06%. Попит на неї найбільший на сайті, а конверсія
            в клік майже нульова через позицію. Це кандидат №1 на оптимізацію: підняття з ~20 до ~8
            позиції дає прогнозовано найбільший приріст кліків серед усіх сторінок.
          </p>
          <Action>
            Серпень: переписати title/description і розширити crypto-exchange-license,
            /incorporation-license/crypto та money-transmitter-license (усі три — тисячі показів при
            позиції 20–32). Це три сторінки з найбільшим розривом «попит / позиція».
          </Action>

          <h3 className="text-lg font-bold mb-2 mt-6">AI-видимість</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Перші згадки бренду в AI-пошуку. Новий індекс — базового періоду немає.
          </p>
          <div className="overflow-x-auto mb-3">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={th}>Платформа</th>
                  <th className={th}>Відповіді</th>
                  <th className={th}>Сторінки</th>
                  <th className={th}>Статус</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Google AI Mode', '2', '2', 'перші згадки'],
                  ['Perplexity', '1', '1', 'перші згадки'],
                  ['AI Overviews', '0', '0', '—'],
                  ['ChatGPT', '0', '0', 'але 6 сесій на сайт'],
                  ['Gemini', '0', '0', '—'],
                  ['Copilot', '0', '0', '—'],
                  ['Grok', '0', '0', 'на паузі'],
                ].map(([p, r, pg, st]) => {
                  const active = Number(r) > 0
                  return (
                    <tr key={p}>
                      <td className={td}>{p}</td>
                      <td className={active ? td : tdMuted}>{active ? <strong className={up}>{r}</strong> : r}</td>
                      <td className={active ? td : tdMuted}>{active ? <strong>{pg}</strong> : pg}</td>
                      <td className={tdMuted}>{st}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted-foreground mb-1 leading-relaxed">
            <strong>Важливе неспівпадіння:</strong> ChatGPT показує 0 згадок в індексі, але GA4
            фіксує 6 сесій із chatgpt.com за період. Тобто модель веде людей на сайт, хоча трекер
            згадок цього не бачить. Реальна AI-видимість вища за виміряну.
          </p>
          <Action>
            Додати chatgpt.com / perplexity.ai як окремий сегмент у GA4, щоб AI-канал рахувався
            трафіком, а не тільки згадками.
          </Action>

          <h3 className="text-lg font-bold mb-2 mt-6">Обсяг публікацій і закриті задачі</h3>
          <ul className="text-sm space-y-2 leading-relaxed list-disc list-inside marker:text-muted-foreground">
            <li><strong>10 статей у блог</strong> — фокус buyer-side M&amp;A: як купувати ліцензований фінтех, оцінка активів, due diligence, порівняння юрисдикцій.</li>
            <li><strong>8 публікацій WEB 2.0</strong> (Medium) + <strong>8 Profiles</strong>.</li>
            <li><strong>Конкурентний аналіз:</strong> оцінено контентне покриття блогів конкурентів і їхні позиції; сформовано пріоритетні кластери для доповнення блогу.</li>
            <li><strong>Аналітична інфраструктура:</strong> повністю налаштовано GA4 (події, звітність по каналах) + підключено Microsoft Clarity (теплові карти, записи сесій).</li>
            <li><strong>Наповнення сайту:</strong> підготовлено й опубліковано нові сторінки — розширює обсяг індексованого контенту й кількість точок входу.</li>
          </ul>
        </section>

        {/* ── 2. Соціальні мережі ───────────────────────────────────────────── */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">2. Соціальні мережі</h2>

          <h3 className="text-lg font-bold mb-2">LinkedIn — зведення по акаунтах</h3>
          <p className="text-sm text-muted-foreground mb-4">Період: 1 липня – 1 серпня 2026.</p>
          <div className="overflow-x-auto mb-3">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={th}>Акаунт</th>
                  <th className={th}>Покази</th>
                  <th className={th}>Охоплення</th>
                  <th className={th}>Соц. дії</th>
                  <th className={th}>Кліки</th>
                  <th className={th}>Поза мережею</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className={td}>Ihor Vlasov</td><td className={td}>204 638</td><td className={td}>131 092</td><td className={td}>561</td><td className={td}>280</td><td className={td}>96%</td></tr>
                <tr><td className={td}>Denys Bets</td><td className={td}>35 445</td><td className={td}>22 217</td><td className={td}>371</td><td className={td}>52</td><td className={td}>87%</td></tr>
                <tr><td className={td}>Egor Podkolzin</td><td className={td}>5 204</td><td className={td}>2 375</td><td className={td}>111</td><td className={td}>6</td><td className={td}>59%</td></tr>
                <tr className="bg-muted/40 font-semibold"><td className={td}>Разом</td><td className={td}>245 287</td><td className={td}>155 684</td><td className={td}>1 043</td><td className={td}>338</td><td className={td}>—</td></tr>
                <tr><td className={td}>Сторінка N5Deal</td><td className={td}>181 перегляд</td><td className={td}>85 унік.</td><td className={tdMuted}>—</td><td className={td}>0</td><td className={tdMuted}>—</td></tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            Ігор дає 83% усіх показів і 83% усіх переходів на сайт. Це не рівномірна мережа з трьох
            акаунтів, а один основний канал і два допоміжні — і планувати серпень треба з цього.
          </p>

          <h3 className="text-lg font-bold mb-2">Зворотна залежність: чим менший акаунт, тим тепліша аудиторія</h3>
          <div className="overflow-x-auto mb-3">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={th}>Акаунт</th>
                  <th className={th}>Соц. дії / показ</th>
                  <th className={th}>Поза мережею</th>
                  <th className={th}>Що це означає</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Egor', '2,13%', '59%', 'вузьке, але залучене коло'],
                  ['Denys', '1,05%', '87%', 'баланс охоплення й реакції'],
                  ['Ihor', '0,27%', '96%', 'широке холодне охоплення'],
                ].map(([a, e, o, m]) => (
                  <tr key={a}>
                    <td className={td}>{a}</td>
                    <td className={td}>{e}</td>
                    <td className={td}>{o}</td>
                    <td className={tdMuted}>{m}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            96% охоплення Ігоря — поза мережею. Алгоритм розносить його контент на холодну аудиторію,
            тому охоплення майже не залежить від кількості підписників. Практичний висновок: ріст
            фоловерів і ріст охоплення на цих акаунтах — це дві різні задачі, і в KPI їх треба розводити.
          </p>

          <h3 className="text-lg font-bold mb-2">Топ-пости місяця</h3>
          <div className="overflow-x-auto mb-3">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={th}>Акаунт</th>
                  <th className={th}>Пост</th>
                  <th className={th}>Покази</th>
                  <th className={th}>Взаємодії</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Ihor', 'Zilch купив AB Fjord Bank за $38M — литовський банк, $120M активів, ліцензія ЄЦБ', '90 000', '467'],
                  ['Ihor', 'Jamie Dimon: $10–20B на M&A, $40–50B надлишкового капіталу', '89 000', '112'],
                  ['Denys', 'Парламент Британії розслідує блокування крипто-платежів банками', '24 000', '166'],
                  ['Ihor', 'Capital One закрив купівлю Brex — $5,15B', '8 000', '30'],
                  ['Denys', 'Литовський EMI: €500K і 12 міс. у 2022 → €3M+ на вторинці у 2026', '2 000', '43'],
                  ['Egor', 'Nubank купив банк 1992 року, про який ніхто не чув', '1 464', '11'],
                ].map(([a, post, imp, eng], i) => (
                  <tr key={i}>
                    <td className={td}>{a}</td>
                    <td className={td}>{post}</td>
                    <td className={td}>{imp}</td>
                    <td className={td}>{eng}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted-foreground mb-2 leading-relaxed">
            <strong>Патерн підтверджений на двох акаунтах незалежно.</strong> У Ігоря топ-2 пости дали
            179K з 204K показів (88%). У Дениса один пост дав 24K з 35,4K (68%). Спрацьовує один тип контенту:
          </p>
          <ul className="text-sm space-y-1 leading-relaxed list-disc list-inside marker:text-muted-foreground mb-2">
            <li>конкретна угода або регуляторна подія;</li>
            <li>точна сума і дата в першому реченні;</li>
            <li>пояснення, чому це важливо для покупця активу.</li>
          </ul>
          <p className="text-sm text-muted-foreground mb-1 leading-relaxed">
            Пост Дениса про литовський EMI (€500K у 2022 → €3M+ у 2026) — найточніша ілюстрація: він
            продає саму тезу вторинного ринку ліцензій, тобто продукт N5Deal, без прямої реклами.
          </p>
          <Action>
            Серпень: закріпити формат «угода + сума + що це означає для покупця» як основний для Ігоря
            і Дениса. Планувати 2–3 такі пости на тиждень замість рівномірного мікс-контенту.
          </Action>
          <Action>
            На акаунті Ігоря висить попередження LinkedIn: листи не доходять на одну з адрес, потрібно
            підтвердити email. Перетинається з блоком верифікації для реклами в X — вирішувати разом
            із фінансами.
          </Action>

          <h3 className="text-lg font-bold mb-2 mt-6">Сторінка компанії N5Deal (LinkedIn)</h3>
          <div className="overflow-x-auto mb-3">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={th}>Показник</th>
                  <th className={th}>Липень</th>
                  <th className={th}>Зміна</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Підписники', '812', '+28 за 30 днів (+115,4%)'],
                  ['Джерело приросту', '28 органічних', 'Sponsored — 0'],
                  ['Перегляди сторінки', '181', '+9,7%'],
                  ['Унікальні відвідувачі', '85', '−2,3%'],
                  ['Кліки по кастомній кнопці', '0', '—'],
                  ['Desktop / Mobile', '116 / 65', '—'],
                ].map(([k, v, c]) => (
                  <tr key={k}>
                    <td className={td}>{k}</td>
                    <td className={td}><strong>{v}</strong></td>
                    <td className={tdMuted}>{c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted-foreground mb-1 leading-relaxed">
            Перегляди ростуть, а унікальні відвідувачі падають — сторінку відкривають ті самі люди
            частіше, нової аудиторії майже немає. Це очікувано: компанійські сторінки органічно не
            ростуть, охоплення треба заводити з особистих акаунтів фаундерів. Нуль кліків по кнопці за
            місяць — окрема проблема.
          </p>
          <Action>
            Перевірити кастомну кнопку на сторінці N5Deal: чи вона взагалі налаштована, який у неї
            текст і куди веде. 0 кліків при 181 перегляді — це або відсутня кнопка, або нерелевантний CTA.
          </Action>

          <h3 className="text-lg font-bold mb-2 mt-6">X (Twitter)</h3>
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
            У липні запущено два напрями: брендовий акаунт @N5Deal і особистий акаунт Єгора. Обидва
            стартували з нуля.
          </p>
          <p className="text-sm font-semibold mb-1">@N5Deal</p>
          <p className="text-sm text-muted-foreground mb-2 leading-relaxed">
            Постинг регулярний, переважно листинги активів: Swiss AG (SRO, VASP), Mauritius Investment
            Dealer, Cyprus STP Brokerage (CIF), Canada BC MSB, USA Delaware MSB, Cayman VASP + SIBL, UK
            Authorised EMI.
          </p>
          <ul className="text-sm space-y-1 leading-relaxed list-disc list-inside marker:text-muted-foreground mb-3">
            <li>Покази: 13–17 на пост. Лайки: 0–1. Репости: 0–1.</li>
            <li>Пост від 29.07 отримав 1 показ; його дубль від 3.08 — 0 показів.</li>
          </ul>
          <p className="text-sm font-semibold mb-1">Особистий акаунт Єгора</p>
          <ul className="text-sm space-y-1 leading-relaxed list-disc list-inside marker:text-muted-foreground mb-3">
            <li>Пости від 28–29.07: 3–7 показів кожен, 0 реакцій.</li>
          </ul>
          <p className="text-sm text-muted-foreground mb-1 leading-relaxed">
            Обидва акаунти поки холодні: органічної дистрибуції немає. При такому рівні показів контент
            якісний чи ні — різниці не видно, бо його ніхто не бачить. Спершу потрібен розігрів акаунта,
            потім оцінка контенту.
          </p>
          <Action>
            Окремо перевірити пости з 0–1 показом (29.07 та 3.08) — це схоже на технічне обмеження
            акаунта, а не на слабкий контент. Якщо підтвердиться — звертатись у підтримку X.
          </Action>

          <h3 className="text-lg font-bold mb-2 mt-6">Реклама в X</h3>
          <p className="text-sm text-muted-foreground mb-1 leading-relaxed">
            Запущено першу платну кампанію. Кампанія не крутиться: акаунт вимагає верифікації,
            потрібно, щоб фінансовий відділ перевірив пошту й підтвердив дані.
          </p>
          <Action>
            Блокер серпня. Поки верифікація не пройдена, платний канал у X = 0 і всі планові показники
            по ньому недосяжні. Ескалювати фінансам як задачу з дедлайном.
          </Action>

          <h3 className="text-lg font-bold mb-2 mt-6">Threads</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Аналітика недоступна до 100 підписників, тому вимірюваних показників немає. Фактично —
            стабільні 1–2 тис. переглядів на місяць. Результат за місяць: один партнерський дзвінок.
            Канал у режимі присутності. KPI по ньому не ставимо, поки не пройдено поріг 100 підписників.
          </p>
        </section>

        {/* ── 3. Трафік і воронка (GA4) ─────────────────────────────────────── */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">3. Трафік і воронка (GA4)</h2>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            Дані за 6 липня – 2 серпня 2026 (28 днів). Загалом: 551 сесія, 341 залучена,
            engagement rate 61,89%, середній час 1 хв 47 с, 11 239 подій.
          </p>

          <h3 className="text-lg font-bold mb-2">Джерела трафіку</h3>
          <div className="overflow-x-auto mb-4">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={th}>Джерело / канал</th>
                  <th className={th}>Сесії</th>
                  <th className={th}>Частка (сира)</th>
                  <th className={th}>Частка (чиста)</th>
                  <th className={th}>Engagement</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['(direct) / (none)', '221', '40,1%', '49,2%', '63,8%'],
                  ['google / organic', '191', '34,7%', '42,5%', '64,4%'],
                  ['localhost:3000 / referral', '85', '15,4%', 'виключено', '56,5%'],
                  ['superadmin.n5deals.com', '10', '1,8%', 'виключено', '70,0%'],
                  ['online.seranking.com', '7', '1,3%', 'виключено', '28,6%'],
                  ['chatgpt.com / ai-assistant', '6', '1,1%', '1,3%', '50,0%'],
                  ['linkedin.com / referral', '6', '1,1%', '1,3%', '66,7%'],
                  ['n5bank.com / referral', '6', '1,1%', '1,3%', '83,3%'],
                  ['інші (11 джерел)', '19', '3,4%', '4,2%', '—'],
                ].map(([src, s, raw, clean, eng]) => (
                  <tr key={src}>
                    <td className={`${td} text-xs`}>{src}</td>
                    <td className={td}>{s}</td>
                    <td className={td}>{raw}</td>
                    <td className={clean === 'виключено' ? tdMuted : td}>{clean}</td>
                    <td className={td}>{eng}</td>
                  </tr>
                ))}
                <tr className="bg-muted/40 font-semibold">
                  <td className={td}>РАЗОМ</td>
                  <td className={td}>551</td>
                  <td className={td}>100%</td>
                  <td className={td}>449 чистих</td>
                  <td className={td}>61,9%</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="text-lg font-bold mb-3">Три проблеми, які треба закрити до серпневого звіту</h3>

          <p className="text-sm font-bold mb-1">1. 18,5% трафіку — це службовий шум</p>
          <p className="text-sm text-muted-foreground mb-1 leading-relaxed">
            localhost:3000 (85 сесій), superadmin.n5deals.com (10) та online.seranking.com (7) — це
            разом 102 сесії девелоперського і сканерського трафіку. Реальна база місяця — 449 сесій, а
            не 551. У чистому розрізі органіка займає 42,5%, а не 34,7%.
          </p>
          <Action>
            Поставити фільтри в GA4 на localhost, superadmin-піддомени і seranking. Без цього серпень
            порівнюватиметься з завищеним липнем і виглядатиме як падіння.
          </Action>

          <p className="text-sm font-bold mb-1 mt-4">2. Ключові події = 0</p>
          <p className="text-sm text-muted-foreground mb-1 leading-relaxed">
            По всіх без винятку джерелах Key events показує 0,00. У липні закрито задачу «повне
            налаштування GA4: події, конверсії, наскрізна воронка» — але конверсійних подій у звіті
            немає. Це означає, що або цільові дії не позначені як key events, або вони не спрацьовують.
          </p>
          <p className="text-sm text-muted-foreground mb-1 leading-relaxed">
            <strong>Наслідок:</strong> увесь звіт зараз показує трафік і охоплення без жодного
            результату. Ми не можемо сказати, скільки заявок дав органічний канал чи LinkedIn — тільки
            скільки людей прийшло.
          </p>
          <Action>
            Задача №1 серпня. Позначити як key events: сабміт форми заявки, клік по контакту, перехід у
            Telegram, відкриття листингу. До цього будь-які висновки про ефективність каналів — оцінкові.
          </Action>

          <p className="text-sm font-bold mb-1 mt-4">3. Розрив між кліками в LinkedIn і сесіями на сайті</p>
          <div className="overflow-x-auto mb-2">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={th}>Метрика</th>
                  <th className={th}>Значення</th>
                  <th className={th}>Джерело</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className={td}>Переходи по посиланнях у постах LinkedIn</td><td className={td}>338</td><td className={tdMuted}>LinkedIn Analytics</td></tr>
                <tr><td className={td}>Сесії з linkedin.com на n5deal.com</td><td className={td}>6</td><td className={tdMuted}>GA4</td></tr>
                <tr className="bg-muted/40 font-semibold"><td className={td}>Розрив</td><td className={td}>≈ 56 : 1</td><td className={tdMuted}>—</td></tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted-foreground mb-1 leading-relaxed">
            Найімовірніша причина: профілі Ігоря і Дениса підписані як BankStore.ai, і посилання в
            постах ведуть переважно туди, а не на N5Deal. Тобто 338 кліків — це реальний результат
            контенту, але зарахований іншому домену.
          </p>
          <Action>
            Перевірити, куди фактично ведуть посилання в постах Ігоря і Дениса за липень, і чи стоять
            UTM-мітки. Поки не перевірено — 338 кліків не можна подавати як внесок у трафік N5Deal.
          </Action>
          <Action>
            Додати UTM до всіх посилань у постах фаундерів (source=linkedin, medium=organic_social,
            campaign=ім&apos;я акаунта). Це єдиний спосіб коректно порахувати внесок соцмереж у серпні.
          </Action>

          <h3 className="text-lg font-bold mb-2 mt-6">Дрібне, але варте уваги</h3>
          <ul className="text-sm space-y-1.5 leading-relaxed list-disc list-inside marker:text-muted-foreground">
            <li>google / cpc — 2 сесії з нульовим engagement, хоча платний канал заявлений як невикористаний. Треба з&apos;ясувати походження.</li>
            <li>chatgpt.com — 6 сесій, engagement 50%. Перший вимірюваний AI-трафік на сайт.</li>
            <li>n5bank.com / referral — 6 сесій із найвищим залученням у звіті (83,3%, 8 хв 57 с). Найякісніший referral-канал, варто підсилити перелінковку.</li>
          </ul>
        </section>

        {/* ── 4. Ліди й угоди ───────────────────────────────────────────────── */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">4. Ліди й угоди</h2>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            Контент почав давати не тільки охоплення, а й прямі входи. Нижче — ліди, зафіксовані за
            період, із джерелом надходження.
          </p>
          <div className="overflow-x-auto mb-3">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={th}>Лід</th>
                  <th className={th}>Джерело</th>
                  <th className={th}>Актив / запит</th>
                  <th className={th}>Статус</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Grace Chen', 'Пост у LinkedIn', 'Cayman VASP + SIBL', 'У роботі; ведеться конфіденційно — у групових комунікаціях подається як Legal team покупця'],
                  ['Mattia, CEO Gnosis Pay', 'TG-канал N5Deal.com Assets (переслав знайомий)', 'EMI + principal membership Mastercard/Visa; ЄС, UK бажано; закриття до кінця 2026', 'Інтро-колл з ко-фаундером 23.07; цікавить латвійський EMI'],
                  ['Dhruv', '—', 'RemittancesHub, Latvia EMI', 'Контрагент по угоді'],
                  ['Erling Andersen / Omni Matrix', 'Проданий листинг Swiss SRO', 'Мальта + Естонія', 'Розширення ліцензійного покриття'],
                  ['Tim Knowles', '—', 'Інвесторський аутріч', 'У роботі'],
                  ['Партнерський контакт', 'Threads', '—', 'Один дзвінок'],
                ].map(([lead, src, asset, status], i) => (
                  <tr key={i}>
                    <td className={td}>{lead}</td>
                    <td className={tdMuted}>{src}</td>
                    <td className={td}>{asset}</td>
                    <td className={tdMuted}>{status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted-foreground mb-1 leading-relaxed">
            <strong>Ключове спостереження:</strong> два з шести входів — прямий результат контентної
            роботи (пост у LinkedIn і TG-канал листингів). Це найсильніший аргумент на користь
            соціального каналу у звіті, значно вагоміший за показники охоплення.
          </p>
          <Action>
            Завести єдиний реєстр лідів із полем «джерело входу», щоб у серпні атрибуція рахувалась
            автоматично, а не відновлювалась вручну.
          </Action>
        </section>

        {/* ── 5. Обмеження даних ────────────────────────────────────────────── */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">5. Обмеження даних цього звіту</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Щоб цифри читались коректно і серпневе порівняння було чесним:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={th}>Обмеження</th>
                  <th className={th}>Що це означає</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Немає значень підписників на 31.07', 'Бази: Ігор 7 447 і Денис 4 940 на 29.06, Єгор 2 590 на 6.07. Дельту по фоловерах порахувати неможливо'],
                  ['Різні базові дати', 'Фаундери заміряні від 29.06 і 6.07 — у наступному звіті звести всіх до 1 числа місяця'],
                  ['Періоди не збігаються', 'SEO — 1–31.07; GA4 traffic — 6.07–2.08; LinkedIn — 1.07–1.08. Порівнювати абсолютні цифри між блоками некоректно'],
                  ['Органіка Ahrefs без базового періоду', 'Місячні дельти по органіці не показані як «ріст» — попереднього значення фактично не існує (ймовірно баг Ahrefs у попередніх даних)'],
                  ['X: місячні дані неповні', 'Аналітика знімалась із фільтрами 7D і 4W, не за календарний липень'],
                  ['Threads: аналітики немає', 'Поріг 100 підписників не пройдено'],
                ].map(([lim, mean]) => (
                  <tr key={lim}>
                    <td className={td}>{lim}</td>
                    <td className={tdMuted}>{mean}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── 6. Фокус на серпень ───────────────────────────────────────────── */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">6. Фокус на серпень</h2>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            Стратегічний фокус місяця — LinkedIn і X, із запуском лонгрідів (Articles) на X. Нижче —
            пріоритети в порядку впливу на результат.
          </p>
          <div className="overflow-x-auto mb-6">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={th}>#</th>
                  <th className={th}>Задача</th>
                  <th className={th}>Блок</th>
                  <th className={th}>Чому це пріоритет</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['1', 'Налаштувати key events у GA4 (заявка, контакт, TG, відкриття листинга)', 'Аналітика', 'Без цього канали неможливо оцінити за результатом'],
                  ['2', 'Пройти верифікацію акаунта X і запустити рекламу', 'Платний канал', 'Кампанія оплачена, але не працює'],
                  ['3', 'UTM на всі посилання в постах фаундерів + перевірка, куди вони ведуть', 'Атрибуція', '338 кліків зараз не зараховані N5Deal'],
                  ['4', 'Оптимізувати crypto-exchange-license, /incorporation-license/crypto, money-transmitter-license', 'SEO', 'Тисячі показів при позиції 20–32'],
                  ['5', 'Закріпити формат «угода + сума + наслідок для покупця» для Ігоря і Дениса', 'Контент', 'Підтверджено на двох акаунтах'],
                  ['6', 'Фільтри GA4 на службовий трафік', 'Аналітика', 'Інакше серпень виглядатиме як падіння'],
                  ['7', 'Розігрів акаунтів у X перед запуском Articles', 'Соцмережі', 'При 15 показах на пост лонгріди не спрацюють'],
                  ['8', 'Перевірити кастомну кнопку на сторінці N5Deal', 'LinkedIn', '0 кліків за місяць'],
                ].map(([n, task, block, why]) => (
                  <tr key={n}>
                    <td className={td}>{n}</td>
                    <td className={td}>{task}</td>
                    <td className={tdMuted}>{block}</td>
                    <td className={tdMuted}>{why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="text-lg font-bold mb-2">Окремо щодо Articles на X</h3>
          <p className="text-sm text-muted-foreground mb-2 leading-relaxed">
            Articles — функція платного рівня підписки (Premium+ / verified organization). Перед
            плануванням контенту потрібно підтвердити, що кнопка активна на @N5Deal і на акаунті Єгора —
            інакше це рядок бюджету, а не задача контенту.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            <strong>Важливо для очікувань:</strong> на X лонгріди не мають окремої дистрибуції — вони
            розганяються тим самим постом-анонсом. При поточних 13–17 показах на пост стаття отримає ті
            самі 15 показів. Тому Articles варто ставити як актив для перелінковки й індексації, а не як
            драйвер охоплення. Драйвером має бути розігрів акаунта: відповіді в тредах галузевих
            акаунтів, цитування, коментарі під профільними постами.
          </p>
        </section>

        <p className="text-xs text-muted-foreground border-t border-border pt-4">
          Звіт підготовлено 3 серпня 2026 · N5Deal · Marketing
        </p>
      </div>
    </div>
  )
}
