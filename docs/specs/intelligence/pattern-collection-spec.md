# Pattern Collection Specification

**Version:** 0.1
**Status:** Draft
**Last Updated:** 2026-02-25
**Owner:** Rinaldo Festa (Technical Architecture)

---

## Context

Pattern collection is the bridge between Play New's personal assistant layer and its organizational intelligence layer. Every assistant interaction generates categorical metadata about what kind of work is being done — never the content itself, only the type and category. These patterns, aggregated across users, become the raw material for organizational intelligence.

This is the most privacy-sensitive data pipeline in the system. The fundamental rule: **content is NEVER stored in the pattern pipeline. Only categorical metadata flows from the personal layer to the organizational layer.**

---

## Nanoclaw Foundation

Nanoclaw does not have a built-in pattern collection system. The relevant foundation is:

| Nanoclaw Concept | Relevance |
|---|---|
| **Agent runner event loop** | Messages are processed sequentially in the agent runner; this is the natural point to emit pattern events |
| **Session transcripts** | Transcripts contain the raw data from which patterns are extracted, but transcripts themselves never leave the personal layer |
| **Skill activation** | Skill invocations are already tracked by the agent runner; we extend this into structured pattern events |

---

## Play New Requirements

From the PRD:

| Requirement | PRD Reference | Description |
|---|---|---|
| FR-005.1 | Section 8.4 | System logs categorized interaction types (communication analysis, report prep, data request, etc.) |
| FR-005.2 | Section 8.4 | System logs skill activation frequency and user feedback scores |
| FR-005.3 | Section 8.4 | System logs content types shared via forward mode (email, document, message) |
| FR-005.4 | Section 8.4 | All logging is categorical only — content is never logged, only type and metadata |
| FR-005.5 | Section 8.4 | Logs accessible only to anonymization pipeline, never to org admins or Play New team directly |
| FR-005.6 | Section 8.4 | Minimum 5-user aggregation threshold before any pattern surfaces |
| Section 7.3 | Privacy | Anonymization rules: min threshold, category generalization, no attribution, temporal blurring |
| Section 13.3 | Intelligence | Standardized work category taxonomy (L1/L2/L3) |

---

## Technical Specification

### What We Collect

Pattern collection captures **categorical metadata ONLY**. The table below defines exactly what is and is not collected:

| Data Point | Collected | Example | NOT Collected |
|---|---|---|---|
| **Interaction type** | Category of work being done | `communication_analysis` | The actual email content |
| **Skill activated** | Which skill, duration, outcome | `pipeline-risk-scan`, 45s, completed | The pipeline data analyzed |
| **Content type shared** | Type of content forwarded | `email`, `spreadsheet`, `document` | The content of the email/document |
| **Tools involved** | Generalized tool categories | `spreadsheet_tools`, `crm` | Specific file names, URLs, or data |
| **Work category** | L1/L2/L3 taxonomy classification | `Analysis > Data analysis > Financial analysis` | What was analyzed |
| **Duration** | Time spent on interaction | 120 seconds | Conversation content |
| **Completion status** | Whether task was completed | `completed`, `abandoned`, `in_progress` | Why it was abandoned |
| **User feedback** | Rating if provided | `useful`, `not_useful` | Free-text feedback |

### Pattern Record Schema

Each interaction produces one pattern record:

```json
{
  "pattern_id": "pat_uuid_v7",
  "user_id": "usr_abc123",
  "org_id": "org_xyz789",
  "team_id": "team_finance_01",
  "session_id": "ses_abc123",

  "pattern_type": "interaction | skill_usage | content_forward | tool_usage",

  "category_L1": "Analysis",
  "category_L2": "Data analysis",
  "category_L3": "Financial analysis",

  "metric_type": "count | duration_seconds | frequency",
  "metric_value": 1,

  "interaction_type": "communication_analysis | report_prep | data_request | decision_support | task_automation | information_retrieval | creative_generation | coordination",

  "content_type_shared": "email | document | spreadsheet | message | image | data_export | none",

  "skill_id": "pipeline-risk-scan",
  "skill_duration_seconds": 45,
  "skill_completion_status": "completed | abandoned | error",
  "skill_feedback": "useful | not_useful | needs_improvement | null",

  "tools_involved": ["spreadsheet_tools", "crm"],

  "channel": "slack | teams | email | web",

  "timestamp": "2026-04-12T09:15:00Z",
  "period": "2026-W15"
}
```

