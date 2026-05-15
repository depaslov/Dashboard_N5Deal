# n5deal.com — UX-аудит v2

Перевірено: головна сторінка + `/buyer` + `/seller` + `/faq` + `/youtube` +
HTTP-статус усіх лінків з головної + прямий парсинг HTML.
Знайдено **18 проблем**, відсортованих по серйозності.

Дата: травень 2026

---

## 🔴 Критичні (ламають функціонал або юридично небезпечні)

### 1. Кнопка "Schedule a call" має порожній `href=""`

- Перевірено через прямий парсинг HTML головної: `<a href="">Schedule a call</a>`
- Натискання просто перезавантажує сторінку
- Кнопка стоїть **у top-навігації І в footer** — на двох головних точках конверсії
- **Fix:** замінити на `mailto:client@n5deal.com?subject=Schedule%20a%20call` або реальний Calendly-лінк

### 2. Typo посеред юридичного дисклеймера у FAQ

> *"N5Deal is not a bank, credit institution, deposit-taking and Wales or any other jurisdiction"*

- Це **дисклеймер про регуляторний статус** з copy-paste-помилкою
- Речення обірване, "deposit-taking and Wales" не має сенсу
- Юридичні дисклеймери — найгірше місце для таких багів
- **Fix:** має бути типу `"...deposit-taking institution, payment institution, e-money institution, or any other regulated entity authorised in England and Wales or any other jurisdiction"`

### 3. "M&A Advisor: Coming soon" на головній сторінці

- В секції "Insights & Updates" висить картка зі статусом "Coming soon"
- Сам термін **"Advisor" — Cat 1 forbidden** за лоєрським довідником
  (FSMA s.19/s.24, IAA 1940 — захищене звання)
- Будь-який скріншот цієї картки регулятор може використати як доказ
  нелегальної advisory-діяльності
- **Fix:** прибрати або перейменувати — `Deal Coordinator` / `Transaction Concierge` / `M&A Workflow`

### 4. `/youtube` — порожня landing-сторінка без відео

- Сторінка існує (HTTP 200), у нав-меню є посилання "YouTube"
- На самій сторінці тільки H1 "N5Deal On Youtube" + порожнеча. Жодного embed,
  thumbnail, video feed
- Користувач, що клацнув "YouTube" — отримав deadend
- **Fix:** або redirect на справжній YouTube-канал, або сторінка з embed'ом
  останніх відео

---

## 🟡 Важливі (плутають користувача / шкодять довірі)

### 5. Конфлікт цифр між сторінками

- Головна: *"**1,000+ qualified buyers**"* + *"300 deals listed"*
- Seller-сторінка: *"**500k+ Buyers** rely on N5Deal.com"*
- Різниця в **500 разів**. Користувач, що бачить обидві цифри, втрачає довіру
  до обох
- **Fix:** одна цифра, одне джерело, виставлена скрізь

### 6. 4 різних логотипи в шапці Seller-сторінки

- N5Bank, N5Bank (повтор), N5Deal, MA Deals Platform — без пояснення зв'язку
- Виглядає як header, що не може визначитися, який саме бренд показує
- **Fix:** один логотип у header, інші бренди — окремими блоками в контенті

### 7. CTA-хаос: 4 різні "Start..." кнопки

- "Start Buying", "Start Selling", "Start now", "Start Exploring AI"
- Жодна не натякає що саме станеться після кліку
- Деякі ведуть на `/buyer#header-section` (просто прокрутка на місці),
  деякі — на зовнішній `platform.n5deal.com`
- **Fix:** одна primary CTA на сторінку, secondary з конкретним labels
  (`Browse listings`, `Get valuation in 24h`)

### 8. "AI Matching" / "Start Exploring AI" — без сторінки

- У footer "About Us" згадується "AI Matching", у hero є кнопка
  "Start Exploring AI"
- Окремої сторінки немає, в основній нав-меню AI відсутня
- **Fix:** або зробити dedicated `/ai-matching` сторінку, або прибрати
  маркетингові згадки

### 9. "Free Valuation" — гучна CTA, незрозумілий flow

- На головній прямо в hero — "Free Valuation" + "Start now"
- Окремої `/free-valuation` сторінки немає (404 при прямому переході)
- Куди веде "Start now" з UI — невідомо
- **Fix:** або сторінка з формою на `/free-valuation`, або одразу інлайн-форма
  в hero

### 10. FAQ обірваний на 2 видимих питаннях

