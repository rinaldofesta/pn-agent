# 00 -- System Overview

**Status:** Draft
**Owner:** TBD
**Last Updated:** 2026-02-25
**PRD Sections:** 6.1, 6.2, 6.3, 8.5, 20

---

## Context

Play New is a dual-layer AI platform: a personal assistant layer (Layer 1) and an organizational intelligence layer (Layer 2). This document provides the full system picture -- how all components fit together, what technology powers them, and how the codebase is organized.

The platform is built on top of **nanoclaw** (`github.com/qwibitai/nanoclaw`), a lightweight Node.js agent framework that runs Claude-powered agents in isolated Docker containers. Play New extends nanoclaw from a single-user/single-process tool into a multi-tenant, privacy-first organizational platform.

---

## System Architecture

### Full System Diagram

```
                          EXTERNAL CHANNELS
    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │  Slack   │    │  Teams   │    │  Email   │    │  Web UI  │
    │ Workspace│    │  Tenant  │    │  IMAP/   │    │ Dashboard│
    │  Events  │    │ Bot Fwk  │    │  SMTP    │    │ (Phase1) │
    └────┬─────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘
         │               │               │               │
         └───────────────┴───────┬───────┴───────────────┘
                                 │
    ┌────────────────────────────▼────────────────────────────────┐
    │                     GATEWAY / ROUTER                        │
    │                                                             │
    │  Channel Adapters     Auth / Tenant     Rate Limiting       │
    │  (normalize msgs)     Resolution        Per-User Queues     │
    │                                                             │
    │  [nc: src/router.ts]  [EXTEND]          [EXTEND]            │
    └────────────────────────────┬────────────────────────────────┘
                                 │
    ┌────────────────────────────▼────────────────────────────────┐
    │                   INSTANCE MANAGER                          │
    │                                                             │
    │  User Instance       Container Pool     Health Monitoring   │
    │  Registry             Management         & Recovery         │
    │                                                             │
    │  [nc: RegisteredGroup → UserInstance]   [EXTEND]            │
    └───────┬────────────────┬────────────────┬──────────────────┘
            │                │                │
    ┌───────▼──┐     ┌──────▼───┐     ┌──────▼───┐
    │Container │     │Container │     │Container │    ... up to N
    │ User A   │     │ User B   │     │ User C   │
    │          │     │          │     │          │
    │ Claude   │     │ Claude   │     │ Claude   │
    │ Agent SDK│     │ Agent SDK│     │ Agent SDK│
    │          │     │          │     │          │
    │ Skills   │     │ Skills   │     │ Skills   │
    │ MCP Svrs │     │ MCP Svrs │     │ MCP Svrs │
    │ IPC      │     │ IPC      │     │ IPC      │
    └───┬──────┘     └───┬──────┘     └───┬──────┘
        │                │                │
    ┌───▼────────────────▼────────────────▼──────────────────────┐
    │                    DATA LAYER                               │
    │                                                             │
    │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
    │  │ PostgreSQL   │  │ Vector DB    │  │ Object Storage   │  │
    │  │ + pgvector   │  │ (Qdrant or   │  │ (S3-compat)      │  │
    │  │              │  │  Weaviate)   │  │                  │  │
    │  │ - Org schemas│  │ - Personal   │  │ - Skill files    │  │
    │  │ - Patterns   │  │   memory     │  │ - Org context    │  │
    │  │ - Config     │  │ - Org context│  │   docs           │  │
    │  │ - Audit logs │  │   embeddings │  │ - Exports        │  │
    │  └──────────────┘  └──────────────┘  └──────────────────┘  │
    │                                                             │
    └─────────────────────────┬──────────────────────────────────┘
                              │
    ┌─────────────────────────▼──────────────────────────────────┐
    │               ANONYMIZATION BOUNDARY                       │
    │                                                            │
    │  PostgreSQL views enforce min-5-user aggregation.          │
    │  One-way: individual records IN, aggregated patterns OUT.  │
    │  No application code can bypass the views.                 │
    │                                                            │
    └─────────────────────────┬──────────────────────────────────┘
                              │
    ┌─────────────────────────▼──────────────────────────────────┐
    │           ORGANIZATIONAL INTELLIGENCE LAYER                 │
    │                                                             │
    │  ┌───────────────┐  ┌────────────────┐  ┌───────────────┐  │
    │  │ Pattern       │  │ Intelligence   │  │ Cross-Org     │  │
    │  │ Aggregator    │  │ Streams        │  │ Benchmarking  │  │
    │  │               │  │                │  │               │  │
    │  │ SQL views +   │  │ Automate (P0)  │  │ Standardized  │  │
    │  │ materialized  │  │ Differentiate  │  │ taxonomy      │  │
    │  │ aggregations  │  │ (P1)           │  │ (Phase 2+)    │  │
    │  │               │  │ Innovate (P2+) │  │               │  │
    │  └───────────────┘  └────────────────┘  └───────────────┘  │
    │                                                             │
    └─────────────────────────────────────────────────────────────┘
```

