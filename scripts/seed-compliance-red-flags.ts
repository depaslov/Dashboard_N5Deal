// Seed lawyer-approved compliance red flags into the RedFlagWord table.
// Source documents:
// - "Чому ЗАБОРОНЕНО: Консультуємо на нашому гайду"
// - "N5Deal — Prohibited & Risky Terms Reference v2.0" (FCA/SEC/MiFID II)
// - "SMM-Brief: Fintech Builder positioning"
//
// Policy: EN + UK only (no Russian). Every forbidden concept is represented
// in both languages.
// Category="compliance", severity="block" — legal blockers, not warnings.
// Idempotent via upsert on (projectId, word, language).

import { prisma } from '../lib/db'

const PROJECT_ID = 'seed-project-n5deal'

interface Pair {
  en: string
  uk: string
  reason: string
}

interface Single {
  word: string
  language: 'en' | 'uk' | 'any'
  reason: string
}

// =============================================================================
// CATEGORY 1 — ABSOLUTELY FORBIDDEN (criminal liability)
// =============================================================================
const BANKING: Pair[] = [
  { en: 'bank', uk: 'банк', reason: 'Banking term — using without licence is criminal (FSMA s.24, Banking Act 2009; 18 U.S.C. §1344).' },
  { en: 'banking', uk: 'банківські послуги', reason: 'Banking activity — requires licence (FSMA s.19).' },
  { en: 'deposit', uk: 'депозит', reason: 'Accepting deposits is a regulated activity (RAO 2001 Art.5; FSMA s.19; PSD2).' },
  { en: 'accept deposits', uk: 'приймаємо вклади', reason: 'Regulated banking activity.' },
  { en: 'savings account', uk: 'ощадний рахунок', reason: 'Implies banking activity (RAO Art.5; FDIC regulations).' },
  { en: 'interest rate', uk: 'процентна ставка', reason: 'Implies regulated lending/deposit activity.' },
  { en: 'guaranteed return', uk: 'гарантована дохідність', reason: 'Income guarantee = regulated activity + fraud (FSMA s.397; Securities Act s.17(a); MAR Art.12).' },
  { en: 'FDIC insured', uk: 'застрахований вклад', reason: 'False statement about deposit insurance (18 U.S.C. §1014; FSCS rules).' },
  { en: 'protected deposit', uk: 'захищений вклад', reason: 'False insurance claim.' },
  { en: 'current account', uk: 'поточний рахунок', reason: 'Banking activity (PSD2; Banking Act 2009).' },
  { en: 'checking account', uk: 'розрахунковий рахунок', reason: 'Banking activity.' },
]

const ADVICE: Pair[] = [
  { en: 'investment advice', uk: 'інвестиційна консультація', reason: 'Regulated activity — requires FCA/SEC licence (RAO Art.53; MiFID II Art.4(1)(4); IAA 1940).' },
  { en: 'investment recommendation', uk: 'інвестиційна рекомендація', reason: 'Regulated activity (RAO Art.53; MiFID II Art.9).' },
  { en: 'we recommend', uk: 'ми рекомендуємо', reason: 'Personal recommendation = regulated activity.' },
  { en: 'our recommendation', uk: 'наша рекомендація', reason: 'Personal recommendation = regulated activity.' },
  { en: 'we advise', uk: 'ми радимо', reason: 'Personal advice = regulated activity.' },
  { en: 'financial adviser', uk: 'фінансовий радник', reason: 'Protected title — requires registration (FSMA s.19, s.24; IAA 1940).' },
  { en: 'investment adviser', uk: 'інвестиційний радник', reason: 'Protected title — requires registration (IAA 1940).' },
  { en: 'suitable for you', uk: 'підходить вам', reason: 'Implies suitability assessment (MiFID II Art.25; FCA COBS 9; SEC Rule 15l-1).' },
  { en: 'best for your needs', uk: 'найкраще для ваших потреб', reason: 'Implies suitability assessment.' },
  { en: 'personal recommendation', uk: 'персональна рекомендація', reason: 'Defined as regulated activity (RAO Art.53(1); MiFID II Art.4(1)(4)).' },
  { en: 'you should invest', uk: 'вам слід інвестувати', reason: 'Direct investment recommendation (RAO Art.53; Securities Act s.17(a)).' },
  { en: 'buy signal', uk: 'сигнал на покупку', reason: 'Investment recommendation (MAR Art.3(1)(35); RAO Art.53).' },
  { en: 'sell signal', uk: 'сигнал на продаж', reason: 'Investment recommendation.' },
  { en: 'consulting on our guide', uk: 'консультуємо на нашому гайду', reason: 'Creates legal impression of providing financial advice (FCA).' },
  { en: 'we consult', uk: 'ми консультуємо', reason: 'The verb «consult» auto-classifies activity as regulated (FCA).' },
  { en: 'our guide recommends', uk: 'наш гайд рекомендує', reason: 'Implies investment recommendations.' },
]

