# 01 -- Nanoclaw Foundation

**Status:** Draft
**Owner:** TBD
**Last Updated:** 2026-02-25
**PRD Sections:** 6.1, 6.3, 12, 22.1, Appendix D

---

## Context

Play New is built on top of **nanoclaw** (`github.com/qwibitai/nanoclaw`), a lightweight Node.js agent framework created by Qwibit AI. Nanoclaw runs Claude-powered agents in isolated Docker containers with file-based IPC, skill management, and MCP server support.

The critical insight: nanoclaw's "group" concept (RegisteredGroup) maps directly to Play New's "user instance." A nanoclaw group is an isolated agent environment with its own conversation state, skill set, and container. In Play New, each user gets exactly one of these -- their personal AI assistant.

This document catalogs every nanoclaw component and specifies whether Play New will **reuse** it as-is, **extend** it with additional capabilities, **replace** it with a different implementation, or **build new** components that nanoclaw does not provide.

---

## What Nanoclaw Is

Nanoclaw is a single-process Node.js application that:

1. Receives messages from external channels (Slack, WhatsApp, etc.)
2. Routes messages to the correct "group" (an isolated agent instance)
3. Queues messages per group (one message processed at a time)
4. Spawns Docker containers to execute each agent conversation turn
5. Passes messages to the Claude Agent SDK running inside the container
6. Returns responses back through the channel
7. Manages skills as markdown files mounted into containers
8. Supports MCP servers for tool/data access inside containers

```
                    NANOCLAW ARCHITECTURE (Single Process)

    ┌──────────┐     ┌──────────┐
    │  Slack   │     │ WhatsApp │    ... other channels
    └────┬─────┘     └────┬─────┘
         │               │
    ┌────▼───────────────▼────────────────────────────┐
    │              HOST PROCESS (Node.js)               │
    │                                                   │
    │  ┌─────────────┐  ┌──────────────────────────┐   │
    │  │  Channel     │  │  Router                  │   │
    │  │  Interfaces  │  │  (channel → group lookup)│   │
    │  │              │  │                          │   │
    │  │  [src/       │  │  [src/router.ts]         │   │
    │  │   types.ts]  │  │                          │   │
    │  └──────┬───────┘  └──────────┬───────────────┘   │
    │         │                     │                    │
    │  ┌──────▼─────────────────────▼───────────────┐   │
    │  │           Registered Groups                 │   │
    │  │                                             │   │
    │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐      │   │
    │  │  │ Group A │ │ Group B │ │ Group C │      │   │
    │  │  │         │ │         │ │         │      │   │
    │  │  │ Queue   │ │ Queue   │ │ Queue   │      │   │
    │  │  │ State   │ │ State   │ │ State   │      │   │
    │  │  │ Skills  │ │ Skills  │ │ Skills  │      │   │
    │  │  └────┬────┘ └────┬────┘ └────┬────┘      │   │
    │  └───────┼───────────┼───────────┼────────────┘   │
    │          │           │           │                 │
    │  ┌───────▼───────────▼───────────▼────────────┐   │
    │  │         Container Runner                    │   │
    │  │         [src/container-runner.ts]            │   │
    │  │                                             │   │
    │  │  Docker exec → spawn container              │   │
    │  │  Mount workspace, skills, IPC dirs           │   │
    │  │  Run agent-runner inside container           │   │
    │  └─────────────────────────────────────────────┘   │
    └───────────────────────────────────────────────────┘
                          │
              ┌───────────▼───────────┐
              │   Docker Container    │
              │                       │
              │  agent-runner.ts      │
              │  Claude Agent SDK     │
              │  MCP stdio servers    │
              │                       │
              │  /workspace/          │
              │  /home/node/.claude/  │
              └───────────────────────┘
```

### Key Nanoclaw Source Files