### Component Map

| Component | Responsibility | Nanoclaw Mapping | Spec Document |
|-----------|---------------|-----------------|---------------|
| **Channel Adapters** | Normalize inbound messages from Slack/Teams/Email into common format | `src/types.ts` ChannelInterface, `skills/add-slack/` | `specs/channels/` |
| **Gateway/Router** | Authenticate, resolve tenant, route message to correct user instance | `src/router.ts` message routing | [02-multi-tenant](02-multi-tenant-architecture.md) |
| **Instance Manager** | Manage user instance lifecycle: create, wake, suspend, destroy | `src/claw.ts` RegisteredGroup management | [02-multi-tenant](02-multi-tenant-architecture.md) |
| **Container Pool** | Maintain pool of warm containers, assign to user instances | `src/container-runner.ts` Docker exec | [03-container-isolation](03-container-isolation-model.md) |
| **Agent Runtime** | Claude Agent SDK running inside each container, executes conversations | `src/agent-runner.ts` agent execution | [03-container-isolation](03-container-isolation-model.md) |
| **Skill Engine** | Load, execute, manage SKILL.md files per user | nanoclaw skills directory concept | `specs/skills/` |
| **MCP Servers** | Provide data context (CRM, org docs) to agent via MCP protocol | `src/mcp-stdio.ts` MCP stdio transport | `specs/channels/` |
| **IPC Layer** | Communication between host process and container | `src/ipc.ts` file-based IPC | [03-container-isolation](03-container-isolation-model.md) |
| **Personal Memory** | Per-user encrypted vector store for conversation history and patterns | New (Qdrant/Weaviate) | `specs/memory/` |
| **Org Context Store** | Shared organizational knowledge (strategy doc, team structure) | New (PostgreSQL + pgvector RAG) | `specs/memory/` |
| **Pattern Collector** | Extract categorical metadata from each interaction for aggregation | New | [04-data-flow](04-data-flow-architecture.md) |
| **Anonymization Engine** | One-way aggregation of individual patterns into org-level insights | New (PostgreSQL views) | [05-privacy-boundary](05-privacy-boundary-architecture.md) |
| **Intelligence Streams** | Produce Automate/Differentiate/Innovate briefs from aggregated data | New | `specs/intelligence/` |
| **Admin Dashboard** | Operational visibility, context management, integration health | New (web app) | [06-deployment](06-deployment-architecture.md) |
| **Audit Logger** | Immutable log of all system actions and data access | New | [05-privacy-boundary](05-privacy-boundary-architecture.md) |

---

