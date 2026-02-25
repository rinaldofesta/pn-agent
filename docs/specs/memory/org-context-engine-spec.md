# Organizational Context Engine Specification

**Version:** 0.1
**Status:** Draft
**Last Updated:** 2026-02-25
**Owner:** Rinaldo Festa (Technical Architecture)

---

## Context

A personal assistant without organizational awareness is just another chatbot. The Organizational Context Engine is the "brain" that makes every Play New assistant strategically aware. When a user asks their assistant about a client situation, the assistant should know the company's strategy, competitive position, team structure, and relevant CRM data — without the user having to explain any of it.

This is what separates Play New from generic AI assistants: every response is grounded in the reality of this specific organization.

---

## Nanoclaw Foundation

Nanoclaw provides a global context injection mechanism:

| Nanoclaw Concept | Location | Purpose |
|---|---|---|
| **Global CLAUDE.md** | `groups/global/CLAUDE.md` | Shared instructions injected into every agent instance in the group |
| **Group CLAUDE.md** | `groups/{name}/CLAUDE.md` | Group-specific context layered on top of global |
| **MCP servers** | MCP configuration in agent runner | External data sources exposed as tools to the Claude SDK |

Play New extends the `globalClaudeMd` concept from a static file into a dynamic, multi-source context engine that combines strategic documents, live data connections, and analytical frameworks.

---

## Play New Requirements

From the PRD:

| Requirement | PRD Reference | Description |
|---|---|---|
| FR-001.3 | Section 8.4 | Assistant has access to organizational context (strategy doc, team structure, industry context) |
| FR-004.1 | Section 8.4 | Strategic context document stored as living knowledge base accessible to all assistant instances |
| FR-004.2 | Section 8.4 | Team structure and reporting lines available for context |
| FR-004.3 | Section 8.4 | Industry and competitive context available for analysis |
| FR-004.4 | Section 8.4 | Data source connections (CRM, financials) provide real-time context to assistants |
| FR-004.5 | Section 8.4 | Strategic context document updatable by advisors without engineering involvement |
| Section 6.3.5 | Architecture | Components: Data Connectors, Strategic Context Document, Framework Library, Competitive Intelligence |
| Section 20.1 | Tech Stack | PostgreSQL + pgvector for org context store |

---

## Technical Specification

### Architecture Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                  ORGANIZATIONAL CONTEXT ENGINE                      │
│                                                                    │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐  │
│  │ Strategic Context │  │ Data Connectors  │  │ Framework       │  │
│  │ Documents         │  │ (MCP)            │  │ Library         │  │
│  │                   │  │                  │  │                 │  │
│  │ - Strategy doc    │  │ - CRM connector  │  │ - Wardley Maps  │  │
│  │ - Team structure  │  │ - Directory      │  │ - Blue Ocean    │  │
│  │ - Industry brief  │  │ - Project tools  │  │ - JTBD          │  │
│  │ - Competitive pos │  │ - Financials     │  │ - Porter's 5    │  │
│  └────────┬─────────┘  └────────┬─────────┘  └───────┬─────────┘  │
│           │                     │                     │            │
│  ┌────────▼─────────────────────▼─────────────────────▼─────────┐  │
│  │                    CONTEXT STORE                               │  │
│  │          PostgreSQL + pgvector                                 │  │
│  │                                                               │  │
│  │  org_context_docs → chunked, embedded, indexed                │  │
│  │  org_data_cache   → structured data from MCP connectors       │  │
│  │  org_frameworks   → framework templates + org customization   │  │
│  └──────────────────────────────┬────────────────────────────────┘  │
│                                 │                                   │
│  ┌──────────────────────────────▼────────────────────────────────┐  │
│  │                    RAG PIPELINE                                │  │
│  │                                                               │  │
│  │  User Query → Embed → Similarity Search → Rank → Inject      │  │
│  │                                                               │  │
│  │  Output: relevant context chunks for system prompt            │  │
│  └───────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

### Components

#### 1. Strategic Context Documents

Living markdown documents that capture the organization's strategic reality. Created during onboarding by Play New advisors, updated monthly.

