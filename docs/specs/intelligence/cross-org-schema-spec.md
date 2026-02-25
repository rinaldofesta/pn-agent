# Cross-Organization Schema Specification

**Version:** 0.1
**Status:** Draft
**Last Updated:** 2026-02-25
**Owner:** Rinaldo Festa (Technical Architecture)

---

## Context

Cross-organizational intelligence is Play New's strongest moat. When 20+ organizations use the platform, anonymized patterns can be compared across industries, geographies, and org sizes to produce benchmarks no single organization or consultant could generate: "Companies in your sector that adopted AI for client onboarding saw 40% faster time-to-value. You haven't done this yet."

This capability requires standardized data from day one. If Phase 0 organizations store patterns in incompatible formats, cross-org comparison in Phase 2+ becomes impossible without painful migration. The cross-org schema is not a Phase 2 feature — it is a Phase 0 design constraint.

**Design principle from PRD Section 6.1:** "Design for cross-org from day one. The data schema for organizational patterns must be standardized from the start so that insights from Organization A are structurally comparable to Organization B."

---

## Nanoclaw Foundation

Nanoclaw does not include any cross-organization data model. This is entirely a Play New addition.

---

## Play New Requirements

From the PRD:

| Requirement | PRD Reference | Description |
|---|---|---|
| Section 4.2 (Moat 1) | Strategy | Cross-organizational intelligence is the strongest moat. Network effect. |
| Section 6.1 (Principle 3) | Architecture | Design for cross-org from day one. Standardized schema. |
| Section 13.3 | Intelligence | Standardized Work Category Taxonomy (L1/L2/L3) |
| Section 15.2 | Data Model | Cross-org benchmarking schema with size bands, geo regions, min 3 orgs |
| Section 10.1 | Phase 2 | Cross-org benchmarking beta with 10+ organizations |
| Section 11.1 | Phase 3 | 30+ organizations produce benchmarking intelligence |

---

## Technical Specification

### Benchmark Record Format

Every pattern that flows through the system must conform to this standardized record format. This format is the lingua franca for all cross-org comparison.

```json
{
  "benchmark_id": "bm_uuid_v7",
  "industry": "professional_services",
  "org_size_band": "200-500",
  "geo": "EU_south",
  "team_function": "finance",
  "team_size_band": "5-15",
  "category_L1": "coordination",
  "category_L2": "reporting",
  "category_L3": "manual_data_compilation",
  "metric_type": "time_allocation_pct",
  "metric_value": 0.35,
  "automation_adoption_pct": 0.12,
  "period": "2026-Q2",
  "confidence": 0.82,
  "contributing_org_count": 1,
  "contributing_user_count": 8,
  "data_quality_score": 0.90,
  "taxonomy_version": "1.0",
  "created_at": "2026-07-01T00:00:00Z"
}
```

**Field definitions:**

| Field | Type | Description | Constraints |
|---|---|---|---|
| `benchmark_id` | UUID | Unique record identifier | Auto-generated |
| `industry` | string | Standardized industry classification | From `industry_taxonomy` reference table |
| `org_size_band` | string | Organization size range | One of: `50-200`, `200-500`, `500-2000`, `2000-5000`, `5000+` |
| `geo` | string | Geographic region | One of: `EU_south`, `EU_north`, `EU_west`, `EU_east`, `UK`, `US_east`, `US_west`, `APAC`, `LATAM`, `MEA` |
| `team_function` | string | Team functional area | From `team_function_taxonomy` reference table |
| `team_size_band` | string | Team size range | One of: `1-5`, `5-15`, `15-30`, `30-50`, `50+` |
| `category_L1` | string | Work category level 1 | From `work_category_taxonomy` (required) |
| `category_L2` | string | Work category level 2 | From `work_category_taxonomy` (required) |
| `category_L3` | string | Work category level 3 | From `work_category_taxonomy` (optional) |
| `metric_type` | string | Type of measurement | One of: `time_allocation_pct`, `interaction_count`, `automation_adoption_pct`, `skill_activation_rate` |
| `metric_value` | float | Measured value | 0.0-1.0 for percentages, >= 0 for counts |
| `automation_adoption_pct` | float | Percentage of this category using AI/automation | 0.0-1.0 |
| `period` | string | Time period | Format: `YYYY-QN` for quarterly |
| `confidence` | float | Statistical confidence in the value | 0.0-1.0 |
| `contributing_org_count` | int | Number of organizations contributing | >= 1 for internal, >= 3 for cross-org publication |
| `contributing_user_count` | int | Number of users contributing | >= 5 (anonymization threshold) |
| `data_quality_score` | float | Quality of underlying data | 0.0-1.0 |
| `taxonomy_version` | string | Version of work category taxonomy used | Semantic version |

