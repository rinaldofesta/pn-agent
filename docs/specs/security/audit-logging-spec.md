# Audit Logging Specification

**Version:** 0.1.0
**Last Updated:** 2026-02-25
**Status:** Draft -- Pre-Phase 0 Architecture
**Owner:** Rinaldo Festa

---

## Context

Play New handles personal work data under GDPR jurisdiction and promises privacy separation between individual users and their organization. Audit logging is the mechanism that makes these promises verifiable. It provides:

1. **User trust:** Users can see exactly who accessed their data and when.
2. **Org compliance:** Organization DPOs and works councils can audit data flows.
3. **Regulatory compliance:** GDPR requires records of processing activities (Article 30).
4. **Security incident response:** Forensic trail for investigating breaches.
5. **Tamper detection:** Hash chain ensures logs cannot be retroactively modified.

This specification defines what is logged, at what visibility level, retention policies, and the implementation details.

Related documents:
- [Database Schema](../data/database-schema.md) -- `audit_logs` table definition
- [Security Model](./security-model.md) -- threat model, access controls
- [GDPR Compliance Spec](./gdpr-compliance-spec.md) -- data subject rights
- [Data Classification](../data/data-classification.md) -- data tier definitions

---

## What Is Logged

### User Actions

Actions initiated by end users within their personal instance.

| Action Code | Description | Target Type | Details | Visibility |
|-------------|-------------|-------------|---------|------------|
| `user.message_sent` | User sent a message to assistant | `message` | `{ chat_id }` (no content) | User-visible |
| `user.message_deleted` | User deleted a specific message | `message` | `{ chat_id, message_id }` | User-visible |
| `user.data_export` | User exported their personal data | `user_instance` | `{ format, size_bytes }` | User-visible, Org-visible (action only, no content) |
| `user.data_delete` | User requested deletion of all their data | `user_instance` | `{ deletion_type: 'full' }` | User-visible, Org-visible, Platform-visible |
| `user.skill_activate` | User activated a skill | `skill` | `{ skill_id, skill_name }` | User-visible |
| `user.skill_deactivate` | User deactivated a skill | `skill` | `{ skill_id, skill_name }` | User-visible |
| `user.skill_feedback` | User provided feedback on a skill | `skill` | `{ skill_id, rating }` | User-visible |
| `user.forward_content` | User forwarded content to assistant | `message` | `{ content_type, source_platform }` (no content) | User-visible |
| `user.access_mode_change` | User changed access mode | `user_instance` | `{ from, to }` | User-visible |
| `user.mcp_connect` | User connected a personal data source | `mcp_connection` | `{ connector_type }` | User-visible |
| `user.mcp_disconnect` | User disconnected a personal data source | `mcp_connection` | `{ connector_type }` | User-visible |
| `user.memory_forget` | User asked assistant to forget something | `message` | `{ scope: 'message' \| 'conversation' \| 'topic' }` | User-visible |
| `user.login` | User authenticated | `session` | `{ platform, method }` | User-visible |

### System Actions

Actions performed by the system (anonymization engine, scheduled tasks, intelligence pipeline).

| Action Code | Description | Target Type | Details | Visibility |
|-------------|-------------|-------------|---------|------------|
| `system.pattern_emitted` | Pattern extracted from user activity | `pattern_log` | `{ pattern_type, category_l1 }` (no user attribution) | Platform-visible |
| `system.insight_generated` | Intelligence insight produced | `insight` | `{ insight_id, stream, confidence }` | Org-visible |
| `system.insight_published` | Insight published to leadership | `insight` | `{ insight_id, stream }` | Org-visible |
| `system.skill_proposed` | System proposed a new skill to user | `skill` | `{ skill_id, source: 'auto_generated' }` | User-visible |
| `system.mcp_data_access` | MCP connector queried external data | `mcp_connection` | `{ connector_type, tool_name, scope }` | Org-visible |
| `system.mcp_health_check` | Connector health check | `mcp_connection` | `{ connector_type, status }` | Org-visible |
| `system.scheduled_task_run` | Scheduled task executed | `scheduled_task` | `{ task_type, status }` | Platform-visible |
| `system.key_rotation` | Encryption key rotated | `organization` | `{ key_type, old_version, new_version }` | Platform-visible |
| `system.backup_completed` | Database backup completed | `organization` | `{ size_bytes, duration_s }` | Platform-visible |

