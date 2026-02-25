# Anonymization Engine Specification

**Version:** 0.1
**Status:** Draft
**Last Updated:** 2026-02-25
**Owner:** Rinaldo Festa (Technical Architecture)

---

## Context

The anonymization engine is the single most important technical component of Play New. It enforces the one-way transformation between individual user data and organizational intelligence. If this boundary fails — if individual behavior can be inferred from organizational patterns — the entire trust model collapses.

The design principle: **it should be architecturally impossible to reverse the transformation.** This is not enforced by application code that could be bypassed. It is enforced by database views, access controls, and aggregation rules at the infrastructure level.

---

## Nanoclaw Foundation

Nanoclaw does not include an anonymization layer. This is entirely a Play New addition.

---

## Play New Requirements

From the PRD:

| Requirement | PRD Reference | Description |
|---|---|---|
| Section 6.3.3 | Architecture | One-way transformation layer. Individual data goes in, anonymized patterns come out. Architecturally impossible to reverse. |
| Section 7.3 | Privacy | Five anonymization rules: min threshold, category generalization, no attribution, temporal blurring, differential privacy |
| Section 7.4 | Privacy | Aggregation rules are auditable. Published anonymization specification. |
| Section 7.5 | Privacy | Phase 0: anonymized patterns extracted manually by advisors |
| FR-005.5 | Section 8.4 | Logs accessible only to anonymization pipeline, never to org admins or Play New team directly |
| FR-005.6 | Section 8.4 | Minimum 5-user aggregation threshold before any pattern surfaces |
| Section 13.2 | Intelligence | Quality thresholds: min 5 users, confidence >= 0.7, evidence citations |

---

## Technical Specification

### Architecture Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                       PERSONAL LAYER                               │
│                                                                    │
│  pattern_logs table                                                │
│  (individual records, user_id present, content-free categorical)   │
│                                                                    │
│  ACCESS: pattern_collector_service (INSERT)                        │
│          anonymization_service (SELECT)                            │
│          user_data_service (UPDATE deleted_at for user deletion)   │
│          NO HUMAN ACCESS                                           │
└────────────────────────────┬───────────────────────────────────────┘
                             │
                             │  One-way transformation
                             │  (DB views enforce aggregation)
                             │
┌────────────────────────────▼───────────────────────────────────────┐
│                    ANONYMIZATION BOUNDARY                          │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │  Rule 1: MIN 5-USER THRESHOLD                            │     │
│  │  HAVING COUNT(DISTINCT user_id) >= 5                      │     │
│  ├──────────────────────────────────────────────────────────┤     │
│  │  Rule 2: CATEGORY GENERALIZATION                          │     │
│  │  Specific tools → generalized categories                  │     │
│  │  (enforced at collection time, verified here)             │     │
│  ├──────────────────────────────────────────────────────────┤     │
│  │  Rule 3: NO INDIVIDUAL ATTRIBUTION                        │     │
│  │  GROUP BY org_id, team_id, category; DROP user_id         │     │
│  ├──────────────────────────────────────────────────────────┤     │
│  │  Rule 4: TEMPORAL BLURRING                                │     │
│  │  Aggregate to weekly/monthly; never daily                 │     │
│  ├──────────────────────────────────────────────────────────┤     │
│  │  Rule 5: DIFFERENTIAL PRIVACY (Phase 2+)                  │     │
│  │  Calibrated noise injection for small groups              │     │
│  └──────────────────────────────────────────────────────────┘     │
│                                                                    │
└────────────────────────────┬───────────────────────────────────────┘
                             │