### Anonymization for Cross-Org Comparison

Cross-org benchmarks require additional anonymization beyond single-org rules:

| Dimension | Single-Org | Cross-Org | Rationale |
|---|---|---|---|
| **Organization size** | Exact employee count known | Size bands only (`200-500`) | Prevent identification of specific orgs |
| **Geography** | Specific city/country | Region only (`EU_south`) | Prevent identification with small sample |
| **Team size** | Exact team size known | Size bands only (`5-15`) | Prevent inference of specific teams |
| **Industry** | Known (single org) | Standardized category | Enable comparison across similar orgs |
| **Minimum orgs** | 1 (internal data) | >= 3 contributing orgs | Prevent inference when only 2 orgs in a segment |
| **Temporal** | Weekly (team), Monthly (org) | Quarterly (cross-org) | Reduce temporal fingerprinting across orgs |

**Cross-org publication rules:**

```
A cross-org benchmark is publishable ONLY when ALL conditions are met:

1. contributing_org_count >= 3
2. contributing_user_count >= 15 (5 per org minimum, across 3+ orgs)
3. No single org contributes > 60% of the data points
4. confidence >= 0.6
5. Period is quarterly or longer
6. All identifiers are generalized to bands/regions
```

### Full Work Category Taxonomy

The work category taxonomy is the core classification system for all pattern data. Every `pattern_logs` record, every anonymized aggregation, and every cross-org benchmark must use categories from this taxonomy.

#### Level 1: Communication

All activities related to creating, processing, or managing messages between people.

| L2 Category | Code | Definition | L3 Examples |
|---|---|---|---|
| **Internal coordination** | COMM-IC | Communication within the organization for alignment and coordination | `Status updates` (COMM-IC-SU), `Meeting prep` (COMM-IC-MP), `Team announcements` (COMM-IC-TA), `Cross-team alignment` (COMM-IC-CA) |
| **Client communication** | COMM-CC | External communication with clients and customers | `Client emails` (COMM-CC-CE), `Proposals` (COMM-CC-PR), `Account updates` (COMM-CC-AU), `Client onboarding` (COMM-CC-CO) |
| **Reporting** | COMM-RE | Creating and distributing reports and summaries | `Management reports` (COMM-RE-MR), `Board materials` (COMM-RE-BM), `Compliance reports` (COMM-RE-CR), `Performance dashboards` (COMM-RE-PD) |
| **Stakeholder management** | COMM-SM | Communication with executives, partners, investors | `Exec briefings` (COMM-SM-EB), `Partner updates` (COMM-SM-PU), `Investor comms` (COMM-SM-IC), `Vendor comms` (COMM-SM-VC) |

#### Level 1: Analysis

All activities related to examining data, information, or situations to extract insights.

| L2 Category | Code | Definition | L3 Examples |
|---|---|---|---|
| **Data analysis** | ANAL-DA | Working with structured data to find patterns and insights | `Financial analysis` (ANAL-DA-FA), `Sales analysis` (ANAL-DA-SA), `Operational metrics` (ANAL-DA-OM), `Marketing analytics` (ANAL-DA-MA) |
| **Research** | ANAL-RE | Investigating topics to build understanding | `Market research` (ANAL-RE-MR), `Competitive analysis` (ANAL-RE-CA), `Technology assessment` (ANAL-RE-TA), `Industry trends` (ANAL-RE-IT) |
| **Decision support** | ANAL-DS | Preparing information to support decisions | `Scenario modeling` (ANAL-DS-SM), `Risk assessment` (ANAL-DS-RA), `Option evaluation` (ANAL-DS-OE), `Impact analysis` (ANAL-DS-IA) |
| **Quality review** | ANAL-QR | Reviewing work products for quality and accuracy | `Document review` (ANAL-QR-DR), `Code review` (ANAL-QR-CR), `Process audit` (ANAL-QR-PA), `Compliance check` (ANAL-QR-CC) |