| File | Purpose | Play New Action |
|------|---------|----------------|
| `src/types.ts` | Defines `ChannelInterface`, `Message`, `Group` types | **REUSE** -- extend with tenant context |
| `src/router.ts` | Routes incoming channel messages to the correct group | **EXTEND** -- add tenant-aware routing |
| `src/claw.ts` | Main orchestrator. Manages `RegisteredGroup` instances. Group registration, lookup, lifecycle | **EXTEND** -- RegisteredGroup becomes UserInstance |
| `src/container-runner.ts` | Docker container spawn, mount configuration, exec | **EXTEND** -- add multi-tenant mounts, encryption |
| `src/agent-runner.ts` | Runs Claude Agent SDK inside the container | **REUSE** -- inject Play New system prompt, org context |
| `src/mcp-stdio.ts` | MCP server management via stdio transport | **REUSE** -- add Play New MCP servers (org context, CRM) |
| `src/ipc.ts` | File-based IPC between host and container | **EXTEND** -- per-user IPC directories |
| `src/task-queue.ts` | Task scheduling within groups | **EXTEND** -- distributed queue backend |
| `src/skills.ts` | Skill file loading and management | **EXTEND** -- add per-user skill registry, quality tracking |
| `skills/add-slack/` | Slack channel integration skill | **REUSE** -- adapt for multi-workspace |
| `Dockerfile` | Base agent container image | **EXTEND** -- add Play New dependencies |
| `package.json` | Dependencies (Claude SDK, Docker, etc.) | **EXTEND** -- add Play New packages |

---

## Components to REUSE

These nanoclaw components work as-is or with minimal configuration changes.

### Channel Interface (`src/types.ts`)

Nanoclaw defines a `ChannelInterface` abstraction that normalizes messages from different sources into a common format. Play New reuses this directly.

```typescript
// Nanoclaw's channel interface (simplified)
interface ChannelInterface {
  name: string;
  sendMessage(groupId: string, message: string): Promise<void>;
  onMessage(handler: (msg: IncomingMessage) => void): void;
}

interface IncomingMessage {
  channelName: string;
  groupId: string;       // In Play New: maps to user instance ID
  userId: string;        // In Play New: the actual end user
  content: string;
  attachments?: Attachment[];
  metadata?: Record<string, unknown>;
}
```

**Play New usage:** Each channel adapter (Slack, Teams, Email) implements `ChannelInterface`. The `groupId` field carries the user instance identifier.

### Agent Runner (`src/agent-runner.ts`)

The agent runner executes inside the Docker container. It initializes the Claude Agent SDK, loads the system prompt, manages tool definitions, and runs the conversation loop.

**Play New usage:** Reuse the agent runner as-is. Customization happens through:
- System prompt injection (add org context, privacy notice)
- Skill file mounts (Play New skill library)
- MCP server configuration (org data connectors)

### MCP Stdio Transport (`src/mcp-stdio.ts`)

Nanoclaw's MCP implementation spawns MCP servers as child processes inside the container, communicating via stdio. This gives agents access to external tools and data.

**Play New usage:** Reuse for all MCP servers. Add Play New-specific MCP servers:
- `pn-org-context` -- RAG retrieval from organizational context store
- `pn-personal-memory` -- Read/write to user's personal vector store
- `pn-crm` -- Read-only access to connected CRM data
- `pn-skills` -- Skill management operations

### Slack Channel (`skills/add-slack/`)

Nanoclaw includes a Slack integration as a skill that can be added to groups.

**Play New usage:** Reuse the Slack bolt integration patterns. Refactor from a skill into a first-class channel adapter supporting multi-workspace operation.

---

## Components to EXTEND

These nanoclaw components provide the right abstraction but need significant enhancement for Play New's multi-tenant, production requirements.

### Container Runner (`src/container-runner.ts`)

**What nanoclaw provides:**
- Docker container spawn with `docker exec`
- Mount configuration for workspace and skill directories
- Non-root user execution
- Ephemeral containers (destroyed after use)

**What Play New adds:**

| Extension | Description |
|-----------|-------------|
| Multi-tenant mounts | Per-user workspace, per-org context, shared skills (see [03-container-isolation](03-container-isolation-model.md)) |
| Encrypted mounts | User workspace encrypted with user-specific key |
| Container pool | Pre-warm containers to meet <30s response SLA |
| Resource limits | Per-container CPU/memory limits based on org tier |
| Image versioning | Play New base image extends nanoclaw image |
| Health monitoring | Liveness/readiness probes, automatic restart |

```
NANOCLAW MOUNTS:                    PLAY NEW MOUNTS:
/workspace/          (read/write)   /workspace/user/         (encrypted, per-user)
/home/node/.claude/  (read/write)   /workspace/org-context/  (read-only, per-org)
                                    /workspace/skills/       (read-only, per-user set)
                                    /workspace/ipc/          (per-user)
                                    /home/node/.claude/      (session data)
```

### Group Management (`src/claw.ts` -- RegisteredGroup)

**What nanoclaw provides:**
- `RegisteredGroup` class: holds group state, conversation history, skill set
- Group registration and lookup by ID
- In-memory group registry
- Single-process lifecycle

**What Play New adds:**

The core mapping: **RegisteredGroup becomes UserInstance**.

