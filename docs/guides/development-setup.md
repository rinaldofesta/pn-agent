# Development Setup Guide

**Version:** 0.1.0
**Last Updated:** 2026-02-25
**Status:** Draft -- Pre-Phase 0 Architecture
**Owner:** Rinaldo Festa

---

## Context

Play New (`pn-agent`) is built on top of nanoclaw (github.com/qwibitai/nanoclaw), a framework for deploying per-user AI assistants with container isolation. This guide covers setting up a local development environment, running the system, and understanding the project structure.

---

## Prerequisites

| Tool | Minimum Version | Purpose | Install |
|------|----------------|---------|---------|
| **Node.js** | 20.x LTS | Runtime for application and MCP servers | `brew install node@20` or [nodejs.org](https://nodejs.org) |
| **npm** | 10.x | Package management | Bundled with Node.js |
| **Docker Desktop** | 4.x | Container runtime for user instance isolation | [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop) |
| **Claude Code CLI** | Latest | AI-assisted development | `npm install -g @anthropic-ai/claude-code` |
| **Git** | 2.40+ | Version control | `brew install git` |
| **PostgreSQL** | 16+ (optional) | Production database (SQLite used by default for dev) | `brew install postgresql@16` |

### Verify Prerequisites

```bash
node --version          # v20.x.x or higher
npm --version           # 10.x.x or higher
docker --version        # Docker version 27.x.x or higher
git --version           # git version 2.40.x or higher

# Optional
psql --version          # psql (PostgreSQL) 16.x
```

### Docker Configuration

Ensure Docker Desktop is running and has sufficient resources allocated:
- **Memory:** At least 4 GB (each user instance container uses ~512 MB)
- **CPUs:** At least 2 cores
- **Disk:** At least 20 GB free

---

## Initial Setup

### 1. Clone the Repository

```bash
# pn-agent is a fork of nanoclaw with Play New extensions
git clone https://github.com/your-org/pn-agent.git
cd pn-agent
```

### 2. Install Dependencies

```bash
npm install
```

This installs:
- nanoclaw core dependencies (Claude SDK, better-sqlite3, Docker SDK, Slack Bolt)
- Play New additions (pg for PostgreSQL, crypto utilities, MCP SDK)

### 3. Configure Environment

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

Edit `.env` with your editor:

```bash
# === LLM Configuration ===
ANTHROPIC_API_KEY=sk-ant-...             # Required: Anthropic API key for Claude
OPENAI_API_KEY=sk-...                     # Optional: OpenAI API key for GPT-4o fallback

# === Database ===
DATABASE_TYPE=sqlite                      # 'sqlite' for dev, 'postgresql' for staging/prod
DATABASE_PATH=./data/pn-agent.db          # SQLite file path (dev only)
# DATABASE_URL=postgresql://user:pass@localhost:5432/pn_agent  # PostgreSQL (if DATABASE_TYPE=postgresql)

# === Slack Configuration ===
SLACK_BOT_TOKEN=xoxb-...                  # Slack bot OAuth token
SLACK_APP_TOKEN=xapp-...                  # Slack app-level token (for Socket Mode)
SLACK_SIGNING_SECRET=...                  # Slack signing secret

# === Container Configuration ===
DOCKER_SOCKET=/var/run/docker.sock        # Docker socket path
CONTAINER_IMAGE=pn-agent-runner:latest    # Agent runner container image
CONTAINER_MEMORY_LIMIT=512m              # Memory limit per user instance
CONTAINER_CPU_LIMIT=0.5                  # CPU limit per user instance

# === Security (Development) ===
ENCRYPTION_KEY_DEV=dev-only-not-for-production-32bytes!!   # 32-byte key for dev encryption
JWT_SECRET=dev-jwt-secret-change-in-production             # JWT signing secret

# === MCP Connectors (Optional for dev) ===
# SF_INSTANCE_URL=https://your-sandbox.my.salesforce.com
# SF_ACCESS_TOKEN=...
# GOOGLE_SA_KEY_PATH=./secrets/google-sa.json
# GOOGLE_DOMAIN=your-domain.com

# === Logging ===
LOG_LEVEL=debug                           # debug | info | warn | error
LOG_FORMAT=pretty                         # pretty (dev) | json (prod)

# === Server ===
PORT=3000                                 # API server port
HOST=localhost
```

### 4. Initialize the Database

```bash
# Run database migrations (creates all tables)
npm run db:migrate

# Seed taxonomy data (work category hierarchy)
npm run db:seed
```

This creates the SQLite database at `./data/pn-agent.db` with all tables defined in the [database schema](../specs/data/database-schema.md).

### 5. Build the Project

```bash
# Compile TypeScript
npm run build

# Build the agent-runner container image
npm run docker:build
```

### 6. Start Development Server

```bash
# Start in development mode (hot reload)
npm run dev
```

This starts:
- The main Play New process (API server + Slack bot + container orchestrator)
- SQLite database connection
- Slack Socket Mode connection (if Slack tokens are configured)
- File watcher for hot reload

---

## Local Development Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    Developer Machine                          │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Main Process (npm run dev)           Port 3000        │  │
│  │                                                        │  │
│  │  ┌──────────┐  ┌──────────┐  ┌───────────────────┐   │  │
│  │  │ API      │  │ Slack    │  │ Container         │   │  │
│  │  │ Server   │  │ Bot      │  │ Orchestrator      │   │  │
│  │  │ (Express)│  │ (Bolt)   │  │ (Docker SDK)      │   │  │
│  │  └────┬─────┘  └────┬─────┘  └─────────┬─────────┘   │  │
│  │       │              │                  │              │  │
│  │       └──────────────┼──────────────────┘              │  │
│  │                      │                                 │  │
│  │  ┌───────────────────▼──────────────────────────────┐  │  │
│  │  │  Database Layer (SQLite: ./data/pn-agent.db)     │  │  │
│  │  │  better-sqlite3 (synchronous, fast)              │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Docker Containers (one per simulated user)            │  │
│  │                                                        │  │
│  │  ┌──────────────┐  ┌──────────────┐                   │  │
│  │  │ User A       │  │ User B       │  ...              │  │
│  │  │ agent-runner  │  │ agent-runner  │                   │  │
│  │  │ + Claude SDK  │  │ + Claude SDK  │                   │  │
│  │  │ + MCP servers │  │ + MCP servers │                   │  │
│  │  └──────────────┘  └──────────────┘                   │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  External APIs:                                              │
│    → Anthropic API (Claude)                                  │
│    → Slack API (Socket Mode)                                 │
│    → [Optional] Salesforce/HubSpot sandbox                   │
└──────────────────────────────────────────────────────────────┘
```

**Key differences from production:**
- SQLite instead of PostgreSQL
- Single Node.js process (no distributed architecture)
- Slack Socket Mode (no public webhook URL needed)
- Docker containers on local Docker Desktop
- No encryption key hierarchy (dev-mode flat key)
- No secrets manager (credentials in .env)

---

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- src/db/adapter.test.ts

# Run tests with coverage
npm run test:coverage
```

Tests use [Vitest](https://vitest.dev/) and are located alongside source files:

```
src/
  db/
    adapter.ts
    adapter.test.ts          # Unit tests for DB adapter
  security/
    encryption-service.ts
    encryption-service.test.ts
  audit/
    audit-service.ts
    audit-service.test.ts
```

**Test database:** Tests use an in-memory SQLite database (`:memory:`). No Docker required for unit tests.

**Integration tests:** Tests that require Docker containers are in `tests/integration/` and are run separately:

```bash
# Integration tests (requires Docker running)
npm run test:integration
```

---

## Directory Structure

```
pn-agent/
├── .claude/                        # Claude Code configuration
│   └── settings.local.json
├── .env.example                    # Environment variable template
├── .gitignore
├── PRD.md                          # Product Requirements Document
├── package.json
├── tsconfig.json
├── vitest.config.ts
│
├── docs/                           # Technical documentation
│   ├── README.md                   # Documentation index
│   ├── architecture/               # System architecture docs
│   │   ├── 00-system-overview.md
│   │   ├── 01-nanoclaw-foundation.md
│   │   └── ...
│   ├── specs/                      # Component specifications
│   │   ├── channels/               # Slack, Teams, Email integration specs
│   │   ├── data/                   # Database schema, data classification, MCP
│   │   ├── intelligence/           # Pattern collection, intelligence streams
│   │   ├── memory/                 # Personal memory, vector DB, RAG
│   │   ├── security/               # Security model, encryption, audit, GDPR
│   │   └── skills/                 # Skill engine, SKILL.md format
│   ├── guides/                     # Operational guides
│   │   ├── development-setup.md    # (this file)
│   │   └── ...
│   └── decisions/                  # Architecture Decision Records
│       ├── 001-nanoclaw-as-foundation.md
│       └── ...
│
├── src/                            # Application source (TypeScript)
│   ├── index.ts                    # Entry point
│   ├── config.ts                   # Configuration loading and validation
│   │
│   ├── db/                         # Database layer
│   │   ├── adapter.ts              # DatabaseAdapter interface
│   │   ├── sqlite-adapter.ts       # SQLite implementation (dev)
│   │   ├── postgres-adapter.ts     # PostgreSQL implementation (prod)
│   │   └── migrations/             # Sequential migration files
│   │       ├── 001_nanoclaw_base.sql
│   │       ├── 002_play_new_extensions.sql
│   │       └── ...
│   │
│   ├── security/                   # Security layer
│   │   ├── encryption-service.ts   # Encryption/decryption for data tiers
│   │   ├── auth-middleware.ts      # JWT validation, RBAC enforcement
│   │   └── key-manager.ts         # KMS integration, key derivation
│   │
│   ├── audit/                      # Audit logging
│   │   ├── audit-service.ts        # Append-only audit log writer
│   │   └── hash-chain.ts          # Hash chain computation and verification
│   │
│   ├── api/                        # REST API
│   │   ├── server.ts               # Express server setup
│   │   ├── routes/                 # Route handlers
│   │   │   ├── me.ts              # /api/v1/me/* (user data, export, delete)
│   │   │   ├── orgs.ts            # /api/v1/orgs/* (admin endpoints)
│   │   │   ├── skills.ts          # /api/v1/skills/* (skill management)
│   │   │   └── health.ts          # /api/v1/health (health check)
│   │   └── middleware/             # Express middleware
│   │       ├── auth.ts            # Authentication
│   │       ├── rate-limit.ts      # Rate limiting
│   │       └── error-handler.ts   # Error handling
│   │
│   ├── channels/                   # Messaging channel integrations
│   │   ├── slack/                  # Slack bot (Bolt SDK)
│   │   │   ├── app.ts            # Slack app initialization
│   │   │   ├── events.ts         # Event handlers
│   │   │   └── commands.ts       # Slash command handlers
│   │   ├── teams/                  # Teams bot (future)
│   │   └── email/                  # Email bridge (future)
│   │
│   ├── orchestrator/               # Container orchestration
│   │   ├── container-manager.ts    # Docker container lifecycle
│   │   ├── instance-router.ts     # Route messages to correct container
│   │   └── config-generator.ts    # Generate per-instance container config
│   │
│   ├── intelligence/               # Organizational intelligence layer
│   │   ├── pattern-collector.ts    # Extract categorical patterns from usage
│   │   ├── anonymizer.ts          # Anonymization engine (5-user threshold)
│   │   └── insight-generator.ts   # Produce insights from patterns
│   │
│   └── skills/                     # Skill engine
│       ├── skill-registry.ts       # Skill storage and retrieval
│       ├── skill-runner.ts        # Execute SKILL.md files
│       └── skill-proposer.ts      # Auto-propose skills (Phase 1+)
│
├── container/                      # Agent runner container
│   ├── Dockerfile                  # Container image definition
│   └── agent-runner/               # Runs inside each user container
│       ├── package.json
│       └── src/
│           ├── index.ts           # Agent runner entry point
│           ├── mcp-manager.ts     # MCP server lifecycle
│           └── claude-client.ts   # Claude SDK wrapper
│
├── mcp-servers/                    # MCP connector implementations
│   ├── salesforce/
│   │   ├── package.json
│   │   └── src/
│   │       └── index.ts
│   ├── hubspot/
│   ├── google-workspace/
│   └── microsoft-365/
│
├── skills/                         # Pre-built skill library (SKILL.md files)
│   ├── communication/
│   │   ├── email-summarizer.md
│   │   ├── response-drafter.md
│   │   └── ...
│   ├── sales/
│   │   ├── pipeline-risk-scan.md
│   │   └── ...
│   ├── analysis/
│   ├── operations/
│   ├── strategy/
│   └── management/
│
├── data/                           # Local data directory (gitignored)
│   └── pn-agent.db                # SQLite database (dev)
│
├── tests/                          # Test utilities and integration tests
│   ├── fixtures/                   # Test data fixtures
│   ├── helpers/                    # Test helper utilities
│   └── integration/                # Integration tests (require Docker)
│
└── scripts/                        # Utility scripts
    ├── db-migrate.ts               # Database migration runner
    ├── db-seed.ts                  # Seed taxonomy and test data
    ├── generate-mcp-config.ts     # Generate per-instance MCP configs
    └── test-connector.ts          # Test MCP connector against sandbox
```

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | Yes | -- | Anthropic API key for Claude inference |
| `OPENAI_API_KEY` | No | -- | OpenAI API key for GPT-4o fallback |
| `DATABASE_TYPE` | No | `sqlite` | Database backend (`sqlite` or `postgresql`) |
| `DATABASE_PATH` | No | `./data/pn-agent.db` | SQLite database file path |
| `DATABASE_URL` | If pg | -- | PostgreSQL connection string |
| `SLACK_BOT_TOKEN` | Yes* | -- | Slack bot token (`xoxb-...`) |
| `SLACK_APP_TOKEN` | Yes* | -- | Slack app token for Socket Mode (`xapp-...`) |
| `SLACK_SIGNING_SECRET` | Yes* | -- | Slack request signing secret |
| `DOCKER_SOCKET` | No | `/var/run/docker.sock` | Docker daemon socket |
| `CONTAINER_IMAGE` | No | `pn-agent-runner:latest` | Agent runner Docker image |
| `CONTAINER_MEMORY_LIMIT` | No | `512m` | Memory limit per container |
| `CONTAINER_CPU_LIMIT` | No | `0.5` | CPU limit per container |
| `ENCRYPTION_KEY_DEV` | Dev only | -- | 32-byte encryption key for development |
| `JWT_SECRET` | Yes | -- | JWT signing secret |
| `LOG_LEVEL` | No | `info` | Log level (`debug`, `info`, `warn`, `error`) |
| `LOG_FORMAT` | No | `json` | Log format (`pretty` for dev, `json` for prod) |
| `PORT` | No | `3000` | API server port |
| `HOST` | No | `localhost` | API server host |

*Slack tokens are required for Slack integration. You can run without them for API-only development.

---

## Common Issues and Troubleshooting

### Docker containers fail to start

**Symptom:** `Error: connect ENOENT /var/run/docker.sock`

**Fix:** Ensure Docker Desktop is running. On macOS, check that the Docker socket is accessible:

```bash
ls -la /var/run/docker.sock
# If missing, Docker Desktop may need to be started or reinstalled
```

### SQLite "database is locked" errors

**Symptom:** `SQLITE_BUSY: database is locked` during tests

**Fix:** This happens when multiple processes access the same SQLite file. Ensure only one `npm run dev` process is running. Tests use in-memory databases and should not conflict.

### Slack bot not responding

**Symptom:** Messages to the bot in Slack get no response.

**Fixes:**
1. Verify `SLACK_BOT_TOKEN` and `SLACK_APP_TOKEN` are set correctly in `.env`
2. Ensure the Slack app has Socket Mode enabled
3. Check that the bot is invited to the DM channel
4. Check logs: `LOG_LEVEL=debug npm run dev`

### Port already in use

**Symptom:** `Error: listen EADDRINUSE :::3000`

**Fix:**

```bash
# Find and kill the process using port 3000
lsof -i :3000
kill -9 <PID>
```

### Container image not found

**Symptom:** `Error: No such image: pn-agent-runner:latest`

**Fix:** Build the container image first:

```bash
npm run docker:build
```

### Claude API errors

**Symptom:** `401 Unauthorized` from Anthropic API

**Fix:** Verify your `ANTHROPIC_API_KEY` is valid and has not expired. Test it:

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-sonnet-4-20250514","max_tokens":10,"messages":[{"role":"user","content":"hi"}]}'
```

### Database migration failures

**Symptom:** `Error: migration 005_skills.sql failed`

**Fix:** If the database is in a bad state, you can reset it (development only):

```bash
rm ./data/pn-agent.db
npm run db:migrate
npm run db:seed
```

---

## Development Workflow

### Typical Day

1. Start Docker Desktop
2. `npm run dev` -- starts the development server
3. Make changes -- hot reload picks them up
4. Write tests alongside code (`*.test.ts`)
5. `npm test` -- run test suite before committing
6. `npm run build` -- verify TypeScript compilation

### Adding a New Feature

1. Check the relevant spec document in `docs/specs/`
2. Create or modify source files in `src/`
3. Add migration if schema changes needed (`src/db/migrations/`)
4. Write unit tests (`*.test.ts`)
5. Update API routes if new endpoints needed (`src/api/routes/`)
6. Test locally with `npm run dev`
7. Run full test suite: `npm test`

### Working with Nanoclaw Upstream

`pn-agent` is a fork of nanoclaw. To pull upstream changes:

```bash
# Add nanoclaw as an upstream remote (one-time setup)
git remote add upstream https://github.com/qwibitai/nanoclaw.git

# Fetch upstream changes
git fetch upstream

# Merge upstream into your branch (resolve conflicts as needed)
git merge upstream/main
```

See [ADR-001: Nanoclaw as Foundation](../decisions/001-nanoclaw-as-foundation.md) for fork management strategy.

---

## Phase 0 Scope

This guide covers the development setup for Phase 0. The following are NOT yet available:
- PostgreSQL with schema-per-org (use SQLite for now)
- Teams integration (Slack only in Phase 0)
- Email bridge
- Full encryption key hierarchy (dev uses flat key)
- CI/CD pipeline (manual deployment in Phase 0)
