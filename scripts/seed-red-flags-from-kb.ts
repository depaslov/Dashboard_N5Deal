// Bulk-seed Red Flag dictionary from n5deal_Prohibited_Terms_Reference.pdf.
// All terms are project-scoped to seed-project-n5deal and category='compliance'.
// Severity:
//   block — Category 1 (criminal/regulatory liability) + explicit forbidden marketing
//   warn  — Category 2 (high regulatory risk) + Category 3 (medium risk)
//
// Idempotent: uses upsert on the unique (projectId, word, language) key, so
// re-running this just refreshes severity/reason without duplicating.

import { prisma } from '../lib/db'

const PROJECT_ID = 'seed-project-n5deal'

interface Entry {
  word: string
  language: 'en' | 'uk' | 'ru' | 'any'
  severity: 'warn' | 'block'
  reason: string
}

// --- CATEGORY 1: ABSOLUTELY PROHIBITED (block) -----------------------------

const CAT1_BANKING: Entry[] = [
  { word: 'bank',                    language: 'en', severity: 'block', reason: 'Banking license required (FSMA s.24, Banking Act 2009 UK; 18 USC §1344 US). Use "platform"/"service".' },
  { word: 'banking',                 language: 'en', severity: 'block', reason: 'Implies regulated banking activity.' },
  { word: 'deposit',                 language: 'en', severity: 'block', reason: 'Accepting deposits is regulated activity (RAO 2001 Art.5; PSD2). Use "investment contribution".' },
  { word: 'accept deposits',         language: 'en', severity: 'block', reason: 'Regulated activity under FSMA s.19.' },
  { word: 'savings account',         language: 'en', severity: 'block', reason: 'Implies banking activity. Use "investment account on the platform".' },
  { word: 'current account',         language: 'en', severity: 'block', reason: 'Banking activity. Use "user profile" / "personal cabinet".' },
  { word: 'checking account',        language: 'en', severity: 'block', reason: 'US banking term — implies regulated deposit-taking.' },
  { word: 'interest rate',           language: 'en', severity: 'block', reason: 'Implies guaranteed return = fraud + regulated activity.' },
  { word: 'guaranteed return',       language: 'en', severity: 'block', reason: 'Guarantee of returns is regulated + securities fraud.' },
  { word: 'guaranteed returns',      language: 'en', severity: 'block', reason: 'Guarantee of returns is regulated + securities fraud.' },
  { word: 'fdic insured',            language: 'en', severity: 'block', reason: 'False statement of insurance — 18 USC §1014.' },
  { word: 'protected deposit',       language: 'en', severity: 'block', reason: 'False insurance claim — FSCS UK, FDIC US.' },
  { word: 'wire transfer',           language: 'en', severity: 'block', reason: 'Banking activity — implies money transmission.' },
  { word: 'банк',                    language: 'ru', severity: 'block', reason: 'Использование без лицензии — уголовное преступление. Использовать «платформа», «сервис».' },
  { word: 'банковский',              language: 'ru', severity: 'block', reason: 'Подразумевает банковскую деятельность.' },
  { word: 'депозит',                 language: 'ru', severity: 'block', reason: 'Приём депозитов — регулируемая деятельность.' },
  { word: 'принимаем вклады',        language: 'ru', severity: 'block', reason: 'Регулируемая деятельность.' },
  { word: 'сберегательный счёт',     language: 'ru', severity: 'block', reason: 'Подразумевает банковскую деятельность.' },
  { word: 'процентная ставка',       language: 'ru', severity: 'block', reason: 'Подразумевает гарантированный доход.' },
  { word: 'гарантированная доходность', language: 'ru', severity: 'block', reason: 'Гарантия дохода = мошенничество + регулируемая деятельность.' },
  { word: 'застрахованный вклад',    language: 'ru', severity: 'block', reason: 'Ложное заявление о страховании.' },
  { word: 'банк',                    language: 'uk', severity: 'block', reason: 'Без ліцензії — кримінальна відповідальність. Використовуй «платформа».' },
  { word: 'депозит',                 language: 'uk', severity: 'block', reason: 'Регульована діяльність.' },
  { word: 'гарантована дохідність',  language: 'uk', severity: 'block', reason: 'Гарантія доходу = шахрайство + регульована діяльність.' },
]

