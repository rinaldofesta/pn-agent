# 02 -- Multi-Tenant Architecture

**Status:** Draft
**Owner:** TBD
**Last Updated:** 2026-02-25
**PRD Sections:** 6.3.1, 8.4 FR-001, 8.5, 15.1, 17.1

---

## Context

Play New serves multiple organizations simultaneously, with each organization containing multiple teams and users. Every user gets an isolated AI assistant instance. The multi-tenant architecture must guarantee:

1. **Data isolation:** No organization can access another organization's data. No user can access another user's personal data.
2. **Configuration hierarchy:** Platform defaults cascade through org, team, and user levels.
3. **Routing correctness:** Every inbound message from any channel reaches exactly the right user instance.
4. **Efficient scaling:** 3 orgs and 150 users in Phase 0, growing to thousands.

Nanoclaw provides a single-tenant model (one host process, flat group namespace). Play New extends this into a hierarchical, multi-tenant model.

---

## Nanoclaw Foundation

**What we inherit:**
- `RegisteredGroup` concept [nc: src/claw.ts] -- an isolated agent environment with its own queue and state
- Message routing from channel to group [nc: src/router.ts]
- Group-level queue for sequential message processing [nc: src/task-queue.ts]
- Group registration and lookup by ID [nc: src/claw.ts]

**What we extend:**
- Flat group namespace becomes hierarchical: Organization -> Team -> User Instance
- In-memory registry becomes database-backed registry
- Simple channel-to-group routing becomes tenant-aware routing with multiple resolution strategies
- Single-process group management becomes distributed instance management

---

## Play New Requirements

From the PRD:
- Each user gets an isolated assistant instance [PRD FR-001.1]
- 3 design partner organizations, 20-50 users each [PRD S8.1]
- Slack workspace-based delivery [PRD FR-001.1, S14.1]
- Teams tenant-based delivery [PRD S14.1]
- Email-based delivery (forward mode) [PRD FR-002.1]
- User can delete their entire instance [PRD FR-001.6]
- 99.5% uptime during business hours [PRD S8.5]
- <30s response time for standard queries [PRD FR-001.8]
- Support 150 concurrent users [PRD S8.5]

---

## Technical Specification

### Tenancy Model

```
                        TENANCY HIERARCHY

    ┌─────────────────────────────────────────────────┐
    │                   PLATFORM                       │
    │          (Play New global config)                │
    │                                                  │
    │  ┌───────────────────┐  ┌───────────────────┐   │
    │  │  Organization A   │  │  Organization B   │   │
    │  │  (Design Partner) │  │  (Design Partner) │   │
    │  │                   │  │                   │   │
    │  │  ┌─────┐ ┌─────┐ │  │  ┌─────┐ ┌─────┐ │   │
    │  │  │TeamA│ │TeamB│ │  │  │TeamX│ │TeamY│ │   │
    │  │  │     │ │     │ │  │  │     │ │     │ │   │
    │  │  │U1 U2│ │U3 U4│ │  │  │U5 U6│ │U7 U8│ │   │
    │  │  │U9   │ │     │ │  │  │     │ │     │ │   │
    │  │  └─────┘ └─────┘ │  │  └─────┘ └─────┘ │   │
    │  └───────────────────┘  └───────────────────┘   │
    │                                                  │
    │  ┌───────────────────┐                           │
    │  │  Organization C   │                           │
    │  │  (Design Partner) │                           │
    │  │  ...              │                           │
    │  └───────────────────┘                           │
    └─────────────────────────────────────────────────┘
```

### Core Entities

