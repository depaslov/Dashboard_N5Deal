// Seed lawyer-approved compliance red flags into the RedFlagWord table.
// Source documents:
// - "Чому ЗАБОРОНЕНО: Консультуємо на нашому гайду"
// - "N5Deal — Prohibited & Risky Terms Reference v2.0" (FCA/SEC/MiFID II)
// - "SMM-Brief: Fintech Builder positioning"
//
// Category="compliance", severity="block" — these are legal blockers, not
// stylistic warnings. Idempotent via upsert on (projectId, word, language).

import { prisma } from '../lib/db'

const PROJECT_ID = 'seed-project-n5deal'

interface Flag {
  word: string
  language: 'en' | 'uk' | 'ru' | 'any'
  reason: string
}

// =============================================================================
// CATEGORY 1 — ABSOLUTELY FORBIDDEN (criminal liability — FSMA s.19, RAO, MiFID II)
// =============================================================================
const CAT1_BANKING: Flag[] = [
  { word: 'bank', language: 'en', reason: 'Banking term — using without licence is criminal (FSMA s.24, Banking Act 2009).' },
  { word: 'banking', language: 'en', reason: 'Banking activity — requires licence (FSMA s.19).' },
  { word: 'банк', language: 'uk', reason: 'Банківський термін без ліцензії — кримінальна відповідальність.' },
  { word: 'банк', language: 'ru', reason: 'Банковский термин без лицензии — уголовная ответственность.' },
  { word: 'банковские услуги', language: 'ru', reason: 'Банковская деятельность — требует лицензии.' },
  { word: 'банківські послуги', language: 'uk', reason: 'Банківська діяльність — потребує ліцензії.' },
  { word: 'deposit', language: 'en', reason: 'Accepting deposits is a regulated activity (RAO 2001 Art.5).' },
  { word: 'accept deposits', language: 'en', reason: 'Regulated activity (RAO Art.5; FSMA s.19).' },
  { word: 'депозит', language: 'uk', reason: 'Приймання депозитів — регульована діяльність.' },
  { word: 'депозит', language: 'ru', reason: 'Приём депозитов — регулируемая деятельность.' },
  { word: 'принимаем вклады', language: 'ru', reason: 'Приём вкладов — банковская деятельность.' },
  { word: 'savings account', language: 'en', reason: 'Implies banking activity (RAO Art.5; FDIC regulations).' },
  { word: 'ощадний рахунок', language: 'uk', reason: 'Ощадний рахунок передбачає банківську діяльність.' },
  { word: 'сберегательный счёт', language: 'ru', reason: 'Сберегательный счёт = банковская деятельность.' },
  { word: 'interest rate', language: 'en', reason: 'Implies regulated lending/deposit activity.' },
  { word: 'процентна ставка', language: 'uk', reason: 'Передбачає регульовану банківську діяльність.' },
  { word: 'процентная ставка', language: 'ru', reason: 'Подразумевает регулируемую деятельность.' },
  { word: 'guaranteed return', language: 'en', reason: 'Income guarantee = regulated activity + fraud (FSMA s.397; Securities Act s.17(a); MAR Art.12).' },
  { word: 'гарантована дохідність', language: 'uk', reason: 'Гарантія доходу = регульована діяльність + шахрайство.' },
  { word: 'гарантированная доходность', language: 'ru', reason: 'Гарантия дохода = регулируемая деятельность + мошенничество.' },
  { word: 'FDIC insured', language: 'en', reason: 'False statement about insurance (18 U.S.C. §1014).' },
  { word: 'protected deposit', language: 'en', reason: 'False insurance claim (FSCS rules).' },
  { word: 'застрахований вклад', language: 'uk', reason: 'Хибне твердження про страхування.' },
  { word: 'застрахованный вклад', language: 'ru', reason: 'Ложное заявление о страховании.' },
  { word: 'current account', language: 'en', reason: 'Banking activity (PSD2; Banking Act 2009).' },
  { word: 'checking account', language: 'en', reason: 'Banking activity.' },
  { word: 'поточний рахунок', language: 'uk', reason: 'Банківська діяльність.' },
  { word: 'расчётный счёт', language: 'ru', reason: 'Банковская деятельность.' },
  { word: 'текущий счёт', language: 'ru', reason: 'Банковская деятельность.' },
]