const CAT1_INVESTMENT_ADVISORY: Entry[] = [
  { word: 'investment advice',       language: 'en', severity: 'block', reason: 'Regulated activity (Investment Advisers Act 1940; RAO Art.53). Use "platform information".' },
  { word: 'investment advisor',      language: 'en', severity: 'block', reason: 'Requires registration with SEC/FCA.' },
  { word: 'investment adviser',      language: 'en', severity: 'block', reason: 'Requires registration with SEC/FCA.' },
  { word: 'financial advisor',       language: 'en', severity: 'block', reason: 'Regulated profession. Use "intermediary" / "introducer".' },
  { word: 'financial adviser',       language: 'en', severity: 'block', reason: 'Regulated profession. Use "intermediary" / "introducer".' },
  { word: 'we advise',               language: 'en', severity: 'block', reason: 'Implies investment advice.' },
  { word: 'we recommend',            language: 'en', severity: 'block', reason: 'Implies investment recommendation = regulated.' },
  { word: 'best investment',         language: 'en', severity: 'block', reason: 'Investment recommendation + misleading.' },
  { word: 'recommended investment',  language: 'en', severity: 'block', reason: 'Investment recommendation = regulated.' },
  { word: 'wealth management',       language: 'en', severity: 'block', reason: 'Regulated activity. Use "introductions to investors".' },
  { word: 'инвестиционная рекомендация', language: 'ru', severity: 'block', reason: 'Регулируемая деятельность.' },
  { word: 'финансовый советник',     language: 'ru', severity: 'block', reason: 'Регулируемая профессия.' },
  { word: 'мы советуем',             language: 'ru', severity: 'block', reason: 'Подразумевает инвестиционный совет.' },
  { word: 'мы рекомендуем',          language: 'ru', severity: 'block', reason: 'Подразумевает инвестиционную рекомендацию.' },
  { word: 'управление благосостоянием', language: 'ru', severity: 'block', reason: 'Регулируемая деятельность.' },
  { word: 'фінансовий радник',       language: 'uk', severity: 'block', reason: 'Регульована професія.' },
  { word: 'інвестиційна рекомендація', language: 'uk', severity: 'block', reason: 'Регульована діяльність.' },
]

const CAT1_ASSET_MANAGEMENT: Entry[] = [
  { word: 'asset management',        language: 'en', severity: 'block', reason: 'Regulated activity (RAO Art.37; ICA 1940). Use "introduction services".' },
  { word: 'manage your assets',      language: 'en', severity: 'block', reason: 'Regulated activity.' },
  { word: 'manage your money',       language: 'en', severity: 'block', reason: 'Regulated activity.' },
  { word: 'manage investments',      language: 'en', severity: 'block', reason: 'Regulated activity.' },
  { word: 'custody',                 language: 'en', severity: 'block', reason: 'Custody of client assets is heavily regulated.' },
  { word: 'custodian',               language: 'en', severity: 'block', reason: 'Regulated role.' },
  { word: 'fund',                    language: 'en', severity: 'block', reason: 'Implies collective investment scheme — heavily regulated. Use "platform" / "marketplace".' },
  { word: 'mutual fund',             language: 'en', severity: 'block', reason: 'Regulated investment vehicle.' },
  { word: 'hedge fund',              language: 'en', severity: 'block', reason: 'Regulated investment vehicle.' },
  { word: 'управление активами',     language: 'ru', severity: 'block', reason: 'Регулируемая деятельность.' },
  { word: 'управляем инвестициями',  language: 'ru', severity: 'block', reason: 'Регулируемая деятельность.' },
  { word: 'кастодиан',               language: 'ru', severity: 'block', reason: 'Регулируемая деятельность.' },
  { word: 'инвестиционный фонд',     language: 'ru', severity: 'block', reason: 'Регулируемое инвестиционное предприятие.' },
  { word: 'управління активами',     language: 'uk', severity: 'block', reason: 'Регульована діяльність.' },
]