// CONSULTING / ADVISORY family — Cat 3 in source doc, but still high-risk for n5deal.
const CONSULTING: Pair[] = [
  { en: 'consulting', uk: 'консалтинг', reason: 'Implies professional consulting service — regulated in financial context.' },
  { en: 'consulting services', uk: 'консалтингові послуги', reason: 'Implies regulated advisory service.' },
  { en: 'consultancy', uk: 'консультативна діяльність', reason: 'Implies regulated advisory service.' },
  { en: 'advisory', uk: 'консультативний', reason: 'Cat 3 term — implies investment advice (RAO Art.53).' },
  { en: 'advisory services', uk: 'консультативні послуги', reason: 'Implies regulated advisory.' },
  { en: 'advise', uk: 'консультувати', reason: 'Implies investment advice — replace with «inform».' },
  { en: 'advice', uk: 'порада', reason: 'Cat 3 — replace with «information».' },
  { en: 'consult', uk: 'консультуватися', reason: 'Implies professional consultation.' },
  { en: 'consultation', uk: 'консультація', reason: 'Implies professional consultation — replace with «information».' },
  { en: 'expert opinion', uk: 'експертна думка', reason: 'Implies professional advice.' },
  { en: 'investment research', uk: 'інвестиційне дослідження', reason: 'Implies regulated investment research.' },
  { en: 'investment analysis', uk: 'інвестиційний аналіз', reason: 'Implies regulated investment analysis.' },
  { en: 'screening', uk: 'скринінг', reason: 'Implies investment screening — use «verification» instead.' },
  { en: 'guidance', uk: 'фінансове керівництво', reason: 'Cat 3 — less risky than «advice» but ambiguous.' },
]

const ASSET_MGMT: Pair[] = [
  { en: 'asset management', uk: 'управління активами', reason: 'Regulated activity (RAO Art.37; MiFID II Art.4(1)(8); IAA 1940).' },
  { en: 'portfolio management', uk: 'управління портфелем', reason: 'Regulated activity (RAO Art.37; MiFID II Art.4(1)(8)).' },
  { en: 'investment fund', uk: 'інвестиційний фонд', reason: 'Implies collective investment (FSMA s.235; AIFMD; ICA 1940).' },
  { en: 'we manage your money', uk: 'ми управляємо вашими грошима', reason: 'Direct asset-management claim (RAO Art.37).' },
  { en: 'discretionary management', uk: 'довірче управління', reason: 'Highest form of regulated asset management.' },
  { en: 'AUM', uk: 'активи під управлінням', reason: 'Assets under management — implies regulated asset management.' },
  { en: 'assets under management', uk: 'активи під управлінням клієнтів', reason: 'Implies regulated asset management.' },
  { en: 'NAV', uk: 'вартість чистих активів', reason: 'Net Asset Value — collective-investment term (FSMA s.235; ICA 1940).' },
  { en: 'net asset value', uk: 'чиста вартість активів', reason: 'Collective-investment term.' },
  { en: 'custodian', uk: 'кастодіан', reason: 'Custody is a regulated activity (RAO Art.40; MiFID II Art.4(1)(18)).' },
  { en: 'custody services', uk: 'кастодіальні послуги', reason: 'Regulated activity — holding client assets.' },
]

