# Аудит n5deal.com з урахуванням внутрішньої бази знань

Аналіз публічного сайту https://n5deal.com/ зіставлений з документами Obsidian-vault (RAG, 2 593 chunks): ICP-стратегією, бренд-гайдами, юридичним довідником FCA/SEC/MiFID II і SMM-брифом про "Fintech Builder".

---

## Загальний вердикт

Сайт **технічно міцний і добре оформлений візуально**, але має **критичні розриви між обіцяною стратегією (з KB) і реальним позиціонуванням**, плюс **юридичні червоні прапорці** в копірайті, які суперечать власним же дисклеймерам.

---

## ✅ Що зроблено добре

### Технічно
- Сучасний стек: Next.js, AVIF/WebP-зображення з Cloudinary CDN, окремі mobile-варіанти assets
- Видно оптимізацію: `q=75`, lazy-load, responsive sizing
- Грамотні дисклеймери — *"N5Deal is not a bank, credit institution… does not possess a banking licence"* — рідкість для платформ цього сегменту
- Чітка trademark-нотатка: *"N5Deal™ is a registered trademark of M&A Tech Group LTD, UK"*

### UX / UI
- Чіткий value prop у hero: *"M&A Platform for the Financial Sector — Buy or Sell Financial Business & License Assets faster than ever before"*
- Конкретні числа довіри: 300+ угод, 1 000+ покупців, 36+ країн
- Dual-track CTA "Start Selling" / "Start Buying" — простий ментальний поділ
- News hub для контент-маркетингу + FAQ — добре для SEO

---

## ❌ Великі розриви з KB-стратегією

### 1. Headline не відповідає ICP-стратегічному документу

**KB (`n5deal_icp_strategy.md`)** прямо радить:

> *"HEADLINE UPGRADE — Lead with the decision, not the transaction. The homepage headline opportunity: 'We help you make the right financial infrastructure decision'"*

**На сайті:** *"Fintech. Banking. Deals. Done."*

Звучить агресивно і трансакційно. Підходить тим, хто **вже готовий купувати/продавати**, але відсікає ~70 % воронки — людей у фазі **exploration** і **comparison**.

### 2. Немає router-а по стадії рішення

**KB описує 3-крокову модель ICP:**
- *"I'm exploring options"*
- *"I'm comparing specific paths"*
- *"I'm ready to execute"*

Кожен мав би вести в окрему гілку: Fintech Builder для тих, хто думає; M&A для тих, хто діє; гібрид для проміжного.

**На сайті:** тільки бінарний buyer / seller split. Той, хто ще думає, не знаходить шляху для себе → відскакує до Google.

### 3. Розрив між Fintech Builder і M&A платформою

**KB описує 2 чітких продукти:**
- **N5Deal M&A** = execution layer (готові до угод)
- **Fintech Builder** = decision layer (стратегія / incorporation)

**На сайті:**
- Fintech Builder згаданий як *"boutique service"* — без власної воронки
- **"M&A Advisor: Coming Soon"** — звідки взявся "Advisor", якщо вже існує Fintech Builder?
- AI Expert "Maya" з кнопкою *"Start Exploring AI"* — без чіткого destination

Результат: користувач не розуміє, який продукт йому потрібен.

### 4. Контент не сегментований по 7 ICPs / 8 SEO-кластерах

**KB:**

> *"Map content to segments, not to license types. Current blog covers market news. High-leverage alternative: segment-specific content. 'How ex-operators structure their second fintech' (Segment 1)…"*

**На сайті** — generic список *"Crypto, PSP, EMI, PI, Bank, Startup, Fintech"* без переходу на ICP-specific landing pages. Тобто Fintech Founder і Crypto Founder (VASP) мають **однакову точку входу**, хоча в KB це різні воронки з різним контентом.

---

## 🚨 Юридичні червоні прапорці

За документами юриста (FCA / SEC / MiFID II), які інтегровані в БД як `compliance` red flags. Знайдено **слова з Cat 1 / Cat 3 заборонених термінів на самому сайті**:

| Знайдено на сайті | Категорія заборони | Чому це проблема |
|---|---|---|
| **"M&A Advisor"** (секція "Coming Soon") | Cat 1 — Investment adviser | Захищене звання за FSMA s.19, s.24; IAA 1940. Використання без ліцензії = кримінальна відповідальність |
| **"Operates as a consultative platform only"** | Cat 3 — Consult / Consultation | Слово *"consultative"* за лоєрським довідником = подразумевається професійна консультація |
| **"Free Valuation"** | Cat 3 — Valuation | Ризиковано без контексту: треба *"Valuation provided by company data"* |
| **"Schedule a call"** | OK, але контекст | Якщо на дзвінку даються поради → треба disclaimer *"Ми пояснюємо процеси, не консультуємо"* |

### Парадокс

- Сайт **говорить**: *"Does not provide banking services… does not provide regulated financial activities"* — це правильно.
- Сайт **робить**: використовує слова *"Advisor"* і *"consultative"* — які регулятор може інтерпретувати як advisory activity.

Дисклеймери захищають від одного, але самі слова в копірайті відкривають фланг.

---

## 🔧 Технічні зауваження

| Що | Стан |
|---|---|
| Next.js + Cloudinary | ✅ |
| AVIF + WebP | ✅ |
| Mobile-окремі assets | ✅ |
| `dpl=dpl_DmmFbWZLQctKvag1stMEH8Sgrd4c` параметри в URL зображень | ⚠️ повторюється скрізь — Vercel deployment ID протікає в HTML; косметика |
| "Coming soon" на M&A Advisor | ⚠️ незавершено — або приховати, або поставити launch-дату |
| AI Expert "Maya" з невідомим destination | ⚠️ кнопка веде в нікуди → bounce |
| Live chat / Intercom | ❌ відсутній попри `support@n5deal.com` в підвалі |
| Дубль навігації desktop / mobile у HTML | ⚠️ мікроптимізація — не критично |
| Великі hero-фотослайди | ⚠️ дивитися LCP в PageSpeed; може шкодити Core Web Vitals |

---

## 🎯 Топ-5 рекомендацій (від найважливішого до косметики)

### 1. Перейменуй "M&A Advisor" на щось безпечне *(найкритичніше)*

Варіанти: **"Deal Coordinator"**, **"Transaction Concierge"**, **"M&A Workflow"**.

Слово *"Advisor"* — FCA red flag. Один скріншот може коштувати ліцензії, навіть якщо платформа не ліцензована.

### 2. Заміни *"consultative platform"* → *"informational platform"*

За лоєрським правилом: *"Ми ІНФОРМУЄМО, а не КОНСУЛЬТУЄМО"*.

### 3. Додай decision-stage router у hero

Замість тільки Buyer / Seller — три кнопки: **"I'm exploring"** / **"I'm comparing"** / **"I'm ready to act"** (як радить ICP-стратегічний документ).

### 4. Підніми Fintech Builder з footer-а в основну навігацію

Зараз він *"boutique service"* десь збоку. Має бути рівноправним продуктом з M&A платформою.

### 5. Сегментуй контент-блок під ICP

Замість generic списку *"Crypto, PSP, EMI, PI…"* — зроби 4–7 карток, кожна веде на ICP-specific landing з власною копірайт-логікою (на яку вже є промти + RAG).

---

## Підсумково

Сайт виглядає як платформа, побудована на сильному технічному фундаменті, але **без імплементації власної стратегії з KB**. На стратегічні документи (ICP-сегменти, decision routing, 8 SEO-кластерів) витрачено час — а сайт цього не показує. Плюс 2–3 регуляторних слова, які треба міняти терміново.

---

*Документ зібрано на основі WebFetch n5deal.com + RAG-запитів до проєктної бази знань (`project:seed-project-n5deal:obsidian` scope, 2 586 chunks across 88 files) + lawyer compliance reference у БД (256 термінів).*
