# 03 -- Container Isolation Model

**Status:** Draft
**Owner:** TBD
**Last Updated:** 2026-02-25
**PRD Sections:** 6.3.1, 7.4, 8.5, 20.2, 20.3

---

## Context

Every user interaction with their Play New assistant runs inside an isolated Docker container. This is the security boundary that prevents cross-user data leakage, limits blast radius of any compromise, and enforces the privacy guarantees that are foundational to user trust.

Nanoclaw already provides container isolation for agent execution. Play New extends this model with multi-tenant mount topologies, encrypted user workspaces, a container pool for cold-start optimization, and per-org resource limits.

---

## Nanoclaw Foundation

**What we inherit from nanoclaw [nc: src/container-runner.ts, Dockerfile]:**

- Non-root user inside containers (the `node` user)
- Ephemeral containers: created per task, destroyed after
- Mount allowlist: only specified directories are mounted
- Docker-based container management
- Base container image with Node.js, Claude Agent SDK, and MCP tooling
- File-based IPC between host and container [nc: src/ipc.ts]

**Nanoclaw's container model (simplified):**

```
┌─────────────────────────────────────────┐
│           NANOCLAW CONTAINER            │
│                                         │
│  User: node (non-root, UID 1000)        │
│                                         │
│  Mounts:                                │
│  ├── /workspace/        (read/write)    │
│  │   └── group files, conversation      │
│  ├── /home/node/.claude/ (read/write)   │
│  │   └── Claude SDK session data        │
│  └── /tmp/ipc/          (read/write)    │
│      └── IPC message files              │
│                                         │
│  Process:                               │
│  └── agent-runner.ts                    │
│      └── Claude Agent SDK               │
│          └── MCP servers (stdio)        │
│                                         │
│  Network: restricted (API access only)  │
│  Capabilities: dropped (minimal set)    │
└─────────────────────────────────────────┘
```

---

## Play New Requirements

- Personal conversations never visible to employer [PRD S7.4] -- requires per-user isolation
- Encryption at rest with user-scoped keys [PRD S8.5, S20.3]
- User can delete all their data [PRD FR-001.6] -- container must not persist user data
- <30s response for standard queries [PRD FR-001.8] -- container startup must be fast
- 150 concurrent users [PRD S8.5] -- container pool must handle concurrent load
- EU data residency [PRD S8.5] -- containers run in EU cloud only

---

## Technical Specification

### Play New Mount Topology

Each container gets a carefully constructed set of mounts based on the user instance it is serving.