const GUARANTEES: Pair[] = [
  { en: 'guaranteed profit', uk: 'гарантований прибуток', reason: 'Fraud claim (FSMA s.397; Securities Act s.17(a); MAR Art.12).' },
  { en: 'no risk', uk: 'без ризику', reason: 'False statement (FCA COBS 4.2; SEC Rule 10b-5).' },
  { en: 'capital protection', uk: 'захист капіталу', reason: 'Implies guarantee — requires licence (Prospectus Regulation; MiFID II).' },
  { en: 'insured investment', uk: 'застрахована інвестиція', reason: 'Insurance activity requires licence (Insurance Act 2015; Solvency II).' },
  { en: 'risk-free', uk: 'безризковий', reason: 'False statement = fraud (FCA COBS 4.2; SEC Rule 10b-5).' },
]

// =============================================================================
// CATEGORY 2 — HIGH RISK
// =============================================================================
const BROKERAGE: Pair[] = [
  { en: 'broker', uk: 'брокер', reason: 'Implies dealing as principal/agent (RAO Art.14, 21, 25; Exchange Act s.3(a)(4)).' },
  { en: 'brokerage', uk: 'брокерські послуги', reason: 'Regulated dealing activity.' },
  { en: 'dealer', uk: 'дилер', reason: 'Regulated activity (RAO Art.14, 21; SEC Rules 3a5-4, 3a44-2).' },
  { en: 'dealing', uk: 'дилінг', reason: 'Regulated activity.' },
  { en: 'execute trades', uk: 'виконання угод', reason: 'Implies broker activity (RAO Art.14, 21; MiFID II Art.4(1)(5)).' },
  { en: 'order execution', uk: 'виконання ордерів', reason: 'Implies broker activity.' },
  { en: 'place an order', uk: 'розмістити ордер', reason: 'Implies trading platform (MiFID II; Exchange Act 1934).' },
  { en: 'trading platform', uk: 'торгова платформа', reason: 'Requires MTF/OTF licence (MiFID II Art.4(1)(22-23); RAO).' },
  { en: 'market maker', uk: 'маркет-мейкер', reason: 'Regulated activity (MiFID II Art.4(1)(7); SEC Rules 3a5-4).' },
  { en: 'clearing', uk: 'кліринг', reason: 'Regulated infrastructural activity (EMIR; FSMA Part XVIII).' },
  { en: 'settlement', uk: 'розрахунки', reason: 'Regulated infrastructural activity.' },
]

const PORTFOLIO: Pair[] = [
  { en: 'diversification strategy', uk: 'стратегія диверсифікації', reason: 'Implies investment advice.' },
  { en: 'rebalancing', uk: 'ребалансування', reason: 'Implies portfolio management.' },
  { en: 'asset allocation', uk: 'розподіл активів', reason: 'Implies investment advice.' },
  { en: 'risk-adjusted return', uk: 'дохідність з поправкою на ризик', reason: 'Implies analytical/advisory service.' },
]

const PLANNING: Pair[] = [
  { en: 'financial planning', uk: 'фінансове планування', reason: 'Regulated activity in UK/US.' },
  { en: 'wealth management', uk: 'управління статками', reason: 'Regulated activity.' },
  { en: 'retirement planning', uk: 'пенсійне планування', reason: 'Regulated activity — do not use.' },
  { en: 'tax advice', uk: 'податкова консультація', reason: 'May require licence.' },
  { en: 'tax planning', uk: 'податкове планування', reason: 'May require licence.' },
  { en: 'estate planning', uk: 'планування спадщини', reason: 'Regulated activity — do not use.' },
  { en: 'investment strategy', uk: 'інвестиційна стратегія', reason: 'Implies investment advice.' },
]

