# 05 -- Privacy Boundary Architecture

**Status:** Draft
**Owner:** TBD
**Last Updated:** 2026-02-25
**PRD Sections:** 7 (all), 8.4 FR-005, 8.5, 15, 20.3

---

## Context

Privacy is the foundational architectural decision in Play New. The PRD states it clearly: "Privacy is architecture, not a feature" [PRD S6.1]. The anonymization boundary is "the single most important technical component of the system" [PRD S6.3.3].

Play New must simultaneously:
1. Give individuals a trusted personal assistant that feels private.
2. Extract organizational intelligence from aggregated usage patterns.
3. Satisfy GDPR requirements and works-council scrutiny.

These three goals are in tension. The privacy boundary architecture resolves this tension by making it *technically impossible* for individual data to cross into the organizational layer -- not through policies or access controls, but through database views that physically aggregate before any query can return results.

---

## Nanoclaw Foundation

**What we inherit:**
- Container isolation (each user's execution is isolated) [nc: src/container-runner.ts]
- Non-root execution (limits container escape risk) [nc: Dockerfile]
- Ephemeral containers (no persistent data in container itself) [nc: src/container-runner.ts]

**What we build new:**
- Anonymization engine (PostgreSQL views with aggregation thresholds)
- Encryption key hierarchy (KMS -> org key -> user key)
- Pattern collection with content stripping
- User data controls (view, forget, delete, export)
- Audit trail for all data access
- Data classification enforcement

---

## Play New Requirements

- "The assistant works for the person, not the company" [PRD S7.1]
- Personal conversations never visible to employer [PRD S7.4]
- Min 5-user aggregation threshold [PRD S7.3]
- Category generalization (Excel -> "spreadsheet tools") [PRD S7.3]
- No individual attribution in org layer [PRD S7.3]
- Temporal blurring (weekly/monthly, not daily) [PRD S7.3]
- User can delete all data at any time [PRD FR-001.6]
- User can view what assistant knows [PRD FR-001.4]
- User can export all data [PRD FR-001.5]
- AES-256 encryption at rest [PRD S8.5]
- TLS 1.3 in transit [PRD S8.5]
- EU data residency [PRD S8.5]
- Categorical logging only -- content never logged [PRD FR-005.4]
- Pattern logs accessible only to anonymization pipeline [PRD FR-005.5]

---

## Technical Specification

### Design Principle

```
    ┌─────────────────────────────────────────────────────┐
    │                                                     │
    │   "The assistant works for the person,              │
    │    not the company."                                │
    │                                                     │
    │   This means:                                       │
    │                                                     │
    │   1. The employer CANNOT see what any individual    │
    │      user does with their assistant.                │
    │                                                     │
    │   2. The organization CAN see aggregated patterns   │
    │      across groups of 5+ users.                     │
    │                                                     │
    │   3. The user CAN see everything the system knows   │
    │      about them, and CAN delete any of it.          │
    │                                                     │
    │   4. This is enforced by INFRASTRUCTURE, not        │
    │      by application logic or access controls.       │
    │                                                     │
    └─────────────────────────────────────────────────────┘
```

### Data Classification

Four tiers of data, each with different visibility, storage, and retention rules:

```
    DATA CLASSIFICATION TIERS

    ┌─────────────────────────────────────────────────────────┐
    │  TIER 1: PERSONAL DATA                                  │
    │  Visibility: User only                                  │
    │  Storage: Encrypted vector DB (user-scoped key)         │
    │  Retention: User controls. Delete anytime.              │
    │                                                         │
    │  Examples:                                               │
    │  - Conversation history with assistant                   │
    │  - Personal work patterns ("I spend 12h/week reporting")│
    │  - Forwarded email content and analysis                 │
    │  - Skill execution history and results                  │
    │  - Personal preferences and learned context             │
    │  - Weekly review archives                               │
    └─────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────┐
    │  TIER 2: ORGANIZATIONAL CONTEXT                         │
    │  Visibility: All users in org (read-only)               │
    │  Storage: PostgreSQL + pgvector (org-scoped key)        │
    │  Retention: Org contract period                          │
    │                                                         │
    │  Examples:                                               │
    │  - Strategic context document                            │
    │  - Team structure and reporting lines                    │
    │  - Industry and competitive context                      │
    │  - Connected data source snapshots (CRM, etc.)          │
    │  - Framework library                                     │
    └─────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────┐
    │  TIER 3: ANONYMIZED PATTERNS                            │
    │  Visibility: Advisors + leadership (via aggregated views)│
    │  Storage: PostgreSQL (org schema, aggregation views)     │
    │  Retention: Org contract period                          │
    │                                                         │
    │  Examples:                                               │
    │  - "35% of marketing team time -> reporting"            │
    │  - "6 users in finance use spreadsheet tools daily"     │
    │  - "Top skill: email-summarizer (89% positive)"         │
    │  - "47 hours/week spent on manual data compilation"     │
    │                                                         │
    │  NEVER contains: which users, daily patterns,           │
    │  specific tool names, content of interactions           │
    └─────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────┐
    │  TIER 4: CROSS-ORG BENCHMARKS (Phase 2+)                │
    │  Visibility: Cross-org intelligence layer               │
    │  Storage: PostgreSQL (platform schema, multi-org views) │
    │  Retention: Platform lifetime                            │
    │                                                         │
    │  Examples:                                               │
    │  - "Professional services orgs (200-500) spend avg 30%  │
    │    on coordination"                                     │
    │  - "Companies that automated reporting saw 40% time     │
    │    recovery"                                            │
    │                                                         │
    │  Requires: >= 3 organizations contributing to pattern   │
    │  NEVER contains: org names, team names, user counts     │
    │  per specific org                                       │
    └─────────────────────────────────────────────────────────┘
```

### The Anonymization Boundary

```
    THE ANONYMIZATION BOUNDARY

    ═══════════════════════════════════════════════════════════
    PERSONAL SIDE                    │    ORGANIZATIONAL SIDE
    (Tier 1 data)                    │    (Tier 3 data)
                                     │
    Individual pattern_logs records   │    Aggregated views only
    with hashed user IDs             │    No individual records
                                     │
    ┌─────────────────────┐          │
    │ pattern_logs table  │          │
    │                     │          │
    │ user_hash: a1b2c3   │──────┐   │
    │ team: marketing     │      │   │
    │ cat_L1: commun.     │      │   │
    │ cat_L2: reporting   │      │   │
    │ time_saved: 45min   │      │   │
    │ period: 2026-W15    │      │   │
    ├─────────────────────┤      │   │
    │ user_hash: d4e5f6   │      │   │
    │ team: marketing     │      │   │
    │ cat_L1: commun.     │      │   │
    │ cat_L2: reporting   │      │   │
    │ time_saved: 30min   │      │   │
    │ period: 2026-W15    │      │   │    ┌─────────────────────┐
    ├─────────────────────┤      │   │    │ aggregated_patterns │
    │ user_hash: g7h8i9   │      │   │    │ (PostgreSQL VIEW)   │
    │ team: marketing     │      ▼   │    │                     │
    │ cat_L1: commun.     │    ┌─────┴─┐  │ team: marketing     │
    │ cat_L2: reporting   │    │ VIEW  │  │ cat_L1: commun.     │
    │ time_saved: 60min   │    │       │──│ cat_L2: reporting   │
    │ period: 2026-W15    │    │ GROUP │  │ user_count: 6       │
    ├─────────────────────┤    │  BY   │  │ total_time: 235min  │
    │ user_hash: j0k1l2   │    │       │  │ period: 2026-W15    │
    │ team: marketing     │    │ HAVING│  │ confidence: 0.82    │
    │ cat_L1: commun.     │    │ count │  └─────────────────────┘
    │ cat_L2: reporting   │    │  >= 5 │
    │ time_saved: 55min   │    └───────┘
    ├─────────────────────┤      ▲
    │ user_hash: m3n4o5   │      │
    │ team: marketing     │──────┘
    │ cat_L1: commun.     │
    │ cat_L2: reporting   │
    │ time_saved: 45min   │
    │ period: 2026-W15    │
    └─────────────────────┘

    6 distinct users >= 5 threshold
    -> Pattern surfaces in org view

    ═══════════════════════════════════════════════════════════
```

### The Five Anonymization Rules

#### Rule 1: Minimum Aggregation Threshold (>= 5 users)

Patterns only surface when 5 or more distinct users exhibit them. Below this threshold, data stays in personal instances only. [PRD S7.3]

```sql
-- Enforced in the VIEW definition, not in application code
CREATE VIEW org_abc.aggregated_team_patterns AS
SELECT
    team_id,
    category_l1,
    category_l2,
    period_week,
    COUNT(DISTINCT user_hash) AS user_count,
    SUM(estimated_time_saved_minutes) AS total_time_saved,
    COUNT(*) AS interaction_count,
    AVG(estimated_time_saved_minutes) AS avg_time_saved
FROM org_abc.pattern_logs
GROUP BY team_id, category_l1, category_l2, period_week
HAVING COUNT(DISTINCT user_hash) >= 5;  -- THRESHOLD ENFORCED HERE
```

**Why this is a view and not application logic:** A view cannot be bypassed. Any query against this view physically cannot return results for patterns with fewer than 5 users. There is no API, no admin override, no query parameter that can change this. The database enforces it.

#### Rule 2: Category Generalization

Specific tools are generalized to categories. Specific actions are generalized to task types. [PRD S7.3]

| Raw Data (in container) | Generalized (in pattern_logs) |
|--------------------------|-------------------------------|
| Excel | spreadsheet_tools |
| Google Sheets | spreadsheet_tools |
| Salesforce | crm |
| HubSpot | crm |
| Gmail | communication_tools |
| Outlook | communication_tools |
| Slack | communication_tools |
| Jira | project_management |
| Asana | project_management |
| Linear | project_management |

```typescript
// Generalization happens BEFORE data leaves the container
const TOOL_GENERALIZATION: Record<string, string> = {
  'excel': 'spreadsheet_tools',
  'google_sheets': 'spreadsheet_tools',
  'salesforce': 'crm',
  'hubspot': 'crm',
  'gmail': 'communication_tools',
  'outlook': 'communication_tools',
  // ... complete mapping
};

function generalizeTools(tools: string[]): string[] {
  return [...new Set(tools.map(t => TOOL_GENERALIZATION[t] || 'other_tools'))];
}
```

#### Rule 3: No Individual Attribution

The organizational layer never knows which specific users contributed to a pattern. It knows "6 people in marketing" but never "Maria, Joao, and Luca." [PRD S7.3]

**Implementation:** The `user_hash` field in `pattern_logs` is a salted SHA-256 hash of the instance ID. It is used solely for COUNT(DISTINCT user_hash) in aggregation views. The hash cannot be reversed to identify the user. The aggregation views never expose user_hash.

```sql
-- The view NEVER includes user_hash in its output columns
CREATE VIEW org_abc.aggregated_team_patterns AS
SELECT
    team_id,
    category_l1,
    category_l2,
    period_week,
    COUNT(DISTINCT user_hash) AS user_count,  -- count only, hash not exposed
    -- ...
FROM org_abc.pattern_logs
GROUP BY team_id, category_l1, category_l2, period_week
HAVING COUNT(DISTINCT user_hash) >= 5;
```

#### Rule 4: Temporal Blurring

Patterns are reported in weekly or monthly aggregations, never daily. This prevents correlation attacks like "who was working Tuesday night." [PRD S7.3]

```typescript
// Pattern timestamps are blurred to the week level BEFORE storage
function temporalBlur(timestamp: Date): string {
  const year = timestamp.getFullYear();
  const week = getISOWeek(timestamp);
  return `${year}-W${String(week).padStart(2, '0')}`;
  // e.g., '2026-W15' -- no day, no hour, no minute
}
```

The `pattern_logs` table stores `period_week` (TEXT), not a precise timestamp. The original interaction timestamp stays only in the user's personal memory (Tier 1).

#### Rule 5: Differential Privacy (Phase 2+)

Add calibrated noise to small-group aggregations to prevent statistical inference of individual behavior. [PRD S7.3]

```
Phase 0: Rules 1-4 only. Sufficient for design partner trust.
Phase 1: Rules 1-4 + formal privacy audit.
Phase 2+: Rules 1-5. Differential privacy with epsilon calibration.
```

Differential privacy is deferred because:
- Phase 0 has only 20-50 users per org, making sophisticated statistical inference unlikely.
- The min-5-user threshold + temporal blurring provides strong baseline protection.
- Implementing differential privacy correctly requires expertise and calibration.

### Implementation: PostgreSQL Views Enforce Aggregation

The core privacy guarantee: **the organizational layer can only access data through PostgreSQL views that enforce aggregation.** There is no table-level access, no raw query path, no API endpoint that returns non-aggregated pattern data.

```sql
-- ============================================================
-- PATTERN LOG TABLE (personal side of the boundary)
-- Only the pattern collector process can INSERT.
-- Only aggregation views can SELECT.
-- No direct human access to this table.
-- ============================================================

CREATE TABLE org_abc.pattern_logs (
    pattern_id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_hash                   TEXT NOT NULL,       -- SHA256(instance_id + salt)
    team_id                     UUID NOT NULL,
    role_category               TEXT,
    interaction_type            TEXT NOT NULL,        -- 'direct_query', 'forward_analysis', etc.
    category_l1                 TEXT NOT NULL,        -- Standardized taxonomy L1
    category_l2                 TEXT,                 -- Standardized taxonomy L2
    category_l3                 TEXT,                 -- Standardized taxonomy L3
    tools_generalized           TEXT[],               -- Generalized tool categories
    estimated_time_saved_min    INTEGER,
    skills_invoked              TEXT[],
    skill_feedback              TEXT,                 -- 'useful', 'not_useful', null
    content_types_shared        TEXT[],               -- 'email', 'document', 'message'
    period_week                 TEXT NOT NULL,         -- '2026-W15' (temporal blur)
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ACCESS CONTROL: Only the app service role can insert.
-- No human role has SELECT access.
REVOKE ALL ON org_abc.pattern_logs FROM PUBLIC;
GRANT INSERT ON org_abc.pattern_logs TO pn_collector_role;
GRANT SELECT ON org_abc.pattern_logs TO pn_view_definer_role;
-- pn_view_definer_role is used ONLY for view creation, not direct queries.

-- ============================================================
-- AGGREGATION VIEWS (organizational side of the boundary)
-- These are the ONLY way to access pattern data.
-- ============================================================

-- Team-level work patterns
CREATE VIEW org_abc.v_team_patterns AS
SELECT
    t.name AS team_name,
    t.function AS team_function,
    pl.category_l1,
    pl.category_l2,
    pl.period_week,
    COUNT(DISTINCT pl.user_hash) AS contributing_users,
    COUNT(*) AS total_interactions,
    SUM(pl.estimated_time_saved_min) AS total_time_saved_min,
    ROUND(AVG(pl.estimated_time_saved_min), 1) AS avg_time_saved_min
FROM org_abc.pattern_logs pl
JOIN org_abc.teams t ON pl.team_id = t.team_id
GROUP BY t.name, t.function, pl.category_l1, pl.category_l2, pl.period_week
HAVING COUNT(DISTINCT pl.user_hash) >= 5;

-- Skill usage patterns
CREATE VIEW org_abc.v_skill_usage AS
SELECT
    t.name AS team_name,
    unnest(pl.skills_invoked) AS skill_id,
    pl.period_week,
    COUNT(DISTINCT pl.user_hash) AS contributing_users,
    COUNT(*) AS activation_count,
    COUNT(CASE WHEN pl.skill_feedback = 'useful' THEN 1 END) AS useful_count,
    COUNT(CASE WHEN pl.skill_feedback = 'not_useful' THEN 1 END) AS not_useful_count
FROM org_abc.pattern_logs pl
JOIN org_abc.teams t ON pl.team_id = t.team_id
WHERE pl.skills_invoked IS NOT NULL AND array_length(pl.skills_invoked, 1) > 0
GROUP BY t.name, unnest(pl.skills_invoked), pl.period_week
HAVING COUNT(DISTINCT pl.user_hash) >= 5;

-- Tool category patterns
CREATE VIEW org_abc.v_tool_patterns AS
SELECT
    t.name AS team_name,
    unnest(pl.tools_generalized) AS tool_category,
    pl.period_week,
    COUNT(DISTINCT pl.user_hash) AS contributing_users,
    COUNT(*) AS usage_count
FROM org_abc.pattern_logs pl
JOIN org_abc.teams t ON pl.team_id = t.team_id
GROUP BY t.name, unnest(pl.tools_generalized), pl.period_week
HAVING COUNT(DISTINCT pl.user_hash) >= 5;

-- Content type patterns
CREATE VIEW org_abc.v_content_patterns AS
SELECT
    t.name AS team_name,
    unnest(pl.content_types_shared) AS content_type,
    pl.period_week,
    COUNT(DISTINCT pl.user_hash) AS contributing_users,
    COUNT(*) AS share_count
FROM org_abc.pattern_logs pl
JOIN org_abc.teams t ON pl.team_id = t.team_id
GROUP BY t.name, unnest(pl.content_types_shared), pl.period_week
HAVING COUNT(DISTINCT pl.user_hash) >= 5;

-- Grant view access to advisor role
GRANT SELECT ON org_abc.v_team_patterns TO pn_advisor_role;
GRANT SELECT ON org_abc.v_skill_usage TO pn_advisor_role;
GRANT SELECT ON org_abc.v_tool_patterns TO pn_advisor_role;
GRANT SELECT ON org_abc.v_content_patterns TO pn_advisor_role;
```

### Encryption Architecture

```
                    ENCRYPTION KEY HIERARCHY

    ┌──────────────────────────────────────────────────────┐
    │  CLOUD KMS (AWS KMS / GCP KMS)                        │
    │                                                       │
    │  Platform Master Key (PMK)                            │
    │  └── Used to encrypt/decrypt org master keys          │
    │                                                       │
    │  Managed by: Play New platform team                   │
    │  Rotation: Annual                                     │
    │  Access: Platform admin role only                     │
    └──────────────────┬───────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
    ┌────────┐    ┌────────┐    ┌────────┐
    │ Org A  │    │ Org B  │    │ Org C  │
    │ Master │    │ Master │    │ Master │
    │ Key    │    │ Key    │    │ Key    │
    │        │    │        │    │        │
    │ Encrypts:   │ Encrypts:   │ Encrypts:
    │ - Org    │  │ - Org    │  │ - Org    │
    │   config │  │   config │  │   config │
    │ - Context│  │ - Context│  │ - Context│
    │   docs   │  │   docs   │  │   docs   │
    │ - User   │  │ - User   │  │ - User   │
    │   keys   │  │   keys   │  │   keys   │
    └───┬──────┘  └───┬──────┘  └───┬──────┘
        │              │              │
    ┌───┼───┐      ┌───┼───┐      ┌───┼───┐
    │   │   │      │   │   │      │   │   │
    ▼   ▼   ▼      ▼   ▼   ▼      ▼   ▼   ▼
   U1  U2  U3     U4  U5  U6     U7  U8  U9
   Key Key Key    Key Key Key    Key Key Key

   Each user key encrypts:
   - Personal memory (vector DB namespace)
   - Conversation history
   - Forwarded content
   - Skill execution results
   - Export files
```

**Encryption specifications:**

| Layer | Algorithm | Key Size | Notes |
|-------|-----------|----------|-------|
| At rest (PostgreSQL) | AES-256-GCM | 256-bit | Transparent data encryption |
| At rest (vector DB) | AES-256-GCM | 256-bit | Per-namespace encryption |
| At rest (object storage) | AES-256-GCM | 256-bit | Server-side encryption |
| In transit | TLS 1.3 | - | All internal and external traffic |
| User data envelope | AES-256-GCM | 256-bit | Application-level envelope encryption |
| Key wrapping | RSA-OAEP or AES-KW | 256-bit+ | KMS key wrapping |

**Envelope encryption pattern:**

```typescript
// Encrypt data with user's key
async function encryptUserData(
  userId: string,
  plaintext: Buffer
): Promise<EncryptedPayload> {
  // 1. Generate a random data encryption key (DEK)
  const dek = crypto.randomBytes(32);

  // 2. Encrypt the data with the DEK
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // 3. Encrypt the DEK with the user's key (from KMS)
  const userKey = await kms.getUserKey(userId);
  const wrappedDek = await kms.encrypt(userKey, dek);

  return {
    encryptedData: encrypted,
    iv: iv,
    authTag: authTag,
    wrappedDek: wrappedDek,
    keyId: userKey.id,
  };
}
```

### User Data Controls

Users have full control over their personal data. These controls are non-negotiable and must work reliably.

```
                    USER DATA CONTROL OPERATIONS

    ┌──────────────────────────────────────────────────────┐
    │  OPERATION: VIEW ("What does my assistant know?")     │
    │                                                       │
    │  User triggers via: /what-do-you-know or              │
    │  "Show me what you know about me"                     │
    │                                                       │
    │  Returns:                                             │
    │  - Summary of conversation topics (last 30 days)      │
    │  - Learned preferences and patterns                   │
    │  - Active skills and their usage                      │
    │  - Connected data sources (Phase 1+)                  │
    │  - Total data volume stored                           │
    │                                                       │
    │  Does NOT return raw conversation transcripts         │
    │  (too large). User can request specific topics.       │
    └──────────────────────────────────────────────────────┘

    ┌──────────────────────────────────────────────────────┐
    │  OPERATION: SELECTIVE FORGET                          │
    │                                                       │
    │  User triggers via: "Forget what I told you about     │
    │  the Johnson deal" or /forget <topic>                 │
    │                                                       │
    │  Process:                                             │
    │  1. Search personal memory for matching vectors       │
    │  2. Show user what will be deleted (confirmation)     │
    │  3. Delete matching vectors from personal memory      │
    │  4. Log deletion in user's audit trail                │
    │  5. Confirm to user: "Done. I've forgotten           │
    │     3 conversations about the Johnson deal."          │
    │                                                       │
    │  Note: Pattern metadata already submitted to          │
    │  pattern_logs is NOT deleted (it contains no          │
    │  content, only categories). This is by design:        │
    │  the pattern "user analyzed a deal" is anonymous.     │
    └──────────────────────────────────────────────────────┘

    ┌──────────────────────────────────────────────────────┐
    │  OPERATION: DELETE ALL                                │
    │                                                       │
    │  User triggers via: "Delete everything" or            │
    │  admin interface (user self-service)                  │
    │                                                       │
    │  Process:                                             │
    │  1. Confirm with user (double confirmation)           │
    │  2. Delete vector DB namespace (all personal memory)  │
    │  3. Delete pattern_logs rows for this user_hash       │
    │  4. Delete encryption key from KMS                    │
    │  5. Remove channel bindings                           │
    │  6. Mark instance as 'deleted' (tombstone)            │
    │  7. Log deletion in platform audit trail              │
    │  8. Send confirmation: "All your data has been        │
    │     permanently deleted. Your assistant is gone."      │
    │                                                       │
    │  IMPORTANT: Already-aggregated view results are       │
    │  NOT affected. They contain no individual data.       │
    │  A view that previously showed "6 users" will now     │
    │  recompute to "5 users" on next query.                │
    │  If it drops below 5, the pattern disappears.         │
    └──────────────────────────────────────────────────────┘

    ┌──────────────────────────────────────────────────────┐
    │  OPERATION: EXPORT                                    │
    │                                                       │
    │  User triggers via: /export-my-data or                │
    │  admin interface (user self-service)                  │
    │                                                       │
    │  Process:                                             │
    │  1. Export all personal memory vectors as JSON         │
    │  2. Export conversation history as structured text     │
    │  3. Export skill usage history                         │
    │  4. Export preferences and configuration               │
    │  5. Package as encrypted ZIP                          │
    │  6. Deliver to user via secure download link           │
    │     (expires in 24 hours)                             │
    │  7. Log export in user's audit trail                  │
    │                                                       │
    │  GDPR Article 20: Right to data portability.          │
    │  Format: machine-readable JSON.                       │
    └──────────────────────────────────────────────────────┘
```

### Audit Trail Design

Every data access event is logged in an append-only audit trail.

```sql
CREATE TABLE org_abc.audit_log (
    audit_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor_type      TEXT NOT NULL,   -- 'user', 'system', 'advisor', 'admin'
    actor_id        TEXT NOT NULL,   -- user_hash, system component, or admin ID
    action          TEXT NOT NULL,   -- 'read_memory', 'write_memory', 'delete_memory',
                                     -- 'export_data', 'forget_topic', 'view_patterns',
                                     -- 'query_aggregation', 'assign_skill', etc.
    resource_type   TEXT NOT NULL,   -- 'personal_memory', 'pattern_logs', 'aggregated_view',
                                     -- 'org_context', 'skill', 'config'
    resource_id     TEXT,            -- Specific resource identifier
    details         JSONB,           -- Action-specific metadata (no content)
    ip_address      INET,            -- Request origin (for admin actions)
    success         BOOLEAN NOT NULL DEFAULT true
);

-- Audit log is append-only. No UPDATE or DELETE possible.
REVOKE UPDATE, DELETE ON org_abc.audit_log FROM PUBLIC;
GRANT INSERT ON org_abc.audit_log TO pn_app_role;
GRANT SELECT ON org_abc.audit_log TO pn_auditor_role;

-- User can see their own audit entries
CREATE VIEW org_abc.v_user_audit AS
SELECT
    timestamp,
    action,
    resource_type,
    details,
    success
FROM org_abc.audit_log
WHERE actor_type = 'user'
  AND actor_id = current_setting('pn.current_user_hash');
```

**What gets audited:**

| Action | Actor | Logged Details |
|--------|-------|----------------|
| Read personal memory | System (container) | Number of vectors retrieved, query type |
| Write personal memory | System (container) | Number of vectors written, data category |
| Delete personal memory (forget) | User | Topic searched, vectors deleted count |
| Delete all data | User | Confirmation timestamp, components deleted |
| Export data | User | Export format, file size, download timestamp |
| Query aggregation view | Advisor | View name, query parameters |
| Update org context | Advisor | Document section updated |
| Assign skill to user | Advisor | Skill ID, reason |
| Pattern log insertion | System (collector) | Pattern category, team (no content) |

---

## Phase 0 Scope

### Phase 0 Privacy Implementation

Phase 0 has a simplified privacy model [PRD S7.5]:

| Aspect | Phase 0 | Phase 1+ |
|--------|---------|----------|
| Data input | Forward mode only (user controls what assistant sees) | Forward + full access (passive observation) |
| Pattern collection | Automated categorical logging after each interaction | Same, plus observation patterns |
| Anonymization | PostgreSQL views with 5-user threshold | Same, plus formal audit |
| Intelligence production | Advisors manually query aggregated views | Automated stream production |
| Encryption | AES-256 at rest, TLS 1.3 in transit. Application-level envelope encryption for personal memory. | Add volume-level encryption, user-held keys |
| User controls | View, forget, delete, export all functional | Same, plus granular data source controls |
| Audit trail | Full audit logging | Same, plus third-party audit review |
| Differential privacy | Not implemented | Phase 2+ |

### What we build in Phase 0:

| Component | Notes |
|-----------|-------|
| Pattern collector (automated) | Runs after every interaction, extracts categorical metadata |
| Pattern_logs table | Per-org schema, hashed user IDs, temporal blurring |
| Aggregation views | v_team_patterns, v_skill_usage, v_tool_patterns, v_content_patterns |
| Tool generalization mapping | Complete mapping table for Phase 0 tool set |
| Encryption key hierarchy | KMS integration, org keys, user keys |
| Envelope encryption for personal memory | Application-level encryption/decryption |
| User data controls | View, selective forget, delete all, export |
| Audit trail | Append-only log, user-visible view |
| Admin view restrictions | Advisors see only aggregated views, never raw data |

### What we defer:

| Component | Deferred To | Reason |
|-----------|-------------|--------|
| Differential privacy | Phase 2+ | Not needed at Phase 0 scale |
| Third-party privacy audit | Phase 1 | Cost, time |
| Works-council briefing template | Phase 0 W3-4 | Needs legal input |
| Volume-level encryption (dm-crypt) | Phase 1 | Application-level encryption sufficient for Phase 0 |
| User-held encryption keys | Phase 2+ | KMS-managed keys for Phase 0 |
| SOC 2 / ISO 27001 preparation | Phase 1+ | Phase 0 is design partnership |

---

## Open Questions

| ID | Question | Impact | Decision Date |
|----|----------|--------|---------------|
| OQ-501 | Should the user_hash salt be per-org or global? Per-org prevents cross-org correlation but complicates user deletion verification. | Medium -- privacy | March 2026 |
| OQ-502 | How do we handle the "5-user threshold drop" scenario? If a team has 5 users contributing and one deletes their data, the pattern drops to 4 and should disappear from views. Do we retroactively remove any reports/briefs that cited this pattern? | High -- consistency | March 2026 |
| OQ-503 | Should pattern_logs records be automatically expired/deleted after the org contract period? Or retained for cross-org benchmarking? | Medium -- retention | April 2026 |
| OQ-504 | How do we handle the advisor querying aggregated views -- do we need a dedicated analytics interface, or is direct SQL access to views acceptable for Phase 0? | Low -- tooling | March 2026 |
| OQ-505 | Should the audit log be stored in a separate database for tamper-resistance? Or is append-only in the same PostgreSQL instance sufficient for Phase 0? | Medium -- compliance | March 2026 |
| OQ-506 | How do we technically prevent the pattern collector from accidentally logging content? Strict JSON schema validation? Separate LLM call for classification? | High -- privacy | March 2026 |