```
┌──────────────────────────────────────────────────────────────┐
│              PLAY NEW CONTAINER (per-user turn)              │
│                                                              │
│  User: node (non-root, UID 1000)                             │
│                                                              │
│  MOUNTS:                                                     │
│  │                                                           │
│  ├── /workspace/user/           [read/write, encrypted]      │
│  │   │                                                       │
│  │   │  Per-user private workspace. Encrypted at rest         │
│  │   │  with user-specific key. Contains:                     │
│  │   │                                                       │
│  │   ├── conversation/          Current conversation state    │
│  │   ├── scratch/               Temporary working files       │
│  │   └── exports/               User-requested data exports   │
│  │                                                           │
│  ├── /workspace/org-context/    [read-only]                  │
│  │   │                                                       │
│  │   │  Shared organizational context. Mounted read-only.     │
│  │   │  Same content for all users in the same org.           │
│  │   │                                                       │
│  │   ├── strategy.md            Strategic context document     │
│  │   ├── teams.json             Team structure and roles       │
│  │   ├── industry.md            Industry and competitive ctx   │
│  │   └── frameworks/            Analysis frameworks library    │
│  │                                                           │
│  ├── /workspace/skills/         [read-only]                  │
│  │   │                                                       │
│  │   │  Skill files for this specific user's active skills.   │
│  │   │  Subset of the full skill library.                     │
│  │   │                                                       │
│  │   ├── email-summarizer.skill.md                           │
│  │   ├── response-drafter.skill.md                           │
│  │   └── pipeline-risk-scan.skill.md                         │
│  │                                                           │
│  ├── /workspace/ipc/            [read/write, per-user]       │
│  │   │                                                       │
│  │   │  IPC directory for this user's container only.         │
│  │   │  Used for host<->container communication.              │
│  │   │                                                       │
│  │   ├── inbound/               Messages from host            │
│  │   ├── outbound/              Messages to host              │
│  │   └── status/                Container status signals      │
│  │                                                           │
│  └── /home/node/.claude/        [read/write]                 │
│      │                                                       │
│      │  Claude Agent SDK session data.                        │
│      │  Ephemeral: discarded when container recycles.         │
│      │                                                       │
│      └── session/               SDK session state             │
│                                                              │
│  ENVIRONMENT:                                                │
│  ├── PN_INSTANCE_ID=inst_xxx                                 │
│  ├── PN_ORG_ID=org_abc                                       │
│  ├── PN_USER_ID=usr_123                                      │
│  ├── PN_ACCESS_MODE=forward                                  │
│  └── PN_MEMORY_NAMESPACE=org_abc_usr_123                     │
│                                                              │
│  SECRETS: Injected via stdin at startup (not env vars)       │
│  ├── anthropic_api_key                                       │
│  ├── memory_encryption_key                                   │
│  ├── org_context_token                                       │
│  └── vector_db_token                                         │
│                                                              │
│  NETWORK:                                                    │
│  ├── api.anthropic.com:443          (Claude API)             │
│  ├── api.openai.com:443            (GPT fallback)            │
│  ├── pn-vector-db.internal:6333    (Qdrant/Weaviate)         │
│  ├── pn-postgres.internal:5432     (PostgreSQL)              │
│  └── All other outbound BLOCKED                              │
│                                                              │
│  CAPABILITIES: ALL DROPPED except minimal set                │
│  SECCOMP: default Docker profile                             │
│  MEMORY LIMIT: 512MB (configurable per org tier)             │
│  CPU LIMIT: 0.5 cores (configurable per org tier)            │
└──────────────────────────────────────────────────────────────┘
```

### Mount Construction

The mount builder constructs the Docker run arguments for each container based on the user instance configuration.

```typescript
interface ContainerMountConfig {
  instanceId: string;
  orgId: string;
  userId: string;
  activeSkills: string[];
  encryptionKeyId: string;
}

function buildMounts(config: ContainerMountConfig): DockerMount[] {
  return [
    // Per-user encrypted workspace
    {
      type: 'volume',
      source: `pn-user-${config.instanceId}`,
      target: '/workspace/user',
      readOnly: false,
      // Volume encrypted via dm-crypt or LUKS at the storage layer
    },
    // Org context (shared, read-only)
    {
      type: 'bind',
      source: `/data/orgs/${config.orgId}/context`,
      target: '/workspace/org-context',
      readOnly: true,
    },
    // User-specific skill set (read-only)
    {
      type: 'bind',
      source: buildSkillDir(config.activeSkills),
      target: '/workspace/skills',
      readOnly: true,
    },
    // Per-user IPC directory
    {
      type: 'bind',
      source: `/data/ipc/${config.instanceId}`,
      target: '/workspace/ipc',
      readOnly: false,
    },
    // Claude session (ephemeral tmpfs)
    {
      type: 'tmpfs',
      target: '/home/node/.claude',
      tmpfsSize: '64m',
    },
  ];
}
```

### User-to-User Isolation Enforcement

The isolation model operates at four levels:

```
                    ISOLATION ENFORCEMENT LAYERS

    ┌─────────────────────────────────────────────────────┐
    │  Layer 1: CONTAINER BOUNDARY                         │
    │                                                      │
    │  Each user's turn runs in its own container.         │
    │  Containers share no filesystem, no IPC, no network  │
    │  namespaces. Standard Docker isolation.              │
    │                                                      │
    │  Enforcement: Docker engine, Linux namespaces,       │
    │  cgroups, seccomp profiles.                          │
    └─────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────┐
    │  Layer 2: MOUNT ISOLATION                            │
    │                                                      │
    │  Mount builder constructs unique mount set per user. │
    │  User A's container cannot mount User B's workspace. │
    │  Org A's container cannot mount Org B's context.     │
    │                                                      │
    │  Enforcement: mount builder logic, volume naming     │
    │  convention, host directory permissions.              │
    └─────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────┐
    │  Layer 3: ENCRYPTION ISOLATION                       │
    │                                                      │
    │  User workspaces encrypted with user-specific key.   │
    │  Even if mounts were misconfigured, data would be    │
    │  unreadable without the correct key.                 │
    │                                                      │
    │  Enforcement: user encryption keys in KMS,           │
    │  volume-level encryption, key never in container env. │
    └─────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────┐
    │  Layer 4: NETWORK ISOLATION                          │
    │                                                      │
    │  Containers can only reach:                          │
    │  - LLM APIs (Anthropic, OpenAI)                      │
    │  - Internal services (vector DB, PostgreSQL)         │
    │  All other outbound traffic blocked.                 │
    │                                                      │
    │  Internal services enforce auth:                     │
    │  - Vector DB queries scoped to user's namespace      │
    │  - PostgreSQL queries scoped to user's org schema    │
    │                                                      │
    │  Enforcement: Docker network policies,               │
    │  Kubernetes NetworkPolicy, service auth tokens.       │
    └─────────────────────────────────────────────────────┘
```

### Secret Management for Multi-Tenant

API keys and secrets are never stored in environment variables inside containers. They are injected via stdin at container startup.

```
                    SECRET INJECTION FLOW

    ┌────────────────┐
    │  External KMS  │  AWS KMS / GCP KMS / HashiCorp Vault
    │                │
    │  Platform Key  │  Encrypts org master keys
    │  Org Keys      │  Encrypt user keys
    │  User Keys     │  Encrypt personal data
    └───────┬────────┘
            │
            ▼
    ┌────────────────┐
    │  Host Process  │  Fetches secrets from KMS at runtime
    │                │
    │  Per-org:      │
    │  - Org API keys (CRM, etc.)
    │  - Org context encryption key
    │                │
    │  Per-user:     │
    │  - User memory encryption key
    │  - User OAuth tokens (Phase 1+)
    │                │
    └───────┬────────┘
            │  Inject via stdin (not env vars)
            ▼
    ┌────────────────┐
    │  Container     │  Receives secrets via stdin JSON
    │                │  on startup. Holds in memory only.
    │                │  Never written to disk.
    │                │
    │  {             │
    │    "anthropic_key": "sk-...",
    │    "memory_key": "enc-...",
    │    "org_context_token": "..."
    │  }             │
    └────────────────┘
```

**Why stdin instead of environment variables:**
- Environment variables are visible in `/proc/[pid]/environ`
- Environment variables appear in Docker inspect output
- Environment variables may leak into error reports and logs
- Stdin injection is ephemeral and not persisted

```typescript
// Secret injection at container start (pseudocode)
async function injectSecrets(
  containerId: string,
  instanceConfig: UserInstance
): Promise<void> {
  const secrets = {
    anthropic_api_key: await kms.decrypt(config.anthropicKeyEncrypted),
    memory_encryption_key: await kms.getUserKey(instanceConfig.encryptionKeyId),
    org_context_token: await kms.getOrgToken(instanceConfig.orgId),
    vector_db_token: await kms.getVectorDbToken(instanceConfig.memoryNamespace),
  };

  // Write secrets to container's stdin as single JSON line
  // Container agent-runner reads from stdin on boot
  await containerRuntime.sendStdin(containerId, JSON.stringify(secrets));
}
```

### Container Image Strategy

```
                    IMAGE HIERARCHY

    ┌──────────────────────────────────────┐
    │  node:20-slim                        │  Official Node.js base
    └──────────────────┬───────────────────┘
                       │
    ┌──────────────────▼───────────────────┐
    │  nanoclaw-agent:latest               │  Nanoclaw base image
    │                                      │  [nc: Dockerfile]
    │  + Claude Agent SDK                  │
    │  + MCP runtime                       │
    │  + agent-runner.ts (compiled)        │
    │  + Non-root user (node:1000)         │
    └──────────────────┬───────────────────┘
                       │
    ┌──────────────────▼───────────────────┐
    │  pn-agent:latest                     │  Play New agent image
    │                                      │  [container/Dockerfile]
    │  + Play New system prompt            │
    │  + Play New MCP servers:             │
    │    - pn-org-context                  │
    │    - pn-personal-memory              │
    │    - pn-crm (read-only)             │
    │    - pn-skills                       │
    │  + Pattern reporting IPC client      │
    │  + Health check script               │
    │  + Play New entrypoint               │
    └──────────────────────────────────────┘
```