```sql
-- Organization (top-level tenant)
CREATE TABLE organizations (
    org_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL UNIQUE,          -- URL-safe identifier
    industry        TEXT NOT NULL,                  -- Standardized industry code
    size_band       TEXT NOT NULL,                  -- '50-200', '200-500', '500-2000', '2000+'
    geo_region      TEXT NOT NULL,                  -- 'EU_south', 'EU_north', 'EU_west', 'UK'
    status          TEXT NOT NULL DEFAULT 'onboarding',  -- onboarding, active, suspended, offboarded
    config          JSONB NOT NULL DEFAULT '{}',    -- Org-level configuration overrides
    context_doc_id  UUID,                           -- Reference to strategic context document
    slack_team_id   TEXT UNIQUE,                    -- Slack workspace ID (if connected)
    teams_tenant_id TEXT UNIQUE,                    -- Teams tenant ID (if connected)
    email_domain    TEXT,                           -- Email domain for routing
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Team (within an organization)
CREATE TABLE teams (
    team_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID NOT NULL REFERENCES organizations(org_id),
    name        TEXT NOT NULL,
    function    TEXT NOT NULL,         -- 'marketing', 'sales', 'engineering', 'finance', etc.
    size        INTEGER,
    config      JSONB NOT NULL DEFAULT '{}',  -- Team-level config overrides
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(org_id, name)
);

-- User Instance (one per user -- the core unit)
CREATE TABLE user_instances (
    instance_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID NOT NULL REFERENCES organizations(org_id),
    team_id             UUID REFERENCES teams(team_id),
    user_id             TEXT NOT NULL,              -- External user ID (Slack user ID, etc.)
    display_name        TEXT,
    role_category       TEXT,                       -- 'manager', 'analyst', 'executive', etc.
    access_mode         TEXT NOT NULL DEFAULT 'forward',  -- 'forward' or 'full'
    status              TEXT NOT NULL DEFAULT 'provisioning',
    encryption_key_id   TEXT NOT NULL,              -- Reference to user encryption key in KMS
    memory_namespace    TEXT NOT NULL UNIQUE,       -- Vector DB namespace
    active_skills       TEXT[] NOT NULL DEFAULT '{}',  -- Array of active skill IDs
    preferences         JSONB NOT NULL DEFAULT '{}',   -- User-level preferences
    last_active_at      TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(org_id, user_id)
);

-- Channel bindings (link external channel IDs to user instances)
CREATE TABLE channel_bindings (
    binding_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id     UUID NOT NULL REFERENCES user_instances(instance_id),
    channel_type    TEXT NOT NULL,       -- 'slack', 'teams', 'email'
    channel_user_id TEXT NOT NULL,       -- Slack user ID, Teams user ID, email address
    channel_meta    JSONB DEFAULT '{}',  -- Channel-specific metadata
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(channel_type, channel_user_id)
);

CREATE INDEX idx_channel_bindings_lookup ON channel_bindings(channel_type, channel_user_id);
CREATE INDEX idx_user_instances_org ON user_instances(org_id);
CREATE INDEX idx_user_instances_status ON user_instances(status);
```

### Instance Lifecycle

```
                     USER INSTANCE LIFECYCLE

    ┌──────────────┐
    │ PROVISIONING │  Admin creates user instance via dashboard
    │              │  or bulk import during onboarding.
    │  - Create DB │
    │    record    │  Actions:
    │  - Generate  │  1. Insert user_instances row
    │    enc key   │  2. Generate encryption key in KMS
    │  - Create    │  3. Create vector DB namespace
    │    vector ns │  4. Create channel bindings
    │  - Bind      │  5. Assign initial skills
    │    channels  │  6. Send welcome message
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │    ACTIVE    │  User is interacting with their assistant.
    │              │  Container assigned from pool on message.
    │  - Messages  │
    │    processed │  On idle (no message for 1 hour):
    │  - Container │  → Release container back to pool
    │    assigned  │  → Instance stays ACTIVE
    │  - Memory    │  → Next message triggers new container
    │    growing   │
    └──────┬───────┘
           │
           │  User requests deletion [PRD FR-001.6]
           │  OR admin offboards user
           │  OR org offboarded
           ▼
    ┌──────────────┐
    │   DELETING   │  All user data being purged.
    │              │
    │  - Delete    │  Actions:
    │    personal  │  1. Delete vector DB namespace
    │    memory    │  2. Delete pattern_logs rows
    │  - Delete    │  3. Delete encryption key from KMS
    │    patterns  │  4. Remove channel bindings
    │  - Delete    │  5. Mark instance as 'deleted'
    │    enc key   │  6. Confirm deletion to user
    │  - Audit     │
    │    log entry │  Note: Anonymized aggregated patterns
    └──────┬───────┘  (already in views) are NOT deleted --
           │          they contain no individual data.
           ▼
    ┌──────────────┐
    │   DELETED    │  Tombstone record retained for audit.
    │              │  No recoverable data remains.
    └──────────────┘


    SUSPENSION (org-initiated):

    ACTIVE ──────► SUSPENDED ──────► ACTIVE
                   │                  │
                   │ No messages      │ Admin reactivates
                   │ processed.       │ or org reactivates.
                   │ Data preserved.  │
                   │ Container        │
                   │ released.        │
```