┌────────────────────────────▼───────────────────────────────────────┐
│                    ORGANIZATIONAL LAYER                             │
│                                                                    │
│  v_team_patterns     (aggregated by team, category, period)        │
│  v_org_patterns      (aggregated by org, category, period)         │
│  v_skill_usage       (aggregated skill activation by team)         │
│                                                                    │
│  ACCESS: advisor_read_role (SELECT on views only)                  │
│          intelligence_service (SELECT on views only)               │
│          NO ACCESS to underlying pattern_logs                      │
└────────────────────────────────────────────────────────────────────┘
```

### The 5 Anonymization Rules

#### Rule 1: Minimum 5-User Threshold

Patterns only surface when 5 or more distinct users exhibit them. Below this threshold, the data stays in the personal layer only.

**SQL implementation:**

```sql
-- Every aggregation query MUST include this clause
HAVING COUNT(DISTINCT user_id) >= 5
```

**Why 5?** This is the standard k-anonymity threshold for workplace analytics (used by Microsoft Viva Insights, Google Workspace analytics). Below 5, statistical inference of individual behavior becomes feasible, especially in small teams.

**Edge case: teams smaller than 5 people.** If a team has only 3 members, no team-level patterns are ever surfaced. Their data contributes to org-level aggregations only (where the 5-user threshold is met across teams).

#### Rule 2: Category Generalization

Specific tools, actions, and identifiers are generalized to broad categories.

**Generalization mapping:**

| Specific (collected) | Generalized (reported) |
|---|---|
| Excel, Google Sheets, Numbers | `spreadsheet_tools` |
| Salesforce, HubSpot, Pipedrive | `crm` |
| Gmail, Outlook, email | `communication` |
| Jira, Asana, Linear, Monday | `project_management` |
| Google Docs, Word, Notion | `document_tools` |
| Figma, Sketch, Canva | `design_tools` |
| GitHub, GitLab, VSCode | `development_tools` |
| Xero, SAP, QuickBooks | `financial_tools` |
| Google Analytics, Tableau, Power BI | `analytics_tools` |

**Implementation:** Generalization is enforced at collection time (see pattern-collection-spec). The anonymization engine verifies that no specific tool names appear in pattern records.

```sql
-- Verification query: ensure no specific tools leaked through
SELECT DISTINCT unnest(tools_involved) AS tool
FROM pattern_logs
WHERE NOT (unnest(tools_involved) = ANY(ARRAY[
    'spreadsheet_tools', 'crm', 'communication', 'project_management',
    'document_tools', 'design_tools', 'development_tools', 'financial_tools',
    'analytics_tools', 'other_tools'
]))
LIMIT 10;
-- Result should always be empty
```

#### Rule 3: No Individual Attribution

The organizational layer never knows which specific users contributed to a pattern. Aggregation drops user_id entirely.

**SQL implementation:**

```sql
-- Aggregation always groups by org/team/category — never by user
SELECT
    org_id,
    team_id,
    category_L1,
    category_L2,
    period,
    COUNT(*) AS pattern_count,
    COUNT(DISTINCT user_id) AS user_count,     -- count only, never the actual IDs
    SUM(metric_value) AS total_metric_value,
    AVG(metric_value) AS avg_metric_value
FROM pattern_logs
WHERE deleted_at IS NULL
GROUP BY org_id, team_id, category_L1, category_L2, period
HAVING COUNT(DISTINCT user_id) >= 5;
-- user_id is used for COUNT(DISTINCT) but NEVER appears in output columns
```

#### Rule 4: Temporal Blurring

Patterns are reported in weekly or monthly aggregations, never daily. This prevents correlation attacks (e.g., "who was the only person working Tuesday evening?").

**SQL implementation:**

```sql
-- Period is always weekly or monthly, never daily
-- Weekly: '2026-W15'
-- Monthly: '2026-04'

-- For team-level views: weekly aggregation
SELECT
    org_id,
    team_id,
    category_L1,
    -- Aggregate to ISO week
    TO_CHAR(timestamp, 'IYYY-"W"IW') AS period_week,
    COUNT(DISTINCT user_id) AS user_count,
    SUM(metric_value) AS total_value
FROM pattern_logs
WHERE deleted_at IS NULL
GROUP BY org_id, team_id, category_L1, period_week
HAVING COUNT(DISTINCT user_id) >= 5;