**Document types:**

| Document | Content | Update Frequency | Created By |
|---|---|---|---|
| **Strategy Document** | Mission, vision, strategic priorities, OKRs, current initiatives, decision principles | Monthly review | Advisor + client leadership |
| **Team Structure** | Org chart, team functions, reporting lines, key roles, team mandates | On change | Advisor |
| **Industry Brief** | Industry dynamics, trends, regulatory landscape, market size, key players | Quarterly | Advisor |
| **Competitive Position** | Key competitors, positioning, strengths/weaknesses, market share estimates | Quarterly | Advisor |
| **Culture & Values** | Communication norms, decision-making style, values, taboo topics | On onboarding, rarely updated | Advisor |

**Example Strategy Document structure:**

```markdown
# Strategic Context: Acme Corp

## Company Overview
- Founded: 2005
- Industry: Professional Services (Management Consulting)
- Size: 380 employees across 4 offices (Milan, Rome, London, Berlin)
- Revenue: €45M (FY2025), target €52M (FY2026)
- Key differentiator: Deep expertise in digital transformation for manufacturing

## Strategic Priorities (2026)
1. **Expand UK market** — Grow London office from 40 to 80 consultants
2. **Productize IP** — Convert 3 delivery frameworks into licensable products
3. **AI integration** — Embed AI into 100% of client engagements by Q4

## Current Initiatives
- Project Atlas: CRM migration from Salesforce to HubSpot (Q1-Q2)
- Project Minerva: New practice area — sustainability consulting
- Hiring sprint: 25 senior consultants by June

## Decision Principles
- Client relationships > short-term revenue
- Data-driven decisions required for any investment > €50K
- All client-facing materials must be reviewed by practice lead

## Key Risks
- UK expansion depends on 3 key hires (managing directors)
- Sustainability consulting: unproven market, €200K investment at risk
- CRM migration: 6 weeks behind schedule as of Feb 2026
```

#### 2. Data Connectors (MCP)

Real-time and near-real-time connections to organizational tools that provide live data context.

**Phase 0 connectors (1-2 per org):**

| Connector | Data Provided | Update Mode | MCP Tools Exposed |
|---|---|---|---|
| **CRM (Salesforce/HubSpot)** | Pipeline, accounts, activities, contacts | On-demand (query when needed) | `crm_get_pipeline`, `crm_get_account`, `crm_search_contacts` |
| **People Directory (Google Workspace/M365)** | Employee list, teams, roles, reporting lines | Daily sync | `directory_get_person`, `directory_get_team`, `directory_search` |

**Phase 1 connectors (added):**

| Connector | Data Provided | Update Mode |
|---|---|---|
| **Project Management (Jira/Asana/Linear)** | Projects, tasks, status, assignments | On-demand |
| **Calendar (Google/Outlook)** | Meetings, availability, recurring events | Near-real-time |
| **Document Store (Google Drive/SharePoint)** | Document metadata, shared folders | On-demand |
| **Financial (Xero/SAP)** | Revenue, costs, budgets | Daily sync |

**MCP connector architecture:**

```typescript
interface OrgMCPConnector {
  connector_id: string;
  org_id: string;
  connector_type: 'crm' | 'directory' | 'project' | 'calendar' | 'document' | 'financial';
  provider: string;                    // 'salesforce', 'hubspot', 'google_workspace', etc.
  status: 'active' | 'error' | 'disconnected';
  auth: {
    type: 'oauth2' | 'api_key' | 'service_account';
    credentials_ref: string;           // reference to secrets manager
    scopes: string[];
    last_refreshed: string;
  };
  sync: {
    mode: 'on_demand' | 'scheduled' | 'webhook';
    schedule_cron?: string;            // e.g., "0 6 * * *" for daily 6am
    last_sync: string;
    last_error?: string;
  };
  data_scope: 'organizational';        // always org-level, never personal
  read_only: true;                     // Phase 0-1: always read-only
}
```

#### 3. Framework Library

Strategic analysis frameworks configured for the organization's industry and context.