### Standardized Work Category Taxonomy

Every pattern must map to the standardized taxonomy. This taxonomy is defined in the cross-org schema spec and enforced at collection time.

**Level 1 Categories:**

| L1 Category | Definition | Scope |
|---|---|---|
| **Communication** | Creating, processing, or managing messages between people | Emails, messages, presentations, reports delivered to others |
| **Analysis** | Examining data, information, or situations to extract insights | Data analysis, research, competitive analysis, risk assessment |
| **Creation** | Producing new content, designs, code, or artifacts | Writing, design, development, content creation |
| **Coordination** | Managing tasks, people, processes, and workflows | Project management, scheduling, delegation, status tracking |
| **Strategy** | Planning, decision-making, and long-term thinking | Strategic planning, budgeting, innovation, scenario modeling |

**Level 2 and Level 3 breakdown:**

| L1 | L2 | L3 Examples |
|---|---|---|
| **Communication** | Internal coordination | Status updates, Meeting prep, Team announcements |
| | Client communication | Client emails, Proposals, Account updates |
| | Reporting | Management reports, Board materials, Compliance reports |
| | Stakeholder management | Exec briefings, Partner updates, Investor comms |
| **Analysis** | Data analysis | Financial analysis, Sales analysis, Operational metrics |
| | Research | Market research, Competitive analysis, Technology assessment |
| | Decision support | Scenario modeling, Risk assessment, Option evaluation |
| | Quality review | Document review, Code review, Process audit |
| **Creation** | Content creation | Blog posts, Marketing copy, Documentation |
| | Design | Visual design, UX design, Architecture design |
| | Development | Code development, System configuration, Integration work |
| | Document preparation | Contracts, Policies, Standard operating procedures |
| **Coordination** | Project management | Task assignment, Timeline management, Resource allocation |
| | People management | 1:1 preparation, Performance review, Team development |
| | Process management | Workflow design, Process optimization, Automation setup |
| | Scheduling | Calendar management, Meeting coordination, Travel planning |
| **Strategy** | Planning | Quarterly planning, Annual planning, Initiative design |
| | Decision-making | Budget allocation, Prioritization, Go/no-go decisions |
| | Innovation | New initiative design, Product ideation, Market opportunity |
| | Monitoring | KPI tracking, Competitive monitoring, Trend analysis |

### Collection Points

Pattern events are emitted at four points in the assistant interaction lifecycle:

```
┌────────────────────────────────────────────────────────────────┐
│                    COLLECTION POINTS                           │
│                                                                │
│  1. AFTER MESSAGE PROCESSING                                   │
│     ┌──────────┐    ┌──────────────┐    ┌──────────────┐      │
│     │ User msg │───►│ LLM Process  │───►│ Emit pattern │      │
│     │ received │    │ + classify   │    │ event        │      │
│     └──────────┘    └──────────────┘    └──────────────┘      │
│                                                                │
│  2. AFTER SKILL ACTIVATION                                     │
│     ┌──────────┐    ┌──────────────┐    ┌──────────────┐      │
│     │ Skill    │───►│ Skill        │───►│ Emit skill   │      │
│     │ invoked  │    │ completes    │    │ usage event  │      │
│     └──────────┘    └──────────────┘    └──────────────┘      │
│                                                                │
│  3. AFTER FORWARD-MODE PROCESSING                              │
│     ┌──────────┐    ┌──────────────┐    ┌──────────────┐      │
│     │ Content  │───►│ Classify     │───►│ Emit content │      │
│     │ forwarded│    │ content type │    │ type event   │      │
│     └──────────┘    └──────────────┘    └──────────────┘      │
│                                                                │
│  4. WEEKLY AGGREGATION (batch)                                 │
│     ┌──────────┐    ┌──────────────┐    ┌──────────────┐      │
│     │ Week ends│───►│ Aggregate    │───►│ Emit weekly  │      │
│     │          │    │ user patterns│    │ summary      │      │
│     └──────────┘    └──────────────┘    └──────────────┘      │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Collection point 1: After message processing**

After each user message is processed, the assistant's response is classified (in-context, not stored) to determine the interaction type and work category.

```typescript
// Classification happens in-context during the LLM call
// The classification prompt is appended to the internal system prompt
const classificationInstruction = `
After responding to the user, silently classify this interaction:
- interaction_type: one of [communication_analysis, report_prep, data_request,
  decision_support, task_automation, information_retrieval, creative_generation, coordination]
- category_L1/L2/L3: from the standardized work category taxonomy
- tools_involved: generalized categories of tools referenced
Output classification as structured JSON in a hidden field.
`;