-- For org-level views: monthly aggregation
SELECT
    org_id,
    category_L1,
    -- Aggregate to month
    TO_CHAR(timestamp, 'YYYY-MM') AS period_month,
    COUNT(DISTINCT user_id) AS user_count,
    SUM(metric_value) AS total_value
FROM pattern_logs
WHERE deleted_at IS NULL
GROUP BY org_id, category_L1, period_month
HAVING COUNT(DISTINCT user_id) >= 5;
```

#### Rule 5: Differential Privacy (Phase 2+)

For small-group aggregations (5-10 users), add calibrated noise to prevent statistical inference.

**Concept (not implemented in Phase 0-1):**

```sql
-- Phase 2: Laplace noise injection
-- epsilon = 1.0 (standard privacy budget)
-- sensitivity = max contribution per user per period

-- Example: add noise to aggregated metric
SELECT
    org_id,
    team_id,
    category_L1,
    period,
    -- Add Laplace noise: actual_value + laplace_noise(sensitivity/epsilon)
    SUM(metric_value) + (random_laplace(1.0 / 1.0)) AS noisy_total_value,
    COUNT(DISTINCT user_id) AS user_count
FROM pattern_logs
GROUP BY org_id, team_id, category_L1, period
HAVING COUNT(DISTINCT user_id) >= 5;
```

### Database Views

These views are the ONLY interface to organizational pattern data. No human or service ever queries `pattern_logs` directly for organizational intelligence purposes.

#### View: v_team_patterns

Team-level patterns aggregated by category and weekly period. Minimum 5 users.

```sql
CREATE OR REPLACE VIEW v_team_patterns AS
SELECT
    p.org_id,
    p.team_id,
    t.name AS team_name,
    t.function AS team_function,
    p.category_L1,
    p.category_L2,
    TO_CHAR(p.timestamp, 'IYYY-"W"IW') AS period_week,

    -- Aggregated metrics (no individual data)
    COUNT(*) AS total_interactions,
    COUNT(DISTINCT p.user_id) AS user_count,
    SUM(CASE WHEN p.metric_type = 'count' THEN p.metric_value ELSE 0 END) AS total_count,
    SUM(CASE WHEN p.metric_type = 'duration_seconds' THEN p.metric_value ELSE 0 END) AS total_duration_seconds,
    AVG(CASE WHEN p.metric_type = 'duration_seconds' THEN p.metric_value END) AS avg_duration_seconds,

    -- Tool usage (generalized)
    ARRAY_AGG(DISTINCT unnest_tool) AS tools_used,

    -- Content type distribution
    COUNT(CASE WHEN p.content_type_shared = 'email' THEN 1 END) AS email_count,
    COUNT(CASE WHEN p.content_type_shared = 'document' THEN 1 END) AS document_count,
    COUNT(CASE WHEN p.content_type_shared = 'spreadsheet' THEN 1 END) AS spreadsheet_count,
    COUNT(CASE WHEN p.content_type_shared = 'message' THEN 1 END) AS message_count

FROM pattern_logs p
JOIN teams t ON p.team_id = t.team_id
CROSS JOIN LATERAL unnest(p.tools_involved) AS unnest_tool
WHERE p.deleted_at IS NULL
GROUP BY
    p.org_id,
    p.team_id,
    t.name,
    t.function,
    p.category_L1,
    p.category_L2,
    TO_CHAR(p.timestamp, 'IYYY-"W"IW')
HAVING COUNT(DISTINCT p.user_id) >= 5;