```typescript
// Nanoclaw's RegisteredGroup (simplified)
class RegisteredGroup {
  id: string;
  channels: ChannelInterface[];
  queue: GroupQueue;
  skills: Skill[];
  state: GroupState;
}

// Play New's UserInstance (extends RegisteredGroup)
class UserInstance extends RegisteredGroup {
  orgId: string;                    // Organization this user belongs to
  teamId: string;                   // Team within the organization
  userId: string;                   // Unique user identifier
  accessMode: 'forward' | 'full';  // Forward-only (Phase 0) or full access (Phase 1+)
  encryptionKeyId: string;          // Reference to user's encryption key in KMS
  memoryNamespace: string;          // Vector DB namespace for personal memory
  activeSkills: string[];           // Currently active skill IDs
  lastActive: Date;                 // For idle timeout / warm pool management
  status: 'provisioning' | 'active' | 'suspended' | 'deleting';
}
```

| Extension | Description |
|-----------|-------------|
| Persistent registry | Database-backed (PostgreSQL) instead of in-memory |
| Tenant association | Each instance belongs to an org and team |
| Status lifecycle | Provisioning, active, suspended, deleting states |
| Encryption context | Per-user encryption key references |
| Memory namespace | Isolated vector DB namespace per user |
| Idle management | Suspend after inactivity, resume on message |

### Group Queue (`src/task-queue.ts`)

**What nanoclaw provides:**
- In-memory FIFO queue per group
- One message processed at a time per group
- Simple async/await processing

**What Play New adds:**

| Extension | Description |
|-----------|-------------|
| Distributed backend | Redis Streams or BullMQ instead of in-memory |
| Persistence | Messages survive process restarts |
| Priority levels | Urgent messages (e.g., from skills with timers) can jump queue |
| Rate limiting | Per-user and per-org rate limits |
| Dead letter queue | Failed messages go to DLQ for investigation |
| Metrics | Queue depth, wait time, processing time per user and org |

### Skills Engine (`src/skills.ts`)

**What nanoclaw provides:**
- Load skill files (markdown format) from directory
- Mount skills into container workspace
- Skill file format with metadata, instructions, triggers

**What Play New adds:**

| Extension | Description |
|-----------|-------------|
| Per-user skill registry | Users have individual active/inactive skill lists |
| Skill categories | Skills organized by role category (communication, analysis, sales, etc.) |
| Quality tracking | Usage count, feedback scores, completion rates per skill |
| Skill assignment | Advisors assign skills to users via admin interface |
| Feedback loop | Users rate skills; low-rated skills flagged for retirement |
| Phase 1: auto-generation | System proposes skill drafts from observed patterns |

### IPC (`src/ipc.ts`)

**What nanoclaw provides:**
- File-based IPC between host process and container
- Shared IPC directory mounted into container
- JSON message exchange via temp files

**What Play New adds:**

| Extension | Description |
|-----------|-------------|
| Per-user IPC dirs | Each user gets isolated IPC directory (no cross-user leakage) |
| Structured messages | Typed IPC protocol for pattern reporting, memory operations |
| Pattern reporting | Container reports categorical metadata back to host via IPC |
| Memory operations | Container requests personal memory read/write via IPC |

### Configuration

**What nanoclaw provides:**
- Single config file or environment variables
- Group-level configuration

**What Play New adds:**

```
Configuration Hierarchy (most specific wins):

    Platform Defaults          (set by Play New team)
         │
         ▼
    Organization Config        (set during onboarding)
         │
         ▼
    Team Config                (set by org admin or advisor)
         │
         ▼
    User Preferences           (set by individual user)
```

| Level | Examples |
|-------|---------|
| Platform | Default LLM model, max response time, privacy rules |
| Organization | Org name, industry, strategic context doc, connected data sources, LLM provider preference |
| Team | Team function, team-specific skills, reporting structure |
| User | Preferred language, proactive message frequency, active skills, access mode |

---

## Components to REPLACE

These nanoclaw components are either unnecessary for Play New or need fundamentally different implementations.

### WhatsApp Channel

Nanoclaw includes a WhatsApp integration. Play New does not need WhatsApp in any phase. **Action:** Do not port this integration.

### Mount Security Model

Nanoclaw uses a mount allowlist approach designed for a single-user environment. Play New needs a multi-tenant mount topology with encryption.

**Replace with:** Multi-tenant mount builder (see [03-container-isolation](03-container-isolation-model.md)) that constructs per-user mount configurations with encrypted volumes, read-only org context, and isolated IPC.

### Single-Process Orchestrator

