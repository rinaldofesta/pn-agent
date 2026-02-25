# Automate Intelligence Stream Specification

**Version:** 0.1
**Status:** Draft
**Last Updated:** 2026-02-25
**Owner:** Rinaldo Festa (Technical Architecture)

---

## Context

The Automate stream is the first and most measurable intelligence stream in Play New. Its purpose: identify "work that shouldn't exist in its current form." When a finance team spends 340 hours/month on manual reconciliation across three systems, and similar organizations have automated this to 40 hours/month, that is an Automate insight.

This stream is the proof point for Play New's organizational intelligence layer. If leadership acts on Automate insights and sees measurable ROI, the dual-layer model is validated. If not, the entire strategic thesis is in question.

---

## Nanoclaw Foundation

Nanoclaw does not include an organizational intelligence layer. The Automate stream is entirely a Play New addition built on top of the pattern collection and anonymization infrastructure.

---

## Play New Requirements

From the PRD:

| Requirement | PRD Reference | Description |
|---|---|---|
| FR-006.1 | Section 8.4 | Advisors produce monthly Automate Intelligence Brief for each design partner |
| FR-006.2 | Section 8.4 | Brief contains top 3 automation opportunities with estimated time/cost savings |
| FR-006.3 | Section 8.4 | Brief includes evidence from aggregated pattern data (never individual attribution) |
| FR-006.4 | Section 8.4 | Brief includes implementation recommendations |
| FR-006.5 | Section 8.4 | Leadership can respond with questions; advisors provide deeper analysis |
| Section 13.1 | Intelligence | Automate stream: analysis framework (5 steps), output format, quality thresholds |
| Section 13.2 | Intelligence | Min 5 users, confidence >= 0.7, evidence citations, recommended actions |
| Section 8.8 | Success | >= 1 Automate insight per org that leadership considers "actionable" |

---

## Technical Specification

### Intelligence Production by Phase

| Phase | Production Method | Automation Level | Output |
|---|---|---|---|
| **Phase 0** | Manual by Play New advisors using aggregated data | 0% automated | Monthly PDF/Slack brief |
| **Phase 1** | Semi-automated: LLM generates draft, advisor reviews and refines | 70% automated | Monthly brief + dashboard |
| **Phase 2+** | Fully automated: system generates, advisor spot-checks | 95% automated | Continuous dashboard + alerts |

### Analysis Framework (5 Steps)

The Automate analysis follows a structured 5-step framework, applied to aggregated pattern data.

```
Step 1: IDENTIFY               Step 2: BENCHMARK
High time-allocation            Cross-reference with
categories (>10% of             industry standards and
team time)                      known automation patterns
      │                               │
      ▼                               ▼
Step 3: ESTIMATE                Step 4: ASSESS
Time/cost savings from          Implementation complexity
actual observed hours            (tools, effort, risk)
(not surveys or estimates)
      │                               │
      ▼                               ▼
            Step 5: RANK
            By ROI score:
            (savings x confidence) / effort
```

#### Step 1: Identify Task Categories Consuming >10% of Team Time

**Data source:** `v_team_patterns` view

```sql
-- Identify high time-allocation categories per team
WITH team_totals AS (
    SELECT
        team_id,
        team_name,
        SUM(total_duration_seconds) AS team_total_seconds
    FROM v_team_patterns
    WHERE org_id = :org_id
      AND period_week >= :period_start   -- last 4 weeks
      AND period_week <= :period_end
    GROUP BY team_id, team_name
),
category_time AS (
    SELECT
        vtp.team_id,
        vtp.team_name,
        vtp.category_L1,
        vtp.category_L2,
        SUM(vtp.total_duration_seconds) AS category_seconds,
        SUM(vtp.user_count) AS user_count,
        SUM(vtp.total_interactions) AS interaction_count,
        ARRAY_AGG(DISTINCT tool) AS tools_used
    FROM v_team_patterns vtp
    CROSS JOIN LATERAL unnest(vtp.tools_used) AS tool
    WHERE vtp.org_id = :org_id
      AND vtp.period_week >= :period_start
      AND vtp.period_week <= :period_end
    GROUP BY vtp.team_id, vtp.team_name, vtp.category_L1, vtp.category_L2
)
SELECT
    ct.team_name,
    ct.category_L1,
    ct.category_L2,
    ct.category_seconds / 3600.0 AS category_hours,
    ct.category_seconds::FLOAT / tt.team_total_seconds AS pct_of_team_time,
    ct.user_count,
    ct.interaction_count,
    ct.tools_used
FROM category_time ct
JOIN team_totals tt ON ct.team_id = tt.team_id
WHERE ct.category_seconds::FLOAT / tt.team_total_seconds >= 0.10  -- >10% threshold
ORDER BY ct.category_seconds DESC;
```