-- Grant access to advisor and intelligence service only
GRANT SELECT ON v_team_patterns TO advisor_read_role;
GRANT SELECT ON v_team_patterns TO intelligence_service;
```

#### View: v_org_patterns

Organization-level patterns aggregated by category and monthly period.

```sql
CREATE OR REPLACE VIEW v_org_patterns AS
SELECT
    p.org_id,
    o.name AS org_name,
    o.industry,
    p.category_L1,
    p.category_L2,
    TO_CHAR(p.timestamp, 'YYYY-MM') AS period_month,

    -- Aggregated metrics
    COUNT(*) AS total_interactions,
    COUNT(DISTINCT p.user_id) AS user_count,
    COUNT(DISTINCT p.team_id) AS team_count,
    SUM(CASE WHEN p.metric_type = 'count' THEN p.metric_value ELSE 0 END) AS total_count,
    SUM(CASE WHEN p.metric_type = 'duration_seconds' THEN p.metric_value ELSE 0 END) AS total_duration_seconds,

    -- Interaction type distribution
    COUNT(CASE WHEN p.interaction_type = 'communication_analysis' THEN 1 END) AS communication_analysis_count,
    COUNT(CASE WHEN p.interaction_type = 'report_prep' THEN 1 END) AS report_prep_count,
    COUNT(CASE WHEN p.interaction_type = 'data_request' THEN 1 END) AS data_request_count,
    COUNT(CASE WHEN p.interaction_type = 'decision_support' THEN 1 END) AS decision_support_count,
    COUNT(CASE WHEN p.interaction_type = 'task_automation' THEN 1 END) AS task_automation_count,
    COUNT(CASE WHEN p.interaction_type = 'information_retrieval' THEN 1 END) AS information_retrieval_count,
    COUNT(CASE WHEN p.interaction_type = 'creative_generation' THEN 1 END) AS creative_generation_count,
    COUNT(CASE WHEN p.interaction_type = 'coordination' THEN 1 END) AS coordination_count,

    -- Channel distribution
    COUNT(CASE WHEN p.channel = 'slack' THEN 1 END) AS slack_count,
    COUNT(CASE WHEN p.channel = 'teams' THEN 1 END) AS teams_count,
    COUNT(CASE WHEN p.channel = 'email' THEN 1 END) AS email_count

FROM pattern_logs p
JOIN organizations o ON p.org_id = o.org_id
WHERE p.deleted_at IS NULL
GROUP BY
    p.org_id,
    o.name,
    o.industry,
    p.category_L1,
    p.category_L2,
    TO_CHAR(p.timestamp, 'YYYY-MM')
HAVING COUNT(DISTINCT p.user_id) >= 5;

GRANT SELECT ON v_org_patterns TO advisor_read_role;
GRANT SELECT ON v_org_patterns TO intelligence_service;
```

#### View: v_skill_usage

Aggregated skill activation patterns by team. Minimum 5 users.

```sql
CREATE OR REPLACE VIEW v_skill_usage AS
SELECT
    p.org_id,
    p.team_id,
    t.name AS team_name,
    p.skill_id,
    s.name AS skill_name,
    s.category AS skill_category,
    TO_CHAR(p.timestamp, 'IYYY-"W"IW') AS period_week,

    -- Usage metrics
    COUNT(*) AS total_activations,
    COUNT(DISTINCT p.user_id) AS user_count,
    AVG(p.skill_duration_seconds) AS avg_duration_seconds,

    -- Completion rates
    COUNT(CASE WHEN p.skill_completion_status = 'completed' THEN 1 END)::FLOAT
        / NULLIF(COUNT(*), 0) AS completion_rate,
    COUNT(CASE WHEN p.skill_completion_status = 'abandoned' THEN 1 END)::FLOAT
        / NULLIF(COUNT(*), 0) AS abandonment_rate,

    -- Feedback distribution
    COUNT(CASE WHEN p.skill_feedback = 'useful' THEN 1 END) AS useful_count,
    COUNT(CASE WHEN p.skill_feedback = 'not_useful' THEN 1 END) AS not_useful_count,
    COUNT(CASE WHEN p.skill_feedback = 'needs_improvement' THEN 1 END) AS needs_improvement_count,
    COUNT(CASE WHEN p.skill_feedback = 'useful' THEN 1 END)::FLOAT
        / NULLIF(COUNT(CASE WHEN p.skill_feedback IS NOT NULL THEN 1 END), 0) AS positive_feedback_rate

FROM pattern_logs p
JOIN teams t ON p.team_id = t.team_id
LEFT JOIN skills s ON p.skill_id = s.skill_id
WHERE p.deleted_at IS NULL
  AND p.pattern_type = 'skill_usage'
  AND p.skill_id IS NOT NULL