// After LLM response, extract classification and emit event
async function emitInteractionPattern(
  session: Session,
  classification: InteractionClassification
): Promise<void> {
  await patternCollector.emit({
    pattern_type: 'interaction',
    user_id: session.userId,
    org_id: session.orgId,
    team_id: await getTeamId(session.userId),
    session_id: session.sessionId,
    category_L1: classification.categoryL1,
    category_L2: classification.categoryL2,
    category_L3: classification.categoryL3,
    interaction_type: classification.interactionType,
    tools_involved: classification.toolsInvolved.map(generalizeTool),
    channel: session.channel,
    metric_type: 'count',
    metric_value: 1,
    timestamp: new Date().toISOString(),
  });
}
```

**Collection point 2: After skill activation**

```typescript
async function emitSkillPattern(
  session: Session,
  skill: SkillExecution
): Promise<void> {
  await patternCollector.emit({
    pattern_type: 'skill_usage',
    user_id: session.userId,
    org_id: session.orgId,
    team_id: await getTeamId(session.userId),
    session_id: session.sessionId,
    skill_id: skill.skillId,
    skill_duration_seconds: skill.durationSeconds,
    skill_completion_status: skill.status,
    skill_feedback: skill.feedback,
    category_L1: skill.categoryL1,          // from skill metadata
    category_L2: skill.categoryL2,
    category_L3: skill.categoryL3,
    metric_type: 'duration_seconds',
    metric_value: skill.durationSeconds,
    timestamp: new Date().toISOString(),
  });
}
```

**Collection point 3: After forward-mode processing**

```typescript
async function emitForwardPattern(
  session: Session,
  forwarded: ForwardedContent
): Promise<void> {
  await patternCollector.emit({
    pattern_type: 'content_forward',
    user_id: session.userId,
    org_id: session.orgId,
    team_id: await getTeamId(session.userId),
    session_id: session.sessionId,
    content_type_shared: forwarded.contentType,  // 'email', 'document', etc.
    category_L1: forwarded.classifiedCategoryL1,
    category_L2: forwarded.classifiedCategoryL2,
    category_L3: forwarded.classifiedCategoryL3,
    tools_involved: forwarded.toolsInvolved.map(generalizeTool),
    metric_type: 'count',
    metric_value: 1,
    timestamp: new Date().toISOString(),
  });
}
```

**Collection point 4: Weekly aggregation**

A batch job runs weekly to produce per-user summaries. These summaries feed the weekly review sent to users and provide higher-quality pattern data for the organizational intelligence layer.

```typescript
// Weekly batch job (runs Sunday midnight)
async function weeklyPatternAggregation(orgId: string): Promise<void> {
  const users = await getActiveUsers(orgId);

  for (const user of users) {
    const weekPatterns = await getPatterns(user.userId, {
      period: currentWeek(),
    });

    const summary = {
      pattern_type: 'weekly_summary',
      user_id: user.userId,
      org_id: orgId,
      team_id: user.teamId,
      period: currentWeekISO(),
      time_allocation: aggregateByCategory(weekPatterns),
      skill_usage: aggregateSkillUsage(weekPatterns),
      content_types: aggregateContentTypes(weekPatterns),
      tool_usage: aggregateToolUsage(weekPatterns),
      total_interactions: weekPatterns.length,
      active_days: countActiveDays(weekPatterns),
    };

    await patternCollector.emit(summary);
  }
}
```

### Tool Generalization

Specific tools are generalized to categories to prevent identification of individual workflows:

```typescript
const TOOL_GENERALIZATION_MAP: Record<string, string> = {
  // Spreadsheets
  'excel': 'spreadsheet_tools',
  'google_sheets': 'spreadsheet_tools',
  'numbers': 'spreadsheet_tools',
  'airtable': 'spreadsheet_tools',

  // CRM
  'salesforce': 'crm',
  'hubspot': 'crm',
  'pipedrive': 'crm',
  'zoho_crm': 'crm',

  // Communication
  'gmail': 'communication',
  'outlook': 'communication',
  'slack': 'communication',
  'teams': 'communication',

  // Project management
  'jira': 'project_management',
  'asana': 'project_management',
  'linear': 'project_management',
  'monday': 'project_management',
  'trello': 'project_management',

  // Documents
  'google_docs': 'document_tools',
  'word': 'document_tools',
  'notion': 'document_tools',
  'confluence': 'document_tools',

  // Design
  'figma': 'design_tools',
  'sketch': 'design_tools',
  'canva': 'design_tools',

  // Development
  'github': 'development_tools',
  'gitlab': 'development_tools',
  'vscode': 'development_tools',

  // Financial
  'xero': 'financial_tools',
  'sap': 'financial_tools',
  'quickbooks': 'financial_tools',

  // Analytics
  'google_analytics': 'analytics_tools',
  'tableau': 'analytics_tools',
  'power_bi': 'analytics_tools',
  'looker': 'analytics_tools',
};

