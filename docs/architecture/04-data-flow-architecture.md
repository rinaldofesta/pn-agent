# 04 -- Data Flow Architecture

**Status:** Draft
**Owner:** TBD
**Last Updated:** 2026-02-25
**PRD Sections:** 6.3, 7.3, 8.3, 8.4 (FR-001 through FR-006), 12, 13, 14, 16

---

## Context

Play New has several distinct data flows that must work together while respecting privacy boundaries. This document traces every major flow end-to-end, from the moment a user sends a message to the organizational intelligence layer receiving aggregated patterns.

Understanding these flows is critical because:
1. Each flow crosses multiple system components.
2. The privacy boundary must be respected at every crossing point.
3. Performance SLAs (<30s response) constrain the design.
4. Phase 0 flows must be designed to evolve into Phase 1+ automated flows.

---

## Nanoclaw Foundation

**What we inherit:**
- Inbound message flow: Channel -> Router -> Group -> Queue -> Container -> Agent SDK -> Response [nc: src/router.ts, src/claw.ts, src/container-runner.ts, src/agent-runner.ts]
- IPC flow: Host <-> Container via file-based messages [nc: src/ipc.ts]
- MCP data access flow: Agent -> MCP server (stdio) -> External data [nc: src/mcp-stdio.ts]

**What we add:**
- Tenant resolution layer in the routing flow
- Org context injection (RAG retrieval before agent call)
- Pattern collection after each interaction
- Forward mode flow (email/Slack share -> parse -> process)
- Anonymization boundary between individual data and org intelligence
- Skill execution flow with per-channel output formatting

---

## Play New Requirements

- Forward mode: user pushes content to assistant [PRD S8.1, FR-002]
- Org context injection into every LLM call [PRD FR-004.1]
- Pattern collection: categorical metadata only, never content [PRD FR-005.4]
- Min 5-user aggregation threshold [PRD FR-005.6, S7.3]
- Monthly Automate Intelligence Brief (Phase 0: manual) [PRD FR-006]
- <30s response for standard queries [PRD FR-001.8]
- Skill invocation via slash commands [PRD FR-003.6]

---

## Technical Specification

### Flow 1: Inbound Message (Standard Query)

The primary flow: user sends a message, assistant responds.

