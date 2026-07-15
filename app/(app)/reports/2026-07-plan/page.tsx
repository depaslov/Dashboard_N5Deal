import Link from 'next/link'
import { ArrowLeft, Target } from 'lucide-react'
import { SeedButton } from './seed-button'
import { ReportExportButton } from '@/components/app/report-export-button'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'N5Deal — План на липень 2026',
}

// ────────────────────────────────────────────────────────────────────────────
// N5Deal — липневий posting plan (forward-looking, not a retrospective).
//
// Розрахунок цілей від червневого факту з коефіцієнтом росту + carry-over:
//   Articles: 25 (у червні 36; знижуємо після pillar-content sprint)
//   Medium (WEB 2.0): 10 (у червні 4; +3 недобрані carry-over + 7 нових)
//   Market news: 6 (~1-2/week — топікал)
//   Profiles: 10 (у червні 7; розширення на нові DR-донори)
//   Reddit / Crowd: 12 (з нового акаунта після 1-тижневого warmup)
//   Paid outreach: 3 (у червні 1; PRNews.io + тест 1 іншої платформи)
// ────────────────────────────────────────────────────────────────────────────

const th = 'bg-black text-white text-left px-3 py-2 text-xs font-bold uppercase tracking-wide border border-gray-300'
const td = 'px-3 py-2 text-sm border border-gray-300 align-top'
const tdMuted = 'px-3 py-2 text-sm border border-gray-300 align-top text-muted-foreground'
const tdCenter = 'px-3 py-2 text-sm border border-gray-300 align-top text-center font-semibold'