```dockerfile
# container/Dockerfile
FROM nanoclaw-agent:latest AS base

# Install Play New-specific dependencies
COPY packages/shared/dist/ /app/shared/
COPY container/mcp-servers/ /app/mcp-servers/
COPY container/entrypoint.sh /app/entrypoint.sh
COPY container/health-check.sh /app/health-check.sh

# Play New system prompt template
COPY container/system-prompt.md /app/system-prompt.md

# Healthcheck
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD ["/app/health-check.sh"]

# Non-root user (inherited from nanoclaw)
USER node

ENTRYPOINT ["/app/entrypoint.sh"]
```

### Container Pool Management

To meet the <30s response SLA [PRD FR-001.8], containers must be pre-warmed. Cold starting a Docker container with Node.js, Claude SDK, and MCP servers takes 5-15 seconds. Adding mount setup and secret injection can push this to 20-30 seconds.

```
                    CONTAINER POOL

    ┌──────────────────────────────────────────────────────┐
    │                  POOL MANAGER                         │
    │                                                       │
    │  Pool Size Config:                                    │
    │  ├── Min warm containers:     5                       │
    │  ├── Max containers:         60 (Phase 0)             │
    │  ├── Scale-up threshold:     80% utilization          │
    │  ├── Scale-down threshold:   30% utilization          │
    │  └── Idle recycle time:      15 minutes               │
    │                                                       │
    │  Container States:                                    │
    │                                                       │
    │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐     │
    │  │  WARM  │  │  WARM  │  │  WARM  │  │  WARM  │     │
    │  │        │  │        │  │        │  │        │     │
    │  │ Ready  │  │ Ready  │  │ Ready  │  │ Ready  │     │
    │  │ No user│  │ No user│  │ No user│  │ No user│     │
    │  └────────┘  └────────┘  └────────┘  └────────┘     │
    │       │                                               │
    │       │  (assign to user on message arrival)          │
    │       ▼                                               │
    │  ┌────────┐  ┌────────┐  ┌────────┐                  │
    │  │ ACTIVE │  │ ACTIVE │  │ ACTIVE │  ... up to max   │
    │  │        │  │        │  │        │                   │
    │  │ User A │  │ User B │  │ User C │                   │
    │  │ Mounts │  │ Mounts │  │ Mounts │                   │
    │  │ Secrets│  │ Secrets│  │ Secrets│                   │
    │  └────────┘  └────────┘  └────────┘                  │
    │       │                                               │
    │       │  (idle for 15 min, or conversation ends)      │
    │       ▼                                               │
    │  ┌────────────┐                                       │
    │  │ RECYCLING  │  Unmount user volumes, flush secrets,  │
    │  │            │  reset state, return to WARM pool.     │
    │  └────────────┘                                       │
    │                                                       │
    └──────────────────────────────────────────────────────┘
```

**Assignment flow when a message arrives:**

```
1. Message arrives for user instance X
2. Check: does X already have an ACTIVE container?
   ├── YES -> route message to that container
   └── NO  -> assign a WARM container
             ├── Apply user-specific mounts
             ├── Inject secrets via stdin
             ├── Load user's system prompt
             └── Mark container as ACTIVE for user X
3. Process message
4. Return response
5. Container stays ACTIVE for idle_timeout (15 min)
6. After timeout -> RECYCLE -> return to WARM pool
```

**Why pre-warm works:**