```
         INBOUND MESSAGE FLOW (Standard Query)

    ┌──────────┐
    │  User    │  Sends message via Slack DM, Teams chat,
    │          │  or direct question.
    └────┬─────┘
         │
         ▼
    ┌──────────────────────────────────────────────────┐
    │  CHANNEL ADAPTER                                  │
    │                                                   │
    │  1. Receive raw event (Slack event, Teams activity)│
    │  2. Normalize to CommonMessage:                   │
    │     {                                             │
    │       channel: 'slack',                           │
    │       channelUserId: 'U0123ABC',                  │
    │       channelTeamId: 'T0456DEF',                  │
    │       content: 'What are our Q3 priorities?',     │
    │       attachments: [],                            │
    │       threadId: 'ts_1234567890',                  │
    │       timestamp: '2026-04-15T09:32:00Z'           │
    │     }                                             │
    │  3. Pass to tenant resolver                       │
    └────┬─────────────────────────────────────────────┘
         │
         ▼
    ┌──────────────────────────────────────────────────┐
    │  TENANT RESOLVER                                  │
    │                                                   │
    │  1. channelTeamId -> org_id (cache or DB lookup)  │
    │  2. (channel, channelUserId) -> instance_id       │
    │  3. Validate: instance active, org active         │
    │  4. Rate limit check                              │
    │  5. Attach tenant context to message:             │
    │     {                                             │
    │       ...commonMessage,                           │
    │       orgId: 'org_abc',                           │
    │       instanceId: 'inst_xyz',                     │
    │       orgConfig: { ... },                         │
    │       userPrefs: { ... }                          │
    │     }                                             │
    └────┬─────────────────────────────────────────────┘
         │
         ▼
    ┌──────────────────────────────────────────────────┐
    │  USER MESSAGE QUEUE (Redis)                       │
    │                                                   │
    │  Enqueue to: pn:queue:org_abc:inst_xyz            │
    │  Sequential processing per user.                  │
    │  Multiple users processed concurrently.           │
    └────┬─────────────────────────────────────────────┘
         │
         ▼
    ┌──────────────────────────────────────────────────┐
    │  INSTANCE MANAGER                                 │
    │                                                   │
    │  1. Dequeue message                               │
    │  2. Check: does inst_xyz have an active container?│
    │     ├── YES -> route to existing container        │
    │     └── NO  -> assign from warm pool              │
    │              -> apply user mounts                 │
    │              -> inject secrets via stdin           │
    │  3. Build system prompt:                          │
    │     - Base Play New prompt                        │
    │     - Org-specific additions                      │
    │     - User preferences (language, style)          │
    │     - Active skill list                           │
    └────┬─────────────────────────────────────────────┘
         │
         ▼
    ┌──────────────────────────────────────────────────┐
    │  ORG CONTEXT RETRIEVAL (RAG)                      │
    │                                                   │
    │  1. Embed user's query                            │
    │  2. Search org context vectors (pgvector)         │
    │  3. Retrieve top-K relevant context chunks:       │
    │     - Strategic priorities                        │
    │     - Team structure info                         │
    │     - Industry context                            │
    │     - Relevant framework guidance                 │
    │  4. Append to system prompt                       │
    │                                                   │
    │  Budget: <2 seconds                               │
    └────┬─────────────────────────────────────────────┘
         │
         ▼
    ┌──────────────────────────────────────────────────┐
    │  CONTAINER (Agent Execution)                      │
    │                                                   │
    │  1. agent-runner receives message + system prompt  │
    │  2. Load personal memory context (recent history)  │
    │  3. Call Claude API:                              │
    │     - System: Play New prompt + org context        │
    │     - Messages: conversation history + new msg     │
    │     - Tools: MCP servers (org-context, memory)     │
    │  4. Claude generates response                     │
    │  5. Agent may invoke tools (MCP calls)            │
    │  6. Format response for channel                   │
    │  7. Save to personal memory (vector DB)           │
    │  8. Report pattern metadata via IPC               │
    │  9. Return response to host                       │
    │                                                   │
    │  Budget: <20 seconds (Claude API dominates)       │
    └────┬─────────────────────────────────────────────┘
         │
         ▼
    ┌──────────────────────────────────────────────────┐
    │  RESPONSE DELIVERY                                │
    │                                                   │
    │  1. Host receives response from container IPC     │
    │  2. Format for target channel:                    │
    │     - Slack: Block Kit formatting                 │
    │     - Teams: Adaptive Cards                       │
    │     - Email: HTML email body                      │
    │  3. Send via channel adapter                      │
    │  4. Acknowledge queue entry                       │
    └────┬─────────────────────────────────────────────┘
         │
         ▼
    ┌──────────┐
    │  User    │  Receives response in Slack DM, Teams,
    │          │  or email reply.
    └──────────┘


    PARALLEL (async, after response):
    ┌──────────────────────────────────────────────────┐
    │  PATTERN COLLECTOR                                │
    │                                                   │
    │  Process IPC pattern report from container:       │
    │  {                                                │
    │    instance_id: 'inst_xyz',                       │
    │    interaction_type: 'direct_query',              │
    │    content_category_L1: 'strategy',               │
    │    content_category_L2: 'planning',               │
    │    content_category_L3: 'quarterly_planning',     │
    │    tools_involved: ['org_context'],               │
    │    response_time_ms: 8500,                        │
    │    skills_invoked: [],                             │
    │    timestamp: '2026-04-15T09:32:08Z'              │
    │  }                                                │
    │                                                   │
    │  Note: NO content is logged. Only categorical     │
    │  metadata. [PRD FR-005.4]                         │
    │                                                   │
    │  Insert into: org_abc.pattern_logs                 │
    └──────────────────────────────────────────────────┘
```

### Flow 2: Forward Mode (Email/Slack Share)

The user forwards content to their assistant for analysis.