## Technology Stack (Phase 0)

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| **Runtime** | Node.js (TypeScript) | 20 LTS+ | Nanoclaw is Node.js. Consistent stack. Async-first. |
| **LLM Backbone** | Claude API (primary) | claude-sonnet-4-20250514+ | Best reasoning quality. Model-agnostic wrappers allow switching. [PRD S20.1] |
| **LLM Fallback** | GPT-4o (OpenAI API) | Latest | Fallback for outages. Same wrapper interface. |
| **Agent Framework** | Claude Agent SDK | Latest | Nanoclaw already uses this. Streaming, tool use, multi-turn. |
| **Container Runtime** | Docker Engine | 24+ | Nanoclaw container isolation model. Rootless containers. |
| **Orchestration** | Kubernetes (managed) | 1.28+ | Container scheduling, scaling, health checks. EU cloud provider. |
| **Primary Database** | PostgreSQL + pgvector | 16+ | Structured data, pattern storage, org config, vector search for RAG. |
| **Vector Database** | Qdrant or Weaviate | TBD (ADR-001) | Per-user personal memory. Encrypted namespaces. [PRD S20.1] |
| **Object Storage** | S3-compatible | MinIO or cloud | Skill files, org context documents, exports. |
| **Message Queue** | Redis Streams or BullMQ | TBD (ADR-004) | Per-user message queues replacing nanoclaw in-memory queues. |
| **Slack Integration** | @slack/bolt | 3.x | Socket Mode for Phase 0. Events API for Phase 1+. [PRD S14.1] |
| **Teams Integration** | Bot Framework SDK | 4.x | Teams bot for alternative delivery channel. [PRD S14.1] |
| **Email** | IMAP/SMTP libraries | - | Forward mode email bridge. Per-user inbound addresses. |
| **Monitoring** | Prometheus + Grafana | - | System metrics, LLM latency, container health. |
| **Error Tracking** | Sentry | - | Application error tracking and alerting. |
| **CI/CD** | GitHub Actions | - | Build, test, deploy pipeline. Container registry push. |
| **Secrets** | External KMS + Vault | TBD | Encryption key hierarchy. Per-org, per-user key management. |

---

## Proposed Monorepo Structure

The repository extends nanoclaw's layout while clearly separating upstream code from Play New additions.