### Routing Architecture

Every inbound message must be resolved to exactly one user instance. The routing strategy depends on the channel.

```
                       MESSAGE ROUTING FLOW

    ┌──────────────────────────────────────────────────────────┐
    │                   INBOUND MESSAGE                        │
    │                                                          │
    │  Channel: slack | teams | email                          │
    │  Raw ID:  Slack user_id + team_id                        │
    │           Teams user_id + tenant_id                      │
    │           Email: from address                            │
    └────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
    ┌──────────────────────────────────────────────────────────┐
    │              CHANNEL ADAPTER (normalize)                  │
    │                                                          │
    │  Extract: channel_type, channel_user_id, content         │
    │  Attach:  raw metadata (timestamps, thread IDs, etc.)    │
    └────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
    ┌──────────────────────────────────────────────────────────┐
    │              TENANT RESOLVER                             │
    │                                                          │
    │  Step 1: Resolve Organization                            │
    │    Slack:  team_id → organizations.slack_team_id         │
    │    Teams:  tenant_id → organizations.teams_tenant_id     │
    │    Email:  domain → organizations.email_domain           │
    │                                                          │
    │  Step 2: Resolve User Instance                           │
    │    Look up channel_bindings:                             │
    │    (channel_type, channel_user_id) → instance_id         │
    │                                                          │
    │  Step 3: Validate                                        │
    │    - Instance status must be 'active'                    │
    │    - Org status must be 'active'                         │
    │    - Rate limit check                                    │
    └────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
    ┌──────────────────────────────────────────────────────────┐
    │              USER INSTANCE QUEUE                          │
    │                                                          │
    │  Enqueue message for the resolved user instance.         │
    │  Queue ensures sequential processing (one at a time).    │
    └──────────────────────────────────────────────────────────┘
```

#### Slack Routing

```
Slack Event (message.im or app_mention):
  ├── event.team_id  → organizations.slack_team_id  → org_id
  ├── event.user     → channel_bindings(slack, user_id) → instance_id
  └── Validate: instance.org_id matches resolved org_id
```

**Multi-workspace support:** Each design partner organization has its own Slack workspace. Play New registers a single Slack app distributed to multiple workspaces. The `team_id` in each event identifies which organization the message belongs to.

#### Teams Routing

```
Teams Activity (message):
  ├── activity.channelData.tenant.id → organizations.teams_tenant_id → org_id
  ├── activity.from.id → channel_bindings(teams, user_id) → instance_id
  └── Validate: instance.org_id matches resolved org_id
```

#### Email Routing

```
Inbound Email (to: user-slug@playnew.ai):
  ├── Parse recipient: extract user-slug
  ├── Resolve: user-slug → channel_bindings(email, user-slug@playnew.ai) → instance_id
  ├── Verify sender: from address matches known user email
  └── If sender unknown: reject (prevent unauthorized access)
```

Each user gets a dedicated assistant email address: `{user-slug}.assistant@playnew.ai` or `{first.last}@{org-slug}.playnew.ai`. The exact format is an open question [OQ-201].

### Routing Cache

For low-latency routing, resolved bindings are cached:

```
┌────────────────────────────────────┐
│           ROUTING CACHE            │
│        (Redis / in-memory)         │
│                                    │
│  Key: channel_type:channel_user_id │
│  Value: {                          │
│    instance_id,                    │
│    org_id,                         │
│    status,                         │
│    queue_name                      │
│  }                                 │
│                                    │
│  TTL: 5 minutes                    │
│  Invalidation: on instance update  │
└────────────────────────────────────┘
```

### Per-Org Message Queues

Nanoclaw uses an in-memory queue per group. Play New replaces this with distributed per-user queues, organized under per-org namespaces.

```
                     QUEUE TOPOLOGY

    Organization A (org_abc)
    ├── queue:org_abc:user_001   [msg1, msg2]
    ├── queue:org_abc:user_002   [msg3]
    ├── queue:org_abc:user_003   []  (idle)
    └── queue:org_abc:user_004   [msg4, msg5, msg6]

    Organization B (org_def)
    ├── queue:org_def:user_101   [msg7]
    ├── queue:org_def:user_102   []  (idle)
    └── queue:org_def:user_103   [msg8]

    Organization C (org_ghi)
    ├── queue:org_ghi:user_201   []
    └── queue:org_ghi:user_202   [msg9]
```

