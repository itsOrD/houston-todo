# Houston

**Mission control for your AI accounts.** Track credit usage across Claude, ChatGPT, Cursor, and more. Plan tasks for when credits refresh, see what you're spending where, and keep a clear operational picture of your AI tooling.

Full-stack React 19 + TypeScript frontend with a FastAPI backend, containerized with Docker Compose. One command to run.

## Quick Start (Mac)

**Prerequisites:** [Docker Desktop](https://www.docker.com/products/docker-desktop/)

```bash
git clone https://github.com/itsOrD/houston-todo.git
cd houston-todo
docker compose up --build
```

Open **http://localhost:4200** — register an account and start adding AI accounts and tasks.

To stop: `docker compose down`

### Without Docker

**Prerequisites:** Python 3.12+, Node.js 18+

**Backend** (terminal 1):

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```

**Frontend** (terminal 2):

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:3001` and proxies `/api` requests to the backend on port 8000.

---

## Challenge Requirements — Point by Point

This section maps every requirement from the engineering challenge to the implementation.

### Suggested UX

| Requirement | Status | Implementation |
|---|---|---|
| **Log in from landing sign-in page** | Done | `LoginPage.tsx` — email/password form, calls `POST /api/auth/login`, stores token in `localStorage` |
| **See a list of tasks after signing in** | Done | `TaskListPage.tsx` — protected route fetches `GET /api/tasks`, renders filterable list with stats |
| **Organize the task list order** | Done | Filter buttons (All / Active / Done) via composable `pipe()` pipeline. Backend supports `PUT /api/tasks/reorder` for position-based ordering |
| **Navigate to task detail screen** | Done | Each task links to `/tasks/:id` → `TaskDetailPage.tsx` with edit, toggle, and delete |

### Deliverables

| Requirement | Status | Details |
|---|---|---|
| **Deployment instructions (Mac)** | Done | Docker one-liner above; also manual Python + Node instructions |
| **Cloud infrastructure (bonus)** | Done | Architecture diagram and AWS deployment notes below |
| **Overall approach** | Done | See [Approach](#approach) section |
| **Features completed** | Done | See [Features Completed](#features-completed) section |
| **Given more time** | Done | See [Given More Time](#given-more-time) section |
| **Make it more robust** | Done | See [Making It More Robust](#making-it-more-robust) section |

### Code Quality

| Requirement | Status | How |
|---|---|---|
| **Community-standard syntax** | Done | ESLint + TypeScript strict mode (frontend), Pydantic models + type hints (backend) |
| **No debug logging / TODOs / FIXMEs** | Done | Verified clean — no stray `console.log`, `TODO`, or `FIXME` in source |
| **Test coverage** | Done | 11 pytest tests covering auth, CRUD, tenant isolation, and account credit tracking |

### What They Look For

| Area | Where to find it |
|---|---|
| **Clean code** | Small, focused files. Longest file is `TaskListPage.tsx` at 223 lines — everything else under 120 |
| **Fundamentals** | Full auth flow, CRUD, protected routes, optimistic UI, error handling |
| **Testing** | `backend/tests/test_api.py` — see [Testing](#running-tests) |
| **Functional style (bonus)** | `pipe()`, curried `filterByCompleted()`, `reduce()`, `computeStatus()` — see [Functional Patterns](#functional-patterns) |
| **Async handling (bonus)** | `AbortController` cleanup, optimistic updates with rollback — see [Async Patterns](#async-patterns) |

---

## Approach

Built as a full-stack monorepo: **React 19 + TypeScript** frontend, **FastAPI + Python 3.12** backend, both containerized behind **nginx** with Docker Compose.

### Why this architecture

- **FastAPI backend** instead of using the provided external API: gives full control over the data model, lets me demonstrate backend fundamentals (auth, validation, tenant isolation), and eliminates dependency on an external service that could go down during a demo.
- **In-memory store** instead of a database: fastest path to a working demo. The data model is structured identically to how it would look with SQLAlchemy — swapping is a configuration change, not a redesign. See [Given More Time](#given-more-time).
- **Single-file backend** (`app/main.py`, 240 lines): for a demo of this scope, one well-organized file is clearer than a premature multi-module split. Every endpoint is visible in a single scroll.
- **Custom hooks** (`useTasks`, `useAccounts`): encapsulate the full fetch lifecycle so page components stay declarative and focused on rendering.

### Project structure

```
houston-todo/
├── frontend/
│   ├── src/
│   │   ├── api/client.ts          # HOF API client
│   │   ├── context/AuthContext.tsx # Auth state + provider
│   │   ├── context/useAuth.ts     # Auth hook
│   │   ├── hooks/useTasks.ts      # Task CRUD hook (optimistic)
│   │   ├── hooks/useAccounts.ts   # Account CRUD hook (optimistic)
│   │   ├── pages/LoginPage.tsx    # Auth — login form
│   │   ├── pages/RegisterPage.tsx # Auth — registration form
│   │   ├── pages/TaskListPage.tsx # Main dashboard (accounts + tasks)
│   │   ├── pages/TaskDetailPage.tsx # Single task edit/delete
│   │   ├── utils/helpers.ts       # pipe, filterByCompleted, computeStatus
│   │   ├── App.tsx                # Router + protected routes
│   │   ├── main.tsx               # Entry point
│   │   └── index.css              # Phosphor terminal theme
│   ├── Dockerfile                 # Multi-stage: node build → nginx serve
│   └── nginx.conf                 # Reverse proxy + security headers
├── backend/
│   ├── app/main.py                # FastAPI — all endpoints
│   ├── tests/test_api.py          # 11 pytest tests
│   ├── Dockerfile                 # Python slim, non-root user
│   └── pyproject.toml             # Dependencies
└── docker-compose.yml             # One-command orchestration
```

### Data flow

```
Browser → nginx (:80)
           ├── /api/* → proxy_pass → uvicorn (:8000) → FastAPI → in-memory dicts
           └── /*     → serve static → React SPA (client-side routing)
```

The frontend never talks to the backend directly. Nginx handles routing, serves the built React app, and proxies API calls. This mirrors a real production setup and means the Docker Compose config works identically on a cloud VM.

---

## Features Completed

### Authentication

Login and registration with token-based auth. Tokens persist in `localStorage` so sessions survive page refresh. The `AuthProvider` validates the stored token on mount via `GET /api/auth/me` with `AbortController` cleanup:

```tsx
// context/AuthContext.tsx — token validation on mount
useEffect(() => {
  if (!token) return;
  const controller = new AbortController();
  createClient(token)
    .get<User>("/auth/me", controller.signal)
    .then((me) => { setUser(me); setLoading(false); })
    .catch((err) => {
      if (err.name === "AbortError") return;
      clearToken(); setToken(null); setLoading(false);
    });
  return () => controller.abort();
}, [token]);
```

Protected routes redirect unauthenticated users to `/login`:

```tsx
// App.tsx
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <p>Loading...</p>;
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
}
```

### Task CRUD

Full create, read, update, delete. The `useTasks` hook manages the complete lifecycle with optimistic updates:

```tsx
// hooks/useTasks.ts — optimistic update with rollback
const update = useCallback(async (id: string, data: Partial<Task>) => {
  if (!token) return;
  // Update UI immediately
  setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...data } : t)));
  try {
    await createClient(token).put(`/tasks/${id}`, data);
  } catch {
    // Rollback on failure
    fetchTasks();
  }
}, [token, fetchTasks]);
```

Toggling a checkbox feels instant — the UI updates before the network round-trip. If the server rejects, the hook refetches to restore truth.

### Task Detail Screen

Navigate from the task list via `<Link to={`/tasks/${task.id}`}>` to a dedicated edit view. Supports editing the description, toggling completion, and deleting — all with error handling:

```tsx
// pages/TaskDetailPage.tsx
const handleSave = async () => {
  if (!token || !id) return;
  try {
    await createClient(token).put(`/tasks/${id}`, { description });
    navigate("/");
  } catch (err) {
    setError(err instanceof Error ? err.message : "Failed to save");
  }
};
```

### Task List Organization

Filter pipeline using function composition. The `pipe` utility composes N functions left-to-right, and `filterByCompleted` is a curried higher-order function:

```ts
// utils/helpers.ts
export function pipe<T>(...fns: Array<(arg: T) => T>): (arg: T) => T {
  return (arg: T) => fns.reduce((acc, fn) => fn(acc), arg);
}

export const filterByCompleted =
  <T extends TaskLike>(completed: boolean | null) =>
  (items: T[]): T[] =>
    completed === null ? items : items.filter((t) => t.completed === completed);
```

Used in the page component with `useMemo` for memoized filtering:

```tsx
// pages/TaskListPage.tsx
const filteredTasks = useMemo(
  () => pipe<Task[]>(filterByCompleted(filter), sortByPosition)(tasks),
  [tasks, filter],
);
```

The backend also supports full position-based reordering via `PUT /api/tasks/reorder` — the drag-and-drop frontend is ready to wire up with `@dnd-kit`.

### AI Account Dashboard

Beyond the basic todo requirements, Houston adds an AI credit tracking dashboard. Add accounts for different AI tools, set credit limits and reset schedules, and track usage with GO/STANDBY/NO-GO status indicators (borrowing NASA flight controller terminology):

```ts
// utils/helpers.ts — pure function, no side effects
export function computeStatus(
  used: number,
  total: number,
): "go" | "standby" | "no-go" {
  if (total === 0) return "no-go";
  const pct = ((total - used) / total) * 100;
  if (pct < 5) return "no-go";
  if (pct <= 25) return "standby";
  return "go";
}
```

Account cards display with status-colored borders and badges. Tasks can be tagged to specific accounts, shown as inline badges in the task list.

### Security Hardening

- **Backend:** Bearer token validation via FastAPI `Depends()`, Pydantic `Field()` constraints on all inputs (min/max length, email validation, integer bounds), tenant-isolated queries (every endpoint filters by `owner`), account ownership validation on task creation
- **Docker:** Non-root `appuser` in the backend container, backend not exposed to host network (only reachable via nginx proxy)
- **Nginx:** `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`

```python
# backend/app/main.py — input validation with Pydantic
class TaskCreate(BaseModel):
    description: str = Field(min_length=1, max_length=500)
    account_id: str | None = None

class AccountCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    credits_total: int = Field(ge=1, le=10000)
```

```python
# Tenant isolation — users only see their own data
@app.get("/api/tasks")
def list_tasks(completed: bool | None = None, user: dict = Depends(get_current_user)):
    user_tasks = [t for t in tasks.values() if t["owner"] == user["id"]]
```

---

## Functional Patterns

These are called out because the challenge specifically awards bonus points for functional style.

### Higher-Order Function: `createClient`

`createClient(token)` returns an object with pre-configured HTTP methods. The token is closed over — callers never handle auth headers directly:

```ts
// api/client.ts
export function createClient(token: string | null) {
  const baseHeaders: Record<string, string> = { "Content-Type": "application/json" };
  if (token) baseHeaders["Authorization"] = `Bearer ${token}`;

  async function request<T>(path: string, opts: RequestInit = {}) {
    const res = await fetch(`${API}${path}`, { ...opts, headers: baseHeaders });
    if (!res.ok) { /* parse + throw ApiError */ }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  return {
    get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
    post: <T>(path: string, body?: unknown) =>
      request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
    put: <T>(path: string, body?: unknown) =>
      request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
    delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  };
}
```

### Function Composition: `pipe`

Generic left-to-right function composition using `reduce`. Takes N functions of type `(T) => T` and chains them:

```ts
// utils/helpers.ts
export function pipe<T>(...fns: Array<(arg: T) => T>): (arg: T) => T {
  return (arg: T) => fns.reduce((acc, fn) => fn(acc), arg);
}
```

### Curried Filter

`filterByCompleted` takes a filter value and returns a reusable filter function. This makes it composable with `pipe`:

```ts
export const filterByCompleted =
  <T extends TaskLike>(completed: boolean | null) =>
  (items: T[]): T[] =>
    completed === null ? items : items.filter((t) => t.completed === completed);
```

### `reduce` for Stats

Task statistics computed via `reduce` — a single pass produces both counts:

```tsx
// pages/TaskListPage.tsx
const stats = useMemo(
  () => tasks.reduce(
    (acc, t) => ({
      ...acc,
      [t.completed ? "done" : "todo"]: acc[t.completed ? "done" : "todo"] + 1,
    }),
    { done: 0, todo: 0 },
  ),
  [tasks],
);
```

---

## Async Patterns

### AbortController Cleanup

Every hook that fetches data uses `AbortController` to cancel in-flight requests when the component unmounts. This prevents state updates on unmounted components:

```tsx
// hooks/useTasks.ts
useEffect(() => {
  const controller = new AbortController();
  fetchTasks(controller.signal);
  return () => controller.abort();
}, [fetchTasks]);
```

The same pattern appears in `useAccounts` and `AuthProvider`.

### Optimistic Updates with Rollback

Both `useTasks.update()` and `useAccounts.updateCredits()` update local state immediately, then fire the API call. On failure, the previous state is restored:

```tsx
// hooks/useTasks.ts — delete with rollback
const remove = useCallback(async (id: string) => {
  if (!token) return;
  const prev = tasks;                           // snapshot
  setTasks((t) => t.filter((t) => t.id !== id)); // optimistic remove
  try {
    await createClient(token).delete(`/tasks/${id}`);
  } catch {
    setTasks(prev);                               // rollback
  }
}, [token, tasks]);
```

---

## Visual Design: Phosphor Terminal Theme

The CSS theme draws inspiration from 1970s NASA mission control CRT terminals — monochrome green phosphor text on black, scanline effects, zero border-radius, and terminal-style UI prefixes.

### Design rationale

- **Distinctive identity:** The "Houston" name and mission control concept demanded something more evocative than a generic dark theme. No one will confuse this with a Bootstrap template.
- **Historical reference:** Apollo-era flight controllers monitored spacecraft telemetry on green phosphor CRT displays. The GO/STANDBY/NO-GO status colors are a direct reference to NASA flight controller terminology used during launch sequences.
- **Cohesive constraints:** Every visual decision reinforces the terminal aesthetic — monospace-only typography, zero border-radius, dashed borders for forms, `::before` pseudo-elements adding terminal prefixes like `> `, `// `, and `[ ]`.

### Key CSS techniques

All effects are pure CSS — no JavaScript, no external dependencies, no web fonts.

- **CRT scanlines** — `body::before` with `repeating-linear-gradient` at 2px intervals
- **Screen vignette** — `body::after` with `radial-gradient` darkening the edges
- **Phosphor flicker** — `@keyframes textFlicker` with subtle opacity variation at 97-99% of a 4s cycle
- **Terminal prefixes** — `::before` pseudo-elements inject `> `, `// `, `[ ]`, and `STATUS:` in key locations
- **Green phosphor glow** — `text-shadow` and `box-shadow` on hover/focus states
- **Disabled font-smoothing** — `-webkit-font-smoothing: none` for authentic CRT crispness

### Known CSS limitations and planned fixes

| Issue | Impact | Fix |
|---|---|---|
| **No `prefers-reduced-motion` support** | Scanline/flicker effects may cause discomfort for motion-sensitive users | Add `@media (prefers-reduced-motion: reduce)` to disable flicker animation and reduce scanline opacity |
| **Contrast on muted text** | Some `#005515`-on-`#000000` text may not meet WCAG AA (4.5:1 ratio) | Audit with axe-core, bump muted greens to meet minimum contrast |
| **No accessibility toggle** | Users can't switch to a clean dark theme if CRT effects are distracting | Add a CSS-class toggle (e.g. `.reduced-effects`) and persist preference in `localStorage` |
| **No print stylesheet** | Terminal effects render on print, green-on-white is unreadable | Add `@media print` block stripping backgrounds, glows, and pseudo-element decorations |
| **Mobile add-account form** | Grid form wraps awkwardly at narrow widths | Tighten responsive breakpoint for single-column layout |

These are straightforward CSS additions — no architecture changes needed. The `prefers-reduced-motion` fix is highest priority and takes ~15 minutes.

---

## Testing

```bash
cd backend
source .venv/bin/activate
pytest -v
```

### Why these tests

The 11 tests aren't random — they cover the **trust boundaries** of the system. If any of these fail, the app is broken for users in a way that matters.

**Auth tests (4)** — Auth is the gate. If registration doesn't return a token, nobody gets in. If login accepts a wrong password, anyone gets in. These tests verify the happy path and the most dangerous failure mode:

```python
# Register → expect 201 + token
def test_register_returns_token(self):
    res = client.post("/api/auth/register", json={
        "name": "A", "email": "a@b.com", "password": "pass1234",
    })
    assert res.status_code == 201
    assert "token" in res.json()

# Wrong password → expect 401, not a token
def test_login_wrong_password(self):
    register_and_login()
    res = client.post("/api/auth/login", json={
        "email": "test@test.com", "password": "wrong",
    })
    assert res.status_code == 401
```

**Task CRUD tests (4)** — The core product. Create, list, delete, plus the most critical security test — **tenant isolation**. This test registers two users and verifies user A's tasks are invisible to user B:

```python
# Two users, one task — user B sees nothing
def test_tenant_isolation(self):
    h1 = register_and_login(email="user1@test.com")
    h2 = register_and_login(email="user2@test.com")
    client.post("/api/tasks", json={"description": "User1 task"}, headers=h1)
    assert len(client.get("/api/tasks", headers=h2).json()) == 0
```

**Account tests (3)** — The extended feature. Verifies account creation returns `credits_used: 0`, credit updates persist, and tasks can be linked to accounts:

```python
# Create account → credits start at zero
def test_create_account(self):
    headers = register_and_login()
    res = client.post("/api/accounts", json={
        "name": "Claude", "credits_total": 100,
    }, headers=headers)
    assert res.status_code == 201
    assert res.json()["credits_used"] == 0

# Link task to account → account_id persists
def test_task_with_account(self):
    headers = register_and_login()
    acct = client.post("/api/accounts", json={
        "name": "Claude", "credits_total": 100,
    }, headers=headers).json()
    task = client.post("/api/tasks", json={
        "description": "Use Claude", "account_id": acct["id"],
    }, headers=headers).json()
    assert task["account_id"] == acct["id"]
```

### Test infrastructure

Tests use FastAPI's `TestClient` (no running server needed) with an `autouse` fixture that clears in-memory stores between tests — zero test pollution, no ordering dependencies:

```python
@pytest.fixture(autouse=True)
def clear_stores():
    users.clear(); tokens.clear(); tasks.clear(); accounts.clear()
    yield
```

A `register_and_login()` helper reduces boilerplate — every test that needs an authenticated user calls it, getting back a ready-to-use auth header dict.

### What's missing and the path forward

**Current gaps:**
- No frontend tests (hooks, components, integration)
- No end-to-end tests (full user journeys through the browser)
- No edge-case coverage (expired tokens, concurrent updates, malformed input beyond Pydantic)
- Update task endpoint is untested

**Test plan going forward:**

| Layer | Tool | What to test | Priority |
|---|---|---|---|
| Backend unit | pytest | Update task, reorder, Pydantic validation rejects (empty description, negative credits, invalid email), duplicate registration, token expiry | P0 |
| Frontend unit | Vitest | `pipe()`, `filterByCompleted()`, `computeStatus()` — pure functions with clear input/output | P0 |
| Frontend hooks | Vitest + RTL | `useTasks` — verify optimistic update fires setState before await, rollback on 500, AbortController cancels on unmount | P1 |
| Frontend components | Vitest + RTL | `LoginPage` — submit calls `login()`, shows error on reject. `TaskListPage` — renders tasks, filter buttons toggle state | P1 |
| E2E | Playwright | Register → login → create task → edit in detail → toggle complete → delete → logout. Run against Docker Compose. | P1 |
| Security | pytest | Cross-tenant task access returns 404 (not 403 — no information leakage), malformed Bearer header returns 401, account ownership validated on task creation | P0 |

### What TDD would look like from here

If switching to TDD for the next feature (e.g., drag-and-drop reorder):

```python
# 1. Write the failing test FIRST
def test_reorder_updates_positions(self):
    headers = register_and_login()
    t1 = client.post("/api/tasks", json={"description": "First"}, headers=headers).json()
    t2 = client.post("/api/tasks", json={"description": "Second"}, headers=headers).json()

    # Reverse the order
    client.put("/api/tasks/reorder", json={"task_ids": [t2["id"], t1["id"]]}, headers=headers)

    tasks = client.get("/api/tasks", headers=headers).json()
    assert tasks[0]["id"] == t2["id"]   # Second is now first
    assert tasks[1]["id"] == t1["id"]   # First is now second

# 2. Run pytest — this test passes (reorder endpoint exists), so write a harder one:
def test_reorder_rejects_other_users_tasks(self):
    h1 = register_and_login(email="user1@test.com")
    h2 = register_and_login(email="user2@test.com")
    t1 = client.post("/api/tasks", json={"description": "User1's"}, headers=h1).json()

    # User 2 tries to reorder User 1's task — should be silently ignored
    client.put("/api/tasks/reorder", json={"task_ids": [t1["id"]]}, headers=h2)
    tasks = client.get("/api/tasks", headers=h1).json()
    assert tasks[0]["position"] == 0  # Unchanged

# 3. Watch it fail or pass, then write the frontend test:
# Vitest: "dragging task B above task A calls PUT /api/tasks/reorder with [B.id, A.id]"
# 4. Implement the @dnd-kit integration
# 5. Green. Refactor. Commit.
```

The cycle: **Red** (write a test for behavior that doesn't exist) → **Green** (minimal code to pass) → **Refactor** (clean up without changing behavior). Tests become living documentation of every decision.

---

## Cloud Deployment

The Docker Compose file works on any cloud VM without modification. Below is the exact infrastructure-as-code and deployment sequence for AWS.

### Architecture

```
Internet → Route 53 (DNS)
              → ALB (HTTPS termination via ACM)
                  → EC2 t4g.micro (Docker host)
                       ├── nginx (:80) → React SPA + /api/* proxy
                       ├── uvicorn (:8000) → FastAPI
                       └── (future) RDS PostgreSQL for persistence
```

### Terraform

```hcl
# infra/main.tf — minimal viable AWS deployment

terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

provider "aws" {
  region = "us-east-1"
}

# --- VPC + Networking ---
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  tags = { Name = "houston-vpc" }
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  map_public_ip_on_launch = true
  availability_zone       = "us-east-1a"
  tags = { Name = "houston-public" }
}

resource "aws_internet_gateway" "gw" {
  vpc_id = aws_vpc.main.id
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.gw.id
  }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# --- Security Group ---
resource "aws_security_group" "houston" {
  vpc_id = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]  # Lock to your IP in production
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "houston-sg" }
}

# --- EC2 Instance ---
resource "aws_instance" "houston" {
  ami                    = "ami-0c7217cdde317cfec"  # Amazon Linux 2023 arm64
  instance_type          = "t4g.micro"               # ~$6/mo
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.houston.id]
  key_name               = "houston-key"

  user_data = <<-EOF
    #!/bin/bash
    dnf update -y
    dnf install -y docker git
    systemctl enable docker && systemctl start docker
    usermod -aG docker ec2-user

    # Install Docker Compose plugin
    mkdir -p /usr/local/lib/docker/cli-plugins
    curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-aarch64 \
      -o /usr/local/lib/docker/cli-plugins/docker-compose
    chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

    # Deploy
    cd /home/ec2-user
    git clone https://github.com/itsOrD/houston-todo.git
    cd houston-todo
    docker compose up --build -d
  EOF

  tags = { Name = "houston-app" }
}

output "public_ip" {
  value = aws_instance.houston.public_ip
}
```

### Deploy commands

```bash
# 1. Provision infrastructure
cd infra
terraform init
terraform plan          # Review what will be created
terraform apply         # Creates VPC, subnet, SG, EC2 — takes ~2 minutes

# 2. Verify
ssh ec2-user@$(terraform output -raw public_ip)
docker compose -f /home/ec2-user/houston-todo/docker-compose.yml ps

# 3. Access the app
open http://$(terraform output -raw public_ip):4200

# 4. Tear down
terraform destroy
```

### Production hardening (next steps)

```bash
# HTTPS via ACM + ALB (add to Terraform)
# - Request ACM certificate for your domain
# - Create ALB listener on :443 with ACM cert
# - ALB forwards to EC2 target group on :4200
# - Redirect :80 → :443

# Persistent storage (add RDS)
# - aws_db_instance with postgres engine
# - Pass DATABASE_URL as env var to backend container
# - Swap in-memory dicts for SQLAlchemy session

# CI/CD via GitHub Actions
# - On push to main: build Docker images, push to ECR
# - SSH to EC2, pull new images, docker compose up -d
```

Estimated cost: **~$6-12/month** (t4g.micro + ALB). Add ~$15/month for RDS db.t4g.micro if persistence is needed.

---

## Given More Time

Sized using task poker points (1 = trivial, 2 = small, 3 = medium, 5 = large, 8 = epic). Priority reflects what a real team would tackle first: P0 = blocks production use, P1 = needed before real users, P2 = valuable but not blocking.

### Feature backlog

| Priority | Feature | Points | Notes |
|---|---|---|---|
| **P0** | **Password hashing (bcrypt/argon2)** | 1 | Currently plaintext for demo. `pip install bcrypt`, hash on register, compare on login. No architecture change — just wrap `body.password` in `bcrypt.hashpw()`. Blocking for any real deployment. |
| **P0** | **PostgreSQL + Alembic** | 3 | Replace in-memory dicts with SQLAlchemy models. Data model maps 1:1 — same keys become columns. Add `alembic init`, write initial migration, swap dict operations for `session.query()`. Complexity is in connection pooling and migration workflow, not data modeling. |
| **P0** | **Frontend tests** | 3 | Vitest + React Testing Library. Cover pure functions first (`pipe`, `computeStatus`, `filterByCompleted`), then hooks (`useTasks` optimistic update + rollback), then page components (form submission, filter toggle). |
| **P1** | **JWT auth with refresh tokens** | 3 | Replace UUID tokens with `python-jose`. Access token (15min) + refresh token (7d). Add `POST /api/auth/refresh` endpoint. Frontend: intercept 401, refresh, retry original request. |
| **P1** | **CI/CD pipeline** | 2 | GitHub Actions: `lint` → `test` → `docker build` → push to ECR → SSH deploy to EC2. Single workflow file, ~50 lines of YAML. |
| **P1** | **Drag-and-drop reorder** | 2 | Backend already has `PUT /api/tasks/reorder` with position-based ordering. Frontend: install `@dnd-kit/core` + `@dnd-kit/sortable`, wrap task list in `DndContext`, call reorder endpoint on `onDragEnd`. |
| **P1** | **E2E tests** | 3 | Playwright against Docker Compose. Scripts: register → login → create task → navigate to detail → edit → toggle complete → delete → logout. Run in CI as a post-deploy smoke test. |
| **P1** | **CSS accessibility** | 2 | `@media (prefers-reduced-motion: reduce)` to disable flicker/scanlines. WCAG AA contrast audit on muted greens. `localStorage`-backed toggle for `.reduced-effects` class. |
| **P2** | **Credit auto-reset** | 3 | APScheduler or Celery Beat for server-side scheduled resets. Main complexity: timezone-aware DST handling (`pytz` or `zoneinfo`). Cron expression per account based on `reset_frequency` + `reset_time` + `timezone`. |
| **P2** | **Provider API integrations** | 5 | Auto-fetch usage from OpenAI (`/dashboard/billing/usage`), Anthropic (`/v1/usage`), etc. Each provider is a separate adapter. Requires API key storage (encrypted at rest), background polling, and rate limiting. Most of the points are in error handling and rate limit backoff, not the happy path. |
| **P2** | **Rate limiting** | 1 | `pip install slowapi`. Add `limiter = Limiter(key_func=get_remote_address)`. Decorate auth endpoints with `@limiter.limit("5/minute")`. |
| **P2** | **Structured logging** | 2 | `structlog` with JSON output, correlation IDs via middleware (`X-Request-ID`). Pipe to CloudWatch Logs or stdout for Docker log drivers. |
| **P2** | **Monitoring + alerting** | 3 | Prometheus client in FastAPI (`prometheus-fastapi-instrumentator`), Grafana dashboard for request latency, error rate, active users. Alert on p99 > 500ms or 5xx rate > 1%. |

### Making It More Robust

| Area | Current state | What's needed | Why it matters |
|---|---|---|---|
| **Auth** | UUID tokens, plaintext passwords | JWT + bcrypt. Tokens expire. Refresh flow. | Without expiry, a leaked token is permanent access. Without hashing, a DB dump is a credential dump. |
| **Rate limiting** | None | `slowapi` on `/auth/login` and `/auth/register` | A bot can brute-force passwords at ~1000 req/s without this. |
| **HTTPS** | HTTP only | ACM cert + ALB termination, or Certbot on EC2 | Tokens travel in `Authorization` headers — over HTTP, they're plaintext on the wire. |
| **XSS** | React auto-escapes JSX, but no server-side sanitization | Sanitize on input (bleach) or escape on output | React's JSX escaping covers rendering, but `dangerouslySetInnerHTML` or future template changes could introduce vectors. Belt-and-suspenders approach. |
| **CORS** | Locked to `localhost:3001` | Set to actual domain in production, not `*` | Current config is correct for dev. Production needs the real origin. |
| **Secrets** | None (no external services yet) | AWS Secrets Manager or `.env` with Docker secrets | API keys for provider integrations need encrypted storage, not env vars in plaintext. |

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React 19, TypeScript 5.9, Vite 8 | Latest React with strict typing and fast HMR |
| Routing | react-router-dom 7 | Client-side routing with protected route pattern |
| Backend | Python 3.12, FastAPI, Pydantic | Type-safe API with automatic validation and OpenAPI docs |
| Containers | Docker Compose (nginx + uvicorn) | Single-command dev and production setup |
| Testing | pytest + FastAPI TestClient | Fast, no external dependencies |
| CSS | Hand-written, system fonts only | No build-time CSS dependencies, no framework lock-in |