| Framework | Use Case | Template Format |
|---|---|---|
| **Wardley Mapping** | Map value chain evolution for strategic positioning | Structured YAML with components, evolution stages |
| **Blue Ocean (ERRC)** | Identify competitive white space | 4-quadrant grid template |
| **Jobs to Be Done** | Understand customer/user needs | JTBD canvas template |
| **Porter's Five Forces** | Industry competitive analysis | Force assessment template |
| **Value Chain Analysis** | Internal capability mapping | Activity chain template |

**Framework template schema:**

```json
{
  "framework_id": "fw_wardley_001",
  "name": "Wardley Map",
  "version": "1.0",
  "description": "Map value chain components by visibility and evolution stage",
  "template": {
    "components": [
      {
        "name": "string",
        "visibility": "number (0-1, user-visible to invisible)",
        "evolution": "genesis | custom | product | commodity",
        "dependencies": ["component_name"]
      }
    ],
    "analysis_prompts": [
      "Which components are evolving faster than your organization's capability to deliver them?",
      "Where are you investing in custom-built solutions for components that are becoming commodities?",
      "Which genesis-stage components could become competitive differentiators?"
    ]
  },
  "industry_customizations": {
    "professional_services": {
      "typical_components": ["client_relationship", "domain_expertise", "delivery_methodology", "talent_pipeline"],
      "industry_benchmarks": { ... }
    }
  }
}
```

#### 4. Competitive Intelligence (Phase 1+)

External data feeds that provide competitive context.

| Source | Data | Update | Phase |
|---|---|---|---|
| Job posting aggregators | Competitor hiring patterns, role evolution | Daily | Phase 1 |
| Patent databases | Technology direction signals | Weekly | Phase 2 |
| News/PR monitoring | Market moves, partnerships, product launches | Daily | Phase 1 |
| Market reports | Industry benchmarks, sizing, trends | Quarterly | Phase 2 |

### RAG Pipeline

The core mechanism for injecting organizational context into every Claude API call.

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  User Query  │───►│  Embed Query │───►│  Similarity  │───►│  Rank &      │
│              │    │  (1536-dim)  │    │  Search      │    │  Filter      │
└──────────────┘    └──────────────┘    │  (pgvector)  │    └──────┬───────┘
                                        └──────────────┘           │
                                                                   │