### Admin Actions

Actions performed by org administrators.

| Action Code | Description | Target Type | Details | Visibility |
|-------------|-------------|-------------|---------|------------|
| `admin.user_invite` | Admin invited a user | `user_instance` | `{ platform_user_id, team_id }` | Org-visible |
| `admin.user_deactivate` | Admin deactivated a user instance | `user_instance` | `{ instance_id, reason }` | Org-visible |
| `admin.user_reactivate` | Admin reactivated a user instance | `user_instance` | `{ instance_id }` | Org-visible |
| `admin.team_create` | Admin created a team | `team` | `{ team_id, name, function }` | Org-visible |
| `admin.team_update` | Admin updated team details | `team` | `{ team_id, changes }` | Org-visible |
| `admin.mcp_configure` | Admin configured a data connection | `mcp_connection` | `{ connector_type, scope }` | Org-visible |
| `admin.mcp_disable` | Admin disabled a data connection | `mcp_connection` | `{ connector_type }` | Org-visible |
| `admin.org_settings_change` | Admin changed org settings | `organization` | `{ setting, old_value, new_value }` | Org-visible |
| `admin.audit_log_export` | Admin exported audit logs | `audit_log` | `{ date_range, format }` | Org-visible, Platform-visible |

### Advisor Actions

Actions performed by Play New advisors.

| Action Code | Description | Target Type | Details | Visibility |
|-------------|-------------|-------------|---------|------------|
| `advisor.context_update` | Advisor updated org context document | `org_context_doc` | `{ doc_type, version }` | Org-visible |
| `advisor.skill_assign` | Advisor assigned a skill to user(s) | `skill` | `{ skill_id, target_count }` (not individual user IDs) | Org-visible |
| `advisor.insight_review` | Advisor reviewed an insight | `insight` | `{ insight_id, action: 'approved' \| 'modified' \| 'rejected' }` | Org-visible |
| `advisor.intelligence_brief` | Advisor produced intelligence brief | `insight` | `{ brief_type, org_id }` | Org-visible |

### Security Events

Security-relevant events that trigger alerts.

| Action Code | Description | Target Type | Details | Visibility |
|-------------|-------------|-------------|---------|------------|
| `security.auth_failure` | Authentication failed | `session` | `{ platform, user_id_attempted, reason }` | Platform-visible |
| `security.auth_failure_threshold` | Multiple auth failures (>5 in 15 min) | `session` | `{ user_id_attempted, failure_count }` | Platform-visible, Alert |
| `security.unauthorized_access` | Attempted access to unauthorized resource | `*` | `{ resource, required_role, actual_role }` | Platform-visible, Alert |
| `security.cross_user_attempt` | Attempted cross-user data access | `user_instance` | `{ requester_id, target_id, endpoint }` | Platform-visible, Alert |
| `security.break_glass` | Emergency production access | `*` | `{ engineer_id, approver_ids, reason, scope }` | Platform-visible, Alert |
| `security.key_access` | Encryption key accessed | `organization` | `{ key_type, accessor }` | Platform-visible |
| `security.data_breach_suspected` | Anomalous data access pattern detected | `*` | `{ pattern, affected_scope }` | Platform-visible, Alert |

---

## Log Visibility Levels

### User-Visible

Accessible to the individual user for their own actions only. Presented in the assistant interface as "What my assistant knows about me" transparency view.

**Access:** User can view via `/my-audit-log` or transparency dashboard.
**Scope:** Only the user's own actions and system actions on their data.
**Content:** Action descriptions in human-readable form. No technical details.

### Org-Visible

Accessible to org admins and DPOs. Used for compliance reporting and data processing oversight.

**Access:** Org admin dashboard, audit log export.
**Scope:** All actions within the organization EXCEPT individual user message content (which is Tier 1).
**Content:** Action codes, timestamps, actor types, aggregate statistics. NEVER individual message content.

### Platform-Visible