#### Level 1: Creation

All activities related to producing new content, designs, code, or artifacts.

| L2 Category | Code | Definition | L3 Examples |
|---|---|---|---|
| **Content creation** | CREA-CO | Writing and producing textual or multimedia content | `Blog posts` (CREA-CO-BP), `Marketing copy` (CREA-CO-MC), `Documentation` (CREA-CO-DC), `Social media` (CREA-CO-SM) |
| **Design** | CREA-DE | Visual and experience design activities | `Visual design` (CREA-DE-VD), `UX design` (CREA-DE-UX), `Architecture design` (CREA-DE-AD), `Presentation design` (CREA-DE-PD) |
| **Development** | CREA-DV | Building software, systems, and integrations | `Code development` (CREA-DV-CD), `System configuration` (CREA-DV-SC), `Integration work` (CREA-DV-IW), `Testing` (CREA-DV-TE) |
| **Document preparation** | CREA-DP | Creating formal documents and templates | `Contracts` (CREA-DP-CT), `Policies` (CREA-DP-PO), `SOPs` (CREA-DP-SP), `Templates` (CREA-DP-TM) |

#### Level 1: Coordination

All activities related to managing tasks, people, processes, and workflows.

| L2 Category | Code | Definition | L3 Examples |
|---|---|---|---|
| **Project management** | COORD-PM | Planning and tracking project execution | `Task assignment` (COORD-PM-TA), `Timeline management` (COORD-PM-TM), `Resource allocation` (COORD-PM-RA), `Status tracking` (COORD-PM-ST) |
| **People management** | COORD-PE | Managing and developing team members | `1:1 preparation` (COORD-PE-11), `Performance review` (COORD-PE-PR), `Team development` (COORD-PE-TD), `Hiring/recruiting` (COORD-PE-HR) |
| **Process management** | COORD-PR | Designing and optimizing workflows | `Workflow design` (COORD-PR-WD), `Process optimization` (COORD-PR-PO), `Automation setup` (COORD-PR-AS), `Change management` (COORD-PR-CM) |
| **Scheduling** | COORD-SC | Managing time and availability | `Calendar management` (COORD-SC-CM), `Meeting coordination` (COORD-SC-MC), `Travel planning` (COORD-SC-TP), `Event planning` (COORD-SC-EP) |

#### Level 1: Strategy

All activities related to planning, decision-making, and long-term organizational thinking.

| L2 Category | Code | Definition | L3 Examples |
|---|---|---|---|
| **Planning** | STRAT-PL | Forward-looking planning activities | `Quarterly planning` (STRAT-PL-QP), `Annual planning` (STRAT-PL-AP), `Initiative design` (STRAT-PL-ID), `Roadmap creation` (STRAT-PL-RC) |
| **Decision-making** | STRAT-DM | Making or supporting strategic decisions | `Budget allocation` (STRAT-DM-BA), `Prioritization` (STRAT-DM-PR), `Go/no-go decisions` (STRAT-DM-GN), `Resource reallocation` (STRAT-DM-RR) |
| **Innovation** | STRAT-IN | Exploring new opportunities and capabilities | `New initiative design` (STRAT-IN-NI), `Product ideation` (STRAT-IN-PI), `Market opportunity` (STRAT-IN-MO), `Capability building` (STRAT-IN-CB) |
| **Monitoring** | STRAT-MO | Tracking strategic indicators and signals | `KPI tracking` (STRAT-MO-KT), `Competitive monitoring` (STRAT-MO-CM), `Trend analysis` (STRAT-MO-TA), `Market signals` (STRAT-MO-MS) |

### Taxonomy Governance

The work category taxonomy is a controlled vocabulary that must evolve carefully. Changes affect all historical data comparison.

#### Versioning

