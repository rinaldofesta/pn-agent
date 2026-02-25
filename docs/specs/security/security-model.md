# Security Model

**Version:** 0.1.0
**Last Updated:** 2026-02-25
**Status:** Draft -- Pre-Phase 0 Architecture
**Owner:** Rinaldo Festa

---

## Context

Play New handles highly sensitive data: personal work conversations, organizational strategy documents, and aggregated intelligence about how people work. A security breach would destroy user trust -- the single most important asset of the platform. This document defines the threat model, trust boundaries, security controls, and authentication/authorization architecture.

Play New inherits nanoclaw's container-based security model and extends it with multi-tenant isolation, encryption-at-rest per data tier, and a layered authorization system.

Related documents:
- [PRD Section 7: Privacy Architecture](../../../PRD.md)
- [PRD Section 20.3: Security Requirements](../../../PRD.md)
- [Data Classification](../data/data-classification.md)
- [Encryption Spec](./encryption-spec.md)
- [Audit Logging Spec](./audit-logging-spec.md)
- [GDPR Compliance Spec](./gdpr-compliance-spec.md)

---

## Nanoclaw Security Foundation

Nanoclaw provides a strong baseline security model. Play New inherits these controls and extends them.

### Container Isolation

Each nanoclaw "group" (mapped to a Play New user instance) runs in an isolated Docker container:

| Control | Description | Play New Extension |
|---------|-------------|-------------------|
| **Process isolation** | Each user instance runs in its own container with its own filesystem, network namespace, and process tree. | Maintained. One container per user instance. |
| **Mount security** | Container mounts are read-only where possible. Skill files, MCP servers mounted as `:ro`. | Extended with org-specific and user-specific mount configurations. |
| **Credential filtering** | Nanoclaw filters credentials from container environment to prevent leakage to child processes. | Extended with per-org credential injection from secrets manager. |
| **Session isolation** | Each chat session is scoped to a single group. No cross-group data access path exists. | Extended with org_id and user_instance_id scoping. |
| **IPC authorization** | Inter-process communication between agent-runner and host is authorized per-request. | Extended with multi-tenant authorization context. |

### Container Security Configuration

```yaml
# Per-user-instance container security config
security_opt:
  - no-new-privileges:true
cap_drop:
  - ALL
cap_add: []                        # No capabilities needed
read_only: true                    # Read-only root filesystem
tmpfs:
  - /tmp:size=100M,noexec,nosuid   # Writable temp only
network_mode: bridge               # Controlled network access
dns:
  - internal-dns-only              # No public DNS resolution except via proxy
mem_limit: 512m                    # Memory limit per container
cpus: '0.5'                        # CPU limit per container
pids_limit: 100                    # Process limit
```

---

## Play New Threat Model

### T1: Cross-User Data Access

**Description:** An attacker (or bug) allows User A to access User B's personal conversations, patterns, or memory.

| Attribute | Value |
|-----------|-------|
| **Likelihood** | Medium (common vulnerability class in multi-tenant systems) |
| **Impact** | Critical (destroys user trust, GDPR violation, potential legal liability) |
| **Attack vectors** | IDOR in API endpoints, SQL injection bypassing user scoping, container escape, shared memory leak |

**Controls:**
1. Container isolation: User A's container has no network path to User B's container.
2. Database: All queries on personal data MUST include `user_instance_id` filter. Enforced by code review policy and automated testing.
3. API: Authorization middleware validates `user_instance_id` matches authenticated user on every request.
4. Encryption: Personal data encrypted with user-scoped key. Even with DB access, data is unreadable without the specific user's key.
5. Testing: Automated IDOR test suite attempts cross-user access on every API endpoint.

### T2: Org Admin Reads Personal Conversations

**Description:** An organization administrator (client-side) attempts to read individual user conversations or personal work patterns.

| Attribute | Value |
|-----------|-------|
| **Likelihood** | High (frequent request from enterprise buyers; "I need to see what my employees are doing") |
| **Impact** | Critical (destroys trust model, violates core promise of PRD S7.1) |
| **Attack vectors** | Admin API abuse, database direct access, social engineering Play New team |