┌──────────────────────────────────────────────────────────────────▼──────┐
│                        CONTEXT ASSEMBLY                                 │
│                                                                        │
│  ┌─────────────────┐  ┌────────────────┐  ┌──────────────────────┐    │
│  │ Always-inject    │  │ Query-relevant  │  │ Active MCP          │    │
│  │ context          │  │ context chunks  │  │ connector data      │    │
│  │                  │  │                 │  │                     │    │
│  │ - Strategy       │  │ - Top 5 chunks  │  │ - CRM data (if     │    │
│  │   summary        │  │   by similarity │  │   query mentions    │    │
│  │ - Team structure │  │ - Ranked by     │  │   client/pipeline)  │    │
│  │   (compact)      │  │   relevance     │  │ - Directory (if     │    │
│  │ - User's role    │  │                 │  │   query mentions    │    │
│  │   context        │  │                 │  │   people/teams)     │    │
│  └────────┬────────┘  └───────┬─────────┘  └──────────┬──────────┘    │
│           │                   │                        │               │
│           └───────────────────┼────────────────────────┘               │
│                               │                                        │
│                     ┌─────────▼──────────┐                             │
│                     │ SYSTEM PROMPT       │                             │
│                     │                     │                             │
│                     │ {always_context}    │  ← ~2K tokens              │
│                     │ {relevant_chunks}   │  ← ~3K tokens              │
│                     │ {mcp_data}          │  ← ~1K tokens (if needed)  │
│                     │ {personal_memory}   │  ← ~2K tokens              │
│                     │ {skill_instructions}│  ← ~1K tokens (if active)  │
│                     │                     │                             │
│                     │ Total budget: ~10K tokens for context            │
│                     └────────────────────┘                             │
└────────────────────────────────────────────────────────────────────────┘
```

**RAG pipeline steps:**

1. **Embed query**: generate vector embedding from user's message
2. **Similarity search**: query `org_context_docs` table via pgvector, top-K chunks (K=10)
3. **Rerank**: optionally rerank with cross-encoder for precision (Phase 1+)
4. **Classify intent**: determine if MCP connector data is needed (mentions of clients, people, projects)
5. **Fetch MCP data**: if needed, call relevant MCP tools to get live data
6. **Assemble context**: combine always-inject + relevant chunks + MCP data
7. **Budget enforcement**: trim to context budget (~10K tokens), prioritizing always-inject > relevant > MCP
8. **Inject**: pass assembled context as system prompt to Claude API call

**Context hierarchy (what gets injected when):**

| Context Type | Injection Rule | Token Budget | Source |
|---|---|---|---|
| **Strategy summary** | Always | ~800 tokens | Condensed from strategy doc |
| **Team structure** | Always | ~500 tokens | Compact org chart |
| **User's role context** | Always | ~300 tokens | From personal memory |
| **Industry brief** | Always | ~400 tokens | Condensed industry context |
| **Relevant doc chunks** | On similarity match (> 0.75) | ~3,000 tokens | RAG search results |
| **CRM data** | On demand (client/pipeline mention) | ~1,000 tokens | MCP connector query |
| **Directory data** | On demand (people/team mention) | ~500 tokens | MCP connector query |
| **Framework templates** | On demand (analysis request) | ~1,500 tokens | Framework library |
| **Competitive intel** | On demand (competitor mention) | ~1,000 tokens | Phase 1+ |

### SQL Schema

```sql
-- Organizational context documents (chunked and embedded)
CREATE TABLE org_context_docs (
    chunk_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL,
    doc_type        TEXT NOT NULL CHECK (doc_type IN (
                        'strategy', 'team_structure', 'industry_brief',
                        'competitive_position', 'culture_values', 'custom'
                    )),
    doc_version     INTEGER NOT NULL DEFAULT 1,

    -- Content
    title           TEXT NOT NULL,
    section_path    TEXT NOT NULL,          -- e.g., "strategy/priorities/2026"
    content         TEXT NOT NULL,          -- chunk text (500-1000 tokens)
    content_hash    TEXT NOT NULL,          -- SHA-256 for dedup on update

    -- Vector embedding for RAG
    embedding       vector(1536),          -- pgvector column

    -- Metadata
    source_doc_id   UUID,                  -- reference to full source document
    chunk_index     INTEGER NOT NULL,      -- ordering within source doc
    token_count     INTEGER NOT NULL,

    -- Injection rules
    always_inject   BOOLEAN DEFAULT FALSE, -- part of always-injected context
    inject_priority INTEGER DEFAULT 50,    -- higher = more important (0-100)

    -- Lifecycle
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      UUID NOT NULL,         -- advisor user_id
    is_active       BOOLEAN DEFAULT TRUE,

    CONSTRAINT fk_org FOREIGN KEY (org_id) REFERENCES organizations(org_id)
);

-- Index for vector similarity search
CREATE INDEX idx_context_embedding ON org_context_docs
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
    WHERE is_active = TRUE;

-- Index for always-inject context
CREATE INDEX idx_context_always_inject ON org_context_docs(org_id, inject_priority DESC)
    WHERE always_inject = TRUE AND is_active = TRUE;

-- Index for doc type filtering
CREATE INDEX idx_context_doc_type ON org_context_docs(org_id, doc_type)
    WHERE is_active = TRUE;

-- Source documents (full documents before chunking)
CREATE TABLE org_source_docs (
    source_doc_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL,
    doc_type        TEXT NOT NULL,
    title           TEXT NOT NULL,
    content_md      TEXT NOT NULL,          -- full markdown content
    version         INTEGER NOT NULL DEFAULT 1,

    -- Metadata
    word_count      INTEGER NOT NULL,
    chunk_count     INTEGER NOT NULL,

    -- Lifecycle
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      UUID NOT NULL,
    approved_by     UUID,
    status          TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),

    CONSTRAINT fk_org FOREIGN KEY (org_id) REFERENCES organizations(org_id)
);