Accessible to Play New platform administrators. Used for system operations, security monitoring, and incident response.

**Access:** Internal monitoring dashboard, SIEM integration.
**Scope:** All actions across all organizations.
**Content:** Full audit detail including system internals.

---

## Retention Policy

| Log Category | Retention Period | Basis |
|-------------|-----------------|-------|
| **User action logs** | Active account + 90 days after deletion | User trust (they can review their history) |
| **Org admin/advisor action logs** | Org contract period + 1 year | Compliance, DPA obligations |
| **System action logs** | 2 years | Operational debugging, pattern analysis |
| **Security event logs** | 7 years | Regulatory compliance (SOC 2, ISO 27001 preparation) |
| **Break-glass access logs** | 7 years | Security audit trail |

### Retention Enforcement

```sql
-- Scheduled job: purge expired audit logs
-- Run daily at 03:00 UTC
DELETE FROM audit_logs
WHERE
    -- User logs: 90 days after user deletion
    (actor_type = 'user'
     AND user_id IN (SELECT user_id FROM user_instances WHERE status = 'deleted')
     AND timestamp < now() - interval '90 days')
    -- System logs: 2 years
    OR (actor_type = 'system'
        AND action NOT LIKE 'security.%'
        AND timestamp < now() - interval '2 years')
    -- Note: security logs and org logs are NOT auto-purged.
    -- They are purged manually after the retention period by platform admin.
;
```

**Important:** Purging audit logs itself generates an audit log entry (`system.audit_purge`).

---

## Implementation

### Structured JSON Format

Every audit log entry follows this JSON structure:

```json
{
    "log_id": "550e8400-e29b-41d4-a716-446655440000",
    "org_id": "org_abc123",
    "user_id": "user_def456",
    "actor_type": "user",
    "action": "user.skill_activate",
    "target_type": "skill",
    "target_id": "skill_pipeline_risk_001",
    "details": {
        "skill_name": "Pipeline Risk Scan",
        "skill_category": "sales"
    },
    "ip_address": "192.168.1.100",
    "user_agent": "Slack-Bot/1.0",
    "timestamp": "2026-04-15T14:23:45.123Z",
    "prev_hash": "a1b2c3d4e5f6...",
    "entry_hash": "f6e5d4c3b2a1..."
}
```

### Append-Only Table

The `audit_logs` table is append-only. This is enforced at multiple levels:

**Database level (PostgreSQL):**

```sql
-- Revoke UPDATE and DELETE permissions
REVOKE UPDATE, DELETE ON audit_logs FROM app_user;
REVOKE UPDATE, DELETE ON audit_logs FROM app_admin;

-- Only the purge role (used by scheduled cleanup job) can delete
GRANT DELETE ON audit_logs TO audit_purge_role;

-- Trigger to prevent updates (defense-in-depth)
CREATE OR REPLACE FUNCTION prevent_audit_update()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs table is append-only. Updates are not permitted.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER no_audit_update
    BEFORE UPDATE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_update();
```

**Application level:**

```typescript
// src/audit/audit-service.ts

class AuditService {
    // Only method: append. No update, no delete.
    async log(entry: AuditEntry): Promise<void> {
        const prevHash = await this.getLastHash(entry.org_id);
        const entryHash = this.computeHash(prevHash, entry);

        await this.db.execute(
            `INSERT INTO audit_logs
             (log_id, org_id, user_id, actor_type, action, target_type, target_id,
              details, ip_address, user_agent, timestamp, prev_hash, entry_hash)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [
                entry.logId, entry.orgId, entry.userId, entry.actorType,
                entry.action, entry.targetType, entry.targetId,
                JSON.stringify(entry.details), entry.ipAddress, entry.userAgent,
                entry.timestamp, prevHash, entryHash,
            ],
        );
    }

    // No update() method exists.
    // No delete() method exists (except for the purge job).
}
```

### Hash Chain for Tamper Detection

Each audit log entry includes a hash of itself and the previous entry, forming a chain:

```typescript
import { createHash } from 'crypto';