#### Step 2: Cross-Reference with Industry Benchmarks

In Phase 0, benchmarks are manually maintained by advisors based on industry knowledge. In Phase 2+, benchmarks come from cross-org data.

**Benchmark data structure:**

```json
{
  "benchmark_id": "bm_001",
  "industry": "professional_services",
  "team_function": "finance",
  "category_L1": "Communication",
  "category_L2": "Reporting",
  "benchmark_pct": 0.15,
  "automation_potential_pct": 0.70,
  "source": "advisor_estimate",
  "confidence": 0.65,
  "notes": "Industry average for manual reporting in professional services finance teams"
}
```

```sql
-- Phase 0: Manual benchmark table
CREATE TABLE automate_benchmarks (
    benchmark_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    industry            TEXT NOT NULL,
    team_function       TEXT NOT NULL,
    org_size_band       TEXT,
    category_L1         TEXT NOT NULL,
    category_L2         TEXT,
    benchmark_pct       FLOAT NOT NULL,        -- industry average % of time
    automation_potential_pct FLOAT NOT NULL,    -- % that could be automated
    typical_savings_pct FLOAT NOT NULL,        -- % reduction after automation
    source              TEXT NOT NULL CHECK (source IN (
                            'advisor_estimate', 'industry_report', 'cross_org_data'
                        )),
    confidence          FLOAT NOT NULL CHECK (confidence BETWEEN 0.0 AND 1.0),
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          UUID NOT NULL
);
```

#### Step 3: Estimate Time/Cost Savings from Actual Hours

Key differentiator: savings estimates come from actual observed hours, not surveys or estimates.

```
Savings Calculation:

  observed_hours = total hours/month for this category (from v_team_patterns)
  automation_potential = benchmark automation_potential_pct
  typical_savings = benchmark typical_savings_pct

  estimated_savings_hours = observed_hours * automation_potential * typical_savings

  avg_hourly_cost = org average fully-loaded hourly cost (from org config)

  estimated_savings_annual = estimated_savings_hours * 12 * avg_hourly_cost
```

**Example:**

```
Finance team: "Communication > Reporting > Manual data compilation"
  observed_hours: 340 hours/month (from pattern data, 8 users)
  automation_potential: 0.85 (industry benchmark: highly automatable)
  typical_savings: 0.88 (from 340h to ~40h)

  estimated_savings_hours: 340 * 0.85 * 0.88 = ~254 hours/month
  avg_hourly_cost: €60/hour

  estimated_savings_annual: 254 * 12 * €60 = €182,880
```

#### Step 4: Assess Implementation Complexity

Complexity assessment based on tools currently in use and automation readiness.

**Complexity matrix:**

| Factor | Low (1) | Medium (2) | High (3) |
|---|---|---|---|
| **Tool readiness** | Tools already have automation APIs | APIs exist but need integration | Custom development required |
| **Process standardization** | Process is well-defined and repeatable | Some variation across users | Highly variable, judgment-dependent |
| **Data quality** | Clean, structured data | Some cleanup needed | Significant data quality issues |
| **Change management** | Team is eager for automation | Team is neutral | Team is resistant |
| **Dependencies** | Self-contained within team | 1-2 cross-team dependencies | Multiple cross-team or external dependencies |

```
complexity_score = avg(tool_readiness, process_standardization, data_quality,
                       change_management, dependencies)

Implementation effort classification:
  1.0 - 1.5 = Low    (1-2 weeks, internal)
  1.6 - 2.2 = Medium (1-2 months, may need external support)
  2.3 - 3.0 = High   (3-6 months, significant investment)
```

