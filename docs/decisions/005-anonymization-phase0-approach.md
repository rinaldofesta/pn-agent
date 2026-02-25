# ADR-005: Anonymization Phase 0 Approach

**Status:** Accepted
**Date:** 2026-02-25
**Deciders:** Rinaldo Festa (Technical Architect), Matteo Roversi (Product)
**Technical Story:** Play New needs a Phase 0 approach to collecting and analyzing organizational patterns that (a) respects privacy guarantees, (b) produces actionable intelligence for advisors, and (c) builds a data foundation ready for Phase 1 automation.

---

## Context

Play New's dual-layer model depends on aggregating individual assistant usage into organizational intelligence. The privacy architecture (PRD Section 7) mandates that individual data never surfaces in the organizational layer -- only anonymized, categorical patterns cross the privacy boundary.

Phase 0's organizational intelligence is **manual**: Play New advisors (from Cosmico's network) analyze patterns and produce monthly Automate Intelligence Briefs for leadership (PRD Section 8.4, FR-006). The question is how much of the data pipeline is automated vs. manual.

### Key Constraints

1. **Privacy is architecture, not procedure.** The PRD's core principle (Section 7.1) is that "the assistant works for the person, not the company." Privacy enforcement must be technical, not dependent on advisor discipline.
2. **5-user aggregation threshold.** Patterns only surface when 5 or more users exhibit them (PRD Section 7.3). This is a hard rule, not a guideline.
3. **Advisors cannot see individual data.** Not "should not" -- physically cannot. The system must make it technically impossible for advisors to access per-user interaction content, timing, or behavior.
4. **Phase 1 will automate the pipeline.** Whatever schema and collection mechanism we build for Phase 0 must be the foundation for automated pattern aggregation, not a throwaway.
5. **Phase 0 scale is small.** 60-150 users across 3 organizations. Small enough that manual analysis is feasible, but large enough that privacy enforcement is not trivial.

### What Data Flows Through the System

Each time a user interacts with their assistant, the system logs categorical metadata (never content):

```
User sends message
  -> Assistant processes message
  -> Pattern collector extracts categorical data:
     - Interaction type: "email_analysis" | "report_analysis" | "skill_invocation" | ...
     - Work category (L1/L2/L3 from taxonomy): "communication/client_communication/email_triage"
     - Tools mentioned: ["crm", "spreadsheet_tools"] (generalized, never specific product names)
     - Skill invoked (if any): "pipeline-risk-scan"
     - Skill feedback (if any): "useful" | "not_useful" | "needs_improvement"
     - Content type shared: "email" | "document" | "message" | "data"
  -> Categorical record written to pattern_logs table
  -> Content itself stays in personal memory (encrypted, user-scoped)
```

The question is: who can read `pattern_logs`, and how?

---

## Options Evaluated

### Option A: Fully Manual -- Advisors Read Raw Pattern Logs

Advisors query `pattern_logs` directly (filtered by org). They see per-user records: "user_instance X performed email_analysis at timestamp Y." They mentally aggregate and produce the intelligence brief.

| Aspect | Assessment |
|--------|------------|
| **Speed to implement** | Fastest -- no views, no aggregation logic |
| **Privacy** | Violates privacy architecture. Advisors can see per-user patterns, timestamps, and behavioral sequences. Even without names, user_instance_id + timestamp patterns can identify individuals ("who works at 11pm?"). |
| **Phase 1 readiness** | Poor -- no aggregation infrastructure to automate |
| **Trust** | Fails the "technically impossible" standard. Trust depends on advisor discipline. |

### Option B: Automated Collection + Manual Analysis (via Anonymized Views)

The system collects categorical patterns automatically into `pattern_logs`. PostgreSQL views enforce anonymization rules: they aggregate by team/category, apply the 5-user threshold, blur timestamps to weekly periods, and expose only aggregate metrics. Advisors query the views, never the underlying tables.