const CAT1_INSURANCE_GUARANTEES: Entry[] = [
  { word: 'insurance',               language: 'en', severity: 'block', reason: 'Insurance license required (FSMA, Solvency II EU).' },
  { word: 'insured',                 language: 'en', severity: 'block', reason: 'False insurance claim.' },
  { word: 'risk-free',               language: 'en', severity: 'block', reason: 'Misleading + securities fraud (SEC Rule 10b-5).' },
  { word: 'no risk',                 language: 'en', severity: 'block', reason: 'Misleading statement on investment risk.' },
  { word: 'guaranteed',              language: 'en', severity: 'block', reason: 'Investment guarantees imply fraud.' },
  { word: 'principal protected',     language: 'en', severity: 'block', reason: 'Implies guaranteed return of capital.' },
  { word: 'safe investment',         language: 'en', severity: 'block', reason: 'Misleading — all investments carry risk.' },
  { word: 'застрахован',             language: 'ru', severity: 'block', reason: 'Ложное заявление о страховании.' },
  { word: 'безрисковый',             language: 'ru', severity: 'block', reason: 'Вводит в заблуждение.' },
  { word: 'безрисковые инвестиции',  language: 'ru', severity: 'block', reason: 'Вводит в заблуждение — все инвестиции сопряжены с риском.' },
  { word: 'гарантировано',           language: 'ru', severity: 'block', reason: 'Гарантия дохода = мошенничество.' },
  { word: 'без риска',               language: 'ru', severity: 'block', reason: 'Вводит в заблуждение.' },
  { word: 'безризикові інвестиції',  language: 'uk', severity: 'block', reason: 'Вводить в оману — всі інвестиції мають ризик.' },
]

// --- CATEGORY 2: HIGH RISK (warn) ------------------------------------------

const CAT2_BROKER_DEALER: Entry[] = [
  { word: 'broker',                  language: 'en', severity: 'block', reason: 'Implies broker-dealer activity (RAO; Exchange Act 1934). Use "intermediary" / "introducer".' },
  { word: 'brokerage',               language: 'en', severity: 'block', reason: 'Regulated activity.' },
  { word: 'dealer',                  language: 'en', severity: 'block', reason: 'Regulated dealing activity.' },
  { word: 'execute trades',          language: 'en', severity: 'warn',  reason: 'Implies brokerage activity. Use "parties conclude deals independently".' },
  { word: 'order execution',         language: 'en', severity: 'warn',  reason: 'Implies brokerage activity.' },
  { word: 'place an order',          language: 'en', severity: 'warn',  reason: 'Implies trading platform. Use "express interest" / "submit application".' },
  { word: 'trading platform',        language: 'en', severity: 'warn',  reason: 'Requires MTF/OTF license (MiFID II). Use "information platform".' },
  { word: 'market maker',            language: 'en', severity: 'warn',  reason: 'Regulated activity. Avoid entirely.' },
  { word: 'clearing',                language: 'en', severity: 'warn',  reason: 'Regulated infrastructure activity (EMIR).' },
  { word: 'settlement',              language: 'en', severity: 'warn',  reason: 'Regulated infrastructure activity.' },
  { word: 'брокер',                  language: 'ru', severity: 'block', reason: 'Регулируемая деятельность.' },
  { word: 'дилер',                   language: 'ru', severity: 'block', reason: 'Регулируемая деятельность.' },
  { word: 'торговая платформа',      language: 'ru', severity: 'warn',  reason: 'Требует лицензии MTF/OTF.' },
  { word: 'маркет-мейкер',           language: 'ru', severity: 'warn',  reason: 'Регулируемая деятельность.' },
  { word: 'брокер',                  language: 'uk', severity: 'block', reason: 'Регульована діяльність.' },
]

const CAT2_PORTFOLIO: Entry[] = [
  { word: 'portfolio',               language: 'en', severity: 'warn',  reason: 'Implies portfolio management. Use "user investment set".' },
  { word: 'diversification strategy',language: 'en', severity: 'warn',  reason: 'Implies investment advice. Use "information about sectors".' },
  { word: 'rebalancing',             language: 'en', severity: 'warn',  reason: 'Implies portfolio management. Avoid.' },
  { word: 'asset allocation',        language: 'en', severity: 'warn',  reason: 'Implies investment advice.' },
  { word: 'risk-adjusted return',    language: 'en', severity: 'warn',  reason: 'Implies investment advice.' },
  { word: 'портфель',                language: 'ru', severity: 'warn',  reason: 'Подразумевает управление портфелем.' },
  { word: 'стратегия диверсификации',language: 'ru', severity: 'warn',  reason: 'Подразумевает инвестиционный совет.' },
  { word: 'распределение активов',   language: 'ru', severity: 'warn',  reason: 'Подразумевает инвестиционный совет.' },
]