#### Step 5: Rank by ROI

```
ROI Score = (estimated_savings_annual * confidence) / implementation_effort_score

Where:
  estimated_savings_annual = from Step 3
  confidence = min(data_confidence, benchmark_confidence)
  implementation_effort_score = from Step 4 (1-3 scale)
```

**Example ranking:**

| Rank | Opportunity | Savings/yr | Confidence | Effort | ROI Score |
|---|---|---|---|---|---|
| 1 | Finance: manual reconciliation | €182K | 0.82 | 1.8 (Medium) | 82.9 |
| 2 | Marketing: report compilation | €95K | 0.75 | 1.3 (Low) | 54.8 |
| 3 | Sales: pipeline data entry | €67K | 0.71 | 2.1 (Medium) | 22.7 |

### Output Format: Automate Intelligence Brief

```markdown
# AUTOMATE INTELLIGENCE BRIEF

**Organization:** Acme Corp
**Period:** April 2026
**Prepared by:** Play New Intelligence Engine (reviewed by [Advisor Name])
**Classification:** Confidential — Leadership Distribution Only

---

## Executive Summary

Analysis of aggregated work patterns across [X] active users in [Y] teams
identified **3 automation opportunities** with a combined estimated annual
saving of **€344K**. The top opportunity alone could recover **254 hours/month**
in the Finance team.

---

## TOP OPPORTUNITY: Finance — Manual Reconciliation

**Category:** Communication > Reporting > Manual data compilation
**Team:** Finance (8+ contributing users)
**Confidence:** 0.82

### Evidence (from aggregated pattern data)
- Finance team dedicates **340 hours/month** to reporting-category activities
- **85%** of this time involves spreadsheet tools, CRM, and communication tools
- Pattern is consistent across 4 consecutive weeks (low variance: ±12%)
- 8 distinct users exhibit this pattern (above 5-user threshold)

### Benchmark Comparison
- Similar professional services organizations (200-500 employees) typically spend
  **15%** of finance team time on reporting (Acme: **35%**)
- Organizations that have automated reconciliation report **88% time reduction**
  in this category

### Estimated Impact
| Metric | Value |
|---|---|
| Current monthly hours | 340 hours |
| Estimated post-automation hours | ~40 hours |
| Monthly time savings | ~300 hours |
| Annual cost savings | **€182,880** |
| Implementation complexity | Medium (1-2 months) |

### Recommended Actions
1. **Immediate:** Audit the 3 systems involved in reconciliation
   (identified as: spreadsheet_tools, crm, financial_tools)
2. **Week 1-2:** Evaluate integration tools (Zapier, Make, or custom API)
   to connect the systems
3. **Week 3-6:** Pilot automation with 2-3 team members
4. **Week 7-8:** Full rollout with monitoring

### Risk Factors
- Implementation depends on API availability in connected systems
- Change management: team must be trained on new workflow
- Data quality in source systems may require cleanup

---

## OPPORTUNITY #2: Marketing — Report Compilation

**Category:** Analysis > Data analysis > Marketing metrics
**Team:** Marketing (6+ contributing users)
**Confidence:** 0.75

### Evidence
- Marketing team spends **160 hours/month** on data analysis activities
- **60%** involves analytics_tools and spreadsheet_tools
- Pattern concentrated in first week of each month (reporting cycle)

### Estimated Impact
| Metric | Value |
|---|---|
| Current monthly hours | 160 hours |
| Estimated post-automation hours | ~65 hours |
| Monthly time savings | ~95 hours |
| Annual cost savings | **€95,400** (at €60/hour avg) |
| Implementation complexity | Low (1-2 weeks) |

### Recommended Actions
1. Consolidate reporting data sources into a single dashboard
2. Automate data extraction from analytics_tools via scheduled exports
3. Template standardized reports that populate automatically

---

## OPPORTUNITY #3: Sales — Pipeline Data Entry

**Category:** Coordination > Process management > Data entry
**Team:** Sales (5+ contributing users)
**Confidence:** 0.71

### Evidence
- Sales team spends **112 hours/month** on coordination activities
- Significant portion involves crm and communication tools
- Pattern is recurring weekly (pipeline update cycle)

### Estimated Impact
| Metric | Value |
|---|---|
| Current monthly hours | 112 hours |
| Estimated post-automation hours | ~45 hours |
| Monthly time savings | ~67 hours |
| Annual cost savings | **€67,000** |
| Implementation complexity | Medium (1-2 months) |

### Recommended Actions
1. Evaluate CRM automation features (activity logging, auto-capture)
2. Implement email-to-CRM integration for communication logging
3. Pilot with top 2-3 sales reps before full rollout

---

## TREND WATCH

- **AI adoption increasing in Marketing:** 40% more AI-assisted tasks this month
  vs. last. Recommend accelerating automation support for this team.
- **Communication overhead growing in Operations:** 15% increase in
  coordination-category activities. May indicate process complexity increasing.

---

## Methodology Note

All data in this brief is derived from **anonymized, aggregated work patterns**.
No individual user data is included or attributable. Minimum aggregation threshold:
5 users per pattern. All estimates carry confidence scores and are based on observed
hours, not surveys.

---

*Next brief: May 2026 | Questions? Contact [Advisor Name] or respond to this message.*
```