```
Taxonomy Version: MAJOR.MINOR

MAJOR version change (e.g., 1.0 → 2.0):
  - New L1 category added or removed
  - Fundamental restructuring of L2 categories
  - Backward-incompatible changes
  - Requires: data migration plan for historical records

MINOR version change (e.g., 1.0 → 1.1):
  - New L3 category added
  - Definition refinement (no structural change)
  - Backward-compatible
  - Historical data remains valid
```

#### Evolution Process

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ PROPOSAL      │───►│ REVIEW        │───►│ APPROVAL      │───►│ DEPLOYMENT    │
│               │    │               │    │               │    │               │
│ Anyone can    │    │ Technical     │    │ Product +     │    │ Deploy to     │
│ propose a     │    │ review:       │    │ Technical     │    │ taxonomy      │
│ new category  │    │ - Fits schema │    │ sign-off      │    │ table         │
│ or change     │    │ - Not dup     │    │               │    │ Update docs   │
│               │    │ - Clear def   │    │ MAJOR: CEO    │    │ Migrate if    │
│               │    │ - Examples    │    │   sign-off    │    │   needed      │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

**Taxonomy change request template:**

```json
{
  "request_id": "tcr_001",
  "request_type": "add_L3 | add_L2 | modify_definition | deprecate | merge",
  "proposed_category": {
    "code": "ANAL-DA-PI",
    "name": "Predictive analytics",
    "level": 3,
    "parent_code": "ANAL-DA",
    "definition": "Using data to predict future outcomes or trends",
    "examples": ["Demand forecasting", "Churn prediction", "Lead scoring"]
  },
  "justification": "Multiple users classifying predictive work under generic 'Data analysis'. Need finer granularity.",
  "impact_assessment": {
    "version_change": "minor",
    "historical_data_affected": false,
    "migration_required": false
  },
  "requested_by": "advisor_name",
  "requested_at": "2026-06-15"
}
```

### SQL Schema

#### Taxonomy Reference Tables

```sql
-- Work category taxonomy (the controlled vocabulary)
CREATE TABLE work_category_taxonomy (
    taxonomy_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            TEXT NOT NULL UNIQUE,   -- e.g., 'COMM-IC-SU'
    name            TEXT NOT NULL,          -- e.g., 'Status updates'
    level           INTEGER NOT NULL CHECK (level IN (1, 2, 3)),
    parent_code     TEXT,                  -- NULL for L1, L1 code for L2, L2 code for L3
    definition      TEXT NOT NULL,
    examples        TEXT[] DEFAULT '{}',

    -- Versioning
    taxonomy_version TEXT NOT NULL DEFAULT '1.0',
    introduced_in   TEXT NOT NULL DEFAULT '1.0',  -- version when added
    deprecated_in   TEXT,                          -- version when deprecated (NULL = active)

    -- Lifecycle
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_parent FOREIGN KEY (parent_code)
        REFERENCES work_category_taxonomy(code)
);

-- Hierarchical indexes
CREATE INDEX idx_taxonomy_level ON work_category_taxonomy(level) WHERE is_active = TRUE;
CREATE INDEX idx_taxonomy_parent ON work_category_taxonomy(parent_code) WHERE is_active = TRUE;
CREATE INDEX idx_taxonomy_name ON work_category_taxonomy(name) WHERE is_active = TRUE;

-- Industry taxonomy
CREATE TABLE industry_taxonomy (
    industry_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            TEXT NOT NULL UNIQUE,   -- e.g., 'professional_services'
    name            TEXT NOT NULL,          -- e.g., 'Professional Services'
    parent_code     TEXT,                  -- for sub-industries
    description     TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Team function taxonomy
CREATE TABLE team_function_taxonomy (
    function_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            TEXT NOT NULL UNIQUE,   -- e.g., 'finance'
    name            TEXT NOT NULL,          -- e.g., 'Finance'
    description     TEXT,
    typical_L1_distribution JSONB,          -- expected % per L1 category for this function
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tool generalization mapping
CREATE TABLE tool_generalization (
    specific_tool   TEXT PRIMARY KEY,       -- e.g., 'excel'
    generalized     TEXT NOT NULL,          -- e.g., 'spreadsheet_tools'
    category        TEXT NOT NULL,          -- e.g., 'productivity'
    is_active       BOOLEAN DEFAULT TRUE
);
```