function generalizeTool(specificTool: string): string {
  return TOOL_GENERALIZATION_MAP[specificTool.toLowerCase()] || 'other_tools';
}
```

### Privacy Safeguards

| Safeguard | Implementation | Verification |
|---|---|---|
| **Content never stored** | Pattern records contain only categorical fields. No free-text content fields. Schema enforced. | Schema validation rejects records with content-like fields |
| **LLM classification is in-context only** | Classification happens during the same LLM call as the response. No separate classification call with stored data. | Audit: no separate API calls for classification |
| **User can view own patterns** | API endpoint returns all pattern records for a user. User sees exactly what is collected. | User transparency dashboard |
| **Patterns deletable** | User can delete all their pattern records (triggers re-aggregation). | Destroy operation cascades to pattern_logs |
| **Access restricted** | Pattern logs accessible only by the anonymization pipeline. No admin/advisor direct access. | Database permissions enforce read-only for anonymization service account; no human access |
| **Classification taxonomy is fixed** | Only predefined categories allowed. No open-ended classification. | CHECK constraints on all category fields |

### SQL Schema

```sql
-- Individual pattern logs (pre-anonymization)
-- ACCESS RESTRICTED: only anonymization_service role can SELECT
CREATE TABLE pattern_logs (
    pattern_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL,
    org_id                  UUID NOT NULL,
    team_id                 UUID NOT NULL,
    session_id              UUID,

    -- Pattern classification
    pattern_type            TEXT NOT NULL CHECK (pattern_type IN (
                                'interaction', 'skill_usage', 'content_forward',
                                'tool_usage', 'weekly_summary'
                            )),

    -- Standardized taxonomy (validated against taxonomy table)
    category_L1             TEXT NOT NULL,
    category_L2             TEXT,
    category_L3             TEXT,

    -- Metrics
    metric_type             TEXT NOT NULL CHECK (metric_type IN (
                                'count', 'duration_seconds', 'frequency'
                            )),
    metric_value            NUMERIC NOT NULL,

    -- Interaction details (all categorical, no content)
    interaction_type        TEXT CHECK (interaction_type IN (
                                'communication_analysis', 'report_prep', 'data_request',
                                'decision_support', 'task_automation', 'information_retrieval',
                                'creative_generation', 'coordination'
                            )),
    content_type_shared     TEXT CHECK (content_type_shared IN (
                                'email', 'document', 'spreadsheet', 'message',
                                'image', 'data_export', 'none'
                            )),

    -- Skill usage (if applicable)
    skill_id                TEXT,
    skill_duration_seconds  INTEGER,
    skill_completion_status TEXT CHECK (skill_completion_status IN (
                                'completed', 'abandoned', 'error'
                            )),
    skill_feedback          TEXT CHECK (skill_feedback IN (
                                'useful', 'not_useful', 'needs_improvement'
                            )),

    -- Tool usage (generalized categories only)
    tools_involved          TEXT[] DEFAULT '{}',

    -- Channel
    channel                 TEXT CHECK (channel IN ('slack', 'teams', 'email', 'web')),

    -- Temporal
    timestamp               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    period                  TEXT NOT NULL,              -- ISO week: '2026-W15'

    -- Lifecycle
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ,

    -- Foreign keys
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(user_id),
    CONSTRAINT fk_org FOREIGN KEY (org_id) REFERENCES organizations(org_id),
    CONSTRAINT fk_team FOREIGN KEY (team_id) REFERENCES teams(team_id)
);