GROUP BY
    p.org_id,
    p.team_id,
    t.name,
    p.skill_id,
    s.name,
    s.category,
    TO_CHAR(p.timestamp, 'IYYY-"W"IW')
HAVING COUNT(DISTINCT p.user_id) >= 5;

GRANT SELECT ON v_skill_usage TO advisor_read_role;
GRANT SELECT ON v_skill_usage TO intelligence_service;
```

### Input/Output Examples

**Input (individual pattern record — in pattern_logs):**

```json
{
  "pattern_id": "pat_001",
  "user_id": "usr_maria_123",
  "org_id": "org_acme",
  "team_id": "team_marketing",
  "pattern_type": "interaction",
  "category_L1": "Communication",
  "category_L2": "Reporting",
  "category_L3": "Manual data compilation",
  "metric_type": "duration_seconds",
  "metric_value": 3600,
  "tools_involved": ["spreadsheet_tools", "crm", "communication"],
  "timestamp": "2026-04-12T09:15:00Z",
  "period": "2026-W15"
}
```

**Output (from v_team_patterns — what advisors see):**

```json
{
  "org_id": "org_acme",
  "team_id": "team_marketing",
  "team_name": "Marketing",
  "team_function": "marketing",
  "category_L1": "Communication",
  "category_L2": "Reporting",
  "period_week": "2026-W15",
  "total_interactions": 47,
  "user_count": 6,
  "total_duration_seconds": 169200,
  "avg_duration_seconds": 3600,
  "tools_used": ["spreadsheet_tools", "crm", "communication"],
  "email_count": 23,
  "document_count": 12,
  "spreadsheet_count": 8,
  "message_count": 4
}
```

Notice: the output shows that 6 users in the Marketing team spent a combined 47 hours on "Communication > Reporting" during week 15. It does not reveal which users, when they worked, or what they reported on.

### Advisor Access Model

Advisors access organizational intelligence through the anonymized views ONLY. They never have access to raw pattern_logs.

```
┌──────────────────────┐     ┌─────────────────────────┐
│  Play New Advisor     │     │  Database                │
│                       │     │                          │
│  Has role:            │     │  ┌──────────────────┐   │
│  advisor_read_role    │────►│  │ v_team_patterns  │   │  ← SELECT only
│                       │     │  │ v_org_patterns   │   │
│  Can query:           │     │  │ v_skill_usage    │   │
│  - Anonymized views   │     │  └──────────────────┘   │
│                       │     │                          │
│  Cannot access:       │     │  ┌──────────────────┐   │
│  - pattern_logs       │  ╳  │  │ pattern_logs     │   │  ← NO ACCESS
│  - personal_memory    │  ╳  │  │ personal_memory  │   │
│  - sessions           │  ╳  │  │ sessions         │   │
│                       │     │  └──────────────────┘   │
└──────────────────────┘     └─────────────────────────┘
```

**Pre-built advisor queries:**

```sql
-- Query 1: Top time-consuming activities by team (this month)
SELECT
    team_name,
    category_L1,
    category_L2,
    SUM(total_duration_seconds) / 3600.0 AS total_hours,
    SUM(user_count) AS contributing_users,
    SUM(total_interactions) AS interaction_count
FROM v_team_patterns
WHERE org_id = :org_id
  AND period_week >= TO_CHAR(date_trunc('month', CURRENT_DATE), 'IYYY-"W"IW')
GROUP BY team_name, category_L1, category_L2
ORDER BY total_hours DESC
LIMIT 10;

-- Query 2: Skill adoption by team
SELECT
    team_name,
    skill_name,
    SUM(total_activations) AS activations,
    AVG(positive_feedback_rate) AS avg_feedback_rate,
    AVG(completion_rate) AS avg_completion_rate,
    SUM(user_count) AS users_using
FROM v_skill_usage
WHERE org_id = :org_id
  AND period_week >= TO_CHAR(CURRENT_DATE - INTERVAL '4 weeks', 'IYYY-"W"IW')
