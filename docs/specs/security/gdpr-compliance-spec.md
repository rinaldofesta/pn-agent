# GDPR Compliance Specification

**Version:** 0.1.0
**Last Updated:** 2026-02-25
**Status:** Draft -- Pre-Phase 0 Architecture
**Owner:** Rinaldo Festa

---

## Context

Play New operates exclusively in EU jurisdiction (Phase 0-1) and handles personal data as defined by GDPR Article 4(1). The platform processes three categories of personal data:

1. **Direct personal data (Tier 1):** User conversations, work patterns, preferences -- clearly personal data.
2. **Pseudonymized organizational data (Tier 3):** Aggregated patterns derived from personal behavior -- pseudonymized but still derived from personal data under GDPR.
3. **Anonymized benchmark data (Tier 4):** Truly anonymized data that falls outside GDPR scope (Recital 26), provided the anonymization is irreversible.

Play New acts as a **data processor** on behalf of the organization (the data controller). The relationship is governed by a Data Processing Agreement (DPA) per GDPR Article 28.

This specification defines how Play New implements each data subject right, the legal basis for processing, and the operational procedures for GDPR compliance.

Related documents:
- [Data Classification](../data/data-classification.md)
- [Encryption Spec](./encryption-spec.md)
- [Audit Logging Spec](./audit-logging-spec.md)
- [Security Model](./security-model.md)
- [Database Schema](../data/database-schema.md)

---

## Data Subject Rights

### Right of Access (Article 15)

**What:** Users can request a copy of all personal data Play New holds about them.

**Implementation:**

```
User Action:
  1. User sends "/my-data" or "/export" to their assistant
     OR
     User clicks "Export My Data" in the web dashboard

System Response:
  1. System queries all Tier 1 data for this user_instance_id:
     - messages (decrypted)
     - personal memory entries (from vector DB)
     - user_skills (skill assignments and feedback)
     - sessions (session history)
     - user_instances settings and preferences
     - audit_logs for this user
  2. Package into JSON (or CSV) archive
  3. Encrypt archive with a temporary download key
  4. Provide secure download link (valid 24 hours)
  5. Log: audit_logs entry (action: 'user.data_export')
```

**API Endpoint:**

```
POST /api/v1/me/data-export
{
    "format": "json",           // "json" or "csv"
    "include": [                // optional filter, default: all
        "conversations",
        "memory",
        "skills",
        "sessions",
        "preferences",
        "audit_log"
    ]
}

Response:
{
    "exportId": "exp_abc123",
    "status": "processing",
    "estimatedCompletionMinutes": 5,
    "webhookUrl": "/api/v1/me/data-export/exp_abc123"
}

-- When ready:
GET /api/v1/me/data-export/exp_abc123

Response:
{
    "exportId": "exp_abc123",
    "status": "ready",
    "downloadUrl": "https://secure.playnew.ai/exports/exp_abc123?token=...",
    "expiresAt": "2026-04-16T14:23:45Z",
    "sizeMb": 12.4,
    "format": "json"
}
```

**Export Format (JSON):**

```json
{
    "export_metadata": {
        "user_instance_id": "inst_abc123",
        "org_name": "Acme Corp",
        "exported_at": "2026-04-15T14:23:45Z",
        "format_version": "1.0"
    },
    "conversations": [
        {
            "chat_id": "chat_001",
            "title": "Email analysis - client proposal",
            "created_at": "2026-04-01T09:15:00Z",
            "messages": [
                {
                    "role": "user",
                    "content": "Can you analyze this email from...",
                    "timestamp": "2026-04-01T09:15:00Z"
                },
                {
                    "role": "assistant",
                    "content": "I've analyzed the email...",
                    "timestamp": "2026-04-01T09:15:23Z"
                }
            ]
        }
    ],
    "skills": [
        {
            "skill_name": "Pipeline Risk Scan",
            "status": "active",
            "assigned_at": "2026-03-15",
            "uses": 12,
            "feedback_score": 0.87
        }
    ],
    "preferences": {
        "notification_frequency": "daily",
        "language": "en",
        "access_mode": "forward"
    },
    "audit_log": [
        {
            "timestamp": "2026-04-15T14:23:45Z",
            "action": "user.skill_activate",
            "description": "Activated Pipeline Risk Scan"
        }
    ]
}
```

**SLA:** Export available within 30 minutes for standard accounts, 24 hours for large data volumes. GDPR allows up to 1 month, but Play New targets same-day for user trust.

---

### Right to Rectification (Article 16)

**What:** Users can correct inaccurate personal data.

**Implementation:**

Rectifiable data in Play New:
- User profile information (name, role_category, team_id) -- corrected via admin or self-service
- User preferences -- corrected by user directly
- Specific memories -- user can ask assistant to "forget this" or "that's not correct"