```
pn-agent/
├── PRD.md                              # Product requirements (source of truth: what)
├── docs/                               # Technical documentation (source of truth: how)
│   ├── README.md                       # This reading guide
│   ├── architecture/                   # System-level architecture docs (this file, etc.)
│   ├── specs/                          # Component-level specifications
│   │   ├── channels/                   # Slack, Teams, Email specs
│   │   ├── skills/                     # Skill engine, SKILL.md format
│   │   ├── memory/                     # Personal memory, org context, RAG
│   │   ├── intelligence/               # Pattern collection, intelligence streams
│   │   ├── data/                       # Database schemas, cross-org schema
│   │   └── security/                   # Encryption, auth, audit
│   ├── guides/                         # Operational runbooks
│   └── decisions/                      # Architecture Decision Records (ADRs)
│
├── packages/                           # Monorepo packages
│   ├── core/                           # NANOCLAW UPSTREAM (fork-tracked)
│   │   ├── src/
│   │   │   ├── types.ts                # [nc] Channel interface, message types
│   │   │   ├── router.ts               # [nc] Message routing logic
│   │   │   ├── claw.ts                 # [nc] Main orchestrator (RegisteredGroup)
│   │   │   ├── container-runner.ts     # [nc] Docker container management
│   │   │   ├── agent-runner.ts         # [nc] Claude Agent SDK execution
│   │   │   ├── mcp-stdio.ts           # [nc] MCP server stdio transport
│   │   │   ├── ipc.ts                 # [nc] Inter-process communication
│   │   │   ├── task-queue.ts          # [nc] Task scheduling
│   │   │   └── skills.ts             # [nc] Skill loading and management
│   │   ├── Dockerfile                  # [nc] Base agent container image
│   │   └── package.json
│   │
│   ├── platform/                       # PLAY NEW HOST PROCESS
│   │   ├── src/
│   │   │   ├── server.ts              # Main entry point
│   │   │   ├── tenant/                # Multi-tenant management
│   │   │   │   ├── org-registry.ts    # Organization lifecycle
│   │   │   │   ├── user-instance.ts   # User instance management (extends RegisteredGroup)
│   │   │   │   ├── config-hierarchy.ts # Platform → org → team → user config
│   │   │   │   └── routing.ts         # Tenant-aware message routing
│   │   │   ├── channels/              # Channel adapters
│   │   │   │   ├── slack-adapter.ts   # Slack workspace integration
│   │   │   │   ├── teams-adapter.ts   # Teams tenant integration
│   │   │   │   └── email-adapter.ts   # Email bridge (IMAP/SMTP)
│   │   │   ├── containers/            # Container pool management
│   │   │   │   ├── pool-manager.ts    # Warm pool, cold start optimization
│   │   │   │   ├── mount-builder.ts   # Per-user mount topology
│   │   │   │   └── health-checker.ts  # Container health monitoring
│   │   │   ├── queue/                 # Distributed message queues
│   │   │   │   ├── user-queue.ts      # Per-user message queue (replaces GroupQueue)
│   │   │   │   └── org-queue.ts       # Per-org queue coordination
│   │   │   └── admin/                 # Admin API and dashboard backend
│   │   │       ├── api.ts             # REST API for admin operations
│   │   │       └── metrics.ts         # Prometheus metric exports
│   │   └── package.json
│   │
│   ├── intelligence/                   # ORGANIZATIONAL INTELLIGENCE LAYER
│   │   ├── src/
│   │   │   ├── patterns/              # Pattern collection and storage
│   │   │   │   ├── collector.ts       # Extract categorical metadata
│   │   │   │   ├── taxonomy.ts        # Standardized work category taxonomy
│   │   │   │   └── store.ts           # Pattern persistence
│   │   │   ├── anonymization/         # Anonymization boundary
│   │   │   │   ├── views.sql          # PostgreSQL aggregation views
│   │   │   │   ├── validator.ts       # Verify min-5-user threshold
│   │   │   │   └── temporal-blur.ts   # Weekly/monthly aggregation
│   │   │   └── streams/               # Intelligence stream production
│   │   │       ├── automate.ts        # Automate stream logic
│   │   │       ├── differentiate.ts   # Differentiate stream (Phase 1)
│   │   │       └── innovate.ts        # Innovate stream (Phase 2+)
│   │   └── package.json
│   │
│   ├── memory/                         # PERSONAL MEMORY + ORG CONTEXT
│   │   ├── src/
│   │   │   ├── personal/              # Per-user encrypted memory
│   │   │   │   ├── vector-store.ts    # Vector DB client (Qdrant/Weaviate)
│   │   │   │   ├── encryption.ts      # User-scoped encryption
│   │   │   │   └── lifecycle.ts       # Export, forget, delete operations
│   │   │   └── org-context/           # Shared organizational context
│   │   │       ├── rag-pipeline.ts    # RAG retrieval for org context injection
│   │   │       ├── context-loader.ts  # Load strategic context doc
│   │   │       └── data-connectors.ts # MCP connectors for CRM, etc.
│   │   └── package.json
│   │
│   └── shared/                         # SHARED TYPES AND UTILITIES
│       ├── src/
│       │   ├── types/                 # Shared TypeScript interfaces
│       │   │   ├── message.ts         # Common message format
│       │   │   ├── tenant.ts          # Org, team, user types
│       │   │   ├── pattern.ts         # Pattern and taxonomy types
│       │   │   └── config.ts          # Configuration interfaces
│       │   ├── crypto/                # Encryption utilities
│       │   │   ├── key-hierarchy.ts   # KMS → org key → user key
│       │   │   └── envelope.ts        # Envelope encryption helpers
│       │   └── db/                    # Database utilities
│       │       ├── migrations/        # PostgreSQL migrations
│       │       └── client.ts          # Database client factory
│       └── package.json
│
├── skills/                             # SKILL LIBRARY
│   ├── communication/                 # Communication skills (8)
│   │   ├── email-summarizer.skill.md
│   │   ├── response-drafter.skill.md
│   │   └── ...
│   ├── analysis/                      # Analysis skills (7)
│   ├── sales/                         # Sales skills (5)
│   ├── operations/                    # Operations skills (5)
│   ├── strategy/                      # Strategy skills (5)
│   ├── management/                    # Management skills (5)
│   └── creative/                      # Creative skills (5)
│
├── container/                          # CONTAINER IMAGE BUILD
│   ├── Dockerfile                     # Play New agent container (extends nanoclaw)
│   ├── entrypoint.sh                 # Container entry point
│   └── health-check.sh               # Container health check script
│
├── infra/                              # INFRASTRUCTURE AS CODE
│   ├── k8s/                           # Kubernetes manifests
│   │   ├── base/                      # Base manifests
│   │   └── overlays/                  # Per-environment overlays
│   │       ├── dev/
│   │       ├── staging/
│   │       └── production/
│   ├── terraform/                     # Cloud infrastructure (EU)
│   └── docker-compose.yml            # Local development
│
├── .github/                            # CI/CD
│   └── workflows/
│       ├── ci.yml                     # Test, lint, build
│       └── deploy.yml                 # Deploy to staging/production
│
├── package.json                       # Root workspace package
├── tsconfig.json                      # Root TypeScript config
└── turbo.json                         # Turborepo config (or nx.json)
```