```
         FORWARD MODE FLOW

    ┌──────────────────┐
    │  User forwards   │
    │  email to:       │  OR shares a Slack message
    │  user.assistant  │  with the assistant bot
    │  @playnew.ai     │
    └────┬─────────────┘
         │
         ▼
    ┌──────────────────────────────────────────────────┐
    │  CHANNEL ADAPTER (Email Bridge or Slack)          │
    │                                                   │
    │  Email path:                                      │
    │  1. IMAP polling detects new email                │
    │  2. Parse: extract original forwarded content     │
    │  3. Extract attachments (PDF, Word, Excel)        │
    │  4. Verify sender matches known user email        │
    │                                                   │
    │  Slack path:                                      │
    │  1. User shares message to assistant DM           │
    │  2. Extract shared message content                │
    │  3. Detect it's a forward (vs direct message)     │
    │                                                   │
    │  Normalize to CommonMessage with metadata:        │
    │  {                                                │
    │    channel: 'email',                              │
    │    content: '<forwarded email body>',             │
    │    attachments: [{ type: 'pdf', ... }],           │
    │    metadata: {                                    │
    │      isForward: true,                             │
    │      originalSender: 'client@company.com',        │
    │      originalSubject: 'Q3 Proposal Review',       │
    │      forwardedAt: '2026-04-15T10:15:00Z'          │
    │    }                                              │
    │  }                                                │
    └────┬─────────────────────────────────────────────┘
         │
         ▼
    ┌──────────────────────────────────────────────────┐
    │  TENANT RESOLVER + QUEUE + INSTANCE MANAGER       │
    │  (same as standard flow)                          │
    └────┬─────────────────────────────────────────────┘
         │
         ▼
    ┌──────────────────────────────────────────────────┐
    │  CONTAINER (Forward Mode Processing)              │
    │                                                   │
    │  System prompt includes forward-mode instructions:│
    │                                                   │
    │  "The user has forwarded content for your         │
    │   analysis. Provide:                              │
    │   1. Summary of the content                       │
    │   2. Key action items for the user                │
    │   3. Risks or issues to be aware of              │
    │   4. Connections to organizational context        │
    │   5. Suggested response (if applicable)           │
    │                                                   │
    │   Respond ONLY to the user. Never contact         │
    │   the original sender."                           │
    │                                                   │
    │  Agent:                                           │
    │  1. Analyze forwarded content                     │
    │  2. Retrieve relevant org context via MCP         │
    │  3. Check personal memory for related history     │
    │  4. Generate analysis                             │
    │  5. Categorize content type [PRD FR-002.6]:       │
    │     communication | report | request | decision   │
    │  6. Save analysis to personal memory              │
    │  7. Report pattern metadata via IPC               │
    └────┬─────────────────────────────────────────────┘
         │
         ▼
    ┌──────────────────────────────────────────────────┐
    │  RESPONSE DELIVERY                                │
    │                                                   │
    │  Response goes ONLY to the user.                  │
    │  Never to the original sender.                    │
    │                                                   │
    │  Email response:                                  │
    │  Subject: "Re: [Fwd: Q3 Proposal Review]"         │
    │  Body: Analysis + action items + suggestions      │
    │  Footer: "This analysis is private to you.        │
    │           Original email content is stored only   │
    │           in your personal memory."               │
    │                                                   │
    │  Slack response:                                  │
    │  Threaded reply in DM with formatted analysis     │
    └──────────────────────────────────────────────────┘
```

### Flow 3: Pattern Collection

After every interaction, categorical metadata is extracted and stored for later aggregation.