Non-rectifiable (by design):
- Conversation history -- messages are immutable records. User can delete but not edit sent messages.
- Audit logs -- immutable by design (append-only)
- Pattern logs -- anonymized, cannot be attributed back to correct

**API:**

```
PATCH /api/v1/me/profile
{
    "role_category": "manager",    // corrected from "analyst"
    "settings": {
        "language": "it"           // corrected from "en"
    }
}
```

For memory correction, the user interacts with the assistant:
- "That's not correct -- I actually work on the EMEA region, not APAC"
- The assistant updates its personal memory (vector DB), replacing the incorrect entry
- Audit log records the correction

---

### Right to Erasure (Article 17) -- "Right to be Forgotten"

**What:** Users can request deletion of all their personal data.

**Implementation: Hard delete cascade.**

```
User Action:
  1. User sends "/delete-my-data" to assistant
     OR
     User clicks "Delete All My Data" in web dashboard
  2. Confirmation prompt: "This will permanently delete all your conversations,
     memory, skills, and preferences. This cannot be undone. Type 'DELETE' to confirm."
  3. User confirms

System Response (automated cascade):
  1. DELETE FROM messages WHERE user_instance_id = ?
  2. DELETE FROM user_skills WHERE user_instance_id = ?
  3. Delete personal memory namespace from vector DB
  4. DELETE FROM sessions WHERE user_instance_id = ?
  5. Delete user encryption salt from secrets manager
  6. UPDATE user_instances SET status = 'deleted', platform_user_id = '[REDACTED]' WHERE instance_id = ?
  7. INSERT INTO audit_logs (action: 'user.data_delete', details: { deletion_type: 'full' })
  8. Notify org admin: "A user has exercised their right to erasure" (no user identity disclosed)

NOT deleted:
  - pattern_logs entries (already anonymized; user_id is a one-way hash; cannot be linked back)
  - audit_log entries (retained per retention policy, but user_id is redacted after deletion)
  - Cross-org benchmarks (irreversibly anonymized)
```

**API:**

```
POST /api/v1/me/data-delete
{
    "confirmation": "DELETE",
    "reason": "leaving_organization"     // optional
}

Response:
{
    "status": "processing",
    "deletionId": "del_xyz789",
    "estimatedCompletionMinutes": 10,
    "affectedData": {
        "conversations": 47,
        "messages": 823,
        "skills": 12,
        "sessions": 156,
        "memoryEntries": 2341
    }
}
```

**Post-deletion verification:**

```sql
-- Verification query (run after deletion completes)
SELECT COUNT(*) FROM messages WHERE user_instance_id = 'inst_abc123';         -- expect: 0
SELECT COUNT(*) FROM user_skills WHERE user_instance_id = 'inst_abc123';      -- expect: 0
SELECT COUNT(*) FROM sessions WHERE user_instance_id = 'inst_abc123';         -- expect: 0
SELECT status FROM user_instances WHERE instance_id = 'inst_abc123';          -- expect: 'deleted'
```

**SLA:** Deletion completed within 24 hours. GDPR allows up to 1 month.

---

### Right to Data Portability (Article 20)

**What:** Users can receive their data in a structured, commonly used, machine-readable format.

**Implementation:** Same as Right of Access export, with two format options:

| Format | Structure | Use Case |
|--------|-----------|----------|
| **JSON** | Full structured export (see above) | Technical users, import into other systems |
| **CSV** | Flat tables per data type | Spreadsheet analysis, non-technical users |

**CSV Export Structure:**

```
export/
  conversations.csv     -- chat_id, title, created_at, message_count
  messages.csv          -- message_id, chat_id, role, content, timestamp
  skills.csv            -- skill_name, status, uses, feedback_score
  preferences.csv       -- key, value
  audit_log.csv         -- timestamp, action, description
```

**Interoperability note:** The JSON export format is documented publicly so that users (or their new providers) can parse and import the data.

---

### Right to Restrict Processing (Article 18)

**What:** Users can request that their data is stored but not processed.

**Implementation:**

```
User Action:
  User sends "/pause-my-assistant" or clicks "Pause Processing"

System Response:
  1. UPDATE user_instances SET status = 'paused' WHERE instance_id = ?
  2. Container is stopped (no new messages processed)
  3. Existing data is retained (encrypted, at rest)
  4. Pattern extraction for this user is halted
  5. User can resume at any time ("/resume-my-assistant")
  6. Audit log entry recorded
```

While paused:
- No new messages are processed
- No patterns are extracted
- Existing data remains encrypted and accessible to the user (for export or deletion)
- The user's assistant does not respond to messages (returns: "Your assistant is paused. Send /resume to reactivate.")

---

## Legal Basis for Processing