**Queue behavior:**
- Each user has exactly one queue.
- Messages are processed sequentially per user (preserves nanoclaw semantics).
- Multiple users' messages can be processed concurrently (different containers).
- Per-org rate limits prevent one organization from starving others.
- Dead letter queue per org for failed messages.

**Implementation:** Redis Streams (or BullMQ on Redis).

```typescript
// Queue naming convention
const queueName = `pn:queue:${orgId}:${instanceId}`;

// Per-org rate limit key
const rateLimitKey = `pn:ratelimit:${orgId}`;

// Worker group per org (for fair scheduling)
const workerGroup = `pn:workers:${orgId}`;
```

### Data Isolation

Play New enforces data isolation at multiple levels:

```
                     ISOLATION LAYERS

    Layer 1: Database Schema Isolation
    ┌──────────────────────────────────────────────┐
    │  PostgreSQL                                   │
    │                                               │
    │  Schema: pn_platform  (shared platform data)  │
    │    - organizations                            │
    │    - platform_config                          │
    │                                               │
    │  Schema: org_abc  (Organization A data)       │
    │    - teams                                    │
    │    - user_instances                           │
    │    - pattern_logs                             │
    │    - skills_registry                          │
    │    - audit_log                                │
    │    - org_context                              │
    │                                               │
    │  Schema: org_def  (Organization B data)       │
    │    - teams                                    │
    │    - user_instances                           │
    │    - ... (same tables, isolated data)         │
    │                                               │
    │  Row-Level Security: queries scoped to        │
    │  current org via session variable             │
    └──────────────────────────────────────────────┘

    Layer 2: Vector DB Namespace Isolation
    ┌──────────────────────────────────────────────┐
    │  Qdrant / Weaviate                            │
    │                                               │
    │  Namespace: org_abc_user_001  (User A memory) │
    │  Namespace: org_abc_user_002  (User B memory) │
    │  Namespace: org_def_user_101  (User C memory) │
    │  ...                                          │
    │                                               │
    │  Each namespace encrypted with user's key.    │
    │  No cross-namespace queries possible.         │
    └──────────────────────────────────────────────┘

    Layer 3: Container Isolation
    ┌──────────────────────────────────────────────┐
    │  Docker containers                            │
    │                                               │
    │  Each container sees only:                    │
    │  - Its user's workspace (encrypted)           │
    │  - Its org's context (read-only)              │
    │  - Its user's skills (read-only)              │
    │  - Its user's IPC directory                   │
    │                                               │
    │  Cannot access other users' mounts.           │
    └──────────────────────────────────────────────┘

    Layer 4: Queue Isolation
    ┌──────────────────────────────────────────────┐
    │  Redis                                        │
    │                                               │
    │  Each user's queue is a separate stream.      │
    │  Workers authenticate per-org.                │
    │  No cross-org queue access.                   │
    └──────────────────────────────────────────────┘
```

#### Per-Org PostgreSQL Schemas

Each organization gets its own PostgreSQL schema. This provides:
- **Naming isolation:** Tables cannot collide between orgs.
- **Access control:** Database roles scoped to schemas.
- **Backup/restore:** Per-org backup possible.
- **Offboarding:** Drop schema to remove all org data.

```sql
-- Create org schema during onboarding
CREATE SCHEMA org_abc AUTHORIZATION pn_app;

-- Set search_path per request (middleware)
SET search_path TO org_abc, pn_platform;

-- Row-Level Security as defense-in-depth
ALTER TABLE org_abc.user_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON org_abc.user_instances
    USING (org_id = current_setting('pn.current_org_id')::UUID);
```

### Configuration Hierarchy