**Controls:**
1. **Architectural enforcement:** No admin API endpoint returns Tier 1 data. The endpoint does not exist.
2. **Database:** Admin role has no SELECT permission on `messages` table content. Admin can see aggregate statistics (count of messages, not content).
3. **Encryption:** Admin does not have access to user-scoped encryption keys. Key hierarchy prevents org admin from deriving user keys.
4. **Contractual:** DPA explicitly states org admins cannot access individual data. Onboarding includes explicit statement to org leadership.
5. **Audit:** Any attempt to query personal data with admin credentials is logged and flagged.
6. **UI:** Admin dashboard shows only aggregate metrics (active users, interaction counts, skill usage rates). No drill-down to individual level.

### T3: Play New Team Accesses Customer Data

**Description:** A Play New employee (engineer, advisor, support) reads customer personal conversations or organizational strategy documents.

| Attribute | Value |
|-----------|-------|
| **Likelihood** | Medium (insider threat, curiosity, debugging) |
| **Impact** | Critical (breach of trust, contractual violation, GDPR violation) |
| **Attack vectors** | Production database access, log files containing data, debugging tools, backup restoration |

**Controls:**
1. **No production DB access:** Engineers do not have direct database credentials in production. All access is via the application layer with audit logging.
2. **Encryption:** Even with DB access, personal data is encrypted with user-scoped keys that are not accessible to Play New engineers.
3. **Log sanitization:** Application logs NEVER contain message content, user conversations, or org context document content. Only metadata (IDs, timestamps, status codes).
4. **Access tiers for Play New staff:**
   - **Engineers:** Access to system metrics, error logs, infrastructure. NO access to customer data.
   - **Advisors:** Access to Tier 2 (org context -- they write it) and Tier 3 (anonymized patterns -- they analyze them). NO access to Tier 1.
   - **Support:** Access to user metadata (is the instance active? when was last message?) but NOT content.
5. **Background checks:** Play New team members with any data access path undergo background verification.
6. **Break-glass procedure:** Emergency access to production data requires two-person approval, is logged, and triggers automatic security review.

### T4: Prompt Injection via Forwarded Content

**Description:** An attacker crafts a malicious email or document that, when forwarded to the assistant by a user, causes the assistant to execute unintended actions (data exfiltration, privilege escalation, harmful output).

| Attribute | Value |
|-----------|-------|
| **Likelihood** | Medium (well-known LLM attack vector, forwarded content is untrusted) |
| **Impact** | High (data leakage, reputational damage, user harm) |
| **Attack vectors** | Crafted email with hidden instructions, malicious document attachments, injected system prompts |

**Controls:**
1. **Input classification:** Forwarded content is marked as `role: user` (untrusted) in the LLM context, never as `role: system`.
2. **System prompt hardening:** System prompt includes explicit instruction to treat forwarded content as untrusted data to be analyzed, not instructions to be followed.
3. **Output filtering:** Responses are scanned for anomalous patterns (e.g., attempts to output credentials, system prompts, or data from other users).
4. **Tool call restrictions:** The assistant cannot execute tools that modify external systems (Phase 0-1: read-only MCP). Tool calls to the audit system, admin APIs, or other user instances are blocked at the SDK level.
5. **Sandboxed execution:** LLM inference happens in the container. Even if prompt injection succeeds, the blast radius is limited to the single user's container.
6. **Content sanitization:** HTML, scripts, and executable content are stripped from forwarded emails before LLM processing.

### T5: Pattern Aggregation Reveals Individual Behavior

**Description:** Statistical analysis of anonymized Tier 3 patterns allows identification of individual users, especially in small teams.

| Attribute | Value |
|-----------|-------|
| **Likelihood** | Medium (well-known de-anonymization technique) |
| **Impact** | High (violates privacy promise, GDPR concern) |
| **Attack vectors** | Small group inference (team of 5, one outlier), temporal correlation, cross-reference with known external data |

**Controls:**
1. **Minimum 5-user threshold:** Enforced in database views. No pattern surfaces for groups < 5 users.
2. **Temporal blurring:** Weekly/monthly aggregation only. No daily patterns (prevents "who worked Tuesday night" attacks).
3. **Category generalization:** Specific tools/actions generalized to categories.
4. **Outlier suppression:** If one user's metric is > 2 standard deviations from the group mean, the pattern is suppressed or the outlier's contribution is capped.
5. **Differential privacy (Phase 2+):** Calibrated noise injection to prevent statistical inference. Epsilon parameter tuned per data type.
6. **Team size monitoring:** If a team drops below 5 active users, previously published patterns are flagged for review and potentially suppressed.