| Data Category | Legal Basis (GDPR Article 6) | Details |
|---------------|------------------------------|---------|
| **Tier 1: Personal conversations** | Consent (Art. 6(1)(a)) | Explicit opt-in during onboarding. User consents to assistant processing their messages. Consent is specific, informed, and freely given. |
| **Tier 1: Work patterns (personal)** | Consent (Art. 6(1)(a)) | Same consent as above. Patterns derived from conversations the user explicitly shares. |
| **Tier 2: Org context injection** | Legitimate interest (Art. 6(1)(f)) + DPA | Organization has legitimate interest in providing strategic context to assistants. User is informed during onboarding. |
| **Tier 3: Pattern collection** | Consent (Art. 6(1)(a)) | Separate consent for pattern collection. User can opt out of pattern extraction while still using the assistant. |
| **Tier 3: Anonymized aggregation** | Legitimate interest (Art. 6(1)(f)) | Aggregation of already-consented patterns into anonymized intelligence. Passes GDPR legitimate interest balancing test (user privacy protected by anonymization). |
| **Tier 4: Cross-org benchmarks** | Legitimate interest (Art. 6(1)(f)) | Truly anonymized data (Recital 26 -- not personal data). Covered in DPA. |
| **Audit logging** | Legal obligation (Art. 6(1)(c)) + Legitimate interest (Art. 6(1)(f)) | GDPR Article 30 record-keeping obligation. Security legitimate interest. |

### Consent Collection

During user onboarding, the assistant collects two separate consents:

**Consent 1 -- Personal Assistant Processing:**
> "I understand that Play New will process the messages and content I share with my assistant to provide personalized help. My conversations are private and encrypted -- only I can access them. I can export or delete my data at any time."

**Consent 2 -- Pattern Collection (optional, separate):**
> "I understand that anonymized categorical patterns (like 'how much time is spent on reporting') may be derived from my usage and aggregated with at least 4 other users to produce organizational intelligence. No individual conversations or personal details are shared. I can opt out of this at any time."

Consent 2 is optional. Users who decline still get the full assistant experience -- their data simply does not feed into Tier 3 patterns.

**Consent records are stored:**

```sql
-- Consent tracking (in user_instances.settings JSONB)
{
    "consents": {
        "personal_processing": {
            "granted": true,
            "timestamp": "2026-04-01T09:00:00Z",
            "version": "1.0"
        },
        "pattern_collection": {
            "granted": true,
            "timestamp": "2026-04-01T09:01:00Z",
            "version": "1.0"
        }
    }
}
```

---

## DPO Support

### Audit Dashboard

The DPO (Data Protection Officer) of a client organization has access to a compliance dashboard:

| Dashboard Section | Content |
|-------------------|---------|
| **Processing Activities** | List of all data processing activities with legal basis |
| **Data Flow Diagram** | Visual representation of data flows (auto-generated from system config) |
| **Consent Status** | Aggregate consent rates (X% consented to patterns, Y% personal only) |
| **Data Subject Requests** | Log of all export, delete, restrict requests and their status |
| **Audit Trail** | Filtered audit log view (org-visible events) |
| **Retention Status** | Data retention periods and upcoming purge dates |
| **Sub-Processor List** | List of third parties processing data (LLM providers, cloud infrastructure) |