GROUP BY team_name, skill_name
ORDER BY activations DESC;

-- Query 3: Work category distribution for Automate brief
SELECT
    category_L1,
    category_L2,
    SUM(total_interactions) AS total_interactions,
    SUM(total_duration_seconds) / 3600.0 AS total_hours,
    SUM(user_count) AS contributing_users,
    ARRAY_AGG(DISTINCT team_name) AS teams_involved
FROM v_team_patterns
WHERE org_id = :org_id
  AND period_week >= TO_CHAR(CURRENT_DATE - INTERVAL '4 weeks', 'IYYY-"W"IW')
GROUP BY category_L1, category_L2
ORDER BY total_hours DESC;
```

### Staging Pipeline (Phase 1 Automation)

In Phase 1, the anonymization becomes a fully automated pipeline:

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ pattern_logs  │───►│ staging_     │───►│ aggregation  │───►│ anonymized_  │
│ (raw events)  │    │ patterns     │    │ job          │    │ patterns     │
│               │    │ (copy with   │    │ (weekly      │    │ (final,      │
│               │    │  retention   │    │  cron)       │    │  queryable)  │
│               │    │  window)     │    │              │    │              │
└──────────────┘    └──────┬───────┘    └──────────────┘    └──────────────┘
                           │
                    ┌──────▼───────┐
                    │ DELETE from   │
                    │ staging after │
                    │ aggregation   │
                    │ (7-day window)│
                    └──────────────┘
```

```sql
-- Phase 1: Staging table (temporary holding area)
CREATE TABLE staging_patterns (
    staging_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Same columns as pattern_logs (copied)
    user_id             UUID NOT NULL,
    org_id              UUID NOT NULL,
    team_id             UUID NOT NULL,
    category_L1         TEXT NOT NULL,
    category_L2         TEXT,
    metric_type         TEXT NOT NULL,
    metric_value        NUMERIC NOT NULL,
    tools_involved      TEXT[] DEFAULT '{}',
    timestamp           TIMESTAMPTZ NOT NULL,
    period              TEXT NOT NULL,

    -- Staging metadata
    staged_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    aggregated          BOOLEAN DEFAULT FALSE,
    aggregated_at       TIMESTAMPTZ
);

-- Phase 1: Materialized anonymized patterns (replaces views for performance)
CREATE TABLE anonymized_patterns (
    anon_pattern_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID NOT NULL,
    team_id             UUID,              -- NULL for org-level aggregation
    category_L1         TEXT NOT NULL,
    category_L2         TEXT,
    period              TEXT NOT NULL,      -- weekly or monthly
    period_type         TEXT NOT NULL CHECK (period_type IN ('week', 'month')),

    -- Aggregated metrics (no user_id anywhere)
    total_interactions  INTEGER NOT NULL,
    user_count          INTEGER NOT NULL CHECK (user_count >= 5),
    total_metric_value  NUMERIC NOT NULL,
    avg_metric_value    NUMERIC NOT NULL,

    -- Distributions
    tool_distribution   JSONB DEFAULT '{}',
    channel_distribution JSONB DEFAULT '{}',
    content_type_distribution JSONB DEFAULT '{}',

    -- Metadata
    computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data_window_start   TIMESTAMPTZ NOT NULL,
    data_window_end     TIMESTAMPTZ NOT NULL
);

-- Weekly aggregation job
-- Runs every Monday at 2am, aggregates previous week's staging data
CREATE OR REPLACE FUNCTION run_weekly_aggregation()
RETURNS void AS $$
BEGIN
    -- 1. Insert aggregated records
    INSERT INTO anonymized_patterns (
        org_id, team_id, category_L1, category_L2,
        period, period_type,
        total_interactions, user_count, total_metric_value, avg_metric_value,
        data_window_start, data_window_end
    )
    SELECT
        org_id, team_id, category_L1, category_L2,
        TO_CHAR(timestamp, 'IYYY-"W"IW'), 'week',
        COUNT(*), COUNT(DISTINCT user_id),
        SUM(metric_value), AVG(metric_value),
        MIN(timestamp), MAX(timestamp)
    FROM staging_patterns
    WHERE NOT aggregated
      AND timestamp >= date_trunc('week', NOW() - INTERVAL '1 week')
      AND timestamp < date_trunc('week', NOW())
    GROUP BY org_id, team_id, category_L1, category_L2,
             TO_CHAR(timestamp, 'IYYY-"W"IW')
    HAVING COUNT(DISTINCT user_id) >= 5;

    -- 2. Mark staging records as aggregated
    UPDATE staging_patterns
    SET aggregated = TRUE, aggregated_at = NOW()
    WHERE NOT aggregated
      AND timestamp >= date_trunc('week', NOW() - INTERVAL '1 week')
      AND timestamp < date_trunc('week', NOW());

    -- 3. Delete aggregated staging records older than 7 days
    DELETE FROM staging_patterns
    WHERE aggregated = TRUE
      AND aggregated_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;
```