### Quality Thresholds

Every insight in the Automate brief must meet all of the following thresholds:

| Threshold | Minimum | Enforcement |
|---|---|---|
| **User base** | >= 5 distinct users exhibiting the pattern | Enforced by anonymized views (HAVING COUNT(DISTINCT user_id) >= 5) |
| **Confidence score** | >= 0.7 | Calculated from data confidence * benchmark confidence. Insights below 0.7 flagged for advisor review but not published. |
| **Evidence citations** | Every insight cites aggregated data | Template requires: hours, user_count, tools, period |
| **Actionability** | At least one recommended action | Template requires recommended_actions section |
| **Consistency** | Pattern observed across >= 2 consecutive periods | Single-week spikes are excluded unless explained |
| **No individual attribution** | No data that could identify individuals | All data from anonymized views; brief template has no individual-level fields |

**Confidence score calculation:**

```
confidence = data_confidence * benchmark_confidence * consistency_factor

Where:
  data_confidence = min(
    user_count / 10,     // more users = higher confidence (caps at 1.0)
    1.0 - coefficient_of_variation  // lower variance = higher confidence
  )

  benchmark_confidence = from automate_benchmarks table (0.0 - 1.0)

  consistency_factor =
    if pattern_observed_weeks >= 4: 1.0
    elif pattern_observed_weeks >= 2: 0.85
    else: 0.70
```

### Phase 0 Advisor Tooling

#### Pre-Built SQL Queries

A set of parameterized SQL queries that advisors run against anonymized views to produce the monthly brief.