-- Indexes for anonymization pipeline queries
CREATE INDEX idx_pattern_org_period ON pattern_logs(org_id, period)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_pattern_team_period ON pattern_logs(team_id, period)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_pattern_user ON pattern_logs(user_id, timestamp DESC)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_pattern_category ON pattern_logs(org_id, category_L1, category_L2)
    WHERE deleted_at IS NULL;

-- Restrict direct access: only anonymization service can read
REVOKE ALL ON pattern_logs FROM PUBLIC;
GRANT SELECT ON pattern_logs TO anonymization_service;
GRANT INSERT ON pattern_logs TO pattern_collector_service;
GRANT UPDATE (deleted_at) ON pattern_logs TO user_data_service;  -- for user deletion

-- Taxonomy reference table (enforces valid categories)
CREATE TABLE work_category_taxonomy (
    taxonomy_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level           INTEGER NOT NULL CHECK (level IN (1, 2, 3)),
    category_code   TEXT NOT NULL UNIQUE,
    category_name   TEXT NOT NULL,
    parent_code     TEXT,                  -- NULL for L1, L1 code for L2, L2 code for L3
    definition      TEXT NOT NULL,
    examples        TEXT[] DEFAULT '{}',
    version         INTEGER NOT NULL DEFAULT 1,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_parent FOREIGN KEY (parent_code) REFERENCES work_category_taxonomy(category_code)
);

-- Validate that pattern_logs categories exist in taxonomy
-- (enforced via trigger or application-level validation)
CREATE OR REPLACE FUNCTION validate_pattern_category()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM work_category_taxonomy
        WHERE category_name = NEW.category_L1 AND level = 1 AND is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'Invalid category_L1: %', NEW.category_L1;
    END IF;

    IF NEW.category_L2 IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM work_category_taxonomy
        WHERE category_name = NEW.category_L2 AND level = 2 AND is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'Invalid category_L2: %', NEW.category_L2;
    END IF;

    IF NEW.category_L3 IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM work_category_taxonomy
        WHERE category_name = NEW.category_L3 AND level = 3 AND is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'Invalid category_L3: %', NEW.category_L3;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_pattern_category
    BEFORE INSERT ON pattern_logs
    FOR EACH ROW EXECUTE FUNCTION validate_pattern_category();
```

### Event Pipeline Architecture

```
┌───────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ Agent Runner   │────►│ Pattern Collector │────►│ pattern_logs     │
│ (per user)     │     │ Service           │     │ (PostgreSQL)     │
│                │     │                   │     │                  │
│ Emits events:  │     │ - Validates       │     │ Access: anon     │
│ - interaction  │     │   against taxonomy│     │ service ONLY     │
│ - skill_usage  │     │ - Generalizes     │     │                  │
│ - content_fwd  │     │   tool names      │     │                  │
│                │     │ - Assigns period  │     │                  │
│                │     │ - Writes to DB    │     │                  │
└───────────────┘     └──────────────────┘     └────────┬─────────┘
                                                         │
                                                         │ (read only)
                                                         │
                                               ┌─────────▼──────────┐
                                               │ Anonymization       │
                                               │ Engine              │
                                               │ (see anonymization  │
                                               │  engine spec)       │
                                               └─────────────────────┘
