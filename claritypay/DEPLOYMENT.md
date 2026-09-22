# ClarityPay — Vercel Deployment Package

ClarityPay is a hackathon-ready financial safety prototype. It combines transfer anomalies and observable social-engineering signals to demonstrate an intercept and simulated 24-hour safety hold.

## Production architecture

- **Frontend:** Next.js 15 → Vercel
- **Backend:** Express → Vercel Node Function
- **Database:** PostgreSQL (recommended: Prisma Postgres through the Vercel Marketplace)
- **ORM:** Prisma 6
- **AI:** Optional OpenAI analysis; deterministic rules remain the fallback
- **Streaming demo:** Server-Sent Events (SSE) from the simulation endpoint

> This remains a prototype/simulation. It does not connect to real bank accounts, wire networks, payment rails, or production financial systems.

## Local development

### Backend

```powershell
cd backend
npm install
Copy-Item .env.example .env
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

Backend: `http://localhost:4000`

### Frontend

Open another terminal:

```powershell
cd frontend
npm install
Copy-Item .env.example .env.local
npm run dev
```

Frontend: `http://localhost:3000`

## Deploy to Vercel

Deploy the two folders as two Vercel projects.

### 1. Create the production database

Use a hosted PostgreSQL database. Prisma's Vercel Marketplace integration can provision Prisma Postgres and automatically expose `DATABASE_URL` to the connected Vercel project.

Create/connect the database before the first production backend deployment.

### 2. Deploy the backend

In Vercel:

1. Import the GitHub repository.
2. Set **Root Directory** to `backend`.
3. The included `vercel.json` configures the Express API.
4. Add these Production environment variables:

```env
DATABASE_URL=YOUR_POSTGRES_CONNECTION_STRING
FRONTEND_URL=https://YOUR-FRONTEND.vercel.app
NODE_ENV=production
OPENAI_API_KEY=YOUR_OPTIONAL_OPENAI_KEY
OPENAI_MODEL=gpt-4o
```

Do not commit real secrets.

The backend build runs:

```text
prisma generate
prisma migrate deploy
```

The checked-in migration is at:

```text
backend/prisma/migrations/20260922120000_init/migration.sql
```

After deployment, test:

```text
https://YOUR-BACKEND.vercel.app/api/health
```

Expected response includes:

```json
{
  "ok": true,
  "service": "ClarityPay API",
  "database": "connected"
}
```

### 3. Deploy the frontend

Create a second Vercel project from the same GitHub repository.

Set **Root Directory** to:

```text
frontend
```

Add this Production environment variable:

```env
NEXT_PUBLIC_API_URL=https://YOUR-BACKEND.vercel.app
```

Deploy.

### 4. CORS

After the frontend has its final Vercel URL, make sure the backend's:

```env
FRONTEND_URL=https://YOUR-FRONTEND.vercel.app
```

matches it exactly.

Redeploy the backend after changing the variable.

## GitHub setup

From the `claritypay` directory:

```powershell
git init
git add .
git commit -m "Prepare ClarityPay for Vercel deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/claritypay.git
git push -u origin main
```

Never commit:

```text
.env
.env.local
*.db
```

They are already excluded by `.gitignore`.

## Production checklist

- [ ] PostgreSQL database created
- [ ] Backend `DATABASE_URL` configured
- [ ] Backend `FRONTEND_URL` configured
- [ ] Frontend `NEXT_PUBLIC_API_URL` configured
- [ ] Backend `/api/health` returns database connected
- [ ] Frontend loads without localhost API errors
- [ ] Scam Simulation streams transcript
- [ ] Risk score updates
- [ ] High-risk transfer creates an intercept
- [ ] 24-hour hold creates a simulated trusted-contact alert
- [ ] Audit trail updates
- [ ] Optional OpenAI key works, or rules-only fallback remains active

## Important deployment note

The old local implementation used an in-memory SSE client registry. That approach is not appropriate for a serverless deployment because separate function invocations do not share that process state. The deployment version therefore streams the scam simulation directly from a GET endpoint consumed by `EventSource`.

The application still keeps its audit and transaction state in PostgreSQL.

## Security notes

- Keep `DATABASE_URL` and `OPENAI_API_KEY` server-side.
- Only `NEXT_PUBLIC_API_URL` belongs in the browser environment.
- This prototype should not be presented as a real bank integration or as a production financial control.