```
         PATTERN COLLECTION FLOW

    ┌──────────────────────────────────────────────────┐
    │  CONTAINER (during/after agent execution)         │
    │                                                   │
    │  The agent runner classifies the interaction:     │
    │                                                   │
    │  Classification prompt (appended to agent):       │
    │  "After responding, classify this interaction     │
    │   using the standardized taxonomy. Output a       │
    │   JSON classification to the IPC outbound dir.    │
    │   Include ONLY categories, never content."        │
    │                                                   │
    │  Output to /workspace/ipc/outbound/pattern.json:  │
    │  {                                                │
    │    "interaction_type": "forward_analysis",        │
    │    "content_category_L1": "communication",        │
    │    "content_category_L2": "client_communication", │
    │    "content_category_L3": "proposal_review",      │
    │    "tools_generalized": ["communication_tools",   │
    │                          "document_tools"],       │
    │    "estimated_time_saved_minutes": 15,            │
    │    "skills_invoked": ["email-summarizer"],        │
    │    "skill_feedback": null,                        │
    │    "content_types_shared": ["email", "pdf"]       │
    │  }                                                │
    │                                                   │
    │  Note: tool names are generalized                 │
    │  (Excel -> "spreadsheet_tools") per [PRD S7.3]   │
    └────┬─────────────────────────────────────────────┘
         │
         ▼
    ┌──────────────────────────────────────────────────┐
    │  HOST PROCESS (IPC watcher)                       │
    │                                                   │
    │  1. Watch IPC outbound directory for pattern file │
    │  2. Read and validate JSON against schema         │
    │  3. Enrich with instance metadata:                │
    │     - org_id (from instance config)               │
    │     - team_id (from instance config)              │
    │     - role_category (from instance config)        │
    │     - period: week of year (temporal blurring)    │
    │  4. Explicitly STRIP:                             │
    │     - instance_id (not needed in pattern log)     │
    │     - user_id (never stored in patterns)          │
    │     - any content fragments                       │
    │                                                   │
    │  Wait -- we DO need instance_id for the           │
    │  min-5-user aggregation count. Store it as a      │
    │  hash: SHA256(instance_id + salt) so individual   │
    │  records can be counted but not traced back.      │
    └────┬─────────────────────────────────────────────┘
         │
         ▼
    ┌──────────────────────────────────────────────────┐
    │  PATTERN STORE (PostgreSQL)                       │
    │                                                   │
    │  INSERT INTO org_abc.pattern_logs (               │
    │    pattern_id,                                    │
    │    user_hash,          -- SHA256 of instance_id   │
    │    team_id,                                       │
    │    role_category,                                 │
    │    interaction_type,                              │
    │    category_l1,                                   │
    │    category_l2,                                   │
    │    category_l3,                                   │
    │    tools_generalized,                             │
    │    estimated_time_saved_minutes,                  │
    │    skills_invoked,                                │
    │    content_types_shared,                          │
    │    period_week,        -- temporal blur to week   │
    │    created_at                                     │
    │  );                                               │
    │                                                   │
    │  This table is the INPUT to the anonymization     │
    │  boundary. Only aggregated views can read it.     │
    └──────────────────────────────────────────────────┘
```

### Flow 4: Intelligence Production (Phase 0 -- Manual)

In Phase 0, advisors manually analyze aggregated data to produce intelligence briefs.

