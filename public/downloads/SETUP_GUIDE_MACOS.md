# 🍎 N5Deal Dashboard — Повний гайд установки на macOS

**Версія:** Phase 1 MVP
**Оновлено:** 22 квітня 2026
**Платформа:** macOS Sonoma / Sequoia (Intel + Apple Silicon M1/M2/M3/M4)
**Очікуваний час:** ~20 хвилин

---

## 📑 Зміст

1. [Передумови](#-1-передумови)
2. [Встановлення інструментів (Homebrew + Node + Postgres)](#-2-встановлення-інструментів)
3. [Налаштування PostgreSQL](#-3-налаштування-postgresql)
4. [Розпакування проєкту](#-4-розпакування-проєкту)
5. [Встановлення залежностей](#-5-встановлення-залежностей)
6. [Створення файлу `.env`](#-6-створення-файлу-env)
7. [Ініціалізація бази даних](#-7-ініціалізація-бази-даних)
8. [Запуск dev-сервера](#-8-запуск-dev-сервера)
9. [Перевірка що все працює](#-9-перевірка-що-все-працює)
10. [Щоденний workflow](#-10-щоденний-workflow)
11. [Troubleshooting](#-11-troubleshooting)
12. [Корисні команди](#-12-корисні-команди)
13. [FAQ](#-13-faq)

---

## 🎯 1. Передумови

Що вам потрібно мати ПЕРЕД початком:

- ✅ Mac з macOS 13 Ventura або новіше
- ✅ Мінімум 5 GB вільного місця
- ✅ Адмінські права (для встановлення Homebrew)
- ✅ Інтернет-з'єднання
- ✅ Обліковий запис на https://abacus.ai/ (для API ключа, опціонально)

**Не потрібно:** Docker, VirtualBox, Parallels, Windows. Все працює нативно через Homebrew.

---

## 🛠️ 2. Встановлення інструментів

Відкрийте **Terminal** (Cmd + Space → введіть "Terminal" → Enter).

### 2.1 Встановіть Homebrew

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Після інсталяції **обов'язково виконайте 2 команди**, які Homebrew вам підкаже (ті що починаються з `echo ... >> ~/.zprofile` і `eval ...`).

Для Apple Silicon це виглядає приблизно так:
```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

**Перевірка:**
```bash
brew --version
# → Homebrew 4.x.x
```

> 💡 Якщо Homebrew вже встановлено — пропустіть цей крок.

---

### 2.2 Встановіть Node.js 20, Yarn, PostgreSQL 16, Git

**Одна команда ставить усе:**

```bash
brew install node@20 yarn postgresql@16 git
```

Підключіть Node.js 20 до PATH (Homebrew не робить це автоматично для версійних пакетів):

```bash
brew link --overwrite node@20 --force
```

**Перевірка:**
```bash
node -v        # → v20.x.x
yarn -v        # → 1.22.x
psql --version # → psql 16.x
git --version  # → 2.x
```

> ⚠️ Якщо `node -v` показує не v20, або `psql: command not found` — дивіться [Troubleshooting](#-11-troubleshooting).

---

### 2.3 Встановіть Xcode Command Line Tools (якщо ще не встановлено)

Потрібно для компіляції нативних модулів (bcrypt тощо):

```bash
xcode-select --install
```

Якщо з'явиться діалог — натисніть **Install** та зачекайте завершення (~5 хв).
Якщо побачите `command line tools are already installed` — все ок.

---

## 🐘 3. Налаштування PostgreSQL

### 3.1 Додайте psql до PATH

**Для Apple Silicon (M1/M2/M3/M4):**
```bash
echo 'export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"' >> ~/.zshrc
```

**Для Intel Mac:**
```bash
echo 'export PATH="/usr/local/opt/postgresql@16/bin:$PATH"' >> ~/.zshrc
```

Перезавантажте конфіг:
```bash
source ~/.zshrc
```

### 3.2 Запустіть PostgreSQL як фоновий сервіс

```bash
brew services start postgresql@16
```

Перевірте:
```bash
brew services list
```

Побачите щось на зразок:
```
Name              Status     User             File
postgresql@16     started    andriykrechkivsky  ~/Library/LaunchAgents/...
```

> 💡 **Цей сервіс автоматично стартує при завантаженні Mac.** Більше ніколи не треба запускати вручну.

### 3.3 Створіть базу даних та користувача

Увійдіть в psql:
```bash
psql postgres
```

У `postgres=#` prompt вставте **все одразу**:
```sql
CREATE DATABASE n5deal_dashboard;
CREATE USER n5deal WITH ENCRYPTED PASSWORD 'n5deal_dev_2026';
GRANT ALL PRIVILEGES ON DATABASE n5deal_dashboard TO n5deal;
ALTER DATABASE n5deal_dashboard OWNER TO n5deal;
\q
```

**Перевірка підключення:**
```bash
psql "postgresql://n5deal:n5deal_dev_2026@localhost:5432/n5deal_dashboard"
```

Якщо побачите `n5deal_dashboard=>` — усе супер. Вийти: `\q`

> 🔐 Пароль `n5deal_dev_2026` можна змінити, але тоді пам'ятайте оновити його в `.env` файлі (крок 6).

---

## 📦 4. Розпакування проєкту

### 4.1 Завантажте ZIP

Завантажте: https://c0921b28e.preview.abacusai.app/downloads/n5deal_dashboard.zip

### 4.2 Розпакуйте

```bash
cd ~/Downloads
unzip n5deal_dashboard.zip -d ~/Projects/
```

Після розпакування у вас буде:
```
~/Projects/n5deal_dashboard/
├── README.md
├── SETUP_MACOS.md
├── ARCHITECTURE.md
├── .env.example
└── nextjs_space/              ← головна робоча папка
    ├── app/
    ├── components/
    ├── prisma/
    ├── package.json
    └── ... інші файли
```

> 💡 Якщо ви, як зараз, **видалили зовнішню обгортку `n5deal_dashboard/`**, і папки `app/`, `components/`, `prisma/` лежать прямо у `n5dealdashboard/` — це теж ок. Всі команди нижче виконуйте з тієї папки, де знаходиться `package.json`.

### 4.3 Перейдіть у робочу папку

```bash
cd ~/Projects/n5deal_dashboard/nextjs_space
```

*(або просто `cd ~/Projects/n5dealdashboard` якщо ви видалили обгортку)*

**Перевірте що ви в правильному місці** — там має бути `package.json`:
```bash
ls package.json
# → package.json
```

---

## 📥 5. Встановлення залежностей

```bash
yarn install
```

Це займе 2–3 хвилини. Успіх:
```
✨  Done in 146.82s.
```

> ⚠️ Якщо бачите warnings про `node-gyp` чи `deprecated packages` — це нормально, ігноруйте. Головне щоб не було `error`.

---

## 🔐 6. Створення файлу `.env`

### 6.1 Згенеруйте секрет для NextAuth

```bash
openssl rand -base64 32
```

Результат буде щось на зразок:
```
KJ8vM3nQpR5xT7wY9zA2bC4dE6fG1hI3jK5lM7nO9pQ=
```

**Скопіюйте цей рядок** — він знадобиться на наступному кроці.

### 6.2 Отримайте Abacus.AI API ключ (опціонально)

1. Зареєструйтесь на https://abacus.ai/
2. Натисніть аватар у правому верхньому куті → **Account**
3. Вкладка **API Keys** → **Create New Key**
4. Скопіюйте ключ (починається з `s2_...`)

> 💡 Без цього ключа все працюватиме, окрім **AI-генерації контенту** у Content Studio. Можна додати пізніше.

### 6.3 Створіть `.env` файл

Впевнились що ви в папці з `package.json`. Виконайте:

```bash
cat > .env <<'EOF'
DATABASE_URL="postgresql://n5deal:n5deal_dev_2026@localhost:5432/n5deal_dashboard?schema=public"
NEXTAUTH_SECRET="ЗАМІНИТИ_НА_ЗГЕНЕРОВАНИЙ_СЕКРЕТ"
NEXTAUTH_URL="http://localhost:3000"
ABACUSAI_API_KEY="ЗАМІНИТИ_НА_ABACUS_КЛЮЧ_АБО_placeholder"
EOF
```

### 6.4 Замініть плейсхолдери на реальні значення

Відкрийте `.env` у VS Code:
```bash
code .env
```

Або в терміналі:
```bash
nano .env
```

Замініть:
- `ЗАМІНИТИ_НА_ЗГЕНЕРОВАНИЙ_СЕКРЕТ` → результат з кроку 6.1
- `ЗАМІНИТИ_НА_ABACUS_КЛЮЧ_АБО_placeholder` → ваш Abacus ключ (або `placeholder`, якщо ще нема)

Приклад готового `.env`:
```env
DATABASE_URL="postgresql://n5deal:n5deal_dev_2026@localhost:5432/n5deal_dashboard?schema=public"
NEXTAUTH_SECRET="KJ8vM3nQpR5xT7wY9zA2bC4dE6fG1hI3jK5lM7nO9pQ="
NEXTAUTH_URL="http://localhost:3000"
ABACUSAI_API_KEY="s2_abc123def456..."
```

Збережіть файл (`Cmd+S` у VS Code, або `Ctrl+O` → Enter → `Ctrl+X` у nano).

> 🔒 **ВАЖЛИВО:** `.env` файл **НІКОЛИ** не комітиться в Git — він уже в `.gitignore`.

---

## 🗄️ 7. Ініціалізація бази даних

Виконайте по черзі:

```bash
yarn prisma generate
```
Генерує TypeScript-клієнт Prisma.

```bash
yarn prisma db push
```
Створює всі таблиці в базі даних згідно зі схемою.

```bash
yarn prisma db seed
```
Заповнює базу тестовими даними.

**Після успішного seed ви побачите:**
```
🌱  The seed command has been executed.
```

**В базі тепер є:**
- 1 адмін: `john@doe.com` / `johndoe123`
- 1 проєкт: **N5Deal Marketing**
- 4 ICP профілі: EMI, MSB, VASP, PI buyers
- 3 приклади контенту

---

## 🚀 8. Запуск dev-сервера

```bash
yarn dev
```

Ви побачите:
```
▲ Next.js 14.2.28
  - Local:        http://localhost:3000
  ✓ Ready in 2.3s
```

Відкрийте в браузері: **http://localhost:3000**

> 💡 Залиште цей термінал відкритим — це ваш dev-сервер. Щоб зупинити, натисніть `Ctrl+C`.

---

## ✅ 9. Перевірка що все працює

### 9.1 Увійдіть в систему

На сторінці `http://localhost:3000`:
```
Email:    john@doe.com
Password: johndoe123
```

### 9.2 Чек-ліст перевірки

- [ ] Landing-сторінка відкривається на `/`
- [ ] Логін працює, редиректить на `/dashboard`
- [ ] У Dashboard видно stat cards з числами
- [ ] `/icps` — показує 4 ICP профілі (EMI, MSB, VASP, PI buyers)
- [ ] `/content` — показує 3 згенерованих брифи
- [ ] `/settings` — видно управління командою
- [ ] Створення нового ICP працює (кнопка **New ICP**)
- [ ] **Content Studio** генерує AI-бриф (⚠️ потрібен валідний `ABACUSAI_API_KEY`)

Якщо все з чек-листа працює — **Phase 1 завершено! 🎉**

---

## 🔄 10. Щоденний workflow

Коли завтра (чи наступного разу) захочете продовжити роботу:

```bash
cd ~/Projects/n5deal_dashboard/nextjs_space
yarn dev
```

То й усе! PostgreSQL запускається автоматично при старті Mac.

**Якщо перезавантажили Mac і щось не працює:**
```bash
brew services start postgresql@16
yarn dev
```

**Зупинити dev-сервер:**
Просто натисніть `Ctrl+C` у терміналі де він запущений.

---

## 🐞 11. Troubleshooting

### ❌ `command not found: brew`
```bash
eval "$(/opt/homebrew/bin/brew shellenv)"   # Apple Silicon
eval "$(/usr/local/bin/brew shellenv)"       # Intel
```

### ❌ `psql: command not found`
```bash
brew link postgresql@16 --force
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
source ~/.zshrc
```

### ❌ `Error: P1001: Can't reach database server`
```bash
# 1) Чи запущений Postgres?
brew services list

# 2) Перезапустіть
brew services restart postgresql@16

# 3) Перевірте підключення вручну
psql "postgresql://n5deal:n5deal_dev_2026@localhost:5432/n5deal_dashboard"
```

### ❌ `FATAL: role "n5deal" does not exist`
Ви забули створити користувача. Поверніться до [кроку 3.3](#33-створіть-базу-даних-та-користувача).

### ❌ `FATAL: database "n5deal_dashboard" does not exist`
Те ж саме — поверніться до [кроку 3.3](#33-створіть-базу-даних-та-користувача).

### ❌ `yarn: command not found`
```bash
brew link yarn
# або як fallback
npm install -g yarn
```

### ❌ `node-gyp` / native modules не компілюються
```bash
xcode-select --install
```

### ❌ Port 3000 зайнятий
```bash
# Знайти і вбити процес на порту 3000
lsof -ti:3000 | xargs kill -9

# Або запустити на іншому порту
PORT=3001 yarn dev
```

### ❌ Apple Silicon: `incompatible architecture`
Перевірте що Homebrew нативний arm64:
```bash
which brew     # має бути /opt/homebrew/bin/brew
arch           # має бути arm64
```
Якщо запущено під Rosetta — відкрийте Terminal → Get Info → ❌ зніміть галочку **Open using Rosetta**.

### ❌ `.env` файл не бачиться (прихований у Finder)
У Finder натисніть `Cmd + Shift + .` — покаже приховані файли.
У терміналі: `ls -la` — покаже все.

### ❌ Hydration errors / дивні UI-помилки
Очистіть кеш Next.js:
```bash
rm -rf .next node_modules/.cache
yarn dev
```

### ❌ `NEXTAUTH_URL is not set`
Перевірте `.env` — там має бути `NEXTAUTH_URL="http://localhost:3000"` (саме в лапках, без пробілів навколо `=`).

### ❌ Помилка під час `yarn prisma db seed`
```bash
# Переконайтесь що Prisma Client зібраний
yarn prisma generate

# Повторіть seed
yarn prisma db seed
```

---

## 🔧 12. Корисні команди

### База даних
```bash
# Візуальний редактор БД у браузері
yarn prisma studio
# → http://localhost:5555

# Подивитись логи Postgres
tail -f /opt/homebrew/var/log/postgresql@16.log   # Apple Silicon
tail -f /usr/local/var/log/postgresql@16.log      # Intel

# СКИНУТИ БАЗУ ПОВНІСТЮ (⚠️ всі дані зникнуть!)
yarn prisma migrate reset

# Перезапустити Postgres
brew services restart postgresql@16

# Зупинити Postgres (не витрачає батарею)
brew services stop postgresql@16
```

### Розробка
```bash
# Dev-сервер (hot reload)
yarn dev

# Production build (для тесту оптимізованої версії)
yarn build
yarn start

# TypeScript type-check без build
yarn tsc --noEmit

# Очистити кеші
rm -rf .next node_modules/.cache
```

### VS Code
```bash
# Встановити VS Code через Homebrew
brew install --cask visual-studio-code

# Відкрити проєкт у VS Code
cd ~/Projects/n5deal_dashboard/nextjs_space
code .
```

**Обов'язкові VS Code розширення:**
- **Prisma** (офіційне) — підсвітка `schema.prisma`
- **Tailwind CSS IntelliSense** — autocomplete Tailwind
- **ESLint** — лінтинг
- **Prettier** — форматування

### Zsh aliases (bonus)

Додайте в `~/.zshrc` для швидкого доступу:
```bash
# Відкрити ~/.zshrc для редагування
code ~/.zshrc
```

Додайте в кінець файлу:
```bash
# N5Deal shortcuts
alias n5="cd ~/Projects/n5deal_dashboard/nextjs_space"
alias n5dev="cd ~/Projects/n5deal_dashboard/nextjs_space && yarn dev"
alias n5db="cd ~/Projects/n5deal_dashboard/nextjs_space && yarn prisma studio"
alias n5pg-restart="brew services restart postgresql@16"
```

Перечитайте конфіг:
```bash
source ~/.zshrc
```

Тепер одна команда:
```bash
n5dev     # → cd в проєкт + запуск dev-сервера
n5db      # → відкрити Prisma Studio
```

---

## ❓ 13. FAQ

### Чи потрібен Docker?
**Ні.** PostgreSQL працює нативно через Homebrew — швидше і з меншим споживанням ресурсів.

### Чи працює на Apple Silicon (M1/M2/M3/M4)?
**Так**, повністю. Homebrew і Node.js мають нативні arm64 збірки.

### Чи можна замість локального Postgres використати хмарний?
**Так**, Supabase / Neon / Railway працюватимуть. Просто підставте їх `DATABASE_URL` у `.env`, решта кроків ідентична. Посилання:
- https://supabase.com (free tier)
- https://neon.tech (free tier)
- https://railway.app

### Як оновити залежності пізніше?
```bash
cd ~/Projects/n5deal_dashboard/nextjs_space
yarn upgrade-interactive --latest
```

### Чи безпечно комітити `.env` у Git?
❌ **НІ!** `.gitignore` уже блокує це. Ніколи не пушіть `.env` у публічні репозиторії.

### Як поміняти пароль admin користувача?
Зайдіть в Prisma Studio (`yarn prisma studio` → `http://localhost:5555`), знайдіть таблицю **User**, але **не змінюйте поле `hashedPassword` напряму** — пароль хешований bcrypt'ом. Краще використайте UI: **Settings → Change Password** (функція буде додана у Phase 9).

Тимчасовий спосіб через ноду:
```bash
node -e "const b=require('bcrypt');b.hash('newpassword123',10).then(h=>console.log(h))"
```
Потім скопіюйте hash і вставте в поле `hashedPassword` через Prisma Studio.

### Як додати нового користувача?
Двічі варіанти:
1. **Через UI:** `http://localhost:3000/signup` (якщо signup увімкнений)
2. **Через Prisma Studio:** додайте запис у таблицю `User` з хешованим паролем (див. питання вище)

### Де зберігаються завантажені файли?
Локально — поки що файли не завантажуються. У production — через Abacus.AI cloud storage (буде у Phase 9).

### Чи працює офлайн?
**Частково:**
- ✅ Логін, Dashboard, ICPs, Content history — так
- ❌ Content Studio AI generation — ні (потрібен інтернет для Abacus.AI)

### Як деплоїти в production?
Окрема інструкція буде у **Phase 10**. Варіанти:
- Vercel (найпростіше для Next.js)
- Railway (full-stack з Postgres в одному місці)
- DigitalOcean App Platform
- Власний VPS (Ubuntu + PM2 + Nginx)

---

## 📞 Потрібна допомога?

Напишіть мені:
1. На якому саме кроці застрягли
2. Повний текст помилки (скріншот з Terminal або скопійований текст)
3. Результат команди `pwd` (щоб знати де ви зараз)

Я одразу діагностую та дам конкретне рішення.

---

## 📚 Додаткові документи

- **README.md** — огляд проєкту
- **ARCHITECTURE.md** — технічна архітектура (схема БД, auth flow, AI streaming)
- **LOCAL_SETUP.md** — універсальний гайд (Linux / Windows)
- **STYLE_GUIDE.md** — дизайн-система компонентів

---

## 🎯 Що далі?

Коли локальний сетап працює і ви залогінились — **напишіть мені "працює"**, і ми переходимо до **Phase 2: Core UI & Navigation**:

- Dashboard shell з sidebar
- Project switcher у хедері
- Animated stat cards
- Activity feed
- Quick actions bar
- Responsive mobile layout

---

© N5Deal — macOS Setup Guide v1.0 (Phase 1 MVP)
**Протестовано на:** macOS Sequoia 15.3 (Apple Silicon) + macOS Sonoma 14.5 (Intel)