const CAT2_FINANCIAL_PLANNING: Entry[] = [
  { word: 'financial planning',      language: 'en', severity: 'warn',  reason: 'Regulated activity in many jurisdictions.' },
  { word: 'retirement planning',     language: 'en', severity: 'warn',  reason: 'Regulated advisory activity.' },
  { word: 'tax planning',            language: 'en', severity: 'warn',  reason: 'Tax advice is regulated.' },
  { word: 'estate planning',         language: 'en', severity: 'warn',  reason: 'Regulated advisory activity.' },
  { word: 'финансовое планирование', language: 'ru', severity: 'warn',  reason: 'Регулируемая деятельность.' },
]

const CAT2_SECURITIES: Entry[] = [
  { word: 'securities',              language: 'en', severity: 'warn',  reason: 'Triggers Securities Act / MiFID II scope. Use case-by-case with disclaimer.' },
  { word: 'bonds',                   language: 'en', severity: 'warn',  reason: 'Regulated security type.' },
  { word: 'stocks',                  language: 'en', severity: 'warn',  reason: 'Regulated security type. Use "shares" only with disclaimer.' },
  { word: 'IPO',                     language: 'en', severity: 'warn',  reason: 'Highly regulated offering process.' },
  { word: 'public offering',         language: 'en', severity: 'warn',  reason: 'Triggers prospectus rules (EU Prospectus Reg; Securities Act 1933).' },
  { word: 'private placement',       language: 'en', severity: 'warn',  reason: 'Regulated offering — exempt under Reg D, but still scoped.' },
  { word: 'ценные бумаги',           language: 'ru', severity: 'warn',  reason: 'Регулируемый класс инструментов.' },
  { word: 'IPO',                     language: 'ru', severity: 'warn',  reason: 'Регулируемый процесс публичного предложения.' },
]

// --- CATEGORY 3: MEDIUM RISK (warn) ----------------------------------------

const CAT3_TRANSACTIONAL: Entry[] = [
  { word: 'invest with us',          language: 'en', severity: 'block', reason: 'Implies N5Deal accepts investments. Use "find investment opportunities through our platform".' },
  { word: 'invest now',              language: 'en', severity: 'block', reason: 'Inducement to invest — regulated under FSMA s.21 UK.' },
  { word: 'inveстируйте с нами',     language: 'ru', severity: 'block', reason: 'Подразумевает приём инвестиций. Использовать «найдите инвестиционные возможности через платформу».' },
  { word: 'инвестируйте сейчас',     language: 'ru', severity: 'block', reason: 'Побуждение к инвестированию — регулируется.' },
  { word: 'доверьте нам свои деньги',language: 'ru', severity: 'block', reason: 'Подразумевает управление активами.' },
  { word: 'transfer your money',     language: 'en', severity: 'warn',  reason: 'Implies money transmission.' },
  { word: 'pay into',                language: 'en', severity: 'warn',  reason: 'Implies platform takes custody of funds.' },
]

const CAT3_FIDUCIARY: Entry[] = [
  { word: 'fiduciary',               language: 'en', severity: 'warn',  reason: 'Implies fiduciary duty — regulated relationship.' },
  { word: 'trust account',           language: 'en', severity: 'warn',  reason: 'Implies regulated trust services.' },
  { word: 'on your behalf',          language: 'en', severity: 'warn',  reason: 'Implies agency relationship.' },
  { word: 'фидуциар',                language: 'ru', severity: 'warn',  reason: 'Подразумевает фидуциарную ответственность.' },
]

// --- 6.3.1 SPECIFIC FORBIDDEN MARKETING PHRASES ----------------------------