```
         INTELLIGENCE FLOW (Phase 0: Manual)

    ┌──────────────────────────────────────────────────┐
    │  PATTERN STORE (PostgreSQL)                       │
    │                                                   │
    │  pattern_logs table accumulates records            │
    │  over weeks of usage.                             │
    │                                                   │
    │  NEVER queried directly by advisors.              │
    │  Only accessed through aggregation views.          │
    └────┬─────────────────────────────────────────────┘
         │
         ▼
    ┌──────────────────────────────────────────────────┐
    │  ANONYMIZATION BOUNDARY (PostgreSQL Views)        │
    │                                                   │
    │  View: aggregated_team_patterns                   │
    │  - Groups by: team_id, category_L1, category_L2, │
    │    period_week                                    │
    │  - Aggregates: COUNT(DISTINCT user_hash),         │
    │    SUM(estimated_time_saved_minutes),             │
    │    COUNT(*)                                       │
    │  - WHERE: COUNT(DISTINCT user_hash) >= 5          │
    │    ^^^^ MIN AGGREGATION THRESHOLD [PRD S7.3]     │
    │                                                   │
    │  View: aggregated_skill_usage                     │
    │  - Groups by: team_id, skill_id, period_week      │
    │  - Aggregates: activation_count, avg_feedback     │
    │  - WHERE: COUNT(DISTINCT user_hash) >= 5          │
    │                                                   │
    │  View: aggregated_content_types                   │
    │  - Groups by: team_id, content_type, period_week  │
    │  - Aggregates: count, avg_time_saved              │
    │  - WHERE: COUNT(DISTINCT user_hash) >= 5          │
    └────┬─────────────────────────────────────────────┘
         │
         ▼
    ┌──────────────────────────────────────────────────┐
    │  ADMIN DASHBOARD (Advisor View)                   │
    │                                                   │
    │  Advisors see ONLY aggregated view data:          │
    │                                                   │
    │  "Marketing team (8 users contributing):           │
    │   - 35% of interactions: manual_reporting          │
    │   - 25% of interactions: client_communication      │
    │   - Estimated 47 hours/week on reporting tasks     │
    │   - Top skill used: report-analyzer (89% positive) │
    │                                                   │
    │   Finance team (6 users contributing):              │
    │   - 40% of interactions: data_compilation          │
    │   - Estimated 62 hours/week on manual data work    │
    │   - Skill gap: no financial analysis skill active"  │
    │                                                   │
    │  Dashboard CANNOT show:                           │
    │  - Which specific users                            │
    │  - Individual interaction counts                   │
    │  - Daily patterns (only weekly)                    │
    │  - Raw pattern_logs records                        │
    └────┬─────────────────────────────────────────────┘
         │
         ▼
    ┌──────────────────────────────────────────────────┐
    │  ADVISOR (Human)                                  │
    │                                                   │
    │  1. Review aggregated patterns monthly             │
    │  2. Cross-reference with org strategic context     │
    │  3. Identify top 3 automation opportunities        │
    │  4. Estimate time/cost savings                     │
    │  5. Draft Automate Intelligence Brief              │
    │  6. Review with Play New team                      │
    │  7. Deliver to org leadership                      │
    │                                                   │
    │  Output format: [PRD S13.1 Automate Stream]        │
    │  "AUTOMATE INTELLIGENCE BRIEF - Org A - April      │
    │   TOP OPPORTUNITY: Finance team manual              │
    │   reconciliation across 3 systems..."              │
    └──────────────────────────────────────────────────┘
```

### Flow 5: Skill Execution

User invokes a skill explicitly (slash command) or implicitly (system detects skill trigger).