```sql
-- ADVISOR QUERY SET: Automate Brief Production
-- Run these queries against the anonymized views to gather data for the brief

-- Q1: Time allocation by team and category (last 4 weeks)
SELECT
    team_name,
    category_L1,
    category_L2,
    SUM(total_duration_seconds) / 3600.0 AS total_hours,
    AVG(user_count) AS avg_users,
    SUM(total_interactions) AS interactions
FROM v_team_patterns
WHERE org_id = :org_id
  AND period_week >= :four_weeks_ago
GROUP BY team_name, category_L1, category_L2
ORDER BY total_hours DESC
LIMIT 20;

-- Q2: Categories consuming >10% of team time
WITH team_totals AS (
    SELECT team_id, SUM(total_duration_seconds) AS total_secs
    FROM v_team_patterns
    WHERE org_id = :org_id AND period_week >= :four_weeks_ago
    GROUP BY team_id
)
SELECT
    vtp.team_name,
    vtp.category_L1,
    vtp.category_L2,
    SUM(vtp.total_duration_seconds) / 3600.0 AS hours,
    SUM(vtp.total_duration_seconds)::FLOAT / tt.total_secs AS pct_of_time,
    AVG(vtp.user_count) AS avg_users
FROM v_team_patterns vtp
JOIN team_totals tt ON vtp.team_id = tt.team_id
WHERE vtp.org_id = :org_id AND vtp.period_week >= :four_weeks_ago
GROUP BY vtp.team_name, vtp.category_L1, vtp.category_L2, tt.total_secs
HAVING SUM(vtp.total_duration_seconds)::FLOAT / tt.total_secs >= 0.10
ORDER BY pct_of_time DESC;

-- Q3: Tool usage patterns by team
SELECT
    team_name,
    unnest(tools_used) AS tool_category,
    SUM(total_interactions) AS interactions,
    SUM(total_duration_seconds) / 3600.0 AS hours
FROM v_team_patterns
WHERE org_id = :org_id AND period_week >= :four_weeks_ago
GROUP BY team_name, unnest(tools_used)
ORDER BY hours DESC;

-- Q4: Week-over-week trend for top categories
SELECT
    team_name,
    category_L1,
    category_L2,
    period_week,
    SUM(total_duration_seconds) / 3600.0 AS hours,
    SUM(user_count) AS users
FROM v_team_patterns
WHERE org_id = :org_id
  AND period_week >= :eight_weeks_ago
  AND category_L1 IN (:top_categories)    -- from Q2 results
GROUP BY team_name, category_L1, category_L2, period_week
ORDER BY team_name, category_L1, period_week;

-- Q5: Skill adoption (complement to time allocation data)
SELECT
    team_name,
    skill_name,
    skill_category,
    SUM(total_activations) AS activations,
    AVG(positive_feedback_rate) AS feedback_rate,
    AVG(completion_rate) AS completion_rate
FROM v_skill_usage
WHERE org_id = :org_id AND period_week >= :four_weeks_ago
GROUP BY team_name, skill_name, skill_category
ORDER BY activations DESC;
```

#### Brief Template (Markdown)

Advisors fill in the template using query results:

```markdown
# AUTOMATE INTELLIGENCE BRIEF

**Organization:** [ORG_NAME]
**Period:** [MONTH YEAR]
**Prepared by:** [ADVISOR_NAME]

## Executive Summary
Analysis of aggregated work patterns across [USER_COUNT] active users in
[TEAM_COUNT] teams identified [N] automation opportunities with a combined
estimated annual saving of [TOTAL_SAVINGS].

## TOP OPPORTUNITY: [TEAM] — [DESCRIPTION]
**Category:** [L1] > [L2] > [L3]
**Team:** [TEAM_NAME] ([USER_COUNT]+ contributing users)
**Confidence:** [SCORE]

### Evidence
- [EVIDENCE_POINT_1]
- [EVIDENCE_POINT_2]
- [EVIDENCE_POINT_3]

### Benchmark Comparison
- [BENCHMARK_COMPARISON]

### Estimated Impact
| Metric | Value |
|---|---|
| Current monthly hours | [HOURS] |
| Estimated post-automation hours | [HOURS] |
| Annual cost savings | [SAVINGS] |
| Implementation complexity | [LOW/MEDIUM/HIGH] |

### Recommended Actions
1. [ACTION_1]
2. [ACTION_2]
3. [ACTION_3]

---

[REPEAT FOR OPPORTUNITY #2 AND #3]

## TREND WATCH
- [TREND_1]
- [TREND_2]

## Methodology Note
All data derived from anonymized, aggregated work patterns. No individual user
data included. Minimum aggregation threshold: 5 users per pattern.
```

#### Delivery Mechanisms

| Mechanism | Format | Frequency | Audience |
|---|---|---|---|
| **PDF report** | Formatted PDF generated from markdown | Monthly | C-level, printed/emailed |
| **Slack message** | Condensed summary with link to full brief | Monthly | Leadership Slack channel |
| **Dashboard** (Phase 1) | Interactive web view | Continuous | Leadership team |
| **Follow-up session** | Video call with advisor | Monthly or on-demand | Leadership + advisor |

### Phase 1 Automation Path