### Data Flow Diagram (Auto-Generated)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  DATA FLOW: Personal Assistant Processing                                │
│                                                                          │
│  User (Slack/Teams)                                                      │
│       │                                                                  │
│       ▼                                                                  │
│  [Forward Content] ──> [Play New Platform (EU-central-1)]                │
│       │                      │                                           │
│       │                      ├──> [Claude API (Anthropic)]               │
│       │                      │    Purpose: LLM inference                 │
│       │                      │    Data: Message content (not stored      │
│       │                      │          by Anthropic per ZDR terms)      │
│       │                      │                                           │
│       │                      ├──> [PostgreSQL (EU-central-1)]            │
│       │                      │    Purpose: Conversation storage          │
│       │                      │    Data: Encrypted messages (AES-256)     │
│       │                      │                                           │
│       │                      ├──> [Vector DB (EU-central-1)]             │
│       │                      │    Purpose: Personal memory               │
│       │                      │    Data: Encrypted embeddings             │
│       │                      │                                           │
│       │                      └──> [Anonymization Engine]                 │
│       │                           Purpose: Pattern extraction            │
│       │                           Output: Categorical patterns only      │
│       │                           (Tier 3, min 5 users)                  │
│       │                                                                  │
│       ▼                                                                  │
│  [Response to User]                                                      │
│                                                                          │
│  Legal Basis: User consent (Art. 6(1)(a))                                │
│  Data Residency: EU only                                                 │
│  Encryption: AES-256-GCM at rest, TLS 1.3 in transit                    │
│  Retention: User controls (delete anytime)                               │
└──────────────────────────────────────────────────────────────────────────┘
```

### Record of Processing Activities (ROPA)

Per GDPR Article 30, Play New maintains a ROPA for each organization:

| Field | Value |
|-------|-------|
| **Controller** | [Client Organization Name] |
| **Processor** | Cosmico Srl (Play New) |
| **Processing Purpose** | Personal AI assistant services; organizational intelligence |
| **Categories of Data Subjects** | Employees of the controller |
| **Categories of Personal Data** | Work conversations, work patterns, skill usage, session metadata |
| **Recipients** | Anthropic (LLM inference, ZDR), [Cloud Provider] (infrastructure) |
| **Transfers to Third Countries** | None (EU-only infrastructure). Anthropic API calls may route to US -- mitigated by ZDR and SCCs. |
| **Retention Periods** | Tier 1: user-controlled. Tier 2: contract + 90d. Tier 3: contract period. Audit: per retention spec. |
| **Technical/Organizational Measures** | AES-256 encryption, container isolation, RBAC, audit logging, hash chain, 5-user anonymization threshold |

---

## Data Processing Agreement (DPA) -- Template Outline

The DPA is executed between Play New (processor) and the client organization (controller).

### DPA Sections

1. **Definitions** -- Personal data, processing, data subjects, sub-processors
2. **Scope and Purpose** -- AI assistant services, organizational intelligence
3. **Processor Obligations**
   - Process data only on documented instructions from controller
   - Ensure confidentiality of processing personnel
   - Implement appropriate technical and organizational measures
   - Assist controller in responding to data subject requests
   - Delete or return all personal data at end of contract
   - Make available all information necessary for audits
4. **Sub-Processors**
   - Current list: Anthropic (LLM inference), [Cloud Provider] (infrastructure)
   - Prior written consent required for new sub-processors
   - 30-day notice for sub-processor changes
   - Play New remains liable for sub-processor compliance
5. **Data Subject Rights**
   - Play New assists controller in fulfilling access, rectification, erasure, portability requests
   - Response SLA: 48 hours for initial acknowledgment, 30 days for completion
6. **Security Measures**
   - Reference to security model document
   - Encryption, access controls, audit logging, incident response
7. **Data Breach Notification**
   - Play New notifies controller within 24 hours of becoming aware of a breach
   - Notification includes: nature of breach, categories and approximate number of data subjects affected, likely consequences, measures taken
8. **Data Transfers**
   - EU-only data residency
   - Standard Contractual Clauses (SCCs) for any transfers to third countries (e.g., LLM API)
9. **Audit Rights**
   - Controller may audit Play New's compliance once per year
   - Play New provides audit log exports, DPO dashboard access, and technical documentation
10. **Term and Termination**
    - DPA co-terminates with service agreement
    - On termination: data exported to controller and then deleted within 90 days
    - Deletion certificate provided

---

## Phase 0 Scope

**Included in Phase 0:**
- Data export endpoint (JSON format) for Right of Access and Portability
- Data deletion endpoint with hard-delete cascade for Right to Erasure
- Processing restriction (pause/resume) for Right to Restrict Processing
- Consent collection during onboarding (two separate consents)
- Basic DPO dashboard (processing activities list, data subject request log)
- Manual DPA negotiation per design partner
- ROPA template populated per design partner
- Audit log integration for all data subject requests

**Deferred to Phase 1:**
- CSV export format
- Automated ROPA generation
- DPO self-service dashboard with data flow diagrams
- Standardized DPA (reduced negotiation)
- Works council briefing template
- Sub-processor change notification workflow
- Consent version tracking and re-consent flow

**Deferred to Phase 2+:**
- SOC 2 Type I attestation
- Third-party DPA/GDPR audit
- Automated data breach detection and notification
- ISO 27001 preparation
- Cookie consent (if web dashboard)

---

## Open Questions

- **[OQ-GDPR-001]** For the LLM API, Anthropic processes data in the US. Even with ZDR terms, does this constitute a "transfer to a third country" under GDPR? If yes, SCCs are needed. Legal counsel should advise.
- **[OQ-GDPR-002]** Is Tier 3 data (anonymized patterns with hashed user_id) truly "anonymized" under GDPR Recital 26, or is it "pseudonymized" (since the hash could theoretically be reversed with the salt)? This affects whether Tier 3 falls under GDPR scope.
- **[OQ-GDPR-003]** Should we appoint a DPO for Play New itself (Article 37)? As a processor handling personal data at scale, this may be required.
- **[OQ-GDPR-004]** For design partners with works councils (common in Italy and Germany), do we need a specific works council agreement template in addition to the DPA?
- **[OQ-GDPR-005]** What is our position if a user exercises Right to Erasure but their anonymized patterns have already been aggregated into published insights? The patterns are anonymized, but the user may feel their contribution should be retracted.