export default function JulyPlanPage() {
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
        <ReportExportButton title="N5Deal — План на липень 2026" targetId="report-export-root" />
      </div>

      <div id="report-export-root">
      {/* ── Заголовок + огляд ────────────────────────────────────────────── */}
      <section className="mb-10">
        <h1 className="text-3xl font-bold mb-2">N5Deal — План на липень 2026</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Період: 1 – 31 липня 2026 · 66 запланованих матеріалів + 3 платних розміщення
        </p>

        <div className="rounded-lg border-l-4 border-primary bg-muted/30 p-4 mb-4">
          <div className="flex items-start gap-3">
            <Target className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-sm leading-relaxed">
              <strong>Фокус липня:</strong> публікація вже готових текстів (24 з червневих 36 +
              нові), закриття 3 carry-over Medium публікацій з червня, відновлення crowd (новий
              Reddit-акаунт з warmup), розширення платних outreach-розміщень через PRNews.io,
              production deploy на Hostinger VPS.
            </div>
          </div>
        </div>

        <SeedButton />
      </section>

      {/* ── Місячні цілі по каналах ──────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3">Місячні цілі по каналах</h2>
        <p className="text-sm text-muted-foreground mb-4">
          6 каналів + сумарний обсяг. Порівняння з червневим фактом справа щоб бачити темп.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>Канал</th>
                <th className={th}>Ціль липень</th>
                <th className={th}>Червень факт</th>
                <th className={th}>Примітка</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={td}>
                  <strong>Articles</strong> (n5deal.com блог)
                </td>
                <td className={tdCenter}>25</td>
                <td className={tdMuted}>36</td>
                <td className={td}>
                  Продовження Серії 2 (licensing / regulatory) + старт Серії 3 (case studies).
                  Знижуємо після червневого pillar-sprint — після 36 темп треба тримати сталим
                </td>
              </tr>
              <tr>
                <td className={td}>
                  <strong>Medium</strong> (WEB 2.0)
                </td>
                <td className={tdCenter}>10</td>
                <td className={tdMuted}>4</td>
                <td className={td}>
                  3 carry-over з червневих недобраних + 7 нових. Medium-акаунт не забанений
                  (на відміну від Reddit), можна нарощувати темп
                </td>
              </tr>
              <tr>
                <td className={td}>
                  <strong>Market news</strong>
                </td>
                <td className={tdCenter}>6</td>
                <td className={tdMuted}>—</td>
                <td className={td}>
                  1–2 на тиждень. Топікал: MiCA deadline (уже пройшов), Q2 2026 fintech M&amp;A
                  recap, live deal announcements. Rephrase-режим — беремо новини і переписуємо
                  у N5Deal voice
                </td>
              </tr>
              <tr>
                <td className={td}>
                  <strong>Profile backlinks</strong>
                </td>
                <td className={tdCenter}>10</td>
                <td className={tdMuted}>7</td>
                <td className={td}>
                  Розширення на нові DR-донори. У червні закрили планові 7 (gravatar, behance,
                  disqus, dribbble, flipboard, sourceforge, pinterest); у липні +3-4 на інших
                  донорах
                </td>
              </tr>
              <tr className="bg-destructive/5">
                <td className={td}>
                  <strong>Reddit / Crowd</strong>
                </td>
                <td className={tdCenter}>12</td>
                <td className={tdMuted}>7 (акаунт забанили)</td>
                <td className={td}>
                  Новий Reddit-акаунт із <strong>обов'язковим warmup</strong> W1 (просто участь
                  без посилань), тільки з W2 починаємо posting. Без bulk-режиму — 2-3 відповіді
                  на тиждень з розкладкою по subreddits
                </td>
              </tr>
              <tr className="bg-primary/5">
                <td className={td}>
                  <strong>Paid outreach</strong>
                </td>
                <td className={tdCenter}>3</td>
                <td className={tdMuted}>1 (PRNews.io / Lucky Seven)</td>
                <td className={td}>
                  Продовження PRNews.io (2 нові розміщення на різних сайтах з їхньої панелі) +
                  тест 1 альтернативної outreach-платформи для порівняння цін/якості
                </td>
              </tr>
              <tr className="border-t-2 border-gray-400">
                <td className={td}>
                  <strong>Разом матеріалів</strong>
                </td>
                <td className={tdCenter}>
                  <strong>66</strong>
                </td>
                <td className={tdMuted}>55</td>
                <td className={td}>+20% до червневого обсягу з урахуванням carry-over і росту каналів</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Тижнева розбивка ─────────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3">Тижнева розбивка</h2>
        <p className="text-sm text-muted-foreground mb-4">
          5 тижнів у липні (W5 неповна). W1 — recovery + carry-over, W2-W4 — основний темп,
          W5 — закриття.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>Тиждень</th>
                <th className={th}>Articles</th>
                <th className={th}>Medium</th>
                <th className={th}>Market news</th>
                <th className={th}>Profiles</th>
                <th className={th}>Reddit</th>
                <th className={th}>Paid</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={td}>
                  <strong>W1</strong>
                  <br />
                  <span className="text-xs text-muted-foreground">1–7 лип</span>
                </td>
                <td className={tdCenter}>6</td>
                <td className={tdCenter}>3 (carry-over)</td>
                <td className={tdCenter}>1</td>
                <td className={tdCenter}>2</td>
                <td className={tdCenter}>
                  <span className="text-muted-foreground">warmup</span>
                </td>
                <td className={tdCenter}>—</td>
              </tr>
              <tr>
                <td className={td}>
                  <strong>W2</strong>
                  <br />
                  <span className="text-xs text-muted-foreground">8–14 лип</span>
                </td>
                <td className={tdCenter}>6</td>
                <td className={tdCenter}>2</td>
                <td className={tdCenter}>1</td>
                <td className={tdCenter}>3</td>
                <td className={tdCenter}>2–3</td>
                <td className={tdCenter}>1</td>
              </tr>
              <tr>
                <td className={td}>
                  <strong>W3</strong>
                  <br />
                  <span className="text-xs text-muted-foreground">15–21 лип</span>
                </td>
                <td className={tdCenter}>6</td>
                <td className={tdCenter}>2</td>
                <td className={tdCenter}>2</td>
                <td className={tdCenter}>3</td>
                <td className={tdCenter}>3–4</td>
                <td className={tdCenter}>1</td>
              </tr>
              <tr>
                <td className={td}>
                  <strong>W4</strong>
                  <br />
                  <span className="text-xs text-muted-foreground">22–28 лип</span>
                </td>
                <td className={tdCenter}>5</td>
                <td className={tdCenter}>2</td>
                <td className={tdCenter}>1</td>
                <td className={tdCenter}>2</td>
                <td className={tdCenter}>3–4</td>
                <td className={tdCenter}>1</td>
              </tr>
              <tr>
                <td className={td}>
                  <strong>W5</strong>
                  <br />
                  <span className="text-xs text-muted-foreground">29–31 лип</span>
                </td>
                <td className={tdCenter}>2</td>
                <td className={tdCenter}>1</td>
                <td className={tdCenter}>1</td>
                <td className={tdCenter}>0</td>
                <td className={tdCenter}>1–2</td>
                <td className={tdCenter}>—</td>
              </tr>
              <tr className="border-t-2 border-gray-400 bg-muted/40">
                <td className={td}>
                  <strong>Разом</strong>
                </td>
                <td className={tdCenter}>
                  <strong>25</strong>
                </td>
                <td className={tdCenter}>
                  <strong>10</strong>
                </td>
                <td className={tdCenter}>
                  <strong>6</strong>
                </td>
                <td className={tdCenter}>
                  <strong>10</strong>
                </td>
                <td className={tdCenter}>
                  <strong>~12</strong>
                </td>
                <td className={tdCenter}>
                  <strong>3</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Публікаційний ритм W1 ─────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3">Публікаційний ритм — W1 (1–7 лип, recovery)</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Перший тиждень — критичний. Треба закрити 3 carry-over Medium публікації + запустити
          новий Reddit-акаунт (warmup, без посилань) + почати regular articles-rhythm.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>День</th>
                <th className={th}>Що постити</th>
                <th className={th}>Канал</th>
                <th className={th}>Примітка</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={td}>
                  <strong>Вт 1 лип</strong>
                </td>
                <td className={td}>Article #1 (Серія 2)</td>
                <td className={td}>n5deal.com/blog</td>
                <td className={tdMuted}>MiCA deep-dive або EMI-vs-PI</td>
              </tr>
              <tr>
                <td className={td}>
                  <strong>Ср 2 лип</strong>
                </td>
                <td className={td}>Medium carry-over #1</td>
                <td className={td}>medium.com</td>
                <td className={tdMuted}>З 3 недобраних червневих текстів (готові)</td>
              </tr>
              <tr>
                <td className={td}>
                  <strong>Чт 3 лип</strong>
                </td>
                <td className={td}>Article #2 + Reddit warmup start</td>
                <td className={td}>n5deal.com + reddit.com</td>
                <td className={tdMuted}>
                  Reddit: тільки коментарі без посилань, participate у 3-4 subreddits щоб
                  накопичити карму
                </td>
              </tr>
              <tr>
                <td className={td}>
                  <strong>Пт 4 лип</strong>
                </td>
                <td className={td}>Market news #1 + Profile #1</td>
                <td className={td}>n5deal.com + новий DR-донор</td>
                <td className={tdMuted}>Топікал: MiCA deadline recap, live impact на CASP-компанії</td>
              </tr>
              <tr>
                <td className={td}>
                  <strong>Сб 5 лип</strong>
                </td>
                <td className={td}>Medium carry-over #2</td>
                <td className={td}>medium.com</td>
                <td className={tdMuted}>Reddit warmup continues</td>
              </tr>
              <tr>
                <td className={td}>
                  <strong>Нд 6 лип</strong>
                </td>
                <td className={td}>Article #3</td>
                <td className={td}>n5deal.com/blog</td>
                <td className={tdMuted}>Weekend — довший формат, high-effort text</td>
              </tr>
              <tr>
                <td className={td}>
                  <strong>Пн 7 лип</strong>
                </td>
                <td className={td}>Medium carry-over #3 + Profile #2</td>
                <td className={td}>medium.com + новий DR-донор</td>
                <td className={tdMuted}>
                  <strong>Закриття 3 carry-over Medium</strong> — WEB 2.0 недобір з червня повністю
                  закрито. Reddit warmup продовжується (без linking)
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Публікаційний ритм W2 ─────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3">Публікаційний ритм — W2 (8–14 лип, повний цикл)</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Другий тиждень — усі канали активні. Первинний deploy на Hostinger. Перше платне
          розміщення. Reddit починає posting з linking (після 7 днів warmup).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>День</th>
                <th className={th}>Що постити</th>
                <th className={th}>Канал</th>
                <th className={th}>Примітка</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={td}>
                  <strong>Вт 8 лип</strong>
                </td>
                <td className={td}>Article #4 + Reddit #1 (перший з linking)</td>
                <td className={td}>n5deal.com + reddit.com</td>
                <td className={tdMuted}>
                  Reddit — перший post з посиланням після warmup. Один нативний коментар з
                  contextual link, не promotional
                </td>
              </tr>
              <tr>
                <td className={td}>
                  <strong>Ср 9 лип</strong>
                </td>
                <td className={td}>Medium #1 (нова) + Profile #3</td>
                <td className={td}>medium.com + новий DR-донор</td>
                <td className={tdMuted}>Медіум переходить на "нові" тексти після 3 carry-over</td>
              </tr>
              <tr>
                <td className={td}>
                  <strong>Чт 10 лип</strong>
                </td>
                <td className={td}>Article #5</td>
                <td className={td}>n5deal.com/blog</td>
                <td className={tdMuted}>Серія 3 case study — перший live кейс</td>
              </tr>
              <tr>
                <td className={td}>
                  <strong>Пт 11 лип</strong>
                </td>
                <td className={td}>
                  Market news #2 + <strong>Paid outreach #1</strong>
                </td>
                <td className={td}>n5deal.com + PRNews.io</td>
                <td className={tdMuted}>
                  Перше платне розміщення — знову на Lucky Seven або нова панель PRNews.io
                </td>
              </tr>
              <tr>
                <td className={td}>
                  <strong>Сб 12 лип</strong>
                </td>
                <td className={td}>Article #6 + Reddit #2</td>
                <td className={td}>n5deal.com + reddit.com</td>
                <td className={tdMuted}>Reddit — другий post з linking, різний subreddit</td>
              </tr>
              <tr>
                <td className={td}>
                  <strong>Нд 13 лип</strong>
                </td>
                <td className={td}>Medium #2 + Profile #4</td>
                <td className={td}>medium.com + новий DR-донор</td>
                <td className={tdMuted}>Weekend push</td>
              </tr>
              <tr>
                <td className={td}>
                  <strong>Пн 14 лип</strong>
                </td>
                <td className={td}>Article #6 (finalize) + Reddit #3</td>
                <td className={td}>n5deal.com + reddit.com</td>
                <td className={tdMuted}>
                  Кінець W2 — усі канали протестовані, темп сталий. Готовність до W3 mid-quarter
                  push
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Пріоритети та залежності ─────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3">Пріоритети та залежності</h2>
        <div className="space-y-4">
          {[
            {
              title: 'Пріоритет №1 — Recovery (перші 2 тижні)',
              items: [
                'Закрити 3 carry-over Medium публікації до 7 липня — вже готові тексти, тільки залити',
                'Відновити crowd — новий Reddit-акаунт warmup W1, перший post з linking у W2 (8 липня)',
                '2 profile-розміщення у W1 щоб продовжити темп попереднього місяця',
              ],
            },
            {
              title: 'Пріоритет №2 — Growth (W2-W4)',
              items: [
                'Первинний deploy на Hostinger (W2) — production URL для першого live тестування RAG на VM',
                'Перше платне outreach-розміщення (11 липня) — PRNews.io панель',
                'Регулярний темп 6 articles + 2 Medium + 3 profiles + 2-3 Reddit щотижня',
              ],
            },
            {
              title: 'Пріоритет №3 — Close (W4-W5)',
              items: [
                'Останнє платне розміщення до 28 липня (тест альтернативної платформи)',
                'Фінальні Reddit posts до 31 липня — тримати темп щоб зберегти акаунт',
                'Липневий retrospective звіт готується у W5 щоб опублікувати 1 серпня',
              ],
            },
            {
              title: 'Залежності',
              items: [
                'Reddit warmup — обов\'язковий W1. Без нього ризик повторного бану',
                'Hostinger deploy — блокер для live тестування RAG. Треба до 14 липня',
                'PRNews.io бюджет — треба перевірити наявність на 2-3 розміщення (~$300-500)',
                'Готові тексти в черзі — 24 з червневих ще не залиті, це основа для перших 3 тижнів',
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

      {/* ── Success criteria ─────────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3">Що вважатиметься "успішним липнем"</h2>
        <div className="rounded-md border-l-4 border-primary bg-muted/30 p-4">
          <ul className="text-sm space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">✓</span>
              <span>
                <strong>25 articles опубліковано</strong> на n5deal.com/blog (Серія 2 + старт Серії 3)
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">✓</span>
              <span>
                <strong>10 Medium публікацій</strong> (3 carry-over + 7 нових) — WEB 2.0 квота
                перевиконана vs червень
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">✓</span>
              <span>
                <strong>6 market news</strong> — регулярний rephrase-темп 1-2/тиждень
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">✓</span>
              <span>
                <strong>10 profile-беклінків</strong> на нових DR-донорах (+43% vs червневих 7)
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">✓</span>
              <span>
                <strong>12 Reddit відповідей</strong> з нового акаунта — акаунт живий і не забанений
                на кінець місяця (головний тест успішного warmup)
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">✓</span>
              <span>
                <strong>3 платних outreach-розміщення</strong> — PRNews.io + тест 1 альтернативи
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">✓</span>
              <span>
                <strong>Live на Hostinger</strong> — production URL відповідає, RAG підтягує vault,
                TLS активний
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">✓</span>
              <span>
                <strong>Разом 66 матеріалів</strong> + 3 платних розміщення — +20% до червневого
                обсягу
              </span>
            </li>
          </ul>
        </div>
      </section>

      {/* ── Джерела ───────────────────────────────────────────────────────── */}
      <section className="pt-4 border-t text-xs text-muted-foreground">
        <p>
          <strong>База розрахунку:</strong> червневий факт (5 профілів → 7 після коригування, 4
          Medium, 1 PRNews.io, 36 articles) + carry-over (3 Medium, готові тексти в черзі) +
          розширення на нові типи (market news, alternative outreach platform). План перекликається
          з розділом "Що вважатиметься успішним липнем" у червневому звіті —{' '}
          <Link href="/reports/2026-06" className="text-primary underline">
            див. звіт за червень
          </Link>
          .
        </p>
      </section>
      </div>
    </div>
  )
}