### Where Play New Code Lives vs Nanoclaw Upstream

```
┌─────────────────────────────────────────────────────────┐
│                    pn-agent MONOREPO                     │
│                                                          │
│  ┌──────────────────────┐  ┌──────────────────────────┐  │
│  │  packages/core/      │  │  packages/platform/      │  │
│  │                      │  │  packages/intelligence/   │  │
│  │  NANOCLAW UPSTREAM   │  │  packages/memory/         │  │
│  │  (fork-tracked)      │  │  packages/shared/         │  │
│  │                      │  │                           │  │
│  │  Changes here must   │  │  PLAY NEW CODE            │  │
│  │  be upstreamable or  │  │  (our additions)          │  │
│  │  clearly marked as   │  │                           │  │
│  │  pn-specific patches │  │  No upstream dependency   │  │
│  │                      │  │  beyond core/ interfaces  │  │
│  └──────────────────────┘  └──────────────────────────┘  │
│                                                          │
│  ┌──────────────────────┐  ┌──────────────────────────┐  │
│  │  skills/             │  │  infra/                   │  │
│  │  container/          │  │  docs/                    │  │
│  │                      │  │  .github/                 │  │
│  │  PLAY NEW ASSETS     │  │  PLAY NEW OPS             │  │
│  └──────────────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## Key Architectural Principles

These principles derive from the PRD [PRD S6.1] and constrain all technical decisions:

1. **Wrap, don't build.** Use Claude/GPT as inference backbone. Build the context, skill, and intelligence layers. Never build a custom LLM.

2. **Privacy is architecture, not a feature.** The separation between personal data and organizational patterns is enforced by database views and infrastructure isolation, not application logic. It must be technically impossible to leak individual data into the organizational layer.

3. **Design for cross-org from day one.** The pattern data schema uses a standardized taxonomy from Phase 0, even though cross-org benchmarking ships in Phase 2+. This means the schema cannot be changed later.

4. **Skills over features.** New capabilities are skills (SKILL.md files), not code. The platform core stays small; the skill library grows at the speed of usage.

5. **Nanoclaw-first.** Use nanoclaw abstractions wherever possible. Extend, do not rewrite. Keep upstream sync feasible.

---

## Phase 0 Scope

**What we build in Phase 0 (March-July 2026):**

- Host process with multi-tenant routing (3 orgs, 150 users)
- Slack adapter (primary channel) + Teams adapter
- Email bridge (forward mode)
- Per-user container isolation (extending nanoclaw containers)
- Personal memory (encrypted vector store per user)
- Org context injection (strategic context doc via RAG)
- Pre-built skill library (30-50 skills)
- Pattern collection (categorical metadata, automated)
- Anonymization boundary (PostgreSQL views, min-5-user threshold)
- Admin dashboard (basic: active users, health, context management)
- Deployment to single EU cloud instance

**What we defer to Phase 1+:**

- Automated skill generation (Phase 1)
- Full access mode / passive observation (Phase 1)
- Automated intelligence stream production (Phase 1)
- Leadership web dashboard (Phase 1)
- Differentiate stream (Phase 1), Innovate stream (Phase 2+)
- Cross-org benchmarking (Phase 2+)
- Local inference (Phase 2+)
- Self-service onboarding (Phase 2+)

---

## Open Questions

| ID | Question | Impact | Decision Date |
|----|----------|--------|---------------|
| OQ-001 | Which vector DB for personal memory? Qdrant vs Weaviate vs pgvector-only? | High -- affects encryption model, scaling, cost | March 2026 |
| OQ-002 | Redis Streams vs BullMQ vs other for distributed queues? | Medium -- affects reliability, scaling | March 2026 |
| OQ-003 | Monorepo tooling: Turborepo vs Nx? | Low -- developer experience | March 2026 |
| OQ-004 | EU cloud provider: AWS eu-central-1 vs GCP europe-west1 vs Hetzner? | High -- affects cost, compliance, managed services | March 2026 |
| OQ-005 | Container orchestration: managed K8s vs lighter alternative (Nomad, Docker Swarm) for Phase 0? | Medium -- complexity vs flexibility | March 2026 |