| Aspect | Assessment |
|--------|------------|
| **Speed to implement** | Moderate -- requires view definitions and access control, but no complex pipeline |
| **Privacy** | Strong -- advisors physically cannot access individual records. Views enforce aggregation. Database permissions prevent direct table access. |
| **Phase 1 readiness** | Excellent -- views become the foundation for the automated intelligence pipeline. Schema is production-ready. |
| **Trust** | Meets the "technically impossible" standard. Privacy is enforced by the database, not by process. |

### Option C: Fully Automated Pipeline

Skip manual analysis entirely. Build an automated system that collects patterns, runs aggregation, applies statistical analysis, and produces intelligence briefs without advisor involvement.

| Aspect | Assessment |
|--------|------------|
| **Speed to implement** | Slow -- requires building the full intelligence pipeline (pattern aggregation, statistical analysis, insight generation, brief formatting) before Phase 0 can produce value |
| **Privacy** | Excellent -- no human sees any data at any granularity |
| **Phase 1 readiness** | Redundant -- this IS the Phase 1 pipeline |
| **Trust** | Technically superior, but unvalidated. We don't know if the automated analysis produces useful insights. The whole point of Phase 0 is to validate this with human intelligence first. |

---

## Decision

**Option B: Automated categorical pattern collection into `pattern_logs` table, with PostgreSQL views enforcing anonymization rules. Advisors query views only.**

Specifically:

### 1. Pattern Collection (Automated)

Every assistant interaction produces a categorical pattern record. The pattern collector (`src/intelligence/pattern-collector.ts`) extracts metadata and writes to `pattern_logs`:

```sql
INSERT INTO pattern_logs (
    pattern_id,
    org_id,
    team_id,
    user_instance_id,    -- stored for aggregation, never exposed
    interaction_type,
    category_l1,
    category_l2,
    category_l3,
    tools_involved,       -- JSONB array of generalized tool categories
    skill_id,
    skill_feedback,
    content_type,
    period_week,          -- ISO week (YYYY-Www), not timestamp
    created_at
) VALUES (...);
```

Note: `created_at` is used internally for data management. The `period_week` field is the temporal grain exposed to views -- weekly, never daily or hourly.

### 2. Anonymized Views (Privacy Boundary)

Three PostgreSQL views enforce the anonymization rules:

**`v_team_patterns` -- Team-level pattern aggregation:**

```sql
CREATE VIEW v_team_patterns AS
SELECT
    org_id,
    team_id,
    category_l1,
    category_l2,
    category_l3,
    interaction_type,
    period_week,
    COUNT(DISTINCT user_instance_id) AS user_count,
    COUNT(*) AS interaction_count,
    -- Generalized tool usage (array aggregation)
    array_agg(DISTINCT unnested_tool) AS tools_observed
FROM pattern_logs,
     LATERAL unnest(tools_involved) AS unnested_tool
GROUP BY org_id, team_id, category_l1, category_l2, category_l3,
         interaction_type, period_week
HAVING COUNT(DISTINCT user_instance_id) >= 5;    -- Anonymization threshold
```

**`v_org_patterns` -- Organization-level pattern aggregation:**

```sql
CREATE VIEW v_org_patterns AS
SELECT
    org_id,
    category_l1,
    category_l2,
    interaction_type,
    period_week,
    COUNT(DISTINCT team_id) AS team_count,
    COUNT(DISTINCT user_instance_id) AS user_count,
    COUNT(*) AS interaction_count,
    array_agg(DISTINCT unnested_tool) AS tools_observed
FROM pattern_logs,
     LATERAL unnest(tools_involved) AS unnested_tool
GROUP BY org_id, category_l1, category_l2, interaction_type, period_week
HAVING COUNT(DISTINCT user_instance_id) >= 5;
```

**`v_skill_usage` -- Skill usage and feedback aggregation:**

```sql
CREATE VIEW v_skill_usage AS
SELECT
    org_id,
    skill_id,
    period_week,
    COUNT(DISTINCT user_instance_id) AS user_count,
    COUNT(*) AS activation_count,
    COUNT(CASE WHEN skill_feedback = 'useful' THEN 1 END) AS useful_count,
    COUNT(CASE WHEN skill_feedback = 'not_useful' THEN 1 END) AS not_useful_count,
    COUNT(CASE WHEN skill_feedback = 'needs_improvement' THEN 1 END) AS improve_count,
    ROUND(
        COUNT(CASE WHEN skill_feedback = 'useful' THEN 1 END)::numeric /
        NULLIF(COUNT(skill_feedback), 0), 2
    ) AS positive_feedback_rate
FROM pattern_logs
WHERE skill_id IS NOT NULL
GROUP BY org_id, skill_id, period_week
HAVING COUNT(DISTINCT user_instance_id) >= 5;
```