```

**Phase 0: synchronous collection**

In Phase 0, pattern events are collected synchronously after each LLM response. This is acceptable at 150 users.

```typescript
// In the agent runner message processing loop
async function processMessage(session: Session, message: UserMessage): Promise<AssistantResponse> {
  // 1. Assemble context (org context + personal memory)
  const context = await assembleContext(session, message);

  // 2. Call LLM with classification instruction
  const response = await llm.complete({
    system: context.systemPrompt + CLASSIFICATION_INSTRUCTION,
    messages: session.messages.concat(message),
  });

  // 3. Extract classification from response (hidden structured output)
  const classification = extractClassification(response);

  // 4. Emit pattern event (synchronous in Phase 0)
  await emitInteractionPattern(session, classification);

  // 5. Return response to user (without classification metadata)
  return response.userFacingContent;
}
```

**Phase 1: asynchronous collection**

At scale, pattern collection becomes asynchronous via a message queue:

```
Agent Runner → Message Queue (SQS/PubSub) → Pattern Collector → pattern_logs
```

---

## Phase 0 Scope

### What We Build Now

1. **Basic categorical logging**: after each message processing, emit a pattern record with interaction_type, category_L1 (required), category_L2 (optional), content_type_shared, and channel.
2. **Skill usage logging**: after each skill activation, log skill_id, duration, completion_status, and feedback.
3. **Taxonomy validation**: all categories validated against the work_category_taxonomy table. Reject unmapped categories.
4. **Tool generalization**: specific tool names replaced with generalized categories.
5. **User transparency**: API endpoint for users to view all their pattern records.
6. **Manual taxonomy classification**: LLM classifies interactions using the standardized taxonomy in-context. No separate classification model.

**Phase 0 simplifications:**

- Synchronous collection (acceptable at 150 users)
- L1 classification required; L2/L3 optional (classification accuracy may be low initially)
- No weekly aggregation batch job (advisors query directly for monthly briefs)
- No user dashboard for pattern viewing (API only)

### What We Defer

| Capability | Target Phase | Rationale |
|---|---|---|
| Asynchronous event pipeline | Phase 1 | Synchronous acceptable at Phase 0 scale |
| L2/L3 classification accuracy tuning | Phase 1 | Need real data to calibrate |
| Weekly aggregation batch job | Phase 1 | Advisors query manually for Phase 0 |
| User pattern dashboard | Phase 1 | API sufficient for Phase 0 |
| Classification confidence scoring | Phase 1 | Need validation data first |
| Pattern deletion cascading to anonymized views | Phase 1 | Manual re-aggregation acceptable |

---

## Open Questions

1. **Classification accuracy**: How accurate will LLM-based in-context classification be? If the LLM classifies a "budget review email" as "Communication > Client communication" instead of "Analysis > Data analysis > Financial analysis", the pattern data is wrong. Need a validation framework to measure classification accuracy during Phase 0.

2. **Multi-category interactions**: Some interactions span multiple categories (e.g., a user forwards an email AND asks for analysis AND requests a draft response). Should we emit multiple pattern records per interaction, or choose the primary category?

3. **Idle time**: If a user sends a message and the assistant takes 2 minutes to respond, does the 2-minute duration belong to the user's pattern or the system's latency? Need clear duration attribution rules.

4. **Pattern volume**: At 150 users with ~5 interactions/day each, we generate ~750 pattern records/day or ~22,500/month. At Phase 1 (2,000 users), ~300,000/month. Is PostgreSQL sufficient, or do we need a time-series DB (TimescaleDB)?

5. **Classification taxonomy evolution**: When the taxonomy changes (new L3 category added), how do we handle historical patterns? Backfill? Leave as-is? Need a taxonomy versioning strategy.

6. **User opt-out**: Can a user opt out of pattern collection entirely while still using the assistant? The PRD implies patterns are always collected (in categorical form), but some users or works councils may demand opt-out. What are the implications for anonymization thresholds?