const CAT1_ADVICE: Flag[] = [
  { word: 'investment advice', language: 'en', reason: 'Regulated activity — requires FCA/SEC licence (RAO Art.53; MiFID II Art.4(1)(4); IAA 1940).' },
  { word: 'investment recommendation', language: 'en', reason: 'Regulated activity (RAO Art.53; MiFID II Art.9).' },
  { word: 'інвестиційна консультація', language: 'uk', reason: 'Регульована діяльність — потребує ліцензії.' },
  { word: 'інвестиційна порада', language: 'uk', reason: 'Регульована діяльність.' },
  { word: 'инвестиционная консультация', language: 'ru', reason: 'Регулируемая деятельность — требует лицензии.' },
  { word: 'инвестиционный совет', language: 'ru', reason: 'Регулируемая деятельность.' },
  { word: 'we recommend', language: 'en', reason: 'Personal recommendation = regulated activity (RAO Art.53; MiFID II Art.9).' },
  { word: 'our recommendation', language: 'en', reason: 'Personal recommendation = regulated activity.' },
  { word: 'ми рекомендуємо', language: 'uk', reason: 'Персональна рекомендація = регульована діяльність.' },
  { word: 'ми радимо', language: 'uk', reason: 'Особиста порада = регульована діяльність.' },
  { word: 'мы рекомендуем', language: 'ru', reason: 'Персональная рекомендация = регулируемая деятельность.' },
  { word: 'мы советуем', language: 'ru', reason: 'Персональный совет = регулируемая деятельность.' },
  { word: 'financial adviser', language: 'en', reason: 'Protected title — requires registration (FSMA s.19, s.24; IAA 1940).' },
  { word: 'investment adviser', language: 'en', reason: 'Protected title — requires registration (IAA 1940).' },
  { word: 'фінансовий радник', language: 'uk', reason: 'Захищене звання, потребує ліцензії.' },
  { word: 'інвестиційний радник', language: 'uk', reason: 'Захищене звання, потребує ліцензії.' },
  { word: 'финансовый консультант', language: 'ru', reason: 'Защищённое звание, требует регистрации.' },
  { word: 'инвестиционный советник', language: 'ru', reason: 'Защищённое звание, требует регистрации.' },
  { word: 'suitable for you', language: 'en', reason: 'Implies suitability assessment (MiFID II Art.25; FCA COBS 9; SEC Rule 15l-1).' },
  { word: 'best for your needs', language: 'en', reason: 'Implies suitability assessment.' },
  { word: 'підходить вам', language: 'uk', reason: 'Передбачає оцінку придатності.' },
  { word: 'подходит вам', language: 'ru', reason: 'Подразумевает suitability assessment.' },
  { word: 'personal recommendation', language: 'en', reason: 'Defined as regulated activity (RAO Art.53(1); MiFID II Art.4(1)(4)).' },
  { word: 'персональна рекомендація', language: 'uk', reason: 'Визначена як регульована діяльність.' },
  { word: 'персональная рекомендация', language: 'ru', reason: 'Определена как регулируемая деятельность.' },
  { word: 'you should invest', language: 'en', reason: 'Direct investment recommendation (RAO Art.53; Securities Act s.17(a)).' },
  { word: 'вам слід інвестувати', language: 'uk', reason: 'Пряма інвестиційна рекомендація.' },
  { word: 'вам следует инвестировать', language: 'ru', reason: 'Прямая инвестиционная рекомендация.' },
  { word: 'buy signal', language: 'en', reason: 'Investment recommendation (MAR Art.3(1)(35); RAO Art.53).' },
  { word: 'sell signal', language: 'en', reason: 'Investment recommendation.' },
  { word: 'сигнал на покупку', language: 'ru', reason: 'Инвестиционная рекомендация.' },
  { word: 'сигнал на продажу', language: 'ru', reason: 'Инвестиционная рекомендация.' },
  { word: 'консультуємо на нашому гайду', language: 'uk', reason: 'Створює юридичне враження надання фінансових консультацій (FCA).' },
  { word: 'ми консультуємо', language: 'uk', reason: 'Слово "консультуємо" автоматично класифікує діяльність як regulated activity (FCA).' },
  { word: 'наш гайд рекомендує', language: 'uk', reason: 'Передбачає інвестиційні рекомендації.' },
]