Nanoclaw runs as a single Node.js process managing all groups. This is appropriate for personal use but not for a multi-tenant platform serving 150+ users.

**Replace with:** A scalable host process that:
- Can run multiple instances behind a load balancer
- Stores state in PostgreSQL (not in-memory)
- Uses distributed queues (Redis) instead of in-memory queues
- Supports graceful restart without message loss

### SQLite Database

Nanoclaw uses SQLite for local persistence (conversation history, group state). This is appropriate for a single-machine deployment.

**Replace with:** PostgreSQL for all structured data:
- Per-org schemas for tenant isolation
- pgvector extension for embedding storage and RAG
- Built-in row-level security for additional isolation guarantees
- Managed PostgreSQL service for backups, failover, monitoring

---

## Components to BUILD NEW

These are entirely new capabilities that nanoclaw does not provide.

| Component | Purpose | Complexity | Phase |
|-----------|---------|-----------|-------|
| **Anonymization Engine** | One-way transformation of individual patterns into aggregated insights. PostgreSQL views enforce min-5-user threshold, category generalization, temporal blurring. | High | Phase 0 |
| **Pattern Collector** | After each interaction, extract categorical metadata (interaction type, content category, tools involved, time estimate). Store in pattern_logs table. | Medium | Phase 0 |
| **Org Context RAG Pipeline** | Embed organizational context documents, retrieve relevant context for each user query, inject into agent system prompt. | Medium | Phase 0 |
| **Encrypted Vector DB** | Per-user namespace in Qdrant/Weaviate with user-scoped encryption keys. Stores conversation history, learned preferences, work patterns. | High | Phase 0 |
| **Multi-Tenant Auth** | Slack workspace ID / Teams tenant ID to org mapping. User authentication flow. SSO (SAML/OIDC). | Medium | Phase 0 |
| **Admin Dashboard** | Web UI for advisors: user stats (aggregate), context management, skill assignment, integration health. | Medium | Phase 0 |
| **GDPR Layer** | User data export, selective forget, full delete. Audit trail. Data processing agreements. | Medium | Phase 0 |
| **Email Bridge** | Per-user inbound email address. IMAP polling, parse forwarded emails, route to user instance, reply to user only. | Medium | Phase 0 |
| **Container Pool Manager** | Pre-warm container pool. Assignment, health checks, cold start optimization. Target: <30s response time. | Medium | Phase 0 |
| **Intelligence Streams** | Automate/Differentiate/Innovate brief generation from aggregated patterns. Phase 0: manual advisor + DB views. Phase 1: automated. | Low (Phase 0) | Phase 0 (manual) |
| **Cross-Org Benchmarking** | Anonymized pattern comparison across organizations. Standardized taxonomy schema. Min-3-org threshold. | High | Phase 2+ |
| **Observation Engine** | MCP connectors for email, calendar, project tools. Passive pattern detection. User-granted access. | High | Phase 1+ |
| **Skill Auto-Generation** | Detect recurring patterns, propose skill drafts, advisor review, user approval. | High | Phase 1+ |

---

## Fork Management Strategy

### Approach: Monorepo with Isolated Core Package

Nanoclaw upstream code lives in `packages/core/`. Play New code lives in all other packages. This separation enables:

1. **Upstream tracking:** `packages/core/` can be updated from nanoclaw upstream with minimal conflict.
2. **Clear boundaries:** Play New code never modifies files in `packages/core/` -- it imports and extends.
3. **Contribution back:** Improvements to core abstractions can be PR'd back to nanoclaw.

### Sync Process

```
                 UPSTREAM SYNC WORKFLOW

    nanoclaw/main ──────────────────────────────────
         │                                          │
         │  (periodic check: weekly)                │
         ▼                                          ▼
    pn-agent/upstream-sync branch                   │
         │                                          │
         │  1. Pull latest nanoclaw changes         │
         │  2. Apply to packages/core/              │
         │  3. Run full test suite                  │
         │  4. Fix any breaking changes             │
         │  5. PR to main                           │
         ▼                                          │
    pn-agent/main ──────────────────────────────────
```

### Extension Pattern

Play New code extends nanoclaw classes and interfaces rather than modifying them:

```typescript
// packages/core/src/claw.ts (nanoclaw upstream -- DO NOT MODIFY)
export class RegisteredGroup {
  id: string;
  queue: GroupQueue;
  // ... nanoclaw implementation
}

// packages/platform/src/tenant/user-instance.ts (Play New extension)
import { RegisteredGroup } from '@pn-agent/core';

export class UserInstance extends RegisteredGroup {
  orgId: string;
  teamId: string;
  encryptionKeyId: string;
  // ... Play New additions

  constructor(config: UserInstanceConfig) {
    super(config);  // Initialize nanoclaw base
    // Initialize Play New extensions
  }
}
```