- Категорії в шапці обіцяють контент: "For License Buyers", "For License Sellers",
  "Our Services"
- Реальних Q&A — 2–3 штуки. Решта секцій порожні
- Виглядає як WIP, що випадково задеплоїлось у production
- **Fix:** залити по 3–4 питання в кожну категорію, інакше прибрати порожні
  розділи

### 11. "Consultative platform" у дисклеймерах

> *"Operates as a consultative platform only"*

- Слово **"consultative" — у лоєрському списку Cat 3 forbidden**
  (передбачає consult/consultation, тобто регульовану advisory-діяльність)
- Це в legal disclaimer — найгірше місце для regulatory-fingerprint
- **Fix:** замінити на `"informational platform"` (саме так, як прописано
  у власному compliance-довіднику n5deal)

---

## 🟢 Polish (косметика / нерохайно, але не критично)

### 12. Структура URL непослідовна

- Articles: `/articles/191-london-warsaw-barcelona-events-in-one-week-5-ma-signals`
  (numeric ID + slug)
- Pages: `/incorporation-license/fintech` (clean slug)
- **Fix:** один підхід для всього контенту, без префіксованих ID

### 13. Alt-text у зображень generic

- "Slider image 1", "Seller card right section", "buyer-hero-1" — placeholder
  назви, не описи
- Accessibility + SEO втрачають сигнал

### 14. © year відсутній у footer

- Тільки `"N5Deal™ is a registered trademark of M&A Tech Group LTD, UK"`
- Немає `© 2026` — користувачі читають це як сигнал, що сайт активний
- **Fix:** додати `© 2026 M&A Tech Group LTD`

### 15. Trust-signals без proof

- "100+ countries", "300 deals listed", "1000+ buyers" — числа без джерела
  чи таймстемпу
- На фінансовій B2B-платформі це слабо
- **Fix:** додати `as of Q2 2026` або посилання на public deal log

### 16. Регуляторні credentials відсутні

- У footer є дисклеймер, що платформа НЕ ліцензована — це чесно
- Але немає згадки про verification framework, ID checks, KYC partners
- Користувач, який роздумує про угоду на $5M+, не побачить жодного proof of trust

### 17. 4 контактних email без чіткої дисципліни

- `client@`, `partnership@`, `pr@`, `support@` — 4 адреси
- На сторінках появляються вперемішку
- **Fix:** короткий блок "Who to email" з одним рядком опису кожної ролі

### 18. Hero-секція дубльована в HTML

- Render двічі: одна mobile-версія, одна desktop. Стандартна Tailwind-практика
- SEO-краулери бачать дубльований контент
- **Fix:** використати CSS `display:none` через media-queries замість
  двох копій DOM

---

## Топ-пріоритети (TL;DR)

| # | Проблема | Час на fix | Impact |
|---|---|---|---|
| 1 | Schedule a call `href=""` | 5 хв | Дуже високий — критична CTA |
| 2 | FAQ обірваний дисклеймер | 5 хв | Дуже високий — юридично |
| 3 | "M&A Advisor" → перейменувати | 10 хв | Дуже високий — regulatory |
| 4 | "Consultative platform" → "informational" | 5 хв | Дуже високий — regulatory |
| 5 | Конфлікт цифр (1000 vs 500k) | 15 хв | Високий — довіра |
| 6 | 4 логотипи в seller-шапці | 30 хв | Високий — branding |
| 7 | /youtube — або redirect, або реал embed | 30 хв | Середній |
| 8 | FAQ долити Q&A в порожні розділи | 1–2 год | Середній |

---

## Загальний вердикт

Сайт побудований на сильному технічному фундаменті (Next.js, AVIF/WebP,
Cloudinary), але є **4 критичних UX-/legal-баги**, які потрібно фіксити негайно:

1. Мертва "Schedule a call" кнопка
2. Обірваний legal-дисклеймер у FAQ
3. "Advisor" у назві фічі — регуляторний red flag
4. "Consultative" у дисклеймері — той самий red flag

Усі четверо — 25 хвилин роботи разом. Решта 14 пунктів — поступове
покращення UX і довіри.

---

*Аудит зібрано: WebFetch n5deal.com (homepage + 4 sub-pages), прямий парсинг
HTML, перевірка HTTP-статусу 23 URL-патернів, перехресна перевірка з власним
compliance-довідником n5deal (256 lawyer-mandated red flags у БД проєкту).*