const CAT1_ASSET_MGMT: Flag[] = [
  { word: 'asset management', language: 'en', reason: 'Regulated activity (RAO Art.37; MiFID II Art.4(1)(8); IAA 1940).' },
  { word: 'portfolio management', language: 'en', reason: 'Regulated activity (RAO Art.37; MiFID II Art.4(1)(8)).' },
  { word: 'управління активами', language: 'uk', reason: 'Регульована діяльність.' },
  { word: 'управление активами', language: 'ru', reason: 'Регулируемая деятельность.' },
  { word: 'управління портфелем', language: 'uk', reason: 'Регульована діяльність.' },
  { word: 'управление портфелем', language: 'ru', reason: 'Регулируемая деятельность.' },
  { word: 'investment fund', language: 'en', reason: 'Implies collective investment (FSMA s.235 CIS; AIFMD; ICA 1940).' },
  { word: 'інвестиційний фонд', language: 'uk', reason: 'Передбачає колективне інвестування.' },
  { word: 'инвестиционный фонд', language: 'ru', reason: 'Подразумевает коллективное инвестирование.' },
  { word: 'we manage your money', language: 'en', reason: 'Direct asset-management claim (RAO Art.37).' },
  { word: 'ми управляємо вашими грошима', language: 'uk', reason: 'Пряма заява про управління активами.' },
  { word: 'мы управляем вашими деньгами', language: 'ru', reason: 'Прямое указание на управление активами.' },
  { word: 'discretionary management', language: 'en', reason: 'Highest form of regulated asset management.' },
  { word: 'доверительное управление', language: 'ru', reason: 'Высшая форма регулируемой деятельности.' },
  { word: 'доверительне управління', language: 'uk', reason: 'Найвища форма регульованої діяльності.' },
  { word: 'AUM', language: 'en', reason: 'Assets under management — implies asset management (IAA 1940; MiFID II).' },
  { word: 'assets under management', language: 'en', reason: 'Implies regulated asset management.' },
  { word: 'NAV', language: 'en', reason: 'Net Asset Value — collective-investment term (FSMA s.235; ICA 1940).' },
  { word: 'net asset value', language: 'en', reason: 'Collective-investment term.' },
  { word: 'custodian', language: 'en', reason: 'Custody is a regulated activity (RAO Art.40; MiFID II Art.4(1)(18)).' },
  { word: 'custody services', language: 'en', reason: 'Regulated activity — holding client assets.' },
  { word: 'кастодіан', language: 'uk', reason: 'Регульована діяльність — зберігання активів.' },
  { word: 'кастодиан', language: 'ru', reason: 'Регулируемая деятельность — хранение активов.' },
]

const CAT1_GUARANTEES: Flag[] = [
  { word: 'guaranteed profit', language: 'en', reason: 'Fraud claim (FSMA s.397; Securities Act s.17(a); MAR Art.12).' },
  { word: 'no risk', language: 'en', reason: 'False statement (FCA COBS 4.2; SEC Rule 10b-5).' },
  { word: 'гарантований прибуток', language: 'uk', reason: 'Шахрайське твердження.' },
  { word: 'гарантированная прибыль', language: 'ru', reason: 'Мошенническое заявление.' },
  { word: 'без ризику', language: 'uk', reason: 'Хибне твердження.' },
  { word: 'без риска', language: 'ru', reason: 'Ложное заявление.' },
  { word: 'capital protection', language: 'en', reason: 'Implies guarantee — requires licence (Prospectus Regulation; MiFID II).' },
  { word: 'захист капіталу', language: 'uk', reason: 'Передбачає гарантію — потребує ліцензії.' },
  { word: 'защита капитала', language: 'ru', reason: 'Подразумевает гарантию.' },
  { word: 'insured investment', language: 'en', reason: 'Insurance activity requires licence (Insurance Act 2015; Solvency II).' },
  { word: 'застрахована інвестиція', language: 'uk', reason: 'Страхова діяльність потребує ліцензії.' },
  { word: 'застрахованная инвестиция', language: 'ru', reason: 'Страховая деятельность требует лицензии.' },
  { word: 'risk-free', language: 'en', reason: 'False statement = fraud (FCA COBS 4.2; SEC Rule 10b-5).' },
  { word: 'безризковий', language: 'uk', reason: 'Хибне твердження = шахрайство.' },
  { word: 'безрисковый', language: 'ru', reason: 'Ложное заявление = мошенничество.' },
]