-- MCP connector registry
CREATE TABLE org_mcp_connectors (
    connector_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL,
    connector_type  TEXT NOT NULL CHECK (connector_type IN (
                        'crm', 'directory', 'project', 'calendar', 'document', 'financial'
                    )),
    provider        TEXT NOT NULL,          -- 'salesforce', 'hubspot', etc.
    display_name    TEXT NOT NULL,

    -- Connection
    credentials_ref TEXT NOT NULL,          -- secrets manager reference
    auth_type       TEXT NOT NULL CHECK (auth_type IN ('oauth2', 'api_key', 'service_account')),
    scopes          TEXT[] DEFAULT '{}',
    base_url        TEXT,

    -- Sync config
    sync_mode       TEXT DEFAULT 'on_demand' CHECK (sync_mode IN (
                        'on_demand', 'scheduled', 'webhook'
                    )),
    sync_schedule   TEXT,                   -- cron expression
    last_sync_at    TIMESTAMPTZ,
    last_error      TEXT,

    -- Status
    status          TEXT DEFAULT 'active' CHECK (status IN (
                        'active', 'error', 'disconnected', 'disabled'
                    )),
    health_check_at TIMESTAMPTZ,

    -- Lifecycle
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      UUID NOT NULL,

    CONSTRAINT fk_org FOREIGN KEY (org_id) REFERENCES organizations(org_id)
);

-- Framework library
CREATE TABLE org_frameworks (
    framework_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID,                   -- NULL = global template
    framework_type  TEXT NOT NULL CHECK (framework_type IN (
                        'wardley_map', 'blue_ocean_errc', 'jtbd',
                        'porters_five', 'value_chain', 'custom'
                    )),
    name            TEXT NOT NULL,
    version         INTEGER NOT NULL DEFAULT 1,

    -- Template
    template_md     TEXT NOT NULL,          -- markdown template
    analysis_prompts TEXT[] DEFAULT '{}',   -- LLM prompts for this framework

    -- Industry customization
    industry_config JSONB DEFAULT '{}',

    -- Lifecycle
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active       BOOLEAN DEFAULT TRUE
);

-- Cached MCP connector data (structured cache for performance)
CREATE TABLE org_data_cache (
    cache_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL,
    connector_id    UUID NOT NULL,
    data_type       TEXT NOT NULL,          -- 'pipeline_summary', 'team_roster', etc.
    data_key        TEXT NOT NULL,          -- unique key within data_type
    data_json       JSONB NOT NULL,

    -- Cache control
    fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL,
    is_stale        BOOLEAN DEFAULT FALSE,

    CONSTRAINT fk_connector FOREIGN KEY (connector_id) REFERENCES org_mcp_connectors(connector_id),
    CONSTRAINT uq_cache_key UNIQUE (org_id, connector_id, data_type, data_key)
);

CREATE INDEX idx_cache_lookup ON org_data_cache(org_id, data_type, data_key)
    WHERE is_stale = FALSE;
```

### Access Control

| Role | Read Context | Update Context | Manage Connectors |
|---|---|---|---|
| **End user (assistant instance)** | Read all org context for RAG injection | No | No |
| **Play New advisor** | Read all org context | Update strategic docs, framework config | Configure connectors |
| **Client admin** | Read all org context | Update team structure | View connector status |
| **Play New platform admin** | Read all org context | Emergency updates only | Full connector management |

**Enforcement:**

- All assistant instances read org context through the RAG pipeline only (no direct DB access)
- Strategic document updates require advisor or client admin role
- MCP connector credentials stored in secrets manager (AWS Secrets Manager / GCP Secret Manager)
- Connector data access logged for audit

### Update Workflow

```
Strategic Context Update Flow:

  Play New Advisor                      System
       │                                  │
       │  1. Edit strategy doc            │
       │     (web admin interface)        │
       │  ─────────────────────────────►  │
       │                                  │  2. Chunk document
       │                                  │     (500-1000 token chunks)
       │                                  │
       │                                  │  3. Generate embeddings
       │                                  │     for each chunk
       │                                  │
       │                                  │  4. Upsert chunks in
       │                                  │     org_context_docs
       │                                  │     (replace old version)
       │                                  │
       │  5. Review diff                  │
       │  ◄─────────────────────────────  │
       │                                  │
       │  6. Approve                      │
       │  ─────────────────────────────►  │
       │                                  │  7. Set status = 'active'
       │                                  │     (old version archived)
       │                                  │
       │                                  │  8. All assistant instances
       │                                  │     now retrieve new context
       │                                  │     via RAG on next query