#### Benchmark Records Table

```sql
-- Cross-org benchmark records
CREATE TABLE benchmark_records (
    benchmark_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Organization dimensions (all generalized to bands/regions)
    industry                TEXT NOT NULL,
    org_size_band           TEXT NOT NULL CHECK (org_size_band IN (
                                '50-200', '200-500', '500-2000', '2000-5000', '5000+'
                            )),
    geo                     TEXT NOT NULL CHECK (geo IN (
                                'EU_south', 'EU_north', 'EU_west', 'EU_east',
                                'UK', 'US_east', 'US_west', 'APAC', 'LATAM', 'MEA'
                            )),

    -- Team dimensions
    team_function           TEXT NOT NULL,
    team_size_band          TEXT NOT NULL CHECK (team_size_band IN (
                                '1-5', '5-15', '15-30', '30-50', '50+'
                            )),

    -- Work category (from taxonomy)
    category_L1             TEXT NOT NULL,
    category_L2             TEXT NOT NULL,
    category_L3             TEXT,

    -- Metrics
    metric_type             TEXT NOT NULL CHECK (metric_type IN (
                                'time_allocation_pct', 'interaction_count',
                                'automation_adoption_pct', 'skill_activation_rate'
                            )),
    metric_value            NUMERIC NOT NULL,
    automation_adoption_pct NUMERIC CHECK (automation_adoption_pct BETWEEN 0.0 AND 1.0),

    -- Temporal
    period                  TEXT NOT NULL,  -- format: 'YYYY-QN' (quarterly)

    -- Quality
    confidence              NUMERIC NOT NULL CHECK (confidence BETWEEN 0.0 AND 1.0),
    contributing_org_count  INTEGER NOT NULL CHECK (contributing_org_count >= 1),
    contributing_user_count INTEGER NOT NULL CHECK (contributing_user_count >= 5),
    data_quality_score      NUMERIC CHECK (data_quality_score BETWEEN 0.0 AND 1.0),

    -- Taxonomy version
    taxonomy_version        TEXT NOT NULL DEFAULT '1.0',

    -- Lifecycle
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_publishable          BOOLEAN DEFAULT FALSE, -- TRUE only when cross-org rules met

    -- Foreign keys to taxonomy
    CONSTRAINT fk_category_L1 FOREIGN KEY (category_L1)
        REFERENCES work_category_taxonomy(name),
    CONSTRAINT fk_industry FOREIGN KEY (industry)
        REFERENCES industry_taxonomy(code),
    CONSTRAINT fk_team_function FOREIGN KEY (team_function)
        REFERENCES team_function_taxonomy(code)
);

-- Publication rules enforced via computed column
-- A benchmark is publishable ONLY when:
--   contributing_org_count >= 3
--   contributing_user_count >= 15
--   confidence >= 0.6
ALTER TABLE benchmark_records ADD CONSTRAINT chk_publishable
    CHECK (
        (is_publishable = FALSE)
        OR (
            contributing_org_count >= 3
            AND contributing_user_count >= 15
            AND confidence >= 0.6
        )
    );

-- Indexes for benchmark queries
CREATE INDEX idx_benchmark_industry ON benchmark_records(industry, period)
    WHERE is_publishable = TRUE;
CREATE INDEX idx_benchmark_function ON benchmark_records(team_function, category_L1, period)
    WHERE is_publishable = TRUE;
CREATE INDEX idx_benchmark_geo ON benchmark_records(geo, industry, period)
    WHERE is_publishable = TRUE;
CREATE INDEX idx_benchmark_category ON benchmark_records(category_L1, category_L2, period)
    WHERE is_publishable = TRUE;
```

#### Benchmark Aggregation View