---

## Phase 0 Scope

### What We Build Now

Phase 0 uses database views for anonymization (no separate staging pipeline). This is sufficient for 3 organizations with manual advisor analysis.

1. **Database views**: `v_team_patterns`, `v_org_patterns`, `v_skill_usage` as defined above.
2. **Access control**: advisor_read_role can SELECT on views only. No access to pattern_logs.
3. **Pre-built queries**: SQL queries for advisors to run against views for monthly brief production.
4. **Automated collection**: patterns flow into pattern_logs automatically. Views aggregate in real-time.
5. **Manual brief production**: advisors query views, analyze results, produce Automate Intelligence Brief manually.

**Phase 0 flow:**

```
User interactions → pattern_logs (automated)
                         │
                         ▼
            v_team_patterns / v_org_patterns (DB views, real-time)
                         │
                         ▼
              Advisor queries views (manual, monthly)
                         │
                         ▼
              Advisor produces Automate Brief (manual)
                         │
                         ▼
              Brief delivered to leadership (PDF/Slack)
```

### What We Defer

| Capability | Target Phase | Rationale |
|---|---|---|
| Staging pipeline | Phase 1 | Views sufficient for Phase 0 scale |
| Materialized anonymized_patterns table | Phase 1 | Real-time views sufficient for 3 orgs |
| Automated aggregation job | Phase 1 | Manual advisor queries sufficient |
| Differential privacy | Phase 2 | Not needed until cross-org benchmarking |
| Anonymization audit report | Phase 1 | Manual verification sufficient |
| Pattern deletion reconciliation | Phase 1 | User deletes rare in Phase 0 |

---

## Open Questions

1. **5-user threshold validation**: Is 5 the right minimum? Microsoft Viva uses 5, but some privacy researchers argue for higher (10-15) for stronger guarantees. Should we make this configurable per org to accommodate stricter works councils?

2. **Temporal blurring granularity**: Weekly aggregation for team views, monthly for org views. Is weekly too fine-grained for small teams? A team of 6 people with weekly granularity — patterns shift significantly week-to-week, potentially enabling inference of individual changes.

3. **Cross-team aggregation**: If a user belongs to multiple teams (matrix organization), their patterns appear in both teams' aggregations. Could this enable cross-referencing to identify individuals? Mitigation: count user only once per aggregation, in their primary team.

4. **Advisor trust model**: Advisors can query anonymized views but not raw data. However, a skilled analyst with knowledge of team composition might infer individual patterns from small-team aggregations. Should we add additional safeguards (e.g., suppress outlier data points)?

5. **Real-time vs batch views**: Phase 0 uses real-time views. If an advisor queries at 3pm and a user just had an unusual interaction, that interaction is immediately visible in the aggregate. Should there be a delay (24h buffer) before patterns appear in views?

6. **View materialization strategy**: At Phase 1 scale (2,000 users), real-time views over pattern_logs may be slow. When do we switch to materialized views or the staging pipeline? Benchmark needed.