```
         SKILL EXECUTION FLOW

    ┌──────────────┐
    │  User types  │  /pipeline-risk
    │  in Slack DM │  (or: "run my pipeline risk scan")
    └────┬─────────┘
         │
         ▼
    ┌──────────────────────────────────────────────────┐
    │  CHANNEL ADAPTER                                  │
    │                                                   │
    │  Detect skill invocation:                         │
    │  - Slash command: /pipeline-risk                   │
    │  - Natural language: pattern match against         │
    │    registered skill triggers                      │
    │                                                   │
    │  Normalize to CommonMessage:                      │
    │  {                                                │
    │    content: '/pipeline-risk',                     │
    │    metadata: {                                    │
    │      isSkillInvocation: true,                     │
    │      skillId: 'pipeline-risk-scan'                │
    │    }                                              │
    │  }                                                │
    └────┬─────────────────────────────────────────────┘
         │
         ▼
    ┌──────────────────────────────────────────────────┐
    │  TENANT RESOLVER + QUEUE + INSTANCE MANAGER       │
    │  (same as standard flow)                          │
    │                                                   │
    │  Additional check: is skill in user's activeSkills│
    │  list? If not, return "skill not available" msg.  │
    └────┬─────────────────────────────────────────────┘
         │
         ▼
    ┌──────────────────────────────────────────────────┐
    │  CONTAINER (Skill Execution)                      │
    │                                                   │
    │  The skill file is already mounted at             │
    │  /workspace/skills/pipeline-risk-scan.skill.md    │
    │                                                   │
    │  Agent runner:                                    │
    │  1. Read skill file (metadata, trigger, context,  │
    │     instructions, output format, quality criteria)│
    │  2. Inject skill instructions into LLM context:   │
    │     "Execute the following skill exactly as       │
    │      specified. Follow the instructions,          │
    │      output format, and quality criteria."        │
    │  3. Skill may require MCP data access:            │
    │     - pn-crm: fetch pipeline deals                │
    │     - pn-personal-memory: previous risk scans     │
    │     - pn-org-context: historical win/loss rates   │
    │  4. Claude generates skill output following       │
    │     the skill's instructions and format           │
    │  5. Validate output against quality criteria      │
    │  6. Save to personal memory                       │
    │  7. Report pattern metadata (skill invocation)    │
    └────┬─────────────────────────────────────────────┘
         │
         ▼
    ┌──────────────────────────────────────────────────┐
    │  RESPONSE FORMATTING (Per-Channel)                │
    │                                                   │
    │  Skill output format specifies the desired format │
    │  (e.g., "concise Slack message, max 15 lines").   │
    │  Channel adapter applies formatting:              │
    │                                                   │
    │  Slack:                                           │
    │  ┌─────────────────────────────────────────┐     │
    │  │ Pipeline Risk Scan - April 15           │     │
    │  │                                         │     │
    │  │ 3 deals flagged this week.              │     │
    │  │ Top concern: Acme Corp Expansion.       │     │
    │  │                                         │     │
    │  │ :red_circle: Acme Corp - HIGH RISK      │     │
    │  │ Last contact: 12 days ago               │     │
    │  │ Action: Schedule call this week          │     │
    │  │                                         │     │
    │  │ :yellow_circle: Beta Inc - MEDIUM        │     │
    │  │ Stage stagnation: 18 days (avg: 10)     │     │
    │  │ Action: Send case study                 │     │
    │  │                                         │     │
    │  │ Was this scan useful? [Yes] [No] [Edit] │     │
    │  └─────────────────────────────────────────┘     │
    │                                                   │
    │  Teams: Adaptive Card with similar structure      │
    │  Email: HTML table with color coding              │
    └────┬─────────────────────────────────────────────┘
         │
         ▼
    ┌──────────────────────────────────────────────────┐
    │  SKILL FEEDBACK COLLECTION                        │
    │                                                   │
    │  User clicks [Yes] / [No] / [Edit]                │
    │  Feedback stored:                                 │
    │  {                                                │
    │    skill_id: 'pipeline-risk-scan',                │
    │    instance_id: 'inst_xyz',                       │
    │    feedback: 'useful',  -- or 'not_useful'        │
    │    timestamp: '2026-04-15T09:45:00Z'              │
    │  }                                                │
    │                                                   │
    │  Updates skill quality score for this user.       │
    │  Also reported as pattern metadata (skill usage). │
    └──────────────────────────────────────────────────┘
```

### Flow 6: Weekly Review (Proactive)

The assistant proactively sends a weekly summary to each user.

```
         WEEKLY REVIEW FLOW

    ┌──────────────────────────────────────────────────┐
    │  SCHEDULER (Cron: Fridays at 16:00 user TZ)       │
    │                                                   │
    │  For each active user instance:                   │
    │  1. Check user preferences:                       │
    │     proactiveMessageFrequency != 'never'          │
    │  2. Check: had >= 1 interaction this week         │
    │  3. If eligible, enqueue weekly review task       │
    └────┬─────────────────────────────────────────────┘
         │
         ▼
    ┌──────────────────────────────────────────────────┐
    │  CONTAINER (Weekly Review Generation)             │
    │                                                   │
    │  System prompt addition:                          │
    │  "Generate this user's weekly review. Summarize   │
    │   their interactions this week, patterns you      │
    │   noticed, and suggestions for next week.         │
    │   Reference their personal memory for context.    │
    │   Maximum 10 lines. Conversational tone."         │
    │                                                   │
    │  Agent:                                           │
    │  1. Retrieve this week's interactions from        │
    │     personal memory                               │
    │  2. Identify patterns (types of queries,          │
    │     recurring topics, skill usage)                │
    │  3. Generate personalized summary                 │
    │  4. Include 1-2 suggestions for next week         │
    └────┬─────────────────────────────────────────────┘
         │
         ▼
    ┌──────────────────────────────────────────────────┐
    │  DELIVERY (Proactive Message)                     │
    │                                                   │
    │  Slack DM:                                        │
    │  "Weekly Review - April 11-15                     │
    │                                                   │
    │   This week you shared 12 items with me.          │
    │   Here's what I noticed:                          │
    │                                                   │
    │   - 5 emails about the Acme proposal (the         │
    │     negotiation seems to be stalling -- want       │
    │     me to analyze the communication pattern?)      │
    │   - 3 data requests that involved manual           │
    │     compilation from multiple sources              │
    │   - Your pipeline risk scan flagged 2 new          │
    │     concerns since last week                      │
    │                                                   │
    │   Suggestion: The manual data compilation          │
    │   pattern is recurring. Want me to help you        │
    │   document the process so we can find a faster     │
    │   approach?"                                      │
    │                                                   │
    │  [PRD FR-001.7, PRD S16.1 message hierarchy]      │
    │  Max 1 proactive message per day.                 │
    └──────────────────────────────────────────────────┘
```