```sql
-- View for generating benchmark records from anonymized org patterns
-- Used in Phase 2+ when sufficient org data exists
CREATE OR REPLACE VIEW v_cross_org_benchmarks AS
WITH org_dimensions AS (
    SELECT
        o.org_id,
        o.industry,
        o.size_band AS org_size_band,
        o.geo
    FROM organizations o
),
team_dimensions AS (
    SELECT
        t.team_id,
        t.org_id,
        t.function AS team_function,
        CASE
            WHEN t.size BETWEEN 1 AND 5 THEN '1-5'
            WHEN t.size BETWEEN 6 AND 15 THEN '5-15'
            WHEN t.size BETWEEN 16 AND 30 THEN '15-30'
            WHEN t.size BETWEEN 31 AND 50 THEN '30-50'
            ELSE '50+'
        END AS team_size_band
    FROM teams t
)
SELECT
    od.industry,
    od.org_size_band,
    od.geo,
    td.team_function,
    td.team_size_band,
    ap.category_L1,
    ap.category_L2,
    'time_allocation_pct' AS metric_type,
    AVG(ap.total_metric_value) AS avg_metric_value,
    ap.period,
    COUNT(DISTINCT od.org_id) AS contributing_org_count,
    SUM(ap.user_count) AS contributing_user_count,
    -- Confidence: higher with more orgs and more users
    LEAST(1.0,
        (COUNT(DISTINCT od.org_id)::FLOAT / 10.0) *  -- more orgs = higher confidence
        (SUM(ap.user_count)::FLOAT / 50.0)            -- more users = higher confidence
    ) AS confidence
FROM anonymized_patterns ap
JOIN team_dimensions td ON ap.team_id = td.team_id
JOIN org_dimensions od ON ap.org_id = od.org_id
WHERE ap.period_type = 'month'
GROUP BY
    od.industry, od.org_size_band, od.geo,
    td.team_function, td.team_size_band,
    ap.category_L1, ap.category_L2, ap.period
HAVING
    COUNT(DISTINCT od.org_id) >= 3        -- minimum 3 orgs
    AND SUM(ap.user_count) >= 15;          -- minimum 15 users total
```

### Validation Rules

Every pattern record must map to the taxonomy. Unmapped categories are rejected.

**Validation at collection time:**

