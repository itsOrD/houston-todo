# Houston — Mission Control for Your AI Accounts

Manage your AI credit usage across all your accounts — Claude, ChatGPT, Loveable, Cursor, and more. Plan and prepare tasks for when your credits refresh, track what you're spending where, and keep a clear picture of your AI tooling.

## Quick Start (Mac)

**Prerequisites:** Docker and Docker Compose

```bash
docker compose up --build
```

Visit **http://localhost:3000** — register an account to start managing your AI credit usage. Plan and prepare tasks for when your credits refresh!

### Without Docker

**Prerequisites:** Python 3.12+, Node.js 18+

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Visit **http://localhost:3000**.

## Approach

Built as a full-stack monorepo with a FastAPI backend and React frontend.

- **Backend:** Single-file FastAPI API with Pydantic validation, UUID-based auth tokens, and tenant-isolated storage. In-memory store keeps scope focused — swapping to SQLAlchemy + PostgreSQL is a configuration change, not an architectural one.

- **Frontend:** React 19 + TypeScript. Higher-order function pattern for the API client (`createClient(token)` returns configured methods). Composable filter pipeline using `pipe()` and curried filter functions. Custom hooks (`useTasks`, `useAccounts`) encapsulate the full async lifecycle with `AbortController` cleanup and optimistic updates.

- **Testing:** pytest for backend (auth, CRUD, tenant isolation, account credits). Inline TODO comments document planned test expansion.

## Features

- **AI Account Dashboard** — Add accounts (Claude, ChatGPT, etc.) with credit limits, reset schedules, and timezones. +/− buttons for manual credit tracking. GO/STANDBY/NO-GO status computed from remaining credit percentage.
- **Task Management** — Create, complete, and delete tasks. Tag tasks to specific AI accounts. Filter by completion status. Stats bar via reduce.
- **Auth** — Register, login, logout with protected routes and token persistence.

## Functional Patterns (Bonus)

| Pattern | Location |
|---------|----------|
| Higher-order function | `api/client.ts` — `createClient(token)` returns configured fetcher |
| Function composition | `utils/helpers.ts` — `pipe(...fns)` composes N functions |
| `reduce` | `utils/helpers.ts` — `groupBy()` via reduce |
| `reduce` | `TaskListPage.tsx` — stats computation |
| Curried filters | `utils/helpers.ts` — `filterByCompleted(value)` returns filter fn |
| Pure functions | `utils/helpers.ts` — `computeStatus()` derives GO/STANDBY/NO-GO |

## Async Patterns (Bonus)

| Pattern | Location |
|---------|----------|
| Custom hooks | `useTasks`, `useAccounts` — encapsulate fetch lifecycle |
| `AbortController` | `AuthProvider`, `useTasks`, `useAccounts` — cancel on unmount |
| Optimistic updates | `useTasks.update()`, `useAccounts.updateCredits()` — immediate UI, rollback on error |

## Given More Time

- **Database:** SQLAlchemy + SQLite/PostgreSQL with Alembic migrations
- **Credit auto-reset:** Server-side scheduled reset (daily/monthly with timezone-aware DST handling)
- **Real AI integrations:** Auto-fetch credit usage from provider APIs (OpenAI, Anthropic)
- **Kanban board:** Drag-and-drop between columns (backlog → in-progress → done)
- **Task detail page:** Full edit form with priority, stage, account reassignment
- **E2E tests:** Playwright for full user journey testing
- **Cloud deployment:** AWS EC2 or ECS Fargate with Terraform IaC

## Making It More Robust

- **Authentication:** JWT with proper expiry, or integrate Keycloak/Auth0
- **Rate limiting:** slowapi on auth endpoints
- **HTTPS:** Let's Encrypt or AWS Certificate Manager
- **Structured logging:** structlog with correlation IDs
- **CI/CD:** GitHub Actions with automated test + deploy pipeline

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite |
| Backend | Python 3.12, FastAPI, Pydantic |
| Containers | Docker Compose (nginx + uvicorn) |
| Testing | pytest (backend) |