// =============================================================================
// CATEGORY 2 — HIGH RISK (regulated activity if used)
// =============================================================================
const CAT2_BROKERAGE: Flag[] = [
  { word: 'broker', language: 'en', reason: 'Implies dealing as principal/agent (RAO Art.14, 21, 25; Exchange Act s.3(a)(4)).' },
  { word: 'brokerage', language: 'en', reason: 'Regulated dealing activity.' },
  { word: 'брокер', language: 'uk', reason: 'Передбачає регульовану діяльність дилінгу.' },
  { word: 'брокер', language: 'ru', reason: 'Подразумевает регулируемую деятельность.' },
  { word: 'брокерські послуги', language: 'uk', reason: 'Регульована діяльність.' },
  { word: 'брокерские услуги', language: 'ru', reason: 'Регулируемая деятельность.' },
  { word: 'dealer', language: 'en', reason: 'Regulated activity (RAO Art.14, 21; SEC Rules 3a5-4, 3a44-2).' },
  { word: 'dealing', language: 'en', reason: 'Regulated activity.' },
  { word: 'дилер', language: 'uk', reason: 'Регульована діяльність.' },
  { word: 'дилер', language: 'ru', reason: 'Регулируемая деятельность.' },
  { word: 'execute trades', language: 'en', reason: 'Implies broker activity (RAO Art.14, 21; MiFID II Art.4(1)(5)).' },
  { word: 'order execution', language: 'en', reason: 'Implies broker activity.' },
  { word: 'place an order', language: 'en', reason: 'Implies trading platform (MiFID II; Exchange Act 1934).' },
  { word: 'trading platform', language: 'en', reason: 'Requires MTF/OTF licence (MiFID II Art.4(1)(22-23); RAO).' },
  { word: 'торгова платформа', language: 'uk', reason: 'Потребує ліцензії MTF/OTF.' },
  { word: 'торговая платформа', language: 'ru', reason: 'Требует лицензии MTF/OTF.' },
  { word: 'market maker', language: 'en', reason: 'Regulated activity (MiFID II Art.4(1)(7); SEC Rules 3a5-4).' },
  { word: 'маркет-мейкер', language: 'uk', reason: 'Регульована діяльність.' },
  { word: 'клиринг', language: 'ru', reason: 'Регулируемая инфраструктурная деятельность (EMIR).' },
  { word: 'кліринг', language: 'uk', reason: 'Регульована інфраструктурна діяльність.' },
]

const CAT2_PORTFOLIO: Flag[] = [
  { word: 'diversification strategy', language: 'en', reason: 'Implies investment advice.' },
  { word: 'стратегія диверсифікації', language: 'uk', reason: 'Передбачає інвестиційний совет.' },
  { word: 'стратегия диверсификации', language: 'ru', reason: 'Подразумевает инвестиционный совет.' },
  { word: 'rebalancing', language: 'en', reason: 'Implies portfolio management.' },
  { word: 'ребалансування', language: 'uk', reason: 'Передбачає управління портфелем.' },
  { word: 'ребалансировка', language: 'ru', reason: 'Подразумевает управление портфелем.' },
  { word: 'asset allocation', language: 'en', reason: 'Implies investment advice.' },
  { word: 'розподіл активів', language: 'uk', reason: 'Передбачає інвестиційну пораду.' },
  { word: 'распределение активов', language: 'ru', reason: 'Подразумевает инвестиционный совет.' },
  { word: 'risk-adjusted return', language: 'en', reason: 'Implies analytical/advisory service.' },
  { word: 'доходность с поправкой на риск', language: 'ru', reason: 'Подразумевает аналитику/совет.' },
]