const SECURITIES: Pair[] = [
  { en: 'shares offering', uk: 'розміщення акцій', reason: 'Requires prospectus and licence (Prospectus Regulation).' },
  { en: 'IPO', uk: 'первинне публічне розміщення', reason: 'Requires prospectus and licence.' },
  { en: 'underwriting', uk: 'андеррайтинг', reason: 'Regulated activity — do not use.' },
  { en: 'prospectus', uk: 'проспект емісії', reason: 'Regulated document — use «information memorandum» instead.' },
  { en: 'securities offering', uk: 'розміщення цінних паперів', reason: 'Requires prospectus and licence.' },
]

// =============================================================================
// CATEGORY 3 — Fiduciary / agency wording
// =============================================================================
const FIDUCIARY: Pair[] = [
  { en: 'fiduciary', uk: 'фідуціарний', reason: 'Implies duty to act in client interest — do not use.' },
  { en: 'in your best interest', uk: 'у ваших найкращих інтересах', reason: 'Implies fiduciary duty.' },
  { en: 'duty of care', uk: 'обов\'язок піклування', reason: 'Implies fiduciary duty.' },
  { en: 'on your behalf', uk: 'від вашого імені', reason: 'Implies agency relationship.' },
  { en: 'entrust your money', uk: 'довірити свої гроші', reason: 'Implies discretionary management.' },
  { en: 'trust us with your money', uk: 'довіртеся нам зі своїми грошима', reason: 'Implies asset management.' },
]

// =============================================================================
// FORBIDDEN MARKETING PHRASES (Document 2 §6.3.1 + Document 3)
// =============================================================================
const MARKETING: Pair[] = [
  { en: 'invest with us', uk: 'інвестуйте з нами', reason: 'Implies n5deal accepts investments — forbidden marketing phrase.' },
  { en: 'best investments on the market', uk: 'найкращі інвестиції на ринку', reason: 'Investment recommendation + misleading claim.' },
  { en: 'we selected the best projects for you', uk: 'ми відібрали найкращі проекти для вас', reason: 'Implies investment advice.' },
  { en: 'high return at low risk', uk: 'висока дохідність при низькому ризику', reason: 'Misleading statement — forbidden.' },
  { en: 'your reliable investment partner', uk: 'ваш надійний інвестиційний партнер', reason: 'Implies financial relationship.' },
  { en: 'we will help you earn', uk: 'ми поможемо вам заробити', reason: 'Implies investment advice / guarantee.' },
  { en: 'professional investment management', uk: 'професійне управління інвестиціями', reason: 'Regulated activity claim.' },
  { en: 'start earning today', uk: 'початніть заробляти сьогодні', reason: 'Misleading + income guarantee.' },
  { en: 'passive income without effort', uk: 'пасивний дохід без зусиль', reason: 'Misleading claim — never use.' },
  { en: 'our financial experts', uk: 'наші фінансові експерти', reason: 'Sounds like financial consulting (Doc 3).' },
  { en: 'financial partner', uk: 'фінансовий партнер', reason: '«Financial partner» creates regulatory risk (Doc 3).' },
  { en: 'lowest fees', uk: 'найнижчі комісії', reason: 'Financial-services advertising + unsubstantiated claim.' },
  { en: 'best rates', uk: 'найкращі ставки', reason: 'Financial-services advertising + unsubstantiated claim.' },
  { en: 'we provide financial services', uk: 'ми надаємо фінансові послуги', reason: 'Misrepresents n5deal as a regulated financial firm (Doc 3).' },
  { en: 'financial company', uk: 'фінансова компанія', reason: 'Wrong positioning — n5deal is a fintech builder / introducer (Doc 3).' },
  { en: 'payment system', uk: 'платіжна система', reason: 'Wrong positioning — implies regulated PSP (Doc 3).' },
  { en: 'licensed financial institution', uk: 'ліцензована фінустанова', reason: 'False statement — n5deal is not licensed (Doc 3).' },
  { en: 'issuer', uk: 'емітент', reason: 'Wrong positioning — n5deal does not issue financial instruments.' },
]