### T6: LLM Provider Trains on Customer Data

**Description:** The LLM provider (Anthropic, OpenAI) uses customer conversation data to train or improve their models.

| Attribute | Value |
|-----------|-------|
| **Likelihood** | Low (enterprise API terms typically exclude training) |
| **Impact** | High (breach of customer trust, competitive intelligence leakage) |
| **Attack vectors** | Default API terms, data retention by provider, logging |

**Controls:**
1. **Contractual:** Use enterprise API agreements that explicitly exclude training on customer data. Both Anthropic and OpenAI enterprise APIs have zero-retention options.
2. **Technical:** Use API endpoints with zero-data-retention (ZDR) flags where available. Verify with provider documentation.
3. **Audit:** Periodically verify provider compliance (request data handling attestation).
4. **Architecture:** Local inference path (Phase 2+) eliminates provider dependency for sensitive personal data.
5. **Documentation:** Maintain a register of which LLM providers receive which data categories, reviewed quarterly.

---

## Trust Boundaries

Play New has five trust boundaries, each with progressively broader access:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  TRUST BOUNDARY 5: Cross-Org (Platform Intelligence)                     │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │  TRUST BOUNDARY 4: Org Intelligence (Anonymized Patterns)         │   │
│  │  ┌─────────────────────────────────────────────────────────────┐  │   │
│  │  │  TRUST BOUNDARY 3: Pattern Logs (Pre-Anonymization)         │  │   │
│  │  │  ┌───────────────────────────────────────────────────────┐  │  │   │
│  │  │  │  TRUST BOUNDARY 2: Org Context (Shared Read-Only)     │  │  │   │
│  │  │  │  ┌─────────────────────────────────────────────────┐  │  │  │   │
│  │  │  │  │  TRUST BOUNDARY 1: User <-> Instance (Private)  │  │  │  │   │
│  │  │  │  │                                                  │  │  │  │   │
│  │  │  │  │  - Conversations (encrypted, user key)           │  │  │  │   │
│  │  │  │  │  - Personal memory (encrypted, user key)         │  │  │  │   │
│  │  │  │  │  - User skill preferences                        │  │  │  │   │
│  │  │  │  │  - Session data                                  │  │  │  │   │
│  │  │  │  └─────────────────────────────────────────────────┘  │  │  │   │
│  │  │  │                                                       │  │  │   │
│  │  │  │  - Strategic context docs (encrypted, org key)        │  │  │   │
│  │  │  │  - Team structure, industry context                   │  │  │   │
│  │  │  │  - MCP connector data (live queries)                  │  │  │   │
│  │  │  └───────────────────────────────────────────────────────┘  │  │   │
│  │  │                                                             │  │   │
│  │  │  - Raw pattern_logs (hashed user_id, categorical data)      │  │   │
│  │  │  - Pre-aggregation, pre-threshold-filter                    │  │   │
│  │  └─────────────────────────────────────────────────────────────┘  │   │
│  │                                                                   │   │
│  │  - Anonymized views (v_team_patterns, v_org_patterns)             │   │
│  │  - Insights (published intelligence)                              │   │
│  │  - Min 5-user threshold enforced                                  │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  - Cross-org benchmarks (v_cross_org_benchmarks)                         │
│  - Min 3-org threshold enforced                                          │
│  - No org attribution                                                    │
└──────────────────────────────────────────────────────────────────────────┘
```

### Data Flow Across Trust Boundaries

| Boundary Crossing | Direction | What Crosses | What Does NOT Cross | Enforcement |
|-------------------|-----------|-------------|---------------------|-------------|
| 1 -> 2 | Inbound (read) | Org context injected into assistant | Nothing flows out from 1 to 2 | Read-only access; no write path from instance to org context |
| 1 -> 3 | Outbound | Categorical metadata (pattern type, category, metric value, hashed user_id) | Conversation content, specific queries, personal details, real user_id | Anonymization engine; application-layer transformation |
| 3 -> 4 | Outbound | Aggregated patterns that meet 5-user threshold | Individual pattern_log rows, hashed user_ids, sub-threshold patterns | SQL view with HAVING clause; no direct table access |
| 4 -> 5 | Outbound | Patterns that meet 3-org threshold with generalized org attributes | Specific org_ids, exact org sizes, specific geographies | SQL view; org_id never in output |

---

## Security Controls Matrix

| Threat | Control | Implementation | Phase |
|--------|---------|---------------|-------|
| **T1: Cross-user access** | Container isolation | Docker containers per user instance | 0 |
| | User-scoped DB queries | Mandatory `user_instance_id` in WHERE clause | 0 |
| | User-scoped encryption | User-derived encryption key for Tier 1 data | 0 |
| | IDOR test suite | Automated tests on every API endpoint | 0 |
| | PostgreSQL RLS | Row-Level Security policies on personal tables | 1 |
| **T2: Admin reads personal** | No admin API for personal data | Endpoint does not exist | 0 |
| | Key hierarchy | Admin cannot derive user encryption keys | 0 |
| | Contractual DPA | Explicit prohibition in data processing agreement | 0 |
| | Admin audit logging | All admin actions logged and monitored | 0 |
| **T3: Play New accesses data** | No production DB access | Application-layer-only access with audit | 0 |
| | Encryption at rest | Data unreadable without keys | 0 |
| | Log sanitization | No content in application logs | 0 |
| | Break-glass procedure | Two-person approval for emergency access | 0 |
| | Background checks | For team members with any data access path | 1 |
| **T4: Prompt injection** | Input classification | Forwarded content marked as untrusted | 0 |
| | System prompt hardening | Explicit untrusted-data instructions | 0 |
| | Read-only MCP | No write operations possible via tools | 0 |
| | Container sandboxing | Blast radius limited to single user instance | 0 |
| | Content sanitization | HTML/script stripping from forwarded content | 0 |
| | Output filtering | Anomaly detection on responses | 1 |
| **T5: De-anonymization** | 5-user threshold | Enforced in DB views | 0 |
| | Temporal blurring | Weekly/monthly only | 0 |
| | Category generalization | Tool/action generalization | 0 |
| | Outlier suppression | Cap extreme values in aggregation | 1 |
| | Differential privacy | Noise injection | 2 |
| **T6: LLM training** | Enterprise API terms | Zero-data-retention agreements | 0 |
| | Provider verification | Quarterly compliance check | 1 |
| | Local inference | Personal data processed locally | 2 |

---

## Authentication

### SSO Integration (Per Organization)

Each organization connects Play New to their identity provider via SAML 2.0 or OIDC.

```
┌──────────┐     ┌──────────────┐     ┌────────────────┐
│  User    │────>│ Play New     │────>│ Org IdP        │
│ (Browser)│     │ Auth Service │     │ (Okta/Azure AD/│
│          │<────│              │<────│  Google)        │
│          │     │ JWT issued   │     │                │
└──────────┘     └──────────────┘     └────────────────┘
```

**SSO Configuration per org:**

```json
{
    "org_id": "org_123",
    "auth_provider": "oidc",
    "issuer_url": "https://orgname.okta.com",
    "client_id": "play_new_client_id",
    "scopes": ["openid", "profile", "email"],
    "attribute_mapping": {
        "user_id": "sub",
        "email": "email",
        "name": "name",
        "department": "custom:department"
    }
}
```

### Slack / Teams Identity for End Users

For the primary interaction channel (Slack/Teams), identity is established through the platform's own authentication:

1. User sends a message in their Slack DM with the Play New bot.
2. Slack provides the user's Slack ID and workspace ID (verified by Slack's own auth).
3. Play New maps `(workspace_id, slack_user_id)` -> `user_instance_id` via the `user_instances` table.
4. No additional login required for chat interactions (SSO trust delegation to Slack/Teams).

**Web dashboard access** requires full SSO authentication (browser-based OIDC flow).

### Token Format

Play New issues JWTs for authenticated sessions:

```json
{
    "sub": "user_instance_id",
    "org_id": "org_123",
    "team_id": "team_456",
    "role": "user",
    "platform": "slack",
    "platform_user_id": "U0123ABCDEF",
    "iat": 1711929600,
    "exp": 1711933200,
    "iss": "play-new-auth"
}
```

Token lifetime: 1 hour. Refresh via platform re-authentication or SSO session.

---

## Authorization (RBAC)

### Role Definitions

| Role | Description | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Admin Functions |
|------|-------------|--------|--------|--------|--------|----------------|
| `user` | Individual end user | R/W/D (own) | R | - | - | - |
| `team_lead` | Department/team manager | R/W/D (own) | R | R (own team) | - | View team stats |
| `leadership` | C-suite, VP, strategy | R/W/D (own) | R | R (all teams) | R | View org intel dashboard |
| `advisor` | Play New advisor | - | R/W/U | R (all teams) | R | Update org context, review insights |
| `admin` | Org administrator | - | R/U | R (all teams) | R | User management, connection config, audit log access |
| `platform_admin` | Play New engineer (break-glass) | - | - | - | R/W | System configuration, incident response |

### Role Assignment

- `user` -- default role, assigned at instance creation
- `team_lead` -- assigned by org admin or advisor during onboarding (maps to team structure)
- `leadership` -- assigned by org admin, verified by advisor
- `advisor` -- assigned by Play New platform admin, scoped to specific organizations
- `admin` -- assigned during org onboarding, typically 1-2 per organization
- `platform_admin` -- internal Play New role, requires two-person approval

### Permission Enforcement

```typescript
// Authorization middleware
interface AuthContext {
    orgId: string;
    userInstanceId: string;
    teamId: string | null;
    role: 'user' | 'team_lead' | 'leadership' | 'advisor' | 'admin' | 'platform_admin';
}