const CAT2_PLANNING: Flag[] = [
  { word: 'financial planning', language: 'en', reason: 'Regulated activity in UK/US.' },
  { word: 'фінансове планування', language: 'uk', reason: 'Регульована діяльність.' },
  { word: 'финансовое планирование', language: 'ru', reason: 'Регулируемая деятельность.' },
  { word: 'wealth management', language: 'en', reason: 'Regulated activity.' },
  { word: 'управління благосостоянием', language: 'uk', reason: 'Регульована діяльність.' },
  { word: 'управление благосостоянием', language: 'ru', reason: 'Регулируемая деятельность.' },
  { word: 'retirement planning', language: 'en', reason: 'Regulated activity — do not use.' },
  { word: 'пенсійне планування', language: 'uk', reason: 'Регульована діяльність.' },
  { word: 'пенсионное планирование', language: 'ru', reason: 'Регулируемая деятельность.' },
  { word: 'tax advice', language: 'en', reason: 'May require licence.' },
  { word: 'tax planning', language: 'en', reason: 'May require licence.' },
  { word: 'податкова консультація', language: 'uk', reason: 'Може потребувати ліцензії.' },
  { word: 'налоговая консультация', language: 'ru', reason: 'Может требовать лицензии.' },
  { word: 'estate planning', language: 'en', reason: 'Regulated activity — do not use.' },
  { word: 'investment strategy', language: 'en', reason: 'Implies investment advice.' },
  { word: 'інвестиційна стратегія', language: 'uk', reason: 'Передбачає інвестиційний совет.' },
  { word: 'инвестиционная стратегия', language: 'ru', reason: 'Подразумевает инвестиционный совет.' },
]

const CAT2_SECURITIES: Flag[] = [
  { word: 'shares offering', language: 'en', reason: 'Requires prospectus and licence (Prospectus Regulation).' },
  { word: 'IPO', language: 'en', reason: 'Requires prospectus and licence.' },
  { word: 'розміщення акцій', language: 'uk', reason: 'Потребує проспекту та ліцензії.' },
  { word: 'размещение акций', language: 'ru', reason: 'Требует проспекта и лицензии.' },
  { word: 'underwriting', language: 'en', reason: 'Regulated activity — do not use.' },
  { word: 'андеррайтинг', language: 'uk', reason: 'Регульована діяльність.' },
  { word: 'prospectus', language: 'en', reason: 'Regulated document — use "information memorandum" instead.' },
  { word: 'проспект эмиссии', language: 'ru', reason: 'Регулируемый документ.' },
  { word: 'проспект емісії', language: 'uk', reason: 'Регульований документ.' },
]

// =============================================================================
// CATEGORY 3 — Advisory/fiduciary wording — high risk in n5deal context
// =============================================================================
const CAT3_FIDUCIARY: Flag[] = [
  { word: 'fiduciary', language: 'en', reason: 'Implies duty to act in client interest — do not use.' },
  { word: 'фідуціарний', language: 'uk', reason: 'Передбачає обов\'язок діяти в інтересах клієнта.' },
  { word: 'фидуциарный', language: 'ru', reason: 'Подразумевает обязанность действовать в интересах клиента.' },
  { word: 'in your best interest', language: 'en', reason: 'Implies fiduciary duty.' },
  { word: 'у ваших найкращих інтересах', language: 'uk', reason: 'Передбачає фідуціарний обов\'язок.' },
  { word: 'в ваших лучших интересах', language: 'ru', reason: 'Подразумевает фидуциарную обязанность.' },
  { word: 'on your behalf', language: 'en', reason: 'Implies agency relationship.' },
  { word: 'від вашого імені', language: 'uk', reason: 'Передбачає агентські відносини.' },
  { word: 'от вашего имени', language: 'ru', reason: 'Подразумевает агентские отношения.' },
  { word: 'entrust your money', language: 'en', reason: 'Implies discretionary management.' },
  { word: 'доверьте нам свои деньги', language: 'ru', reason: 'Подразумевает управление активами.' },
  { word: 'доверте нам свої гроші', language: 'uk', reason: 'Передбачає управління активами.' },
]