### 3. Access Control

```sql
-- Advisor role can ONLY access views, never underlying tables
CREATE ROLE pn_advisor;
GRANT USAGE ON SCHEMA org_{org_id} TO pn_advisor;
GRANT SELECT ON org_{org_id}.v_team_patterns TO pn_advisor;
GRANT SELECT ON org_{org_id}.v_org_patterns TO pn_advisor;
GRANT SELECT ON org_{org_id}.v_skill_usage TO pn_advisor;

-- Explicitly deny access to pattern_logs
REVOKE ALL ON org_{org_id}.pattern_logs FROM pn_advisor;

-- App role has full access (needed for collection)
GRANT SELECT, INSERT ON org_{org_id}.pattern_logs TO pn_app;
-- App role does NOT have UPDATE or DELETE (append-only)
REVOKE UPDATE, DELETE ON org_{org_id}.pattern_logs FROM pn_app;
```

### 4. Advisor Workflow

Advisors use pre-built SQL queries against the anonymized views to prepare intelligence briefs:

```sql
-- "What work categories consume the most interaction time in marketing?"
SELECT category_l1, category_l2, interaction_count, user_count
FROM v_team_patterns
WHERE team_id = (SELECT team_id FROM teams WHERE name = 'Marketing')
  AND period_week >= '2026-W18'
ORDER BY interaction_count DESC
LIMIT 10;

-- "Which skills are getting the best feedback?"
SELECT s.name, vu.activation_count, vu.positive_feedback_rate, vu.user_count
FROM v_skill_usage vu
JOIN skill_definitions s ON s.skill_id = vu.skill_id
WHERE vu.period_week >= '2026-W18'
ORDER BY vu.positive_feedback_rate DESC;

-- "What tools are most commonly used across the organization?"
SELECT unnested_tool, SUM(interaction_count) as total_interactions
FROM v_org_patterns, LATERAL unnest(tools_observed) AS unnested_tool
WHERE period_week >= '2026-W18'
GROUP BY unnested_tool
ORDER BY total_interactions DESC;
```

Advisors take these query results, apply strategic analysis frameworks, and produce the monthly Automate Intelligence Brief (PRD Section 13.1).

---

## Consequences

### Positive

1. **Privacy as architecture.** Advisors physically cannot access individual data. The PostgreSQL view + role system enforces this at the database level. Even if an advisor wanted to see per-user data, the database rejects the query. This satisfies the PRD's "technically impossible" standard.
2. **Schema ready for Phase 1 automation.** The `pattern_logs` table, work category taxonomy, and anonymized views are the exact foundation the automated intelligence pipeline needs. Phase 1 replaces "advisor queries views manually" with "system queries views programmatically and generates insights." Same schema, different consumer.
3. **Append-only pattern logs.** Pattern logs cannot be modified or deleted (by any role). This creates an auditable, tamper-evident data trail that supports GDPR compliance audits.
4. **5-user threshold is enforced technically.** The `HAVING COUNT(DISTINCT user_instance_id) >= 5` clause in every view means patterns from fewer than 5 users are invisible. No configuration, no override, no "admin bypass."
5. **Temporal blurring is structural.** The `period_week` field (ISO week) prevents daily or hourly correlation attacks. An advisor sees "18 interactions in communication/client_communication during week 22" but cannot determine which day or time of day those interactions occurred.
6. **Structured data for advisors.** Instead of manually reading through logs, advisors query structured aggregations. This is faster, more consistent, and produces better intelligence.

### Negative