```typescript
interface PatternValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  normalized: {
    category_L1: string;
    category_L2: string;
    category_L3: string | null;
  } | null;
}

async function validatePattern(pattern: PatternRecord): Promise<PatternValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Validate L1 category exists and is active
  const l1 = await taxonomyLookup(pattern.category_L1, 1);
  if (!l1) {
    errors.push(`Invalid category_L1: "${pattern.category_L1}". Must be one of: Communication, Analysis, Creation, Coordination, Strategy`);
  }

  // 2. Validate L2 category exists and is child of L1
  if (pattern.category_L2) {
    const l2 = await taxonomyLookup(pattern.category_L2, 2);
    if (!l2) {
      errors.push(`Invalid category_L2: "${pattern.category_L2}"`);
    } else if (l2.parent_code !== l1?.code) {
      errors.push(`category_L2 "${pattern.category_L2}" is not a child of category_L1 "${pattern.category_L1}"`);
    }
  }

  // 3. Validate L3 category exists and is child of L2
  if (pattern.category_L3) {
    const l3 = await taxonomyLookup(pattern.category_L3, 3);
    if (!l3) {
      warnings.push(`Unknown category_L3: "${pattern.category_L3}". Recording as L2 only.`);
    } else if (l3.parent_code !== (await taxonomyLookup(pattern.category_L2!, 2))?.code) {
      warnings.push(`category_L3 "${pattern.category_L3}" is not a child of category_L2 "${pattern.category_L2}"`);
    }
  }

  // 4. Validate tools are generalized
  for (const tool of pattern.tools_involved || []) {
    if (!isGeneralizedTool(tool)) {
      errors.push(`Tool "${tool}" is not generalized. Use generalizeTool() before storage.`);
    }
  }

  // 5. Validate metric_type and metric_value compatibility
  if (pattern.metric_type === 'time_allocation_pct' &&
      (pattern.metric_value < 0 || pattern.metric_value > 1)) {
    errors.push(`time_allocation_pct must be between 0.0 and 1.0, got ${pattern.metric_value}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    normalized: errors.length === 0 ? {
      category_L1: l1!.name,
      category_L2: pattern.category_L2 || null,
      category_L3: pattern.category_L3 || null,
    } : null,
  };
}
```

**Unmapped category handling:**

When the LLM classifies an interaction into a category not in the taxonomy:

```
1. Log the unmapped classification for analysis
2. Attempt fuzzy match to closest taxonomy entry
3. If fuzzy match confidence > 0.8: use the matched category, log as auto-corrected
4. If fuzzy match confidence <= 0.8: classify as L1 only (most general), flag for review
5. Weekly report of unmapped classifications → input for taxonomy evolution
```

```sql
-- Unmapped classifications tracking
CREATE TABLE unmapped_classifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raw_category    TEXT NOT NULL,          -- what the LLM classified
    attempted_L1    TEXT,
    attempted_L2    TEXT,
    attempted_L3    TEXT,
    fuzzy_match     TEXT,                  -- closest taxonomy match
    fuzzy_score     FLOAT,                 -- match confidence
    resolution      TEXT CHECK (resolution IN (
                        'auto_corrected', 'generalized_to_L1',
                        'taxonomy_updated', 'manually_resolved', 'pending'
                    )),
    org_id          UUID NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ
);
```

### Reference Data: Industry Taxonomy

```sql
INSERT INTO industry_taxonomy (code, name, description) VALUES
('technology', 'Technology', 'Software, hardware, internet, and IT services'),
('professional_services', 'Professional Services', 'Consulting, legal, accounting, and advisory'),
('manufacturing', 'Manufacturing', 'Production of physical goods'),
('media_entertainment', 'Media & Entertainment', 'Publishing, broadcasting, digital media, gaming'),
('retail_ecommerce', 'Retail & E-commerce', 'Physical and online retail'),
('financial_services', 'Financial Services', 'Banking, insurance, investment management'),
('healthcare', 'Healthcare', 'Hospitals, clinics, health technology'),
('education', 'Education', 'Schools, universities, edtech, corporate training'),
('energy_utilities', 'Energy & Utilities', 'Power generation, distribution, renewable energy'),
('real_estate', 'Real Estate', 'Property development, management, brokerage'),
('telecommunications', 'Telecommunications', 'Network operators, communications providers'),
('transportation_logistics', 'Transportation & Logistics', 'Shipping, freight, supply chain'),
('government_nonprofit', 'Government & Nonprofit', 'Public sector and nonprofit organizations');
```

### Reference Data: Team Function Taxonomy

```sql
INSERT INTO team_function_taxonomy (code, name, description, typical_L1_distribution) VALUES
('finance', 'Finance', 'Financial planning, accounting, treasury, audit',
 '{"Communication": 0.25, "Analysis": 0.35, "Creation": 0.10, "Coordination": 0.20, "Strategy": 0.10}'),
('sales', 'Sales', 'Revenue generation, account management, business development',
 '{"Communication": 0.40, "Analysis": 0.15, "Creation": 0.10, "Coordination": 0.25, "Strategy": 0.10}'),
('marketing', 'Marketing', 'Brand, demand generation, content, events',
 '{"Communication": 0.30, "Analysis": 0.15, "Creation": 0.30, "Coordination": 0.15, "Strategy": 0.10}'),
('engineering', 'Engineering', 'Software development, infrastructure, QA',
 '{"Communication": 0.15, "Analysis": 0.15, "Creation": 0.45, "Coordination": 0.15, "Strategy": 0.10}'),
('operations', 'Operations', 'Business operations, supply chain, facilities',
 '{"Communication": 0.20, "Analysis": 0.20, "Creation": 0.10, "Coordination": 0.35, "Strategy": 0.15}'),
('hr', 'Human Resources', 'Recruitment, people ops, L&D, compensation',
 '{"Communication": 0.30, "Analysis": 0.15, "Creation": 0.15, "Coordination": 0.30, "Strategy": 0.10}'),
('legal', 'Legal', 'Legal counsel, compliance, contracts, IP',
 '{"Communication": 0.25, "Analysis": 0.30, "Creation": 0.20, "Coordination": 0.15, "Strategy": 0.10}'),
('strategy', 'Strategy', 'Corporate strategy, M&A, transformation',
 '{"Communication": 0.20, "Analysis": 0.30, "Creation": 0.10, "Coordination": 0.10, "Strategy": 0.30}'),
('product', 'Product', 'Product management, design, research',
 '{"Communication": 0.25, "Analysis": 0.20, "Creation": 0.20, "Coordination": 0.20, "Strategy": 0.15}'),