### When Upstream Changes Break Us

1. **Interface change in core:** Update our extension classes. Write adapter if needed.
2. **Behavior change in core:** Evaluate if we need to override the method. Document why.
3. **New feature in core:** Evaluate if we should adopt it or if our extension already covers it.
4. **Breaking change we can't absorb:** Pin to last compatible version. Open issue upstream.

---

## The Key Insight: RegisteredGroup to UserInstance

This is the conceptual bridge between nanoclaw and Play New. Understanding this mapping is essential:

```
NANOCLAW WORLD                          PLAY NEW WORLD
═══════════════                         ═══════════════

Group                          →        User Instance
  "An isolated agent              "A personal AI assistant
   environment"                    for one person"

Group ID                       →        User Instance ID
  "group_abc123"                  "inst_usr_abc123"

Group Queue                    →        User Message Queue
  "FIFO message queue              "Distributed queue
   for one group"                   for one user"

Group Skills                   →        User Skill Set
  "Skills mounted into              "Skills assigned to
   this group's container"          this user by advisor"

Group State                    →        User Memory + Preferences
  "Conversation state"              "Encrypted personal memory
                                     + configuration"

Channel → Group routing        →        Slack/Teams/Email → Org → User routing
  "Which group handles              "Resolve tenant, then
   this message?"                    resolve user instance"

Container per group exec       →        Container per user turn
  "Spawn container for              "Assign container from pool
   this group's message"             for this user's message"

Single host process            →        Multi-instance host
  "One Node.js process              "Scalable host behind
   manages everything"               load balancer"
```

What stays the same:
- One message at a time per user (queue ensures sequential processing)
- Container isolation per execution (security boundary)
- Skills as mounted markdown files (capability model)
- MCP servers inside containers (data access pattern)
- Claude Agent SDK for inference (LLM interaction)

What changes:
- Scale: 1 group to hundreds of user instances
- Persistence: in-memory to database-backed
- Isolation: single-user to multi-tenant with encryption
- Routing: simple lookup to tenant-aware resolution
- Lifecycle: manual to automated provisioning/teardown

---

## Phase 0 Scope

### What we implement from nanoclaw for Phase 0:

| Component | Action | Effort |
|-----------|--------|--------|
| Channel interface types | Reuse | Low |
| Message router | Extend with tenant routing | Medium |
| RegisteredGroup → UserInstance | Extend | Medium |
| Container runner | Extend with multi-tenant mounts | High |
| Agent runner | Reuse with Play New system prompt | Low |
| MCP stdio | Reuse, add pn-org-context server | Medium |
| IPC | Extend with per-user dirs | Low |
| Skills loading | Extend with per-user registry | Medium |
| Slack integration | Adapt for multi-workspace | Medium |

### What we build new for Phase 0:

| Component | Effort |
|-----------|--------|
| Multi-tenant auth and routing | High |
| PostgreSQL schema + migrations | Medium |
| Encrypted personal memory (vector DB) | High |
| Org context RAG pipeline | Medium |
| Pattern collector | Medium |
| Anonymization views (PostgreSQL) | Medium |
| Email bridge | Medium |
| Teams adapter | Medium |
| Admin dashboard (basic) | Medium |
| Container pool manager | Medium |
| GDPR data operations | Medium |
| Deployment infrastructure | High |

---

## Open Questions

| ID | Question | Impact | Decision Date |
|----|----------|--------|---------------|
| OQ-101 | Should we fork nanoclaw or use it as an npm dependency? Fork gives more control; dependency gives cleaner separation. | High -- affects all development workflow | March 2026 |
| OQ-102 | How much of nanoclaw's container runner can we reuse vs rewrite? Need to benchmark cold start times with Play New's mount topology. | High -- affects <30s SLA | March 2026 |
| OQ-103 | Should we contribute multi-tenant extensions back to nanoclaw upstream? | Low -- community relationship | April 2026 |
| OQ-104 | Nanoclaw's agent runner uses a specific Claude SDK version. Should we pin to the same version or upgrade independently? | Medium -- compatibility | March 2026 |
| OQ-105 | Does nanoclaw's IPC model (file-based JSON) scale to our throughput needs, or do we need Unix sockets/gRPC? | Medium -- performance | March 2026 |