### Flow Summary: Data Residency by Layer

```
    ┌───────────────────────────────────────────────────────────┐
    │                                                           │
    │  PERSONAL DATA (User only)           ORG DATA (Shared)    │
    │  ─────────────────────────           ───────────────────  │
    │                                                           │
    │  Vector DB namespace:                PostgreSQL:          │
    │  - Conversation history              - Org config         │
    │  - Learned preferences               - Team structure     │
    │  - Forwarded content analysis         - Strategic context │
    │  - Skill execution history            - Data connections  │
    │  - Weekly review archives                                │
    │                                                           │
    │  Encrypted with user key.            Encrypted with org   │
    │  User can export/delete.             key. Shared read.    │
    │                                                           │
    │  ─────────────────────────────────────────────────────── │
    │                                                           │
    │  PATTERN DATA (Pseudonymized)        AGGREGATED DATA     │
    │  ────────────────────────────        ─────────────────── │
    │                                                           │
    │  PostgreSQL (pattern_logs):          PostgreSQL (views):  │
    │  - Hashed user ID                    - Team aggregations  │
    │  - Category metadata                 - Min 5-user thresh │
    │  - Tool categories                   - Weekly/monthly    │
    │  - Time estimates                    - No user hashes    │
    │  - Skill invocations                                     │
    │                                                           │
    │  Accessible only via views.          Accessible to        │
    │  Never queried directly.             advisors + dashboard │
    │                                                           │
    └───────────────────────────────────────────────────────────┘
```

---

## Phase 0 Scope

### Flows built in Phase 0:

| Flow | Scope | Notes |
|------|-------|-------|
| Inbound message (standard) | Full implementation | Primary user experience |
| Forward mode (email) | Full implementation | Primary forward mode input |
| Forward mode (Slack share) | Full implementation | Slack message sharing |
| Pattern collection | Automated collection + storage | Runs after every interaction |
| Intelligence production | Manual advisor analysis | Advisor queries aggregation views |
| Skill execution | Full implementation | Pre-built skill library |
| Weekly review | Full implementation | Proactive Friday summary |

### Flows deferred:

| Flow | Deferred To | Reason |
|------|-------------|--------|
| Full access mode (passive observation) | Phase 1 | Requires trust model validation |
| Automated intelligence production | Phase 1 | Manual sufficient for 3 orgs |
| Skill auto-generation | Phase 1 | Pre-built library for Phase 0 |
| Cross-org benchmarking | Phase 2+ | Requires 3+ orgs with sufficient data |
| Proactive daily insights | Phase 1 | Weekly review only in Phase 0 |

---

## Open Questions

| ID | Question | Impact | Decision Date |
|----|----------|--------|---------------|
| OQ-401 | Should pattern classification run inside the container (LLM classifies) or outside (separate classifier model)? Inside is simpler but adds latency. Outside is faster but adds complexity. | Medium -- latency/cost | March 2026 |
| OQ-402 | How do we handle attachment processing in forward mode? Extract text from PDF/Word inline, or use a separate processing pipeline? | Medium -- architecture | March 2026 |
| OQ-403 | Should the weekly review be generated per-user (personalized) or per-team (shared template)? Personalized is better UX but more LLM cost. | Low -- cost/UX | April 2026 |
| OQ-404 | How do we handle multi-turn conversations that span multiple container assignments? Full conversation history in personal memory, or keep a session cache? | High -- UX/performance | March 2026 |
| OQ-405 | Should org context retrieval (RAG) happen in the host process before container assignment, or inside the container via MCP? Host-side is faster for prompt assembly; container-side is more flexible. | Medium -- architecture | March 2026 |
