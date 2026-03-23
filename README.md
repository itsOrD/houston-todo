# Houston — Mission Control for Your AI Accounts

Manage your AI credit usage across all your accounts — Claude, ChatGPT, Loveable, Cursor, and more. Plan and prepare tasks for when your credits refresh, track what you're spending where, and keep a clear picture of your AI tooling.

## Deployment / Running Instructions (Mac)

**Prerequisites:** Docker and Docker Compose

```bash
docker compose up --build
```

Visit **http://localhost:4200** — register an account to start managing your AI credit usage. Plan and prepare tasks for when your credits refresh!

To stop: `docker compose down`

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

### Running Tests

```bash
cd backend
source .venv/bin/activate
pytest -v
```

### Cloud Deployment

The Docker Compose setup is designed to run on any cloud VM. For AWS:

```
Internet → EC2 t4g.micro
              ├── Docker: nginx (frontend) :4200 → :80
              ├── Docker: uvicorn (backend) :8000
              └── In-memory store (swap to RDS PostgreSQL for persistence)
```

Provision with Terraform, deploy with `docker compose up --build -d`. Estimated cost: ~$4-10/month.

---

## Summary

### Approach

Built as a full-stack monorepo with a **FastAPI backend** and **React 19 + TypeScript frontend**, containerized with Docker Compose.

- **Backend:** Single-file FastAPI API with Pydantic validation, UUID-based auth tokens, and tenant-isolated in-memory storage. The architecture is deliberately simple — swapping to SQLAlchemy + PostgreSQL is a configuration change, not an architectural one.

- **Frontend:** Higher-order function pattern for the API client (`createClient(token)` returns configured methods). Composable filter pipeline using `pipe()` and curried filter functions. Custom hooks (`useTasks`, `useAccounts`) encapsulate the full async lifecycle with `AbortController` cleanup and optimistic updates with rollback.

- **Testing:** pytest with TestClient for the backend — covers auth flow, task CRUD, tenant isolation, and account credit tracking (11 tests).

### Features Completed

- **Login / Register** — Landing page with auth forms, token persistence across refresh
- **Task list** — View all tasks after signing in, with active/completed stats
- **Task CRUD** — Create tasks, view list, navigate to detail screen for editing, toggle completed, delete
- **Task detail screen** — Edit description, toggle completion, delete — navigable from the task list
- **Organize task list** — Filter by All / Active / Done, sorted by position
- **AI Account Dashboard** — Add accounts (Claude, ChatGPT, etc.) with credit limits, reset schedules, and timezones. Manual +/− credit tracking. GO/STANDBY/NO-GO status computed from remaining percentage.
- **Task-to-account tagging** — Assign tasks to AI accounts, shown as tags in the list
- **Docker Compose** — Single-command startup with nginx reverse proxy and health checks
- **Security hardening** — Bearer token validation, Pydantic field constraints on all inputs, non-root Docker container, nginx security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy), account ownership validation on task creation, backend not exposed to host network

### Given More Time

- **Database:** SQLAlchemy + SQLite/PostgreSQL with Alembic migrations (replace in-memory store — ~2 hours)
- **Credit auto-reset:** Server-side scheduled reset with timezone-aware DST handling (~1 hour)
- **Real AI integrations:** Auto-fetch credit usage from provider APIs like OpenAI and Anthropic (~3 hours)
- **Drag-and-drop reordering:** The backend already supports position-based reorder — wire up @dnd-kit on the frontend (~1 hour)
- **Kanban board:** Drag-and-drop between columns with stage-based filtering (~2 hours)
- **Frontend tests:** Vitest + React Testing Library for component and integration tests (~2 hours)
- **E2E tests:** Playwright for full user journey testing (~2 hours)
- **CI/CD:** GitHub Actions pipeline with automated test and deploy (~1 hour)

### Making It More Robust

- **Authentication:** JWT with proper expiry and refresh tokens, or integrate Keycloak/Auth0 for SSO
- **Password hashing:** bcrypt or argon2 (currently plaintext for demo scope)
- **Rate limiting:** slowapi on auth endpoints to prevent brute force
- **HTTPS:** Let's Encrypt or AWS Certificate Manager
- **Structured logging:** structlog with correlation IDs for request tracing
- **Input sanitization:** HTML escaping on task descriptions to prevent XSS
- **Health checks with dependency status:** Verify DB and external API connectivity
- **Monitoring:** CloudWatch or Prometheus for alerting on error rates and latency

---

## Bonus: Functional Patterns

| Pattern | Location |
|---------|----------|
| Higher-order function | `api/client.ts` — `createClient(token)` returns a configured fetcher |
| Function composition | `utils/helpers.ts` — `pipe(...fns)` composes N functions left-to-right |
| `reduce` | `TaskListPage.tsx` — `tasks.reduce()` computes active/completed stats |
| Curried filters | `utils/helpers.ts` — `filterByCompleted(value)` returns a reusable filter function |
| Pure functions | `utils/helpers.ts` — `computeStatus()` derives GO/STANDBY/NO-GO with no side effects |

## Bonus: Async Patterns

| Pattern | Location |
|---------|----------|
| Custom hooks | `useTasks`, `useAccounts` — encapsulate the full fetch lifecycle (loading, data, error) |
| `AbortController` | `AuthProvider`, `useTasks`, `useAccounts` — cancel in-flight requests on unmount |
| Optimistic updates | `useTasks.update()`, `useAccounts.updateCredits()` — update UI immediately, rollback on error |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite |
| Backend | Python 3.12, FastAPI, Pydantic |
| Containers | Docker Compose (nginx + uvicorn) |
| Testing | pytest (backend) |
