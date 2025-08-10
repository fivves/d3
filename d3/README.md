## D3 — Quit THC Tracker (Full‑Stack, Dockerized)

D3 helps you quit THC with daily logging, points, prizes, and motivation. It is a React frontend with a Node/Express API and Postgres database, packaged for easy home‑server deployment via Docker Compose.

### Features
- Password-protected with a 4‑digit PIN (set during first-time setup)
- First-time setup wizard: name, profile picture, start date, weekly spend
- Daily log: did you use today? Yes/No with branching flow
- Points bank: +10 for clean day, −20 for a use day, bank ledger & totals
- Prizes: add/list/purchase/restock with images
- Savings: estimate based on weekly spend and usage logs; separate money events
- Motivation: curated science-based quotes and tools

### Tech Stack
- Frontend: React + Vite + TypeScript, React Router, Zustand
- Backend: Node + Express + TypeScript, JWT auth, Multer uploads
- Database/ORM: Postgres + Prisma
- Reverse proxy: Nginx (serves frontend and proxies `/api` to the backend)
- Deployment: Docker Compose

### Quick Start (Docker)
1. Copy `.env.example` to `.env` and adjust values (secrets, DB password).
2. Build and start services:
   ```bash
   ./deploy.sh
   ```
3. Open `http://localhost:8080` and complete the setup wizard.

Services:
- Web: `http://localhost:8080` (serves SPA; proxies `/api` to API)
- API: proxied by web at `/api` (direct: `http://localhost:4000`)
- DB: Postgres (internal only)

### Local Development (optional)
If you prefer running without Docker:

Backend:
```bash
cd api
npm install
npx prisma migrate dev
npm run dev
```

Frontend:
```bash
cd web
npm install
npm run dev
```

Set `VITE_API_URL` to your API base in `web/.env.local` for dev if not using the Nginx proxy.

### API Overview
- `POST /api/setup` first-time setup; creates the single user and optional PIN
- `POST /api/auth/login` with PIN; returns JWT
- `GET /api/me` get profile
- `PUT /api/me` update profile (name, avatar, PIN, etc.)
- `POST /api/logs/daily` log a day (creates point transaction and money event)
- `GET /api/logs` list logs (date range)
- `GET /api/bank/summary` balance, totals, transactions
- `GET /api/savings` current savings summary
- `GET /api/prizes` list prizes and purchase status
- `POST /api/prizes` add prize
- `POST /api/prizes/:id/purchase` buy prize (deducts points)
- `POST /api/prizes/:id/restock` make prize purchasable again
- `GET /api/motivation/quotes` list/random quotes

All endpoints except `/api/setup` and `/api/auth/login` require a valid JWT in `Authorization: Bearer <token>`.

### Data Model (Prisma)
- User, DailyLog, Transaction, Prize, Purchase, MoneyEvent, MotivationQuote

### Images & Uploads
Uploaded avatars and prize images are stored in `api/uploads/` and served at `/api/uploads/...`.

### Environment
Copy `.env.example` to `.env` (project root). Important variables:
- `JWT_SECRET`: secret for signing tokens
- `POSTGRES_PASSWORD`: database password
- `DATABASE_URL`: set automatically inside Docker; for local dev configure in `api/.env`

### Deploy script
`deploy.sh` builds images, applies database migrations, and brings the stack up in the background. Re-run after pulling updates.

### Create GitHub repository
You can create and push the repo with GitHub CLI:
```bash
git init
git add .
git commit -m "Initial commit: D3 app"
gh repo create d3 --source=. --public --push
```

If you prefer manual: create the repo on GitHub and push:
```bash
git remote add origin https://github.com/<you>/d3.git
git branch -M main
git push -u origin main
```

### License
MIT