('customer_success', 'Customer Success', 'Customer support, success management, onboarding',
 '{"Communication": 0.40, "Analysis": 0.15, "Creation": 0.10, "Coordination": 0.25, "Strategy": 0.10}'),
('design', 'Design', 'UX, visual design, research, design systems',
 '{"Communication": 0.15, "Analysis": 0.15, "Creation": 0.50, "Coordination": 0.10, "Strategy": 0.10}'),
('executive', 'Executive', 'C-suite and senior leadership',
 '{"Communication": 0.30, "Analysis": 0.10, "Creation": 0.05, "Coordination": 0.20, "Strategy": 0.35}');
```

---

## Phase 0 Scope

### What We Build Now

1. **Define and deploy the full taxonomy**: All L1/L2/L3 categories populated in the `work_category_taxonomy` table from day one.
2. **Validate at collection time**: Every pattern record validated against taxonomy before storage. Reject unmapped categories.
3. **Industry and team function reference data**: Populated for Phase 0 design partner industries.
4. **Benchmark record format defined**: schema ready even though cross-org comparison is not yet possible.
5. **Unmapped classification tracking**: Log and analyze misclassifications to improve taxonomy.
6. **Tool generalization mapping**: Complete mapping table deployed.

**Phase 0 focuses on data quality, not comparison:**

The goal in Phase 0 is not to produce cross-org benchmarks (we only have 3 organizations). The goal is to ensure that all data collected conforms to the standardized schema so that when we have 10+ organizations in Phase 2, the data is immediately comparable.

### What We Defer

| Capability | Target Phase | Rationale |
|---|---|---|
| Cross-org benchmark generation | Phase 2 | Requires 10+ organizations |
| Benchmark publication (cross-org) | Phase 2 | Requires 3+ orgs per segment |
| Automated taxonomy evolution | Phase 1 | Manual governance sufficient for Phase 0 |
| Benchmark comparison dashboard | Phase 2 | No cross-org data to compare yet |
| Statistical significance testing | Phase 2 | Not needed until cross-org |
| typical_L1_distribution benchmarking | Phase 1 | Need real data to validate |
| Differential privacy for cross-org | Phase 2+ | Overkill for single-org data |

### Phase 0 Validation Metrics

| Metric | Target | Purpose |
|---|---|---|
| Taxonomy coverage | >95% of patterns classify to L1+L2 | Taxonomy is comprehensive enough |
| L3 coverage | >60% of patterns classify to L3 | L3 granularity is useful |
| Unmapped rate | <5% of classifications | LLM can use the taxonomy effectively |
| Classification consistency | >80% inter-rater agreement (LLM vs advisor spot-check) | Classifications are reliable |

---

## Open Questions

1. **Taxonomy completeness**: Is the current taxonomy comprehensive enough for all knowledge work? Phase 0 design partners span professional services, and possibly tech and manufacturing. Are there industry-specific L2/L3 categories we are missing?

2. **Classification language**: The taxonomy is in English. Phase 0 organizations may operate in Italian. Should we maintain bilingual category names, or classify in English regardless of conversation language?

3. **Typical distribution benchmarks**: The `typical_L1_distribution` in team_function_taxonomy is advisor-estimated. How do we validate these with real data? Use Phase 0 data from 3 orgs as initial ground truth?

4. **Taxonomy granularity vs accuracy trade-off**: More L3 categories enable richer benchmarking but reduce classification accuracy. Should we start with fewer L3 categories and expand based on demand?

5. **Cross-org data sharing consent**: When we reach Phase 2, organizations must consent to their anonymized data being used for cross-org benchmarks. Is this consent captured at contract time, or do we need a separate opt-in? Legal review needed.

6. **Geo classification for multinational orgs**: If an organization has offices in Milan, London, and Berlin, what `geo` do we use? The HQ location? Or split by office? If split, patterns from a small office (3 people) may fall below the 5-user threshold.

7. **Period alignment**: Cross-org benchmarks use quarterly periods. But organizations may start using Play New at different times within a quarter. How do we handle partial-quarter data? Exclude quarters with less than 2 months of data?