// Example: accessing team patterns (Tier 3)
function authorizeTeamPatterns(auth: AuthContext, targetTeamId: string): boolean {
    switch (auth.role) {
        case 'user':
            return false;  // users cannot see Tier 3 data
        case 'team_lead':
            return auth.teamId === targetTeamId;  // own team only
        case 'leadership':
        case 'advisor':
        case 'admin':
            return auth.orgId === targetOrgId;  // any team in their org
        case 'platform_admin':
            return false;  // platform admins use break-glass, not normal access
    }
}
```

---

## Phase 0 Scope

**Included in Phase 0:**
- Container isolation (inherited from nanoclaw)
- User-scoped database queries (mandatory `user_instance_id` filtering)
- Encryption at rest with user-scoped keys (Tier 1) and org-scoped keys (Tier 2, 3)
- SSO integration (SAML/OIDC) per design partner
- Slack identity mapping for chat interactions
- RBAC with roles: user, advisor, admin
- System prompt hardening against prompt injection
- Read-only MCP connectors
- Audit logging for security events
- Log sanitization (no content in logs)
- 5-user aggregation threshold in views

**Deferred to Phase 1:**
- PostgreSQL Row-Level Security
- IDOR automated test suite (manual testing in Phase 0)
- Output filtering for LLM responses
- Outlier suppression in pattern aggregation
- Team lead and leadership roles (Phase 0 uses user + advisor + admin only)
- MFA requirement
- Penetration testing
- SOC 2 Type I preparation

**Deferred to Phase 2+:**
- Differential privacy
- Local inference for personal data
- Hardware key authentication option
- Full SOC 2 Type II + ISO 27001

---

## Open Questions

- **[OQ-SEC-001]** Should we require MFA for admin/advisor roles from Phase 0, or is SSO sufficient given that design partners are trusted organizations?
- **[OQ-SEC-002]** For the break-glass procedure, what is the approval mechanism? Slack-based approval workflow, or a separate tool (PagerDuty, etc.)?
- **[OQ-SEC-003]** How do we handle the scenario where an org admin insists on seeing individual user data "for compliance reasons"? Our answer is "no" per the PRD, but we need a pre-prepared response.
- **[OQ-SEC-004]** Should container network policies block ALL outbound traffic except to known API endpoints, or allow general HTTPS? Stricter is safer but may break unexpected MCP server needs.
- **[OQ-SEC-005]** Nanoclaw's credential filtering mechanism -- do we need to extend it for multi-tenant scenarios, or is the existing implementation sufficient?