// =============================================================================
// FORBIDDEN MARKETING PHRASES (Document 2 §6.3.1 + Document 3)
// =============================================================================
const MARKETING_PHRASES: Flag[] = [
  { word: 'invest with us', language: 'en', reason: 'Implies n5deal accepts investments — forbidden marketing phrase.' },
  { word: 'інвестуйте з нами', language: 'uk', reason: 'Натякає, що n5deal приймає інвестиції.' },
  { word: 'инвестируйте с нами', language: 'ru', reason: 'Подразумевает, что n5deal принимает инвестиции.' },
  { word: 'trust us with your money', language: 'en', reason: 'Implies asset management.' },
  { word: 'best investments on the market', language: 'en', reason: 'Investment recommendation + misleading claim.' },
  { word: 'найкращі інвестиції на ринку', language: 'uk', reason: 'Інвестиційна рекомендація + вводить в оману.' },
  { word: 'лучшие инвестиции на рынке', language: 'ru', reason: 'Инвестиционная рекомендация + вводит в заблуждение.' },
  { word: 'we selected the best projects for you', language: 'en', reason: 'Implies investment advice.' },
  { word: 'ми відібрали найкращі проекти для вас', language: 'uk', reason: 'Передбачає інвестиційну пораду.' },
  { word: 'мы отобрали лучшие проекты для вас', language: 'ru', reason: 'Подразумевает инвестиционный совет.' },
  { word: 'high return at low risk', language: 'en', reason: 'Misleading statement — forbidden.' },
  { word: 'висока дохідність при низькому ризику', language: 'uk', reason: 'Вводить в оману.' },
  { word: 'высокая доходность при низком риске', language: 'ru', reason: 'Вводит в заблуждение.' },
  { word: 'your reliable investment partner', language: 'en', reason: 'Implies financial relationship.' },
  { word: 'ваш надійний інвестиційний партнер', language: 'uk', reason: 'Передбачає фінансові відносини.' },
  { word: 'ваш надёжный инвестиционный партнёр', language: 'ru', reason: 'Подразумевает финансовые отношения.' },
  { word: 'we will help you earn', language: 'en', reason: 'Implies investment advice / guarantee.' },
  { word: 'ми поможемо вам заробити', language: 'uk', reason: 'Передбачає інвестиційну пораду / гарантію.' },
  { word: 'мы поможем вам заработать', language: 'ru', reason: 'Подразумевает инвестиционный совет / гарантию.' },
  { word: 'professional investment management', language: 'en', reason: 'Regulated activity claim.' },
  { word: 'професійне управління інвестиціями', language: 'uk', reason: 'Заявка на регульовану діяльність.' },
  { word: 'профессиональное управление инвестициями', language: 'ru', reason: 'Заявка на регулируемую деятельность.' },
  { word: 'start earning today', language: 'en', reason: 'Misleading + income guarantee.' },
  { word: 'початніть заробляти сьогодні', language: 'uk', reason: 'Вводить в оману + гарантія доходу.' },
  { word: 'начните зарабатывать сегодня', language: 'ru', reason: 'Вводит в заблуждение + гарантия дохода.' },
  { word: 'passive income without effort', language: 'en', reason: 'Misleading claim — never use.' },
  { word: 'пасивний дохід без зусиль', language: 'uk', reason: 'Вводить в оману.' },
  { word: 'пассивный доход без усилий', language: 'ru', reason: 'Вводит в заблуждение.' },
  { word: 'наші фінансові експерти', language: 'uk', reason: 'Звучить як фінансове консультування (Doc 3).' },
  { word: 'наши финансовые эксперты', language: 'ru', reason: 'Звучит как финансовое консультирование.' },
  { word: 'фінансовий партнер', language: 'uk', reason: '«Фінансовий партнер» = регуляторні ризики.' },
  { word: 'финансовый партнёр', language: 'ru', reason: '«Финансовый партнёр» = регуляторные риски.' },
  { word: 'найнижчі комісії', language: 'uk', reason: 'Реклама фінпослуг + необґрунтовані заяви.' },
  { word: 'найкращі ставки', language: 'uk', reason: 'Реклама фінпослуг + необґрунтовані заяви.' },
  { word: 'лучшие ставки', language: 'ru', reason: 'Реклама финуслуг + необоснованные заявления.' },
]

// =============================================================================
// FORBIDDEN HASHTAGS (Document 2 §6.3.2 + Document 3 §5)
// =============================================================================
const HASHTAGS: Flag[] = [
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

const ALL_FLAGS: Flag[] = [
  ...CAT1_BANKING,
  ...CAT1_ADVICE,
  ...CAT1_ASSET_MGMT,
  ...CAT1_GUARANTEES,
  ...CAT2_BROKERAGE,
  ...CAT2_PORTFOLIO,
  ...CAT2_PLANNING,
  ...CAT2_SECURITIES,
  ...CAT3_FIDUCIARY,
  ...MARKETING_PHRASES,
  ...HASHTAGS,
]

async function main() {
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
  console.log(`Project ${PROJECT_ID} now has ${total} red flags total (${compliance} compliance category).`)
}

main()
  .catch((e) => {
    console.error('ERROR:', e.message)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