| Phase | Cold Start (no pool) | Warm Start (pool) |
|-------|---------------------|-------------------|
| Container creation | 3-5s | 0s (already running) |
| Node.js init + SDK load | 4-8s | 0s (already loaded) |
| Mount setup | 2-3s | 2-3s (per-user mounts applied) |
| Secret injection | 1-2s | 1-2s |
| **Total** | **10-18s** | **3-5s** |

Adding Claude API latency (5-15s for response), total time stays under 30s with warm pool.

### Performance Considerations

#### Cold Start Budget

```
Total SLA: <30 seconds [PRD FR-001.8]

Budget breakdown:
┌─────────────────────────────┬──────────┐
│ Phase                       │ Budget   │
├─────────────────────────────┼──────────┤
│ Queue wait time             │ <1s      │
│ Container assignment        │ <1s      │
│ Mount setup (warm pool)     │ <3s      │
│ Secret injection            │ <1s      │
│ System prompt assembly      │ <1s      │
│ Org context RAG retrieval   │ <2s      │
│ Claude API call + response  │ <20s     │
│ Response formatting         │ <1s      │
├─────────────────────────────┼──────────┤
│ TOTAL                       │ <30s     │
└─────────────────────────────┴──────────┘
```

#### Concurrent Container Limits

```
Phase 0: 150 users total (3 orgs x 50 users)

Assumptions:
- Peak concurrent users: ~33% = 50 users
- Average conversation length: 3 minutes
- Container idle timeout: 15 minutes
- Peak concurrent containers needed: ~50

Container pool sizing:
- Min warm: 5 containers
- Max total: 60 containers
- Buffer for spikes: 10 containers
```

#### Resource Limits Per Container

| Resource | Limit | Rationale |
|----------|-------|-----------|
| Memory | 512MB | Agent runner + MCP servers + SDK |
| CPU | 0.5 cores | Mostly waiting on API calls |
| Disk (tmpfs) | 64MB | Claude session data |
| Network egress | 10MB/s | API calls only |
| Process count | 50 | Agent + MCP child processes |
| Open files | 1024 | Standard limit |

---

## Phase 0 Scope

### What we build in Phase 0:

| Component | Scope | Notes |
|-----------|-------|-------|
| Play New container image | Extends nanoclaw base with PN additions | `container/Dockerfile` |
| Mount builder | Constructs per-user mount config | Per-user workspace, org context, skills, IPC |
| Container pool manager | Pre-warm pool, assignment, recycling | Target: 5 warm, 60 max |
| Secret injection via stdin | API keys, encryption keys injected at start | No secrets in env vars |
| Network restrictions | Allowlist for LLM APIs + internal services | Docker network rules |
| Resource limits | CPU, memory, process limits per container | Standard limits for Phase 0 |
| Health checks | Liveness/readiness probes | Kubernetes integration |

### What we defer:

| Component | Deferred To | Reason |
|-----------|-------------|--------|
| Encrypted volume mounts (dm-crypt) | Phase 1 | Phase 0 uses file-level encryption in app layer |
| GPU-accelerated containers | Phase 2+ | Only needed for local inference |
| Container image per org tier | Phase 1 | Single image sufficient for Phase 0 |
| Auto-scaling based on usage patterns | Phase 1 | Fixed pool size sufficient for 150 users |
| Rootless Docker | Phase 1 | Standard Docker with non-root user for Phase 0 |

---

## Open Questions

| ID | Question | Impact | Decision Date |
|----|----------|--------|---------------|
| OQ-301 | Volume encryption strategy: dm-crypt at storage layer vs application-level encryption? dm-crypt is more secure but harder to manage per-user. | High -- privacy | March 2026 |
| OQ-302 | Container pool vs container-per-user-session? Pool is more efficient but requires careful cleanup. Per-session is simpler but slower. | High -- performance | March 2026 |
| OQ-303 | Should containers have any internet access beyond LLM APIs? MCP servers for CRM may need external API access. | Medium -- security model | March 2026 |
| OQ-304 | How do we handle container crashes mid-conversation? Retry from last message? Inform user? | Medium -- reliability | March 2026 |
| OQ-305 | Should we use Docker-in-Docker, Docker socket mount, or Kubernetes pod spawning for container management? | High -- architecture | March 2026 |