```typescript
interface PlatformConfig {
  llm: {
    primaryModel: string;         // 'claude-sonnet-4-20250514'
    fallbackModel: string;        // 'gpt-4o'
    maxTokensPerTurn: number;     // 4096
    maxTurnsPerConversation: number; // 20
  };
  privacy: {
    minAggregationThreshold: number;  // 5 (users)
    temporalBlurUnit: string;         // 'week'
    patternRetentionDays: number;     // 365
  };
  containers: {
    maxConcurrentPerOrg: number;      // 20
    idleTimeoutMinutes: number;       // 60
    maxResponseTimeSeconds: number;   // 30
  };
  proactive: {
    maxUnpromptedPerDay: number;      // 1
    weeklyReviewEnabled: boolean;     // true
    weeklyReviewDay: string;          // 'friday'
  };
}

interface OrgConfig extends Partial<PlatformConfig> {
  orgName: string;
  industry: string;
  strategicContextDocId: string;
  connectedDataSources: DataSourceConfig[];
  slackConfig?: SlackWorkspaceConfig;
  teamsConfig?: TeamsTenanConfig;
  emailConfig?: EmailDomainConfig;
  allowedSkillCategories: string[];
  customSystemPromptAdditions?: string;
}

interface TeamConfig {
  teamFunction: string;           // 'marketing', 'sales', etc.
  additionalSkills?: string[];    // Extra skills for this team
  customContext?: string;         // Team-specific context additions
}

interface UserPreferences {
  preferredLanguage: string;          // 'en', 'it', 'de', etc.
  proactiveMessageFrequency: 'daily' | 'weekly' | 'never';
  activeSkills: string[];
  timezone: string;
  communicationStyle: 'formal' | 'casual' | 'concise';
}
```

**Resolution order (most specific wins):**

```typescript
function resolveConfig(instanceId: string): ResolvedConfig {
  const platform = loadPlatformConfig();
  const org = loadOrgConfig(instance.orgId);
  const team = loadTeamConfig(instance.teamId);
  const user = loadUserPreferences(instanceId);

  return deepMerge(platform, org, team, user);
}
```

---

## Phase 0 Scope

### What we build in Phase 0:

| Component | Scope | Notes |
|-----------|-------|-------|
| Organizations table + management | 3 design partners | Manual onboarding via admin API |
| Teams table + management | Hierarchical team structure per org | Populated during onboarding |
| User instances table + lifecycle | Full CRUD + provisioning flow | Bulk import for onboarding |
| Channel bindings (Slack) | Slack user ID to instance mapping | Primary channel |
| Channel bindings (Teams) | Teams user ID to instance mapping | Secondary channel |
| Channel bindings (Email) | Email address to instance mapping | Forward mode |
| Tenant routing (Slack) | Workspace ID to org, user to instance | Cache-backed |
| Tenant routing (Teams) | Tenant ID to org, user to instance | Cache-backed |
| Tenant routing (Email) | Email domain to org, address to instance | |
| Per-org PostgreSQL schemas | Schema-per-org isolation | Created during onboarding |
| Per-user message queues | Redis-backed distributed queues | Sequential per user |
| Configuration hierarchy | Platform + org + team + user levels | JSON config in DB |
| Instance deletion flow | Full data purge on user request | GDPR compliance |

### What we defer:

| Component | Deferred To | Reason |
|-----------|-------------|--------|
| Self-service org onboarding | Phase 2 | Phase 0 orgs are onboarded manually |
| Automated instance provisioning from SSO | Phase 1 | Phase 0 users added via admin bulk import |
| Per-org billing/usage tracking | Phase 1 | Phase 0 is free (design partnership) |
| Cross-org query isolation (RLS policies) | Phase 1 | Schema separation sufficient for 3 orgs |
| Instance migration between orgs | Phase 2+ | Not needed at Phase 0 scale |

---

## Open Questions

| ID | Question | Impact | Decision Date |
|----|----------|--------|---------------|
| OQ-201 | Email address format for forward mode? `{user}.assistant@playnew.ai` vs `{user}@{org}.playnew.ai`? | Low -- UX preference | March 2026 |
| OQ-202 | Should we use PostgreSQL schema-per-org or single schema with RLS? Schema-per-org is simpler but harder to query across orgs for benchmarking. | High -- affects data model | March 2026 |
| OQ-203 | How do we handle users who belong to multiple teams? One instance per user or multiple? | Medium -- data model | March 2026 |
| OQ-204 | Rate limiting strategy: per-user, per-org, or both? What are the specific limits for Phase 0? | Medium -- fairness | March 2026 |
| OQ-205 | How do we handle Slack users who are in the workspace but not provisioned in Play New? Silent ignore or informational response? | Low -- UX | March 2026 |