const MARKETING: Entry[] = [
  { word: 'best investments on the market', language: 'en', severity: 'block', reason: 'Investment recommendation + misleading.' },
  { word: 'we picked the best projects for you', language: 'en', severity: 'block', reason: 'Implies investment advice.' },
  { word: 'high return at low risk', language: 'en', severity: 'block', reason: 'Misleading risk-return statement.' },
  { word: 'your trusted investment partner', language: 'en', severity: 'block', reason: 'Implies financial relationship.' },
  { word: 'we will help you earn',   language: 'en', severity: 'block', reason: 'Implies investment advice + return guarantee.' },
  { word: 'professional investment management', language: 'en', severity: 'block', reason: 'Regulated activity.' },
  { word: 'start earning today',     language: 'en', severity: 'block', reason: 'Misleading + return guarantee. Use "start meeting projects today".' },
  { word: 'passive income with no effort', language: 'en', severity: 'block', reason: 'Misleading statement.' },
  { word: 'лучшие инвестиции на рынке', language: 'ru', severity: 'block', reason: 'Инвестиционная рекомендация + введение в заблуждение.' },
  { word: 'мы отобрали лучшие проекты для вас', language: 'ru', severity: 'block', reason: 'Подразумевает инвестиционный совет.' },
  { word: 'высокая доходность при низком риске', language: 'ru', severity: 'block', reason: 'Введение в заблуждение.' },
  { word: 'ваш надёжный инвестиционный партнёр', language: 'ru', severity: 'block', reason: 'Подразумевает финансовые отношения.' },
  { word: 'мы поможем вам заработать', language: 'ru', severity: 'block', reason: 'Инвестиционный совет + гарантия.' },
  { word: 'начните зарабатывать уже сегодня', language: 'ru', severity: 'block', reason: 'Введение в заблуждение + гарантия дохода.' },
  { word: 'пассивный доход без усилий', language: 'ru', severity: 'block', reason: 'Введение в заблуждение.' },
]

// --- 6.3.2 FORBIDDEN HASHTAGS ----------------------------------------------

const HASHTAGS: Entry[] = [
  { word: '#invest',                 language: 'any', severity: 'warn',  reason: 'Forbidden hashtag — implies platform accepts investments.' },
  { word: '#trading',                language: 'any', severity: 'warn',  reason: 'Forbidden hashtag — implies trading platform.' },
  { word: '#financialadvisor',       language: 'any', severity: 'warn',  reason: 'Forbidden hashtag — regulated profession.' },
  { word: '#wealthmanagement',       language: 'any', severity: 'warn',  reason: 'Forbidden hashtag — regulated activity.' },
  { word: '#passiveincome',          language: 'any', severity: 'warn',  reason: 'Forbidden hashtag — misleading.' },
  { word: '#guaranteedreturns',      language: 'any', severity: 'warn',  reason: 'Forbidden hashtag — investment guarantee.' },
]

const ALL: Entry[] = [
  ...CAT1_BANKING,
  ...CAT1_INVESTMENT_ADVISORY,
  ...CAT1_ASSET_MANAGEMENT,
  ...CAT1_INSURANCE_GUARANTEES,
  ...CAT2_BROKER_DEALER,
  ...CAT2_PORTFOLIO,
  ...CAT2_FINANCIAL_PLANNING,
  ...CAT2_SECURITIES,
  ...CAT3_TRANSACTIONAL,
  ...CAT3_FIDUCIARY,
  ...MARKETING,
  ...HASHTAGS,
]

async function main() {
  console.log(`Seeding ${ALL.length} compliance red flags into project=${PROJECT_ID}`)
  let created = 0, updated = 0
  for (const e of ALL) {
    const before = await prisma.redFlagWord.findUnique({
      where: { projectId_word_language: { projectId: PROJECT_ID, word: e.word, language: e.language } },
    })
    await prisma.redFlagWord.upsert({
      where: { projectId_word_language: { projectId: PROJECT_ID, word: e.word, language: e.language } },
      create: { projectId: PROJECT_ID, word: e.word, language: e.language, category: 'compliance', severity: e.severity, reason: e.reason },
      update: { category: 'compliance', severity: e.severity, reason: e.reason },
    })
    if (before) updated++
    else created++
  }
  console.log(`Created: ${created}, Updated: ${updated}`)

  const totals = await prisma.redFlagWord.groupBy({
    by: ['category', 'severity'],
    where: { projectId: PROJECT_ID },
    _count: true,
  })
  console.log('\nFinal RedFlag distribution:')
  for (const t of totals) {
    console.log(`  ${t.category.padEnd(12)} ${t.severity.padEnd(6)} ${t._count}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