// =============================================================================
// FORBIDDEN HASHTAGS — language-agnostic
// =============================================================================
const HASHTAGS: Single[] = [
  { word: '#invest', language: 'any', reason: 'Banned hashtag — implies investment recommendation.' },
  { word: '#trading', language: 'any', reason: 'Banned hashtag — associates with trading platform.' },
  { word: '#financialadvisor', language: 'any', reason: 'Banned hashtag — implies regulated advisory.' },
  { word: '#wealthmanagement', language: 'any', reason: 'Banned hashtag — implies regulated wealth management.' },
  { word: '#passiveincome', language: 'any', reason: 'Banned hashtag — implies guaranteed returns.' },
  { word: '#guaranteedreturns', language: 'any', reason: 'Banned hashtag — fraud claim.' },
  { word: '#banking', language: 'any', reason: 'Banned hashtag — banking association.' },
  { word: '#investment', language: 'any', reason: 'Banned hashtag — investment-services association.' },
  { word: '#financialservices', language: 'any', reason: 'Banned hashtag — implies regulated financial services.' },
]

// =============================================================================
// Build the full flat list
// =============================================================================
const PAIRS: Pair[] = [
  ...BANKING,
  ...ADVICE,
  ...CONSULTING,
  ...ASSET_MGMT,
  ...GUARANTEES,
  ...BROKERAGE,
  ...PORTFOLIO,
  ...PLANNING,
  ...SECURITIES,
  ...FIDUCIARY,
  ...MARKETING,
]

const ALL_FLAGS: Single[] = [
  ...PAIRS.flatMap<Single>((p) => [
    { word: p.en, language: 'en', reason: p.reason },
    { word: p.uk, language: 'uk', reason: p.reason },
  ]),
  ...HASHTAGS,
]

async function main() {
  // 1) Drop any pre-existing Russian-language compliance entries (policy: EN+UK only)
  const delRu = await prisma.redFlagWord.deleteMany({
    where: { projectId: PROJECT_ID, category: 'compliance', language: 'ru' },
  })
  console.log(`Removed ${delRu.count} Russian-language compliance entries (policy: EN + UK only)`)

  console.log(`Upserting ${ALL_FLAGS.length} compliance red flags into project ${PROJECT_ID}...`)

  let created = 0
  let updated = 0
  for (const f of ALL_FLAGS) {
    const before = await prisma.redFlagWord.findUnique({
      where: { projectId_word_language: { projectId: PROJECT_ID, word: f.word, language: f.language } },
    })
    await prisma.redFlagWord.upsert({
      where: { projectId_word_language: { projectId: PROJECT_ID, word: f.word, language: f.language } },
      create: {
        projectId: PROJECT_ID,
        word: f.word,
        language: f.language,
        category: 'compliance',
        severity: 'block',
        reason: f.reason,
      },
      update: {
        category: 'compliance',
        severity: 'block',
        reason: f.reason,
      },
    })
    if (before) updated++
    else created++
  }

  console.log(`Compliance red flags — created: ${created}, updated: ${updated}`)

  const total = await prisma.redFlagWord.count({ where: { projectId: PROJECT_ID } })
  const compliance = await prisma.redFlagWord.count({ where: { projectId: PROJECT_ID, category: 'compliance' } })
  const byLang: Array<{ language: string; count: bigint }> = await prisma.$queryRaw`
    SELECT language, COUNT(*)::int as count
    FROM "RedFlagWord"
    WHERE "projectId" = ${PROJECT_ID} AND category = 'compliance'
    GROUP BY language
    ORDER BY count DESC
  `
  console.log(`\nProject ${PROJECT_ID}:`)
  console.log(`  Total red flags: ${total}`)
  console.log(`  Compliance category: ${compliance}`)
  console.log(`  Compliance by language:`)
  byLang.forEach((r: any) => console.log(`    ${r.language.padEnd(5)} ${r.count}`))
}

main()
  .catch((e) => {
    console.error('ERROR:', e.message)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