1. **View performance at scale.** Aggregating `pattern_logs` on every query is not efficient for large datasets. For Phase 0 (150 users, ~1K records/day), this is fine. For Phase 1+, we will need materialized views or pre-computed aggregation tables.
2. **Limited analytical capability.** Views provide counts and distributions but not statistical tests (standard deviation, percentile, trend analysis). Advisors must compute these manually or we must add more sophisticated views. The current views are sufficient for Phase 0's manual workflow.
3. **No real-time analysis.** Views reflect committed data. There is a small lag between a pattern being logged and appearing in view results. For Phase 0 (monthly briefs), this is irrelevant.
4. **Advisor SQL dependency.** Advisors need to run SQL queries. Not all advisors will be comfortable with SQL. Mitigation: provide a library of pre-written queries with parameter placeholders that advisors fill in.

---

## Privacy Guarantees Summary

| Guarantee | Enforcement Mechanism |
|-----------|----------------------|
| Individual interaction content never leaves personal memory | Content is not written to `pattern_logs`. Only categorical metadata is logged. |
| Patterns require 5+ users to surface | `HAVING COUNT(DISTINCT user_instance_id) >= 5` in all views |
| No individual attribution | Views aggregate by team/org. `user_instance_id` exists in `pattern_logs` but is not in any view's SELECT clause. |
| Temporal blurring | `period_week` (ISO week) is the finest temporal grain in views. `created_at` in `pattern_logs` is not exposed to advisor role. |
| Tool generalization | Pattern collector generalizes specific tools ("Salesforce" -> "crm", "Excel" -> "spreadsheet_tools") before writing to `pattern_logs`. |
| Advisor cannot access raw data | PostgreSQL role `pn_advisor` has SELECT on views only. REVOKE ALL on `pattern_logs`. |
| Pattern logs are append-only | No UPDATE or DELETE granted to any application role. Only database admin (for GDPR deletion requests) can modify. |

---

## GDPR Data Deletion

When a user exercises their right to data deletion (PRD FR-001.6):

1. All personal data (conversations, personal memory) is hard-deleted.
2. Pattern log records for that user are **anonymized** (set `user_instance_id = NULL`), not deleted. This preserves aggregate counts while removing the ability to attribute records to the deleted user.
3. If anonymizing the records would cause any view aggregation to drop below the 5-user threshold, those records are fully deleted.
4. An audit log entry records the deletion event.

```sql
-- GDPR deletion: anonymize pattern logs for a user
UPDATE pattern_logs
SET user_instance_id = NULL
WHERE user_instance_id = $1;

-- Verify no threshold violation
-- (handled by application logic before committing the transaction)
```

This approach preserves organizational intelligence while fully complying with the right to erasure.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **5-user threshold blocks intelligence in small teams** | Medium | Medium | Some teams may have fewer than 5 users. Their patterns will not surface until combined with another team at the org level. Advisors are briefed on this limitation. |
| **Advisor SQL errors produce misleading results** | Medium | Medium | Provide a curated query library. Review advisor queries during first month. Build a simple query UI in Phase 1. |
| **Pattern collector misclassifies work categories** | Medium | Medium | Start with a conservative taxonomy. Validate classification accuracy with advisors during weeks 5-8. Refine classifier based on feedback. |
| **View performance degrades with data volume** | Low (Phase 0) | Low | Monitor query times. Add materialized views when P95 query time exceeds 5 seconds. Not expected to be an issue until Phase 1+. |
| **Correlation attack via small group patterns** | Low | High | The 5-user threshold mitigates most correlation attacks. Temporal blurring prevents time-based correlation. Phase 2 adds differential privacy (calibrated noise) for additional protection. |
| **PostgreSQL role misconfiguration allows advisor access to raw data** | Low | Critical | Infrastructure-as-code for role definitions. Integration test verifies advisor role cannot SELECT from `pattern_logs`. Reviewed during security audit. |

---

## Review Date

This decision will be reviewed at the Phase 0 retrospective (approximately July 2026) to assess:
- Do advisors have sufficient data quality from the anonymized views to produce actionable intelligence?
- Is the 5-user threshold too restrictive for the design partner org sizes?
- Are the pre-built queries sufficient, or do advisors need a query builder UI?
- Is the pattern classification accurate enough for the intelligence pipeline?
- What additional views or aggregations are needed for Phase 1 automation?