function computeEntryHash(prevHash: string | null, entry: AuditEntry): string {
    const payload = [
        prevHash || 'GENESIS',
        entry.logId,
        entry.timestamp,
        entry.action,
        entry.actorType,
        entry.orgId || '',
        entry.userId || '',
        entry.targetType || '',
        entry.targetId || '',
        JSON.stringify(entry.details),
    ].join('|');

    return createHash('sha256').update(payload).digest('hex');
}
```

**Verification:** A scheduled integrity check job verifies the hash chain daily:

```typescript
async function verifyAuditChain(orgId: string): Promise<boolean> {
    const logs = await db.query(
        'SELECT * FROM audit_logs WHERE org_id = $1 ORDER BY timestamp ASC',
        [orgId],
    );

    let prevHash: string | null = null;
    for (const log of logs) {
        const expectedHash = computeEntryHash(prevHash, log);
        if (expectedHash !== log.entry_hash) {
            // Tamper detected! Alert security team.
            await alertSecurityTeam({
                type: 'audit_chain_broken',
                orgId,
                logId: log.log_id,
                expectedHash,
                actualHash: log.entry_hash,
            });
            return false;
        }
        prevHash = log.entry_hash;
    }
    return true;
}
```

**Per-org chains:** Each organization has its own hash chain (the `prev_hash` references the previous entry for that `org_id`). This allows per-org verification without scanning the entire table.

---

## Audit Log API Endpoints

### User-Facing

```
GET /api/v1/me/audit-log
    ?from=2026-04-01&to=2026-04-30
    &action=user.*
    &limit=50&offset=0

Response:
{
    "entries": [
        {
            "timestamp": "2026-04-15T14:23:45Z",
            "description": "You activated the Pipeline Risk Scan skill",
            "action": "user.skill_activate",
            "details": { "skill_name": "Pipeline Risk Scan" }
        },
        ...
    ],
    "total": 127,
    "hasMore": true
}
```

### Org Admin

```
GET /api/v1/orgs/{org_id}/audit-log
    ?from=2026-04-01&to=2026-04-30
    &action=admin.*,advisor.*,system.insight_*
    &actor_type=admin,advisor,system
    &limit=100&offset=0

Response:
{
    "entries": [...],
    "total": 543,
    "integrity": {
        "lastVerified": "2026-04-15T03:00:00Z",
        "chainValid": true
    }
}
```

### Export

```
POST /api/v1/orgs/{org_id}/audit-log/export
{
    "from": "2026-01-01",
    "to": "2026-04-30",
    "format": "csv",  // or "json"
    "categories": ["admin", "advisor", "security"]
}

Response:
{
    "exportId": "exp_123",
    "status": "processing",
    "estimatedSizeBytes": 1048576,
    "downloadUrl": null  // populated when ready
}
```

---

## Phase 0 Scope

**Included in Phase 0:**
- Full audit log table with hash chain
- User action logging (message sent, data export, data delete, skill activate/deactivate)
- Admin action logging (user invite, team management)
- Advisor action logging (context updates, skill assignments)
- Security event logging (auth failures, unauthorized access attempts)
- User-facing audit log API endpoint
- Org admin audit log export (CSV)
- Append-only enforcement (database triggers + application layer)
- Basic hash chain implementation

**Deferred to Phase 1:**
- Daily hash chain integrity verification job
- Org admin audit dashboard UI
- SIEM integration for security events
- Alert rules for security events
- Automated retention purge job

**Deferred to Phase 2+:**
- Third-party audit trail verification service
- Real-time security event streaming
- SOC 2 compliance reporting templates

---

## Open Questions

- **[OQ-AUD-001]** Should we log `system.pattern_emitted` for every pattern extraction (high volume) or only aggregate periodic summaries? High-volume logging is more thorough but costs more storage.
- **[OQ-AUD-002]** For the hash chain, should we use a per-org chain or a global chain? Per-org is more practical for verification but doesn't detect cross-org tampering.
- **[OQ-AUD-003]** Should users see `system.mcp_data_access` events in their personal audit log? This would show them when the assistant queried the CRM on their behalf, increasing transparency.
- **[OQ-AUD-004]** What is the target for audit log storage cost? At 150 users generating ~50 events/day each, Phase 0 produces ~7,500 events/day or ~225K/month. Retention policies matter for cost.