```
Phase 1: Semi-Automated Brief Production

  ┌──────────────────┐
  │ Anonymized Views  │
  │ (v_team_patterns, │
  │  v_org_patterns,  │
  │  v_skill_usage)   │
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │ LLM Analysis      │  ← Claude analyzes aggregated patterns
  │                    │     using the 5-step framework
  │ Input:             │
  │ - Query results    │
  │ - Benchmarks       │
  │ - Org context      │
  │ - Brief template   │
  │                    │
  │ Output:            │
  │ - Draft brief      │
  │ - Confidence scores│
  │ - Evidence links   │
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │ Advisor Review    │  ← Human reviews, edits, approves
  │                    │
  │ - Verify evidence  │
  │ - Adjust estimates │
  │ - Refine actions   │
  │ - Approve/reject   │
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │ Delivery          │  ← Dashboard + PDF + Slack
  └──────────────────┘
```

**LLM analysis prompt (Phase 1):**

```
You are an organizational intelligence analyst for [ORG_NAME], a [INDUSTRY]
company with [SIZE] employees.

Analyze the following aggregated work pattern data and produce an Automate
Intelligence Brief identifying the top 3 automation opportunities.

## Data
[INSERT QUERY RESULTS FROM v_team_patterns, v_org_patterns]

## Benchmarks
[INSERT RELEVANT BENCHMARKS FROM automate_benchmarks]

## Organization Context
[INSERT STRATEGY SUMMARY]

## Instructions
Follow the 5-step Automate analysis framework:
1. Identify categories consuming >10% of any team's time
2. Cross-reference with provided benchmarks
3. Estimate savings from actual observed hours (use €[HOURLY_RATE]/hour)
4. Assess implementation complexity (Low/Medium/High)
5. Rank by ROI: (savings × confidence) / effort

## Quality Requirements
- Every insight must cite specific data points (hours, user counts, tools)
- Confidence score must be >= 0.7 for publication
- Every insight must include at least one actionable recommendation
- NEVER reference individual users or identifiable behavior

Output the brief in the provided template format.
```

---

## Phase 0 Scope

### What We Build Now

1. **Advisor query toolkit**: pre-built SQL queries against anonymized views
2. **Brief template**: markdown template with required sections
3. **Benchmark table**: initial benchmarks populated by advisors based on industry knowledge
4. **Manual production workflow**: advisor runs queries, fills template, produces brief
5. **Delivery via PDF and Slack**: formatted brief delivered to leadership

### What We Defer

| Capability | Target Phase | Rationale |
|---|---|---|
| LLM-generated draft briefs | Phase 1 | Need validated data quality first |
| Automated benchmark comparison | Phase 1 | Need cross-org data |
| Interactive dashboard | Phase 1 | PDF sufficient for 3 orgs |
| Trend detection automation | Phase 1 | Manual trend analysis by advisor |
| ROI tracking (did action produce savings?) | Phase 1 | Need longer time horizon |
| Continuous intelligence (not just monthly) | Phase 2 | Monthly cadence for Phase 0-1 |

---

## Open Questions

1. **Hourly cost estimation**: The savings calculation requires average hourly cost per team/role. Where does this come from? Options: (a) ask client during onboarding, (b) use industry averages, (c) derive from public salary data. Recommendation: ask during onboarding, provide industry default if unavailable.

2. **Benchmark quality**: Phase 0 benchmarks are advisor estimates. How do we communicate uncertainty to leadership without undermining credibility? Include confidence scores and state source clearly ("advisor estimate based on industry experience" vs "cross-org data from 15 organizations").

3. **Brief frequency**: Monthly is the PRD spec. But if a significant pattern emerges mid-month (e.g., a team suddenly spending 50% of time on an unexpected category), should there be an alert mechanism? Or strictly monthly?

4. **Automation readiness assessment**: Step 4 (complexity assessment) requires judgment about tools, processes, and change readiness. In Phase 0, this is entirely advisor judgment. How do we systematize this for Phase 1 automation?

5. **ROI validation**: When leadership acts on an Automate insight, how do we measure whether the predicted savings materialized? Track the same pattern category over subsequent months to see if hours decreased? This creates a feedback loop that improves future estimates.

6. **Brief access control**: Who in the client organization sees the Automate brief? Only C-level? Department heads? If a brief says "Finance team spends 340h/month on manual reconciliation," the Finance director might feel defensive. Need guidance on change management framing.