```

---

## Phase 0 Scope

### What We Build Now

Phase 0 uses a simplified context engine optimized for 3 organizations.

**Phase 0 implementation: static markdown documents + basic MCP**

1. **Strategic Context Documents**: stored as markdown files in S3, chunked and embedded in PostgreSQL + pgvector.
   - Strategy document (created during onboarding)
   - Team structure (created during onboarding)
   - Industry brief (created during onboarding)
   - Competitive position (created during onboarding)

2. **RAG Pipeline**: basic similarity search over chunked documents.
   - Embed user query
   - Search pgvector for top-5 relevant chunks
   - Always-inject: strategy summary + team structure (condensed versions)
   - Assemble system prompt

3. **MCP Connectors**: 1-2 per organization.
   - CRM (Salesforce or HubSpot) — read-only pipeline and account data
   - People directory (Google Workspace or M365) — team structure and roles

4. **Framework Library**: 2-3 framework templates available to all orgs.
   - Wardley Mapping template
   - Blue Ocean ERRC template
   - JTBD template

5. **Admin interface for advisors**: simple web form to edit and re-publish strategic documents.

**Phase 0 limitations (accepted):**

- No automated competitive intelligence feeds
- No reranking (simple similarity search only)
- No cross-document linking or knowledge graph
- Manual document updates only (no automated extraction from conversations)
- Maximum 2 MCP connectors per org

### What We Defer

| Capability | Target Phase | Rationale |
|---|---|---|
| Competitive intelligence feeds | Phase 1 | Requires external data integrations |
| Automated context extraction | Phase 1 | Requires conversation analysis pipeline |
| Cross-encoder reranking | Phase 1 | Simple similarity sufficient for Phase 0 document sizes |
| Knowledge graph | Phase 2 | Over-engineering for Phase 0 scale |
| Context freshness scoring | Phase 1 | Manual updates sufficient at 3 orgs |
| Multi-language context | Phase 2 | Phase 0 orgs are Italian/English bilingual at most |

### Phase 0 Capacity Planning

| Metric | Phase 0 Estimate |
|---|---|
| Organizations | 3 |
| Documents per org | 4-6 |
| Total document size | ~50-100 KB per org |
| Chunks per org | ~100-200 |
| Total vectors | ~600 |
| pgvector storage | < 50 MB |
| MCP connector calls per day | ~200-500 per org |
| Context assembly time target | < 500ms |

---

## Open Questions

1. **Context staleness**: How do we detect when strategic context documents are out of date? Alert advisor after 30 days without update? Track confidence decay over time?

2. **Context conflicts**: What if CRM data contradicts the strategy document (e.g., strategy says "focus on UK" but pipeline is 80% Italy)? Should the assistant surface contradictions?

3. **Token budget allocation**: The ~10K token context budget is an estimate. Need to benchmark actual Claude performance with different context sizes to find the optimal balance between context richness and response quality.

4. **Chunking strategy**: Fixed-size chunks (500 tokens) vs semantic chunking (by section/paragraph)? Semantic chunking preserves meaning better but produces variable-size chunks. Need to test both approaches.

5. **MCP connector failure mode**: When a CRM connector is down, should the assistant (a) silently omit CRM data, (b) tell the user "CRM data unavailable", or (c) use cached data with a staleness warning?

6. **Multi-org advisor access**: A Play New advisor may work with multiple organizations. How do we ensure strict org isolation in the admin interface? Separate logins per org, or role-based access within a single session?

7. **Document versioning**: Should we keep full version history of all strategic documents? Important for audit trail but increases storage. Recommendation: keep last 5 versions, archive older to cold storage.
