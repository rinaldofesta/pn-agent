# PLAY NEW — Product Requirements Document

**Version:** 1.0  
**Date:** February 2026  
**Author:** Matteo Roversi  
**Status:** Draft for Review  
**Classification:** Confidential

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Vision & Strategic Thesis](#2-product-vision--strategic-thesis)
3. [Problem Definition](#3-problem-definition)
4. [Strategic Positioning & Moat](#4-strategic-positioning--moat)
5. [Users, Personas & Jobs to Be Done](#5-users-personas--jobs-to-be-done)
6. [Product Architecture](#6-product-architecture)
7. [Privacy Architecture (Foundational)](#7-privacy-architecture-foundational)
8. [Phase 0 — MVP: Design Partnership](#8-phase-0--mvp-design-partnership)
9. [Phase 1 — Product Launch](#9-phase-1--product-launch)
10. [Phase 2 — Product-Market Fit](#10-phase-2--product-market-fit)
11. [Phase 3 — Category Leadership](#11-phase-3--category-leadership)
12. [Skill Engine Specification](#12-skill-engine-specification)
13. [Organizational Intelligence Layer](#13-organizational-intelligence-layer)
14. [Integration Specifications](#14-integration-specifications)
15. [Data Model & Cross-Org Schema](#15-data-model--cross-org-schema)
16. [Delivery & Interface Design](#16-delivery--interface-design)
17. [Service Model & Onboarding](#17-service-model--onboarding)
18. [Business Model & Unit Economics](#18-business-model--unit-economics)
19. [Success Metrics](#19-success-metrics)
20. [Technical Requirements & Infrastructure](#20-technical-requirements--infrastructure)
21. [Risks, Mitigations & Kill Criteria](#21-risks-mitigations--kill-criteria)
22. [Open Decisions & Decision Framework](#22-open-decisions--decision-framework)
23. [Appendices](#23-appendices)

---

## 1. Executive Summary

Play New is a continuous strategic intelligence platform that deploys personal AI assistants to every person in an organization and aggregates their anonymized usage patterns into an organizational intelligence layer that produces actionable strategic insight.

**The one-line pitch:** Every person gets an AI assistant that learns their work. The organization gets strategic intelligence from how everyone works. The system compounds.

**The strategic bet:** Within 12-18 months, personal AI assistants will be commoditized. Every knowledge worker will have one through Claude, Copilot, or Gemini. What will NOT be commoditized is the intelligence layer that sits between individual AI usage and organizational strategy. That layer — connecting what individuals do to what the organization should become — is what Play New builds.

**What makes this a product people can't live without:** Play New doesn't ask organizations to adopt yet another tool. It wraps the AI tools they'll already use, injects organizational context that makes them dramatically smarter, and produces a continuous stream of strategic intelligence that no other product, consultant, or dashboard can deliver. Once a CEO sees "here's €180K of time your finance team wastes monthly, and here's exactly how to fix it — based on your actual work data, not interviews" — they don't go back to annual consulting engagements.

**Phase 0 scope:** 3 design partners, 20-50 users each, forward mode, Automate intelligence stream only. Validate that (a) people use and trust a personal work assistant, and (b) aggregated patterns produce at least one strategic insight per organization that leadership acts on.

---

## 2. Product Vision & Strategic Thesis

### 2.1 The 18-Month Thesis

The AI assistant market is evolving through three predictable waves:

**Wave 1 (Now — Mid 2026): Individual Productivity.** People use ChatGPT, Claude, Copilot for ad-hoc tasks. Write faster, summarize better, code more. Disconnected from organizational context. No memory across sessions (or very limited). No strategic awareness.

**Wave 2 (Late 2026 — 2027): Persistent Personal AI.** Major platforms ship persistent memory, deep tool integration, proactive suggestions. Every knowledge worker has a capable personal AI. The assistant knows you, connects to your tools, and acts on your behalf. This layer gets commoditized fast. Anthropic, Microsoft, and Google each spend billions making it as good as possible. Competing here is a losing game.

**Wave 3 (2027 — 2029): Organizational AI Intelligence.** The unsolved problem: how do you extract strategic value from hundreds of people using personal AI? How do you see patterns across the organization that no individual — and no dashboard — can see? How do you turn individual AI usage into organizational evolution? This is the white space. This is where Play New lives.

### 2.2 Play New's Position

Play New doesn't compete with Wave 2 platforms. It **rides on top of them.** The personal assistant is the data collection mechanism and the engagement surface. The organizational intelligence layer is the product. The skill engine is what makes individual assistants genuinely useful enough that people engage, which feeds the organizational layer.

**The flywheel:**

```
More people use their assistant
        ↓
More work patterns captured
        ↓
Better organizational intelligence
        ↓
Leadership takes action (proves ROI)
        ↓
Organization expands deployment
        ↓
More people use their assistant
```

### 2.3 Why Cosmico Builds This

Cosmico's TaaS business has spent 5+ years connecting talent with organizations. This produced three assets that make Play New possible:

1. **Deep understanding of how organizations actually work** — not from the outside (like consultants) but from embedding professionals inside hundreds of teams.
2. **Trust relationships with decision-makers** who are already AI-forward — these become design partners.
3. **A community of 32K+ digital professionals** who understand AI-augmented work — these become the advisors who deliver onboarding.

**The strategic tension to manage:** Cosmico TaaS sells people to fill roles. Play New may tell organizations they don't need those roles. This is not a conflict — it's an evolution. The talent market is shifting from "rent a developer" to "help me reorganize around AI." Play New is how Cosmico evolves with that shift. But the two businesses must operate with independent incentives and separate P&Ls from day one.

---

## 3. Problem Definition

### 3.1 The Individual Problem

Knowledge workers have access to powerful AI tools but use them at ~10% of potential because:

- **No organizational context.** Claude doesn't know your company's strategy, competitive position, or internal politics. Every conversation starts from zero context.
- **No proactive intelligence.** You must know what to ask. The 90% of value you're missing is questions you don't know to ask.
- **No persistent work memory.** Tools have session memory or limited long-term memory, but nothing approaching a deep understanding of your role, patterns, relationships, and evolving capabilities.
- **No connection to others' work.** Your AI can't tell you that three other teams are solving the same problem differently, or that your work connects to an opportunity nobody sees.

**The result:** AI makes people 10-20% faster at their current job. It doesn't show them what their job should become.

### 3.2 The Organizational Problem

Leadership knows AI matters but has no continuous visibility into where value is shifting:

- **Consulting is point-in-time.** McKinsey delivers a PDF after 3-6 months and €500K-5M. By the time you implement, the landscape has shifted.
- **Analytics is backward-looking.** Viva Insights says "your team has too many meetings." It never says "this team shouldn't exist in its current form."
- **AI adoption is invisible.** IT knows which tools are deployed. Nobody knows how they're being used, what patterns are emerging, or what strategic opportunities are being missed.
- **Strategy and operations are disconnected.** The board sets direction annually. Operations runs daily. No continuous feedback loop connects the two.

**The result:** Organizations make strategic decisions based on interviews, benchmarks, and intuition — not continuous intelligence from actual work patterns.

### 3.3 The Gap Play New Fills

No product connects individual AI usage to organizational strategy. Play New does. The personal assistant collects the data. The organizational intelligence layer produces the insight. Each makes the other more valuable.

---

## 4. Strategic Positioning & Moat

### 4.1 Competitive Landscape

| Category | Players | What They Do | What They Don't Do |
|---|---|---|---|
| **General AI Assistants** | Claude, ChatGPT, Gemini, Copilot | Powerful individual productivity | No org context, no aggregation, no strategic insight |
| **Enterprise AI Platforms** | Microsoft Copilot, Google Workspace AI | Deep tool integration within their ecosystem | No cross-tool intelligence, no strategic layer, no self-evolving skills |
| **Work Analytics** | Viva Insights, Time is Ltd., Worklytics | Operational analytics from work tool metadata | Backward-looking, no AI integration, no strategic frameworks |
| **Strategy Consulting** | McKinsey, BCG, Bain | Deep strategic insight | Point-in-time, expensive, no individual impact, no continuous data |
| **AI Agent Platforms** | Relevance AI, CrewAI, LangChain | Build custom AI workflows | Developer-focused, no org intelligence layer, no end-user experience |

### 4.2 Play New's Defensible Moat (Ordered by Durability)

**Moat 1 — Cross-organizational intelligence (strongest).** As Play New serves 20+ organizations, anonymized cross-org patterns produce insights no single organization or consultant can generate. "Companies in your sector that adopted AI for client onboarding saw 40% faster time-to-value. You haven't done this yet." This is a network effect that strengthens with every new client. Must be designed into the data model from day one.

**Moat 2 — Organizational context depth.** The strategic context document + data connections + accumulated work patterns create an organizational "brain" that gets richer over time. Switching costs increase every month because the intelligence compounds. Competitors would need to rebuild months of context to replicate.

**Moat 3 — Privacy-first architecture.** If Play New's privacy architecture is genuinely different (local inference for personal data, only derived patterns aggregate), enterprise clients who've committed to this model won't switch to a less private alternative. Compliance and works-council approval create structural lock-in.

**Moat 4 — Skill library.** As the skill engine generates hundreds of proven, organization-specific skills, these represent accumulated IP. Generic platforms would need to regenerate all of them from scratch.

### 4.3 What Is NOT a Moat

- The personal assistant experience (commoditized within 12 months)
- Slack/Teams integration (trivial for any competitor)
- "AI-powered" anything without specificity (meaningless positioning)
- Being first (matters only if compounding effects are designed in)

### 4.4 ERRC Grid (Blue Ocean)

| ELIMINATE | REDUCE |
|---|---|
| Consultant dependency for recurring strategic insight | Cost of strategic intelligence (1/10th of consulting) |
| Annual strategy cycles replaced by continuous intelligence | Time-to-insight (months → days) |
| Strategy ↔ operations disconnect | Custom development needs (skill engine auto-generates) |
| One-size-fits-all AI deployment | Implementation complexity (wrap existing tools, don't replace) |

| RAISE | CREATE |
|---|---|
| Individual empowerment (every person, not just leadership) | Dual-layer intelligence (personal + organizational) |
| Organizational context in every AI interaction | Self-generating skill engine |
| Proactive insight delivery (don't wait to be asked) | Continuous strategic intelligence as a category |
| Trust through privacy architecture | Cross-organizational pattern intelligence (network effect) |

---

## 5. Users, Personas & Jobs to Be Done

### 5.1 The Buyer

**Primary buyer persona: The Transformation-Aware Executive**

- **Title:** CEO, CHRO, Chief Strategy Officer, or VP of Digital Transformation
- **Organization:** €50M-1B revenue, 200-5000 people
- **Mindset:** Already adopted AI for basic tasks. Feels the gap between "we use AI" and "AI transforms how we work." Frustrated that they can't see what's actually changing.
- **Budget:** Can't justify €500K+ McKinsey engagements regularly, but has budget for SaaS tools that prove ROI continuously.
- **Fear:** Getting disrupted by competitors who figure out AI transformation faster.
- **Dream:** A dashboard that continuously tells them what to automate, where to double down, and what new opportunities are emerging — based on real data, not consultant interviews.

**Jobs to Be Done (Buyer):**
1. "Show me where we're wasting time that AI could handle, with specific numbers and specific actions."
2. "Tell me what our competitors are doing with AI that we're not — continuously, not once a year."
3. "Help every person in my organization get better with AI, not just the early adopters."
4. "Give me confidence we're making the right strategic bets on AI transformation."

### 5.2 The End Users

#### Persona A: The Knowledge Worker (Primary User)

**Profile:** Manager, analyst, designer, marketer, engineer — anyone who does knowledge work. Uses AI occasionally for ad-hoc tasks but knows they're not getting full value.

**Current behavior:** Copies text into ChatGPT for rewrites, uses Copilot for email drafts, occasionally asks Claude to analyze data. Each interaction is disconnected. Forgets to use AI for half the things it could help with.

**Jobs to Be Done:**
1. "Help me see what I'm not seeing about my own work patterns."
2. "Automate the repetitive parts of my job so I can focus on what matters."
3. "Connect me to relevant information and people across the organization."
4. "Make me smarter about my domain by proactively surfacing insights."

**What "love" looks like:** After 4 weeks, the user says "I can't imagine starting my week without checking what my assistant flagged over the weekend." After 3 months: "My assistant caught something that would have cost us a client."

#### Persona B: The Team Lead / Department Head

**Profile:** Manages 5-30 people. Responsible for team output and development. Pressured to "do more with AI" but unclear how.

**Jobs to Be Done:**
1. "Show me how my team actually spends its time — not time tracking, real patterns."
2. "Identify which parts of our work should be automated and which need more human investment."
3. "Help me develop my people's capabilities in an AI-augmented world."
4. "Give me data to justify team structure changes to leadership."

**What "love" looks like:** Gets a monthly brief that says "Your team spent 120 hours on manual data compilation. Here's a validated automation that would recover 100 of those hours. Two team members could redirect to client strategy work."

#### Persona C: The Strategy/Leadership Team

**Profile:** C-suite, VP, or strategy function. Makes decisions about organizational direction, resource allocation, and competitive positioning.

**Jobs to Be Done:**
1. "Give me continuous strategic intelligence I can act on — not annual reports."
2. "Show me patterns across the organization that no individual team can see."
3. "Help me make evidence-based decisions about what to automate, where to invest, and what to start."
4. "Quantify the ROI of our AI transformation — not anecdotes, numbers."

**What "love" looks like:** In a board meeting, presents a strategic recommendation backed by real-time organizational intelligence data. The board asks: "Where does this data come from?" Answer: "From how our 500 people actually work every day."

### 5.3 Anti-Personas (Who This Is NOT For)

- **Small teams (<50 people):** Organizational intelligence layer doesn't produce statistically meaningful patterns. Minimum viable org size: ~200 people.
- **AI skeptics:** If leadership doesn't believe AI is strategic, Play New's value proposition doesn't land. We need organizations that are already on the journey.
- **Pure cost-cutters:** If the buyer only wants "automate everything and fire people," the trust model collapses. Play New works when the intent is transformation, not headcount reduction.
- **Highly regulated industries (initially):** Healthcare, defense, financial services require compliance certifications (SOC 2, HIPAA, ISO 27001) we won't have in Phase 0-1. Target: tech, professional services, manufacturing, media, retail.

---

## 6. Product Architecture

### 6.1 Architecture Philosophy

**Principle 1: Wrap, don't build.** Use existing LLMs (Claude, GPT, open-source) as the inference backbone. Don't build a personal assistant from scratch. Build the context, skill, and intelligence layers that make any LLM dramatically smarter for this person and this organization.

**Principle 2: Privacy is architecture, not a feature.** The separation between personal data (stays with the user) and organizational patterns (anonymized aggregation) must be enforced at the infrastructure level, not the application level. It should be technically impossible for the system to leak individual data into the organizational layer.

**Principle 3: Design for cross-org from day one.** The data schema for organizational patterns must be standardized from the start so that insights from Organization A are structurally comparable to Organization B. This is what enables the network effect moat.

**Principle 4: Skills over features.** The platform ships with a minimal core. Every new capability is a skill that the engine generates, proposes, and the user approves. This means the product evolves at the speed of usage, not the speed of development.

### 6.2 System Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                        DELIVERY LAYER                                │
│   Slack Bot  │  Teams Bot  │  Email Bridge  │  Web Dashboard         │
└──────┬───────┴──────┬──────┴───────┬────────┴───────┬────────────────┘
       │              │              │                │
┌──────▼──────────────▼──────────────▼────────────────▼────────────────┐
│                   PERSONAL ASSISTANT LAYER                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐               │
│  │ User A   │ │ User B   │ │ User C   │ │ User N   │               │
│  │ Instance │ │ Instance │ │ Instance │ │ Instance │               │
│  ├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤               │
│  │ Memory   │ │ Memory   │ │ Memory   │ │ Memory   │  ← Encrypted  │
│  │ Skills   │ │ Skills   │ │ Skills   │ │ Skills   │  ← Per-user   │
│  │ Context  │ │ Context  │ │ Context  │ │ Context  │  ← Isolated   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘               │
│       │            │            │            │                       │
│       └────────────┴──────┬─────┴────────────┘                       │
│                           │                                          │
│              ┌────────────▼────────────┐                             │
│              │  ANONYMIZATION ENGINE   │  ← One-way transformation   │
│              │  (Privacy Boundary)     │  ← No individual data       │
│              └────────────┬────────────┘    passes through           │
└───────────────────────────┼──────────────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────────────┐
│                ORGANIZATIONAL INTELLIGENCE LAYER                      │
│  ┌──────────────┐  ┌────────────────┐  ┌──────────────────┐         │
│  │ Pattern      │  │ Strategic      │  │ Cross-Org        │         │
│  │ Aggregator   │  │ Framework      │  │ Benchmarking     │         │
│  │              │  │ Engine         │  │ Engine           │         │
│  └──────┬───────┘  └───────┬────────┘  └────────┬─────────┘         │
│         │                  │                     │                    │
│         └──────────────────┼─────────────────────┘                    │
│                            │                                          │
│              ┌─────────────▼─────────────┐                            │
│              │  INTELLIGENCE STREAMS     │                            │
│              │  🔴 Automate              │                            │
│              │  🟡 Differentiate         │                            │
│              │  🟢 Innovate              │                            │
│              └───────────────────────────┘                            │
└──────────────────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────────────┐
│              ORGANIZATIONAL CONTEXT ENGINE                            │
│  ┌──────────┐  ┌──────────────┐  ┌────────────┐  ┌──────────────┐  │
│  │ Data     │  │ Strategic    │  │ Framework  │  │ Competitive  │  │
│  │ Sources  │  │ Context      │  │ Library    │  │ Intelligence │  │
│  │ (MCP)    │  │ Document     │  │            │  │              │  │
│  └──────────┘  └──────────────┘  └────────────┘  └──────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

### 6.3 Core Components

#### 6.3.1 Personal Assistant Runtime

Each user gets an isolated assistant instance. The runtime is NOT a custom LLM — it's an orchestration layer:

| Component | Description | Technology Direction |
|---|---|---|
| **LLM Backbone** | Model-agnostic inference. Best model per task. | Claude API (primary), GPT-4o (fallback), local models (privacy mode — Phase 2+) |
| **Personal Memory** | Persistent vector store per user. Stores conversation history, work patterns, preferences, learned context. | Encrypted vector DB (Qdrant/Weaviate), user-scoped, user-deletable |
| **Skill Runtime** | Executes skill files (SKILL.md format). Skills define structured instructions for the LLM to follow for specific tasks. | Markdown-based skill definitions, per-user skill registry |
| **Org Context Injection** | Injects relevant organizational context into every LLM call. Strategy, competitive position, team structure, data. | RAG pipeline pulling from Organizational Context Engine |
| **Messenger I/O** | Bidirectional communication through user's preferred channel. | Slack Bot API, Teams Bot Framework, email (IMAP/SMTP) |
| **Observation Engine** | (Phase 1+) Monitors connected tools for patterns. Passive observation, never autonomous action without approval. | MCP connectors to email, calendar, CRM, project tools |

**Isolation requirements:**
- Each user instance has its own memory namespace — no cross-user reads possible at the infrastructure level.
- Encryption at rest with user-specific keys.
- User can export or delete all their data at any time.
- Instance-level audit log visible only to the user.

#### 6.3.2 Skill Engine

Detailed in Section 12. Summary:

- Skills are structured markdown instruction files that teach the assistant to perform specific tasks.
- Phase 0: Pre-built skill library (30-50 skills), manually curated.
- Phase 1: Semi-automated skill generation — system proposes skill drafts based on observed patterns, human (Play New advisor) reviews before deployment.
- Phase 2+: Fully automated skill generation with quality scoring and user approval.

#### 6.3.3 Anonymization Engine (Privacy Boundary)

Detailed in Section 7. Summary:

This is a one-way transformation layer. Individual data goes in, anonymized categorical patterns come out. It should be architecturally impossible to reverse the transformation. This is the single most important technical component of the system.

#### 6.3.4 Organizational Intelligence Layer

Detailed in Section 13. Summary:

Consumes anonymized patterns and produces three intelligence streams:
- 🔴 **Automate** (Phase 0+): "This work shouldn't exist in its current form."
- 🟡 **Differentiate** (Phase 1+): "This is where you should concentrate human energy."
- 🟢 **Innovate** (Phase 2+): "This new value didn't exist before."

#### 6.3.5 Organizational Context Engine

The "brain" that makes every assistant strategically aware:

| Component | Description | Update Frequency |
|---|---|---|
| **Data Connectors** | MCP and API connections to CRM, financials, HR, project management, operations tools | Real-time or near-real-time |
| **Strategic Context Document** | Living document capturing strategy, competitive position, market dynamics, goals, constraints, culture. Created during onboarding by Play New advisors. | Monthly review (advisor + client strategy team) |
| **Framework Library** | Strategic analysis frameworks (Wardley Mapping, Blue Ocean, JTBD, value chain, Porter's) configured for this organization's industry | Quarterly update |
| **Competitive Intelligence** | (Phase 1+) External data: competitor job postings, patent filings, market signals, news | Daily automated scan |

---

## 7. Privacy Architecture (Foundational)

### 7.1 Design Principle

**The assistant works for the person, not the company.** This is not a tagline. It is an architectural decision that shapes every technical choice.

The privacy architecture must satisfy three stakeholders simultaneously:

1. **The individual user** must believe — and be able to verify — that their personal data, conversations, and work patterns are never visible to their employer.
2. **The organization** must receive genuinely useful strategic intelligence from aggregated patterns.
3. **Works councils / data protection officers** must be able to audit the system and confirm compliance with GDPR and local labor law.

### 7.2 Data Classification

| Data Type | Example | Visibility | Storage | Retention |
|---|---|---|---|---|
| **Personal conversations** | Chat with assistant, questions asked | User only | Encrypted personal memory (user-key) | User controls. Delete anytime. |
| **Personal work patterns** | "User spends 12h/week on reporting" | User only | Personal memory | User controls |
| **Personal skills** | Which skills are generated and used | User only | Personal skill registry | User controls |
| **Anonymized category patterns** | "35% of marketing team time → reporting" | Org intelligence layer | Aggregated pattern store | Org contract period |
| **Organizational context** | Strategy doc, CRM data, financials | All assistants (read-only, contextual) | Org context engine | Org contract period |
| **Cross-org benchmarks** | "Companies in sector X average Y" | Cross-org intelligence | Anonymized benchmark store | Platform lifetime |

### 7.3 The Anonymization Boundary

This is the critical technical component. The boundary enforces a one-way transformation:

**Input (from individual instances):**
```json
{
  "user_id": "usr_abc123",
  "team": "marketing",
  "pattern_type": "time_allocation",
  "category": "manual_reporting",
  "estimated_hours_weekly": 12,
  "tools_involved": ["excel", "salesforce", "email"],
  "timestamp": "2026-04-15"
}
```

**Output (to organizational layer):**
```json
{
  "team": "marketing",
  "pattern_type": "time_allocation",
  "category": "manual_reporting",
  "aggregated_hours_weekly": 47,
  "user_count_in_pattern": 6,
  "tools_involved": ["spreadsheet_tools", "crm", "communication"],
  "confidence": 0.82,
  "period": "2026-Q2"
}
```

**Anonymization rules:**
1. **Minimum aggregation threshold:** Patterns only surface when ≥5 users exhibit them. Below this threshold, data stays in personal instances only.
2. **Category generalization:** Specific tools are generalized to categories (Excel → "spreadsheet tools"). Specific actions generalized to task types.
3. **No individual attribution:** The organizational layer never knows which specific users contributed to a pattern. It knows "6 people in marketing" but never "Maria, João, and Luca."
4. **Temporal blurring:** Patterns are reported in weekly or monthly aggregations, never daily (to prevent correlation attacks like "who was working Tuesday night").
5. **Differential privacy:** (Phase 2+) Add calibrated noise to small-group aggregations to prevent statistical inference of individual behavior.

### 7.4 Privacy Guarantees (Contractual + Technical)

| Guarantee | How It's Enforced |
|---|---|
| Personal conversations never visible to employer | Infrastructure isolation + encryption with user-held keys |
| Individual work patterns never shared | Anonymization boundary (minimum 5-user threshold) |
| User can delete all their data at any time | Hard delete from personal memory, audit log confirms |
| No model training on customer data | Contractual + technical: customer data never sent to model fine-tuning endpoints |
| User chooses access level (full/forward) | Permission system at assistant runtime level |
| Aggregation rules are auditable | Published anonymization specification, third-party audit (Phase 1+) |

### 7.5 Phase 0 Privacy Implementation

For Phase 0 (forward mode only), the privacy model is simpler:

- Users explicitly share content with their assistant (no passive observation).
- Personal conversations stored in encrypted personal memory.
- Anonymized patterns extracted manually by Play New advisors (not automated aggregation).
- Advisors produce organizational intelligence reports without attributing insights to individuals.
- Users can review what their assistant "knows" at any time.

This is less technically sophisticated but establishes the trust model early. Automated anonymization is Phase 1.

### 7.6 Local Inference Path (Phase 2+)

The long-term privacy differentiator: personal inference happens as close to the user as possible.

**Phase 2:** Hybrid architecture — personal conversations processed by local/edge LLM. Only structured, anonymized pattern data leaves the user's environment. Organizational context queries use cloud LLM with anonymized context.

**Phase 3:** Full on-premise option — all inference runs within the organization's infrastructure. Cloud connection only for cross-org benchmarking (anonymized).

This is where the "local LLM" thesis connects to Play New strategically: not as "we run local models" but as "our privacy architecture is fundamentally different because personal inference can happen locally."

---

## 8. Phase 0 — MVP: Design Partnership

**Timeline:** March 2026 → July 2026 (5 months)  
**Goal:** Validate the dual-layer model with 3 organizations  
**Budget:** Operational cost only (team salaries + infrastructure)

### 8.1 Scope Definition

**What Phase 0 IS:**
- 3 design partner organizations, 20-50 users each
- Forward mode only (user pushes content to assistant)
- Pre-built skill library (no automated skill generation)
- Slack and Teams delivery only
- Automate intelligence stream only (manual production by Play New advisors)
- Onboarding delivered manually by Play New team

**What Phase 0 IS NOT:**
- A product launch (no pricing, no sales process)
- Full access mode (no passive observation of user's tools)
- Automated organizational intelligence (advisors produce it manually)
- Self-generating skill engine (skills are pre-built and manually assigned)
- Differentiate or Innovate streams (Automate only)

### 8.2 Design Partner Criteria

Each design partner must meet ALL of the following:

| Criterion | Requirement | Why |
|---|---|---|
| **Size** | 200-2000 people | Below 200: aggregation doesn't produce patterns. Above 2000: too complex for Phase 0. |
| **AI maturity** | Already using AI tools for basic tasks | Not AI-skeptics. Already past "should we use AI?" |
| **Leadership access** | Direct relationship with CEO or C-level sponsor | Organizational intelligence layer needs leadership engagement |
| **Data infrastructure** | Uses standard tools (CRM, project management, communication) | We need data to connect to |
| **Cultural fit** | Willing to experiment, tolerates imperfection, gives feedback | Design partnership requires iteration |
| **Industry** | Tech, professional services, manufacturing, media, retail | Industries where we have contextual expertise, no heavy compliance requirements |

**Ideal: 3 partners across different industries** to test pattern generalizability.

### 8.3 Phase 0 User Journey

#### User Onboarding (Day 1-3)

1. User receives a personal Slack DM (or Teams message) from their Play New assistant.
2. Welcome message explains: "I'm your personal AI assistant. I work for YOU, not the company. Everything we discuss is private. I can help you analyze information, spot patterns in your work, and surface opportunities you might miss."
3. User completes a brief orientation:
   - What's your role? What do you spend most time on?
   - What tools do you use daily?
   - What's the most repetitive part of your job?
   - What would you do with an extra 5 hours per week?
4. Assistant introduces 3 starter skills based on their role and responses.
5. User is shown how forward mode works: forward any email, share any message, ask any question.

#### Daily Usage (Week 1+)

**Forward mode interactions:**

- **Email forwarding:** User forwards an email to their assistant's dedicated email address → assistant analyzes, summarizes, suggests response, flags risks, connects to organizational context.
- **Message sharing:** User shares a Slack/Teams message with the assistant → assistant provides context, analysis, suggested actions.
- **Direct questions:** User messages assistant directly → assistant answers with organizational context, relevant data, strategic frameworks.
- **Weekly review:** Every Friday, assistant sends a brief: "This week you shared 12 items with me. Here's what I noticed: [patterns, suggestions, questions to consider]."

#### Skill Activation (Week 2+)

- Play New advisor reviews user's interaction patterns and assigns relevant skills from the pre-built library.
- User receives: "Based on how you've been working with me, I've added a new capability: `/weekly-report-prep` — I can help you prepare your weekly status report by synthesizing what you've shared with me during the week. Want to try it?"
- User tries the skill, provides feedback, skill is refined or replaced.

#### Organizational Intelligence (Monthly)

- Play New advisors manually analyze anonymized patterns across all users in the organization.
- Produce a monthly "Automate Intelligence Brief" for leadership:
  - Top 3 automation opportunities identified from actual work patterns
  - Estimated time/cost savings for each
  - Recommended actions with implementation guidance
  - Evidence: aggregated pattern data (never individual attribution)

### 8.4 Phase 0 Feature Requirements

#### FR-001: Personal Assistant Core

| ID | Requirement | Priority | Notes |
|---|---|---|---|
| FR-001.1 | Each user gets an isolated assistant instance accessible via Slack DM or Teams chat | Must | Core experience |
| FR-001.2 | Assistant maintains persistent memory across all conversations with the user | Must | Encrypted, user-scoped vector store |
| FR-001.3 | Assistant has access to organizational context (strategy doc, team structure, industry context) | Must | Read-only injection via RAG |
| FR-001.4 | User can ask the assistant to "forget" any specific conversation or piece of information | Must | Trust-building |
| FR-001.5 | User can export all data the assistant has about them | Must | GDPR compliance |
| FR-001.6 | User can delete their entire assistant instance and all associated data | Must | GDPR compliance |
| FR-001.7 | Assistant proactively sends weekly review summarizing patterns observed | Should | Engagement driver |
| FR-001.8 | Assistant responds within 30 seconds for standard queries | Must | UX threshold |
| FR-001.9 | Assistant handles multi-turn conversations with context retention | Must | Basic conversational quality |

#### FR-002: Forward Mode

| ID | Requirement | Priority | Notes |
|---|---|---|---|
| FR-002.1 | User can forward emails to a dedicated assistant email address | Must | Primary forward mode input |
| FR-002.2 | Assistant processes forwarded email: summarizes, extracts action items, identifies risks, suggests response | Must | Core value proposition |
| FR-002.3 | User can share Slack/Teams messages with assistant via "share to DM" or mention | Must | Low-friction input |
| FR-002.4 | Assistant connects forwarded content to organizational context | Must | Differentiator vs generic AI |
| FR-002.5 | User can attach documents (PDF, Word, Excel) to assistant messages for analysis | Should | Common use case |
| FR-002.6 | Assistant categorizes incoming content by type (communication, report, request, decision) | Should | Feeds pattern recognition |

#### FR-003: Skill System (Phase 0 — Pre-built Library)

| ID | Requirement | Priority | Notes |
|---|---|---|---|
| FR-003.1 | Skills are structured markdown instruction files (SKILL.md format) that define capabilities | Must | Architecture foundation |
| FR-003.2 | Pre-built library of 30-50 skills organized by role category | Must | Phase 0 starting point |
| FR-003.3 | Play New advisor can assign skills to a user based on their role and observed patterns | Must | Manual curation in Phase 0 |
| FR-003.4 | User receives notification when a new skill is added with explanation and trial option | Must | Engagement + trust |
| FR-003.5 | User can activate/deactivate any skill | Must | User control |
| FR-003.6 | User can invoke skills via slash commands in chat (e.g., `/weekly-prep`) | Must | Discoverability |
| FR-003.7 | Each skill has a feedback mechanism (useful / not useful / needs improvement) | Must | Learning loop |
| FR-003.8 | Skills have usage analytics visible to the user (how often used, time saved estimates) | Should | Value demonstration |

**Phase 0 Skill Library Categories:**

| Category | Example Skills | Target Personas |
|---|---|---|
| **Communication** | Email summarizer, response drafter, meeting prep, stakeholder brief | All |
| **Analysis** | Data pattern finder, report analyzer, competitive scan, market signal digest | Analysts, managers |
| **Sales** | Pipeline risk scan, competitor pricing alert, forecast prep | Sales teams |
| **Operations** | Process bottleneck identifier, vendor comparison, compliance checker | Operations teams |
| **Strategy** | Strategic signal daily, decision scenario modeler, board prep synthesizer | Leadership |
| **Creative** | Brief analyzer, trend scout, time-on-craft optimizer | Design, marketing |
| **Management** | Team workload analyzer, 1:1 prep, delegation optimizer | Managers |

#### FR-004: Organizational Context

| ID | Requirement | Priority | Notes |
|---|---|---|---|
| FR-004.1 | Strategic context document stored as living knowledge base accessible to all assistant instances | Must | Foundation for contextual intelligence |
| FR-004.2 | Team structure and reporting lines available for context | Must | "Who works on what" |
| FR-004.3 | Industry and competitive context available for analysis | Must | Strategic awareness |
| FR-004.4 | Data source connections (CRM, financials) provide real-time context to assistants | Should | Phase 0: start with 1-2 key data sources per org |
| FR-004.5 | Strategic context document can be updated by Play New advisors without engineering involvement | Must | Operational requirement |

#### FR-005: Pattern Collection (for Organizational Intelligence)

| ID | Requirement | Priority | Notes |
|---|---|---|---|
| FR-005.1 | System logs categorized interaction types across all users (communication analysis, report preparation, data request, etc.) | Must | Raw data for aggregation |
| FR-005.2 | System logs skill activation frequency and user feedback scores | Must | Skill value measurement |
| FR-005.3 | System logs content types shared via forward mode (email, document, message) | Must | Work pattern identification |
| FR-005.4 | All logging is categorical only — content is never logged, only type and metadata | Must | Privacy requirement |
| FR-005.5 | Logs are accessible only to the anonymization pipeline, never to org admins or Play New team directly | Must | Trust requirement |
| FR-005.6 | Minimum 5-user aggregation threshold enforced before any pattern surfaces in org intelligence | Must | Anonymization baseline |

#### FR-006: Automate Intelligence Stream (Manual — Phase 0)

| ID | Requirement | Priority | Notes |
|---|---|---|---|
| FR-006.1 | Play New advisors produce monthly Automate Intelligence Brief for each design partner | Must | Core organizational value |
| FR-006.2 | Brief contains top 3 automation opportunities with estimated time/cost savings | Must | Actionable output |
| FR-006.3 | Brief includes evidence from aggregated pattern data (never individual attribution) | Must | Credibility + privacy |
| FR-006.4 | Brief includes implementation recommendations | Should | Move from insight to action |
| FR-006.5 | Leadership can respond to brief with questions → Play New advisors provide deeper analysis | Should | Interactive intelligence |

#### FR-007: Admin & Operations

| ID | Requirement | Priority | Notes |
|---|---|---|---|
| FR-007.1 | Play New admin dashboard showing: active users, interaction volumes, skill activation rates | Must | Operational visibility |
| FR-007.2 | Individual user data never visible in admin dashboard — only aggregate statistics | Must | Privacy |
| FR-007.3 | Play New advisor can update strategic context document via admin interface | Must | Operational necessity |
| FR-007.4 | System health monitoring: LLM latency, error rates, user satisfaction scores | Must | Reliability |
| FR-007.5 | Onboarding checklist and progress tracker per organization | Should | Operational efficiency |

### 8.5 Phase 0 Non-Functional Requirements

| Requirement | Specification | Notes |
|---|---|---|
| **Availability** | 99.5% uptime during business hours (Mon-Fri, 8am-8pm CET) | Not 99.9% — Phase 0 tolerance for maintenance windows |
| **Response time** | <30 seconds for standard queries, <2 minutes for complex analysis | User expectation threshold |
| **Data residency** | EU data centers only | GDPR baseline |
| **Encryption** | At rest: AES-256. In transit: TLS 1.3. Personal memory: user-scoped keys | Non-negotiable |
| **Scalability** | Support 150 concurrent users (3 orgs × 50 users) | Phase 0 ceiling |
| **LLM provider** | Primary: Claude (Anthropic API). Fallback: GPT-4o (OpenAI API) | Model-agnostic from day one |
| **Audit log** | All system actions logged. User-facing audit log for their own data access. | Trust + compliance |
| **Backup** | Daily encrypted backups. User data restorable on request. | Operational requirement |

### 8.6 Phase 0 Team

| Role | Person | Allocation | Responsibility |
|---|---|---|---|
| Product Vision & Client Relationships | Matteo Roversi | Full-time | Vision, design partner relationships, category development |
| UX/Experience Design | Sarah Corti | Full-time | Assistant interaction design, dashboard UX, onboarding experience |
| Technical Architecture | Rinaldo Festa | Full-time | Platform architecture, infrastructure, security |
| AI Engineer | TBH | Full-time | LLM integration, skill engine, RAG pipeline, anonymization logic |
| Play New Advisors (2-3) | From Cosmico network | Part-time per org | Onboarding delivery, strategic context creation, manual org intelligence |

### 8.7 Phase 0 Timeline

| Week | Milestone | Key Activities |
|---|---|---|
| **W1-2** | Architecture & Setup | Finalize tech stack, set up infrastructure, build assistant core runtime |
| **W3-4** | Design Partner Onboarding Prep | Create onboarding playbook, build skill library v1, design admin dashboard |
| **W5-6** | Partner 1 Onboarding | Strategic context document creation, data connections, deploy to 20-30 users |
| **W7-8** | Partner 1 Live + Partner 2 Onboarding | Partner 1 users active, feedback collection. Begin Partner 2 onboarding |
| **W9-10** | Partner 2 Live + Partner 3 Onboarding | Both partners active. Skill refinement. Begin Partner 3 |
| **W11-12** | All Partners Live | All 3 partners active. Focus on engagement, skill activation, pattern collection |
| **W13-16** | Intelligence Production | First Automate Intelligence Briefs delivered. Leadership feedback sessions |
| **W17-20** | Validation & Learning | Deep analysis of results. Document learnings. Case study development. Go/no-go for Phase 1 |

### 8.8 Phase 0 Success Criteria (Go/No-Go for Phase 1)

**Must achieve ALL of the following:**

| Criterion | Target | Measurement |
|---|---|---|
| **User adoption** | >50% of deployed users active weekly after 4 weeks | Weekly active = at least 3 interactions per week |
| **User trust** | >70% of users comfortable in forward mode, <10% request data deletion | Survey + system data |
| **Skill value** | ≥10 skills per org rated as "useful" by users | Skill feedback mechanism |
| **Organizational intelligence** | ≥1 Automate insight per org that leadership considers "actionable" | Leadership interview |
| **Leadership action** | ≥1 org takes concrete action based on Automate intelligence | Documented decision |
| **Privacy model** | All 3 organizations accept privacy model without major objections | DPO/works-council sign-off |
| **Willingness to pay** | ≥2 of 3 partners willing to transition to paid engagement | Explicit commitment |

**If any criterion is NOT met,** analyze why before proceeding. Specific failure modes and responses:

- Low adoption → Investigate friction points. Consider full access mode acceleration.
- Low trust → Privacy architecture needs strengthening. Consider local inference acceleration.
- Low skill value → Skill library needs fundamental redesign. Consider more automated generation.
- No organizational intelligence value → Dual-layer model may not work at this scale. Consider larger orgs only.
- No willingness to pay → Value proposition not landing. Pivot or kill.

### 8.9 Phase 0 Kill Criteria

**Kill the project if:**
- After 3 months, <30% weekly active usage across all partners (people don't want a work AI assistant)
- 0 out of 3 partners find organizational intelligence actionable (dual-layer model doesn't produce value)
- Privacy concerns prevent deployment in 2+ partners (trust model is fundamentally broken)
- Technical complexity prevents reliable daily operation with current team size

---

## 9. Phase 1 — Product Launch

**Timeline:** August 2026 → December 2026 (5 months)  
**Goal:** Working product, 5-10 paying organizations, 500-2000 users  
**Precondition:** Phase 0 success criteria met

### 9.1 Phase 1 New Capabilities

| Capability | Description | Why Now |
|---|---|---|
| **Full access mode** | Assistant connects to user's email, calendar, and work tools. Passive observation, pattern detection, proactive suggestions. | Phase 0 proved trust model. Now unlock the full experience. |
| **Automated skill generation** | Skill engine proposes new skills based on observed patterns. Human review (Play New advisor) before deployment. | Phase 0 proved which skill types are valuable. Now automate creation. |
| **Automated anonymization pipeline** | Replace manual advisor analysis with automated pattern aggregation. | Scale requirement: manual doesn't work beyond 3 orgs. |
| **Automate + Differentiate streams** | Automate fully automated. Differentiate stream added (combines internal patterns with competitive intelligence). | Automate validated in Phase 0. Add second stream for richer intelligence. |
| **Web dashboard for leadership** | Real-time organizational intelligence dashboard. Replaces monthly PDF briefs. | Leadership wants continuous access, not monthly reports. |
| **Self-service skill management** | Users browse, activate, and manage skills without advisor intervention. | Reduce advisor dependency for skill curation. |

### 9.2 Phase 1 Feature Requirements (Key Additions)

#### FR-100: Full Access Mode

| ID | Requirement | Priority |
|---|---|---|
| FR-100.1 | MCP connectors for: Gmail/Outlook, Google Calendar/Outlook Calendar, Slack message history, Jira/Asana/Linear | Must |
| FR-100.2 | User explicitly grants access to each data source individually | Must |
| FR-100.3 | User can revoke access to any data source at any time | Must |
| FR-100.4 | Assistant observes passively — never takes action without explicit user approval | Must |
| FR-100.5 | Assistant surfaces patterns: "I noticed you spend ~8 hours/week on status emails. Want me to draft them?" | Must |
| FR-100.6 | All observed data stays in personal memory — not shared with org layer except through anonymization | Must |
| FR-100.7 | "What does my assistant know about me?" — user-facing transparency view showing all data sources and learned patterns | Must |

#### FR-101: Automated Skill Generation

| ID | Requirement | Priority |
|---|---|---|
| FR-101.1 | System detects recurring patterns in user's work and proposes skill drafts | Must |
| FR-101.2 | Proposed skills are reviewed by Play New advisor before deployment to user | Must (Phase 1 — remove in Phase 2) |
| FR-101.3 | User receives proposal with clear explanation: what, why, and example output | Must |
| FR-101.4 | User approves/declines proposed skills | Must |
| FR-101.5 | Skill quality scoring: automated assessment of skill output accuracy and usefulness | Should |
| FR-101.6 | Skill retirement: skills unused for 30 days are proposed for retirement | Should |

#### FR-102: Organizational Intelligence Dashboard

| ID | Requirement | Priority |
|---|---|---|
| FR-102.1 | Web-based dashboard accessible to authorized leadership roles | Must |
| FR-102.2 | Automate stream: ranked automation opportunities with estimated impact | Must |
| FR-102.3 | Differentiate stream: competitive advantage analysis based on internal capabilities vs market | Must |
| FR-102.4 | Historical trend tracking: how patterns evolve over time | Should |
| FR-102.5 | Drill-down capability: from high-level insight → department level → evidence (never individual level) | Must |
| FR-102.6 | Export: Board-ready PDF reports from dashboard data | Should |
| FR-102.7 | Alerts: real-time notifications for critical pattern changes | Should |

### 9.3 Phase 1 Pricing (Validated in Phase 0)

| Tier | Price | Includes |
|---|---|---|
| **Essential** | €30-50/person/month | Forward mode, pre-built skills, team-level insights, Slack or Teams |
| **Pro** | €80-120/person/month | Full access mode, skill generation, organizational intelligence (Automate + Differentiate), all channels, quarterly strategic review |
| **Onboarding** | €20-50K one-time | Data connection, strategic context document, rollout support |

*Pricing to be validated with design partners during Phase 0.*

### 9.4 Phase 1 Success Criteria

| Criterion | Target |
|---|---|
| Paying organizations | 5-10 |
| Total deployed users | 500-2000 |
| MRR | >€40K |
| Weekly active usage | >60% of deployed users |
| Full access mode adoption | >20% of users choose full access |
| Skill engine output | 50+ auto-generated skills rated "useful" |
| Organizational action | ≥3 organizations take action based on intelligence |

### 9.5 Phase 1 Team Additions

| Role | Allocation | Responsibility |
|---|---|---|
| AI/Platform Engineer | Full-time | Skill engine automation, anonymization pipeline, MCP connectors |
| Product Manager | Full-time | Feature prioritization, user research, metrics |
| Customer Success Lead | Full-time | Onboarding delivery, user engagement, adoption support |

---

## 10. Phase 2 — Product-Market Fit

**Timeline:** 2027 (Full Year)  
**Goal:** 10-20 organizations, 5,000-15,000 users, self-service Automate and Differentiate streams  
**Precondition:** Phase 1 success criteria met, NRR >100%

### 10.1 Phase 2 Major Capabilities

| Capability | Description |
|---|---|
| **Fully automated Automate + Differentiate** | No advisor intervention needed for these two streams. AI produces, human reviews. |
| **Innovate stream (AI + advisor)** | Third intelligence stream: cross-organizational pattern recognition for new business opportunities. AI generates drafts, Play New advisor refines. |
| **Skill marketplace** | Organizations share anonymized skills. High-value skills become platform IP. |
| **Self-service onboarding** | Organizations <500 people can onboard without Play New advisor. Guided process. |
| **Local inference option (beta)** | Personal assistant inference runs on local/edge infrastructure. Only anonymized patterns leave user environment. |
| **Cross-org benchmarking (beta)** | With 10+ organizations, anonymized cross-org pattern comparison becomes statistically meaningful. |
| **Competitive intelligence integration** | External data: job postings, market signals, patent data integrated into Differentiate and Innovate streams. |
| **European expansion** | UK, DACH, Nordics. Multi-language support for assistant interactions. |

### 10.2 Phase 2 Success Criteria

| Criterion | Target |
|---|---|
| Organizations | 10-20 |
| Total users | 5,000-15,000 |
| ARR | €3-8M |
| NRR | >120% |
| Full access mode adoption | >30% of users |
| Self-service onboarding | Launched for orgs <500 people |
| Cross-org benchmarking | First beta reports produced |
| Automate + Differentiate | Fully automated (no advisor in the loop) |

---

## 11. Phase 3 — Category Leadership

**Timeline:** 2028  
**Goal:** Category king. 30-60 organizations, 20,000-50,000 users.  
**Precondition:** Phase 2 PMF confirmed, ARR trajectory toward €10M+

### 11.1 Phase 3 Major Capabilities

| Capability | Description |
|---|---|
| **API layer** | Other tools build on Play New intelligence. Organizational context as a service. |
| **Full on-premise deployment** | All inference and data processing runs within customer infrastructure. |
| **Cross-org network effects** | 30+ organizations produce benchmarking intelligence that no single org could generate. |
| **Innovate stream fully AI-powered** | Human oversight but AI-led identification of new business opportunities. |
| **Skill engine open-source** | Community-driven skill creation. Ecosystem development. |
| **Category recognition** | Analyst firm coverage (Gartner, Forrester). "Continuous Strategic Intelligence" as recognized category. |
| **Transformation services** | Platform insights convert to transformation consulting engagements (30%+ of clients). |

### 11.2 Phase 3 Success Criteria

| Criterion | Target |
|---|---|
| Organizations | 30-60 |
| Total users | 20,000-50,000 |
| ARR | €10-25M |
| Category recognition | Appears in analyst reports |
| Transformation services | >30% of platform clients |
| Cross-org intelligence | Demonstrably produces insights impossible from single-org data |
| Revenue composition | >70% platform, <15% onboarding, ~15% transformation services |

---

## 12. Skill Engine Specification

### 12.1 What Is a Skill?

A skill is a structured instruction file (SKILL.md format) that teaches the assistant how to perform a specific task or analysis. Skills are the unit of capability evolution in Play New.

**Skill anatomy:**

```markdown
# SKILL: Pipeline Risk Scan

## Metadata
- ID: skill_pipeline_risk_001
- Version: 1.3
- Category: Sales
- Generated: 2026-05-12
- Source: Auto-generated from user pattern observation
- Status: Active
- Quality Score: 0.87
- Usage: 47 activations, 89% positive feedback

## Trigger
User invokes `/pipeline-risk` OR system detects it is Monday morning 
and user has CRM access.

## Context Required
- CRM pipeline data (deals, stages, values, last activity dates)
- Historical win/loss patterns for this organization
- User's specific accounts and territory

## Instructions
1. Pull all open deals from CRM where user is owner or team member.
2. For each deal, assess risk on three dimensions:
   - Engagement decay: days since last meaningful client interaction
   - Stage stagnation: days in current stage vs. historical average
   - Competitive signals: any mentions of competitors in recent communications
3. Rank deals by composite risk score (weighted: engagement 40%, stagnation 35%, competitive 25%).
4. For top 5 at-risk deals, generate specific recommended actions based on deal context.
5. Format as concise brief with deal name, risk level, key concern, recommended action.

## Output Format
Concise Slack message. No more than 15 lines. Start with summary line: 
"X deals flagged this week. Top concern: [deal name]."

## Quality Criteria
- Each flagged deal must cite specific evidence (dates, data points)
- Recommended actions must be specific to the deal, not generic advice
- Compare to previous week's scan to highlight changes

## Feedback Loop
After each use, ask: "Was this scan useful? Any deals I missed or 
flagged incorrectly?" Incorporate feedback into next run.
```

### 12.2 Skill Lifecycle

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ OBSERVED │ →  │ PROPOSED │ →  │ APPROVED │ →  │ ACTIVE   │ →  │ REFINED  │
│          │    │          │    │          │    │          │    │          │
│ Pattern  │    │ Skill    │    │ User or  │    │ In use,  │    │ Updated  │
│ detected │    │ draft    │    │ advisor  │    │ feedback │    │ based on │
│ in user  │    │ created  │    │ approves │    │ collected│    │ feedback │
│ behavior │    │          │    │          │    │          │    │          │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └────┬─────┘
                                                                     │
                                                               ┌─────▼─────┐
                                                               │ RETIRED   │
                                                               │           │
                                                               │ Unused    │
                                                               │ 30+ days  │
                                                               │ or user   │
                                                               │ deactivates│
                                                               └───────────┘
```

### 12.3 Skill Generation by Phase

| Phase | Generation Method | Quality Control |
|---|---|---|
| **Phase 0** | Pre-built library. Play New advisors select and assign. | Advisor curation |
| **Phase 1** | Semi-automated. System observes patterns and generates skill drafts. Advisor reviews before deploying to user. | Advisor review + user approval |
| **Phase 2** | Fully automated. System generates, proposes directly to user. Advisor review only for org-level skills. | Automated quality scoring + user approval |
| **Phase 3** | Community-driven. Skill marketplace. Users and orgs contribute skills. | Quality scoring + community ratings + automated testing |

### 12.4 Skill Quality Scoring (Phase 1+)

Each skill is scored on four dimensions:

| Dimension | Weight | Measurement |
|---|---|---|
| **Activation rate** | 25% | How often the skill is used vs. available |
| **Completion rate** | 25% | How often users let the skill finish vs. canceling mid-way |
| **Feedback score** | 30% | User ratings (useful / not useful / needs improvement) |
| **Output accuracy** | 20% | For skills with verifiable outputs: does the output match reality? (Spot-checked) |

Skills scoring below 0.5 after 10+ activations are flagged for retirement or redesign.

### 12.5 Skill Sharing & Cross-Org Value

When a skill is activated and rated positively across multiple organizations, it becomes a candidate for the skill marketplace (Phase 2+):

1. Skill is anonymized: organization-specific context removed, replaced with generic parameters.
2. Skill metadata added to cross-org skill library.
3. Other organizations can browse and activate shared skills.
4. Original generating organization gets no attribution (full anonymization).

This creates a compounding asset: the more organizations use Play New, the richer the skill library becomes for every organization.

---

## 13. Organizational Intelligence Layer

### 13.1 The Three Intelligence Streams

#### 🔴 AUTOMATE Stream — "This work shouldn't exist in its current form"

**Available from:** Phase 0 (manual), Phase 1 (automated)

**Input data:**
- Time allocation patterns across teams (from anonymized individual data)
- Tool usage patterns (which tools, how often, for what categories of work)
- Repetitive task detection (same task types recurring across multiple users)
- Automation adoption patterns (what are people already automating with AI?)

**Analysis framework:**
1. Identify task categories consuming >10% of a team's time that match known automation patterns
2. Cross-reference with industry benchmarks (what do similar orgs automate?)
3. Estimate time/cost savings based on actual hours observed (not estimates)
4. Assess implementation complexity (tools already in place vs. new tools needed)
5. Rank opportunities by ROI: (estimated savings × confidence) / implementation effort

**Output format:**
```
AUTOMATE INTELLIGENCE BRIEF — [Organization] — [Month]

TOP OPPORTUNITY:
Finance team: Manual reconciliation across 3 systems
- Estimated time: 340 hours/month across team (aggregated from 8+ users)
- Tools involved: Spreadsheet tools, ERP, CRM
- Similar orgs have automated this, reducing to ~40 hours/month
- Estimated annual saving: €180K
- Implementation: Medium complexity — requires integration between existing tools
- Recommended action: [specific steps]

OPPORTUNITY #2: [...]
OPPORTUNITY #3: [...]

TREND: Automation adoption increasing in [department] — 40% more AI-assisted 
tasks this month vs. last. Suggest accelerating support here.
```

#### 🟡 DIFFERENTIATE Stream — "This is where you should concentrate human energy"

**Available from:** Phase 1

**Input data:**
- All Automate data plus:
- Skill types being generated (what capabilities are emerging across the org?)
- Competitive intelligence (competitor job postings, product launches, patent filings)
- Industry benchmark data (what do similar organizations invest human time in?)

**Analysis framework:**
1. Map where the organization's human capabilities exceed industry average
2. Identify areas where competitors are automating (and the org should too, to stay level)
3. Find areas where automation would destroy competitive advantage
4. Recommend human investment priorities: where should freed-up time go?

**Output format:** Monthly strategic brief + dashboard view showing competitive capability map.

#### 🟢 INNOVATE Stream — "This new value didn't exist before"

**Available from:** Phase 2

**Input data:**
- All Automate and Differentiate data plus:
- Cross-team pattern recognition (what do different teams do that could connect?)
- Cross-org pattern recognition (what are similar organizations discovering?)
- Emerging skill types that don't map to existing job descriptions
- Market gap analysis (what do customers need that nobody provides yet?)

**Analysis framework:**
1. Identify cross-functional patterns that suggest new internal products/platforms
2. Detect emerging role types (combinations of skills that didn't exist before)
3. Find market opportunities from the combination of organizational IP + AI capabilities
4. Assess feasibility and strategic fit

**Output format:** Quarterly innovation brief. High-touch: AI generates draft, Play New advisor refines, presented in strategic review session with leadership.

### 13.2 Intelligence Quality Thresholds

| Metric | Minimum for Publication |
|---|---|
| **User base for pattern** | ≥5 users exhibiting the pattern (anonymization threshold) |
| **Confidence score** | ≥0.7 for Automate, ≥0.6 for Differentiate, ≥0.5 for Innovate |
| **Evidence citations** | Every insight must cite aggregated data points (never individuals) |
| **Actionability** | Every insight must include at least one recommended action |
| **Human review** | Innovate insights always reviewed by Play New advisor before publication |

### 13.3 Cross-Org Benchmarking Schema (Design from Day One)

Even in Phase 0, pattern data must be stored in a standardized schema that enables cross-org comparison in Phase 2+:

**Standardized Work Category Taxonomy:**

| Level 1 | Level 2 Examples | Level 3 Examples |
|---|---|---|
| Communication | Internal coordination, Client communication, Reporting | Status updates, Meeting prep, Email triage |
| Analysis | Data analysis, Research, Decision support | Financial analysis, Market research, Competitive analysis |
| Creation | Content creation, Design, Development | Writing, Visual design, Code development |
| Coordination | Project management, People management, Process management | Task assignment, 1:1s, Workflow design |
| Strategy | Planning, Decision-making, Innovation | Quarterly planning, Budget allocation, New initiative design |

Every pattern logged by every organization must map to this taxonomy. This is what enables cross-org comparison: "Your finance team spends 35% on coordination vs. 22% industry average."

---

## 14. Integration Specifications

### 14.1 Phase 0 Integrations

| Integration | Type | Purpose | Priority |
|---|---|---|---|
| **Slack** | Bot (Socket Mode or Events API) | Primary delivery channel for personal assistant | Must |
| **Microsoft Teams** | Bot Framework | Alternative delivery channel | Must |
| **Email (IMAP/SMTP)** | Bridge service | Forward mode email processing | Must |
| **CRM (Salesforce or HubSpot)** | MCP connector (read-only) | Organizational context: pipeline, accounts, activities | Should (1 per org) |
| **Google Workspace / M365** | OAuth + read APIs | Organizational context: people directory, team structure | Should |

### 14.2 Phase 1 Additions

| Integration | Type | Purpose |
|---|---|---|
| **Gmail / Outlook** | MCP connector (read-only) | Full access mode: email observation |
| **Google Calendar / Outlook Calendar** | MCP connector (read-only) | Full access mode: schedule observation |
| **Jira / Asana / Linear** | MCP connector (read-only) | Full access mode: project/task observation |
| **Google Drive / SharePoint** | MCP connector (read-only) | Document context |

### 14.3 Phase 2+ Additions

| Integration | Type | Purpose |
|---|---|---|
| **Financial systems (ERP, Xero, SAP)** | API connector | Organizational context: financial data |
| **HR systems (BambooHR, Workday)** | API connector | Organizational context: structure, roles |
| **Competitive intelligence APIs** | API connector | Differentiate + Innovate streams |
| **Job posting aggregators** | API connector | Market signal detection |

### 14.4 MCP Architecture

All data source connections should use Model Context Protocol (MCP) where possible:

- **Standardized interface:** Each data source exposes a consistent set of tools/resources to the assistant.
- **Permission model:** MCP connections are scoped: organizational (available to all assistants as context) or personal (available only to the user who granted access).
- **Read-only by default:** Phase 0-1: all connectors are read-only. No assistant takes actions in connected systems without explicit user approval.
- **Connection health monitoring:** Admin dashboard shows connector status, data freshness, error rates.

---

## 15. Data Model & Cross-Org Schema

### 15.1 Core Entities

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Organization    │     │  Team           │     │  User Instance  │
│                  │     │                 │     │                 │
│  - org_id        │──┐  │  - team_id      │──┐  │  - instance_id  │
│  - name          │  │  │  - org_id       │  │  │  - user_id      │
│  - industry      │  │  │  - name         │  │  │  - team_id      │
│  - size_band     │  │  │  - function     │  │  │  - role_category│
│  - geo           │  │  │  - size         │  │  │  - access_mode  │
│  - context_doc_id│  │  │                 │  │  │  - status       │
│  - created_at    │  │  │                 │  │  │  - created_at   │
└─────────────────┘  │  └─────────────────┘  │  └─────────────────┘
                     │                        │
                     └────────────────────────┘
                     
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Skill           │     │  Pattern         │     │  Intelligence   │
│                  │     │  (Anonymized)    │     │  Insight        │
│  - skill_id      │     │                 │     │                 │
│  - name          │     │  - pattern_id   │     │  - insight_id   │
│  - category      │     │  - org_id       │     │  - org_id       │
│  - version       │     │  - team_id      │     │  - stream       │
│  - source        │     │  - category_L1  │     │  - title        │
│  - quality_score │     │  - category_L2  │     │  - evidence     │
│  - status        │     │  - category_L3  │     │  - confidence   │
│  - usage_count   │     │  - metric_type  │     │  - impact_est   │
│  - org_id (null  │     │  - metric_value │     │  - recommended  │
│    if shared)    │     │  - user_count   │     │    _actions     │
│                  │     │  - period       │     │  - status       │
│                  │     │  - confidence   │     │  - created_at   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### 15.2 Cross-Org Benchmarking Schema

For patterns to be comparable across organizations, they must share a standardized schema:

```json
{
  "benchmark_record": {
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
    "contributing_org_count": 1
  }
}
```

**Key design decisions:**
- **Size bands, not exact sizes:** Organizations categorized in bands (50-200, 200-500, 500-2000, 2000+) to prevent identification.
- **Geo regions, not countries:** EU_south, EU_north, EU_west, UK to prevent identification with small sample sizes.
- **Minimum contributing orgs:** Cross-org benchmarks only published when ≥3 organizations contribute data to a specific pattern. Below 3, data stays org-internal.

---

## 16. Delivery & Interface Design

### 16.1 Personal Assistant Interfaces

#### Slack / Teams Bot (Primary — Phase 0+)

**Design principles:**
- Conversational, not dashboard-like. The assistant is a colleague, not a tool.
- Proactive but not noisy. Maximum 1 unprompted message per day (unless urgent).
- Skill invocation via slash commands: `/pipeline-risk`, `/weekly-prep`, `/brief-analyze`.
- Rich formatting: use Slack blocks / Teams adaptive cards for structured outputs.
- Thread-aware: keep related conversations in threads, not main DM.

**Message hierarchy:**
1. **Proactive insight** (max 1/day): "Good morning. I noticed something in what you shared yesterday: [brief insight]. Want me to dig deeper?"
2. **Weekly review** (Fridays): Summary of the week's interactions, patterns observed, suggestions for next week.
3. **Skill output**: When a skill produces results (e.g., pipeline risk scan), delivered as a formatted message.
4. **Response to user query**: Immediate response to user questions or forwarded content.

#### Email Bridge (Forward Mode — Phase 0+)

**How it works:**
- Each user gets a dedicated assistant email: `matteo.assistant@playnew.ai`
- User forwards any email → assistant processes and replies to the user (not the original sender)
- Reply includes: summary, key actions, risks, connections to org context, suggested response

**Design principles:**
- Reply format matches email conventions (clear subject line, structured body)
- Always include: "This analysis is private to you. Original email content is stored only in your personal memory."
- Option to "save insight" — user can flag assistant's analysis for their personal knowledge base

### 16.2 Leadership Dashboard (Phase 1+)

**Design principles:**
- Not a BI dashboard. Not charts and graphs for the sake of data.
- Intelligence-first: lead with insights, not metrics.
- Action-oriented: every screen answers "so what should I do?"
- Board-ready: everything exportable as professional PDF.

**Information architecture:**

| Section | Content | Update Frequency |
|---|---|---|
| **Intelligence Feed** | Latest Automate/Differentiate/Innovate insights, ranked by impact | Real-time as new insights generated |
| **Opportunity Pipeline** | All identified opportunities with status (new → in review → actioned → measured) | Weekly |
| **Pattern Explorer** | Deep-dive into work patterns by team, function, time period | Real-time |
| **Impact Tracker** | ROI measurement: actions taken, time saved, value created | Monthly |
| **Benchmark View** | (Phase 2+) Cross-org comparison on key metrics | Quarterly |

### 16.3 Admin Interface

**For Play New advisors and client strategy teams:**

| Section | Content |
|---|---|
| **Org Health** | Active users, interaction volumes, skill activation rates (aggregate only) |
| **Context Management** | Edit strategic context document, manage framework library |
| **Integration Health** | Data connector status, freshness, error rates |
| **Skill Library** | Browse all skills, quality scores, usage patterns |
| **Intelligence Quality** | Review and refine automated insights before publication |

---

## 17. Service Model & Onboarding

### 17.1 Onboarding Process (Phase 0-1)

**Duration:** 4-8 weeks depending on org complexity  
**Delivered by:** Play New advisors (from Cosmico network)

#### Week 1-2: Discovery & Connection

| Activity | Output | Owner |
|---|---|---|
| Leadership interviews (CEO, CHRO, strategy) | Understanding of strategic priorities, culture, pain points | Play New advisor |
| Data infrastructure audit | Map of available data sources, connection feasibility | Technical architect |
| Team structure mapping | Org chart, team functions, key roles | Play New advisor |
| Privacy & compliance review | DPO alignment, works-council briefing (if applicable), data processing agreement | Play New advisor + legal |
| Initial data connections | 1-2 priority data sources connected (CRM, project management) | Technical architect |

#### Week 3-4: Context Building & Configuration

| Activity | Output | Owner |
|---|---|---|
| Strategic context document creation | Living knowledge base capturing strategy, competitive position, industry context | Play New advisor |
| Skill library selection | 10-15 skills selected for initial deployment, customized for org context | Play New advisor |
| Assistant personality configuration | Tone, communication style, proactive frequency calibrated to org culture | UX designer |
| Test deployment | 5-10 beta users test assistant, provide feedback | Product team |
| Beta refinement | Adjustments based on beta feedback | Product team |

#### Week 5-6: Rollout

| Activity | Output | Owner |
|---|---|---|
| User onboarding sessions | 30-minute team sessions introducing the assistant | Play New advisor |
| Individual activation | Each user receives welcome message, completes orientation | Automated + advisor support |
| Adoption support | Daily check-ins with early users, troubleshooting, encouragement | Customer success |
| Champion identification | 3-5 power users identified per org who naturally adopt and evangelize | Customer success |

#### Week 7-8: First Intelligence

| Activity | Output | Owner |
|---|---|---|
| Pattern collection review | Sufficient data for first organizational intelligence | Play New advisor |
| First Automate brief | Top 3 automation opportunities delivered to leadership | Play New advisor |
| Leadership feedback session | Reaction to first intelligence output, calibration | Play New advisor + Matteo |
| Ongoing cadence established | Weekly advisor check-in, monthly intelligence brief, quarterly strategic review | Play New advisor |

### 17.2 Ongoing Service (Post-Onboarding)

| Service | Frequency | Owner |
|---|---|---|
| Intelligence brief production | Monthly (Phase 0), continuous (Phase 1+) | Play New advisor / automated |
| Strategic context update | Monthly review and update | Play New advisor |
| Skill library expansion | Ongoing | Play New advisor / automated |
| User adoption support | As needed | Customer success |
| Quarterly strategic review | Quarterly | Play New advisor + leadership |
| Transformation design | As triggered by insights | Play New advisor (billable) |

### 17.3 Scaling the Service Model

The critical transition: from advisor-heavy to platform-heavy.

| Activity | Phase 0 | Phase 1 | Phase 2 | Phase 3 |
|---|---|---|---|---|
| Onboarding | 100% manual | 80% manual | 50% guided self-service | 30% self-service (small orgs) |
| Intelligence production | 100% manual | 50% automated, 50% advisor | 90% automated, 10% advisor | 95% automated |
| Skill curation | 100% manual | Advisor reviews auto-generated | User self-service + quality scoring | Community + marketplace |
| Context updates | 100% manual | Semi-automated with advisor review | Automated with advisor spot-check | Automated |
| Strategic reviews | Full advisory engagement | Advisory + dashboard | Dashboard-led, advisory on request | Dashboard + AI-generated briefs |

---

## 18. Business Model & Unit Economics

### 18.1 Revenue Streams

| Stream | Phase 0 | Phase 1 | Phase 2 | Phase 3 |
|---|---|---|---|---|
| **Onboarding / consulting** | 100% (design partnership) | 60% | 30% | 15% |
| **Platform subscriptions** | 0% | 25% | 55% | 70% |
| **Transformation services** | 0% | 15% | 15% | 15% |

### 18.2 Pricing (To Be Validated Phase 0)

| Tier | Target Price | Includes |
|---|---|---|
| **Essential** | €30-50/person/month | Forward mode, pre-built skills, team insights, 1 channel |
| **Pro** | €80-120/person/month | Full access, skill generation, org intelligence, all channels, quarterly review |
| **Enterprise** | Custom | Dedicated advisor, custom integrations, on-premise, transformation services |
| **Onboarding** | €20-50K one-time | Scales with org size and complexity |

### 18.3 Unit Economics (Target — 500-person org on Pro @ €100/person/month)

| Metric | Value | % of Revenue |
|---|---|---|
| **Annual contract value** | €600K | 100% |
| **Onboarding revenue** | €40K (one-time, amortized Y1) | — |
| **AI compute cost** | ~€60K/year | ~10% |
| **Integration & infrastructure** | ~€30K/year | ~5% |
| **Play New advisor allocation** | ~€60K/year | ~10% |
| **Gross margin** | ~€450K | ~75% |

### 18.4 Revenue Projections

| Period | Organizations | Users | Revenue | Composition |
|---|---|---|---|---|
| **Phase 0 (H1 2026)** | 3 (design partners) | 60-150 | €0 (design partnership) | N/A |
| **Phase 1 (H2 2026)** | 5-10 | 500-2,000 | €400-800K | 60% onboarding, 25% platform, 15% transformation |
| **Phase 2 (2027)** | 10-20 | 5,000-15,000 | €3-8M | 30% onboarding, 55% platform, 15% transformation |
| **Phase 3 (2028)** | 30-60 | 20,000-50,000 | €10-25M | 15% onboarding, 70% platform, 15% transformation |

---

## 19. Success Metrics

### 19.1 North Star Metric

**"Leadership Actions Taken Based on Platform Intelligence"**

This is the single metric that proves both layers work: individual assistants generate enough data to produce organizational intelligence, and that intelligence is good enough that leadership acts on it. Everything else is a supporting metric.

### 19.2 Metrics Framework

#### User Engagement Metrics

| Metric | Phase 0 Target | Phase 1 Target | Phase 2 Target |
|---|---|---|---|
| Weekly active users (% of deployed) | >50% | >60% | >65% |
| Interactions per active user per week | ≥3 | ≥5 | ≥8 |
| Forward mode → full access conversion | N/A | >20% | >30% |
| Skill activation rate (% of available skills used weekly) | >30% | >40% | >50% |
| User satisfaction (NPS) | >30 | >40 | >50 |
| "Can't do without" score (% who say they'd miss it) | >40% | >60% | >70% |

#### Intelligence Quality Metrics

| Metric | Phase 0 Target | Phase 1 Target | Phase 2 Target |
|---|---|---|---|
| Automate insights per org per month | ≥3 | ≥5 (automated) | ≥8 (automated) |
| Insight accuracy (leadership validates as true) | >70% | >80% | >85% |
| Insight actionability (leadership says "I can act on this") | >50% | >60% | >70% |
| Actions taken per org per quarter | ≥1 | ≥3 | ≥5 |
| Measured ROI from actions | Qualitative | €50K+ per org | €200K+ per org |

#### Business Metrics

| Metric | Phase 0 Target | Phase 1 Target | Phase 2 Target |
|---|---|---|---|
| ARR | €0 | €400K+ | €3M+ |
| MRR growth rate | N/A | >15% MoM | >10% MoM |
| Net revenue retention | N/A | >100% | >120% |
| Gross margin | N/A | >70% | >75% |
| CAC payback period | N/A | <12 months | <9 months |
| Logo churn rate | 0% (design partners) | <10% annual | <5% annual |

#### Skill Engine Metrics (Phase 1+)

| Metric | Phase 1 Target | Phase 2 Target |
|---|---|---|
| Skills auto-generated per org per month | ≥5 | ≥15 |
| Skill quality score (average) | >0.65 | >0.75 |
| Skill approval rate (user accepts proposed skill) | >50% | >60% |
| Shared skills in marketplace | N/A | >100 |

---

## 20. Technical Requirements & Infrastructure

### 20.1 Technology Stack (Recommended — To Be Validated)

| Layer | Technology | Rationale |
|---|---|---|
| **LLM Backbone** | Claude API (primary), GPT-4o (fallback) | Best reasoning quality. Model-agnostic architecture allows switching. |
| **Orchestration** | Python (FastAPI) or TypeScript (Node) | Team preference. Must support async, streaming. |
| **Personal Memory** | Qdrant or Weaviate (vector DB) | Per-user namespaces, encryption at rest, fast similarity search. |
| **Org Context Store** | PostgreSQL + pgvector | Structured data (org context, patterns) + vector search for RAG. |
| **Pattern Store** | PostgreSQL | Structured anonymized patterns for aggregation and benchmarking. |
| **Skill Registry** | File storage (S3/GCS) + PostgreSQL metadata | Skills are markdown files. Metadata in DB for querying. |
| **Messaging** | Slack Bolt SDK, Teams Bot Framework, IMAP/SMTP bridge | Standard messaging platform integrations. |
| **Data Connectors** | MCP servers + custom API connectors | MCP for standardized data access. Custom for systems without MCP. |
| **Infrastructure** | AWS/GCP (EU region) | EU data residency requirement. Kubernetes for orchestration. |
| **Monitoring** | Prometheus + Grafana, Sentry | System health, error tracking, performance monitoring. |
| **CI/CD** | GitHub Actions → Container registry → K8s | Standard deployment pipeline. |

### 20.2 Infrastructure Requirements

| Requirement | Phase 0 | Phase 1 | Phase 2 |
|---|---|---|---|
| **Users** | 150 | 2,000 | 15,000 |
| **LLM calls/day** | ~1,000 | ~20,000 | ~150,000 |
| **Storage (personal memory)** | ~50GB | ~2TB | ~15TB |
| **Storage (org context)** | ~5GB | ~50GB | ~500GB |
| **Compute** | 2-4 nodes | 8-16 nodes | Auto-scaling cluster |
| **Monthly infrastructure cost** | ~€2-5K | ~€15-30K | ~€80-150K |

### 20.3 Security Requirements

| Requirement | Phase 0 | Phase 1 | Phase 2 |
|---|---|---|---|
| **Encryption at rest** | AES-256 | AES-256 | AES-256 + user-scoped keys |
| **Encryption in transit** | TLS 1.3 | TLS 1.3 | TLS 1.3 |
| **Authentication** | SSO (SAML/OIDC) | SSO + MFA | SSO + MFA + hardware key option |
| **Data residency** | EU only | EU only | EU + customer choice |
| **Audit logging** | Basic | Comprehensive | Comprehensive + third-party audit |
| **Penetration testing** | N/A | Annual | Semi-annual |
| **Compliance** | GDPR baseline | GDPR + SOC 2 Type I preparation | SOC 2 Type II + ISO 27001 preparation |
| **Incident response** | Basic playbook | Documented SLA | 24/7 security operations |

---

## 21. Risks, Mitigations & Kill Criteria

### 21.1 Risk Matrix

| Risk | Probability | Impact | Phase | Mitigation |
|---|---|---|---|---|
| **People don't use the assistant** | Medium | Critical | 0 | Forward mode reduces friction. Quick wins first. Champion network. If <30% adoption after 3 months: investigate or kill. |
| **Privacy concerns block deployment** | Medium | Critical | 0 | Privacy-first architecture. DPO engagement in onboarding. Forward mode as safe entry. Works-council briefing template. |
| **Organizational intelligence isn't actionable** | Medium | Critical | 0-1 | Focus on Automate (most measurable). Advisors produce manually first. If 0/3 partners find it actionable: kill dual-layer. |
| **Skill engine produces low-quality skills** | Medium | High | 1 | Human review in Phase 1. Quality scoring. User approval required. Retirement mechanism. |
| **AI hallucination in strategic recommendations** | Medium | High | 1+ | Confidence scoring. Evidence citations. Human-in-loop for Innovate. Never present insights without supporting data. |
| **Microsoft/Anthropic ships competing features** | High | High | 1+ | Focus on org intelligence layer (their blind spot). Cross-org benchmarking (impossible for single-vendor). Speed to category. |
| **Consulting-to-platform transition fails** | Medium | High | 1-2 | Design product to reduce advisor dependency from day one. Automate everything that can be automated. Track consulting vs platform revenue ratio monthly. |
| **Pricing too high for Italian mid-market** | Medium | Medium | 1 | Essential tier at €30-50. Usage-based option. Team pricing vs per-person. Prove ROI fast. |
| **Cosmico TaaS conflict of interest** | Low | Medium | 1+ | Separate P&L. Independent positioning. Frame as evolution, not competition. |
| **LLM provider dependency** | Low | Medium | All | Model-agnostic architecture. Multi-model strategy. Local inference path (Phase 2+). |
| **Data breach or privacy incident** | Low | Critical | All | Encryption, isolation, minimal data collection, incident response plan, insurance. |

### 21.2 Kill Criteria

**Kill Play New entirely if:**
- Phase 0 ends with <30% weekly active usage across all 3 partners
- 0 out of 3 partners find organizational intelligence actionable
- Privacy architecture is rejected by 2+ partner DPOs
- After Phase 1, no paying customer achieves NRR >80%

**Pivot (not kill) if:**
- Organizational intelligence works but personal assistant doesn't engage → pivot to pure analytics/consulting platform
- Personal assistant engages but org intelligence doesn't → pivot to B2B AI assistant (compete in Wave 2, abandon Wave 3 moat)
- Italian market too small → accelerate international expansion before proving domestically

---

## 22. Open Decisions & Decision Framework

### 22.1 Decisions to Make Before Phase 0

| Decision | Options | Recommendation | Decision Date |
|---|---|---|---|
| **LLM backbone for Phase 0** | (A) Claude API only (B) Claude + GPT-4o (C) Multi-model from day one | (B) Claude primary, GPT-4o fallback. Simplicity matters more than optimization in Phase 0. | March 2026 |
| **Vector DB for personal memory** | (A) Qdrant (B) Weaviate (C) Pinecone (D) pgvector | Evaluate during W1-2 architecture sprint. Key criteria: per-namespace encryption, EU hosting, cost at scale. | March 2026 |
| **Build vs. adapt skill engine** | (A) Build from scratch (B) Adapt OpenClaw architecture (C) Build on Claude Agent SDK | (B) Start with OpenClaw patterns, customize. Fastest path to working system. | March 2026 |
| **3 design partners** | Candidates from Cosmico network | Identify 8-10 candidates, evaluate against criteria (Section 8.2), select 3 across different industries. | March 2026 |
| **Org intelligence: fully manual or semi-automated in Phase 0?** | (A) Advisors produce entirely manually (B) System collects patterns, advisors analyze | (B) System collects categorized patterns. Advisors analyze and produce briefs. Validates data pipeline early. | March 2026 |
| **Forward mode email architecture** | (A) Dedicated email per user (B) Single org email with user routing (C) Slack/Teams only, no email | (A) Dedicated email. Clearest UX, simplest routing. Cost: email infrastructure. | March 2026 |

### 22.2 Decisions to Make During Phase 0

| Decision | Trigger | Options |
|---|---|---|
| **Full access mode readiness** | Phase 0 trust data | If >70% trust in forward mode → build full access for Phase 1. If <50% → defer full access, strengthen privacy. |
| **Pricing validation** | Design partner feedback | Test €30-50 Essential and €80-120 Pro. Adjust based on willingness to pay signals. |
| **Minimum viable org size** | Pattern quality data | If patterns are meaningful at 20-50 users → target can be smaller orgs. If not → minimum 200 users per org. |
| **Skill generation automation timeline** | Skill library quality data | If pre-built skills work well → automate generation in Phase 1. If not → extend manual curation. |
| **International timeline** | Italian market size validation | If Italian pipeline <20 qualified prospects → accelerate international. If >50 → stay domestic in Phase 1. |

### 22.3 Decision Framework

For all major decisions, use this framework:

1. **Does this strengthen the organizational intelligence layer (our moat)?** If yes, prioritize. If no, defer unless it's a prerequisite.
2. **Does this reduce advisor dependency?** If yes, prioritize. Consulting doesn't scale.
3. **Does this improve the cross-org data schema?** If yes, prioritize. Network effects are our endgame.
4. **Does this help us learn something we need to know before Phase 1?** If yes, do it in Phase 0.
5. **Is this required for user trust?** If yes, non-negotiable. Trust is the foundation.

---

## 23. Appendices

### Appendix A: Glossary

| Term | Definition |
|---|---|
| **Anonymization Boundary** | The one-way transformation layer between personal data and organizational patterns. Ensures individual data never surfaces in org intelligence. |
| **Automate Stream** | Intelligence stream identifying work that should be automated. Most measurable, first to deploy. |
| **Cross-Org Benchmarking** | Anonymized comparison of work patterns across multiple Play New organizations. Requires ≥3 orgs per pattern. |
| **Design Partner** | Phase 0 organization participating in product validation. No payment, deep collaboration. |
| **Differentiate Stream** | Intelligence stream identifying where human energy should concentrate. Combines internal patterns with competitive intelligence. |
| **Forward Mode** | User controls what the assistant sees by explicitly forwarding content. Lower power, higher trust. |
| **Full Access Mode** | Assistant connects to user's tools (email, calendar, etc.) for passive observation. Higher power, requires trust. |
| **Innovate Stream** | Intelligence stream identifying new opportunities from cross-functional and cross-org patterns. Highest value, hardest to deliver. |
| **MCP (Model Context Protocol)** | Standardized protocol for connecting LLMs to external data sources and tools. |
| **Organizational Context Engine** | The "brain" containing strategic context document, data connections, and framework library. |
| **Play New Advisor** | Human strategist who delivers onboarding, produces organizational intelligence (Phase 0), and guides transformation. |
| **Skill** | Structured instruction file (SKILL.md) that teaches the assistant a specific capability. |
| **Skill Engine** | System that generates, proposes, and manages skills based on user work patterns. |
| **Strategic Context Document** | Living knowledge base capturing organization's strategy, competitive position, culture, goals. Created during onboarding. |

### Appendix B: Competitive Comparison Matrix

| Capability | Play New | Claude Enterprise | Microsoft Copilot | Viva Insights | McKinsey |
|---|---|---|---|---|---|
| Personal AI assistant | ✅ | ✅ | ✅ | ❌ | ❌ |
| Organizational context | ✅ (deep) | ❌ | ✅ (partial) | ✅ (operational) | ✅ (point-in-time) |
| Persistent personal memory | ✅ | ✅ (limited) | ✅ (limited) | ❌ | ❌ |
| Self-generating skills | ✅ | ❌ | ❌ | ❌ | ❌ |
| Proactive insights | ✅ | ❌ | ✅ (basic) | ✅ (operational) | ❌ |
| Organizational intelligence | ✅ | ❌ | ❌ | ✅ (limited) | ✅ (point-in-time) |
| Strategic frameworks | ✅ | ❌ | ❌ | ❌ | ✅ |
| Cross-org benchmarking | ✅ (Phase 2+) | ❌ | ❌ | ✅ (limited) | ✅ |
| Continuous (not point-in-time) | ✅ | ✅ | ✅ | ✅ | ❌ |
| Privacy-first architecture | ✅ (core) | ✅ | ⚠️ (Microsoft ecosystem) | ⚠️ | N/A |
| Price (500 users/year) | ~€600K | ~€180K | ~€180K | Included in M365 | €500K-5M per engagement |

### Appendix C: Phase 0 Skill Library — Initial Set

**Communication Skills (8):**
1. `email-summarizer` — Summarize forwarded email with key actions, risks, and context
2. `response-drafter` — Draft reply to forwarded email in user's tone
3. `meeting-prep` — Prepare brief for upcoming meeting based on agenda and context
4. `stakeholder-brief` — Synthesize information into stakeholder-ready format
5. `negotiation-analyzer` — Analyze negotiation dynamics in forwarded communication
6. `escalation-detector` — Flag communications that may require escalation
7. `action-item-extractor` — Extract and track action items from any shared content
8. `weekly-digest` — Compile weekly summary of all interactions and patterns

**Analysis Skills (7):**
9. `data-pattern-finder` — Identify patterns in shared data or reports
10. `report-analyzer` — Analyze forwarded reports and surface key insights
11. `competitive-scan` — Analyze competitive information shared by user
12. `market-signal-digest` — Synthesize market signals from shared content
13. `trend-spotter` — Identify emerging trends from accumulated shared content
14. `gap-analyzer` — Identify gaps between current state and strategic goals
15. `benchmark-comparer` — Compare shared metrics against known benchmarks

**Sales Skills (5):**
16. `pipeline-risk-scan` — Assess pipeline deal health (requires CRM connection)
17. `deal-strategy-advisor` — Analyze deal dynamics and suggest strategy
18. `competitor-pricing-alert` — Monitor and synthesize competitor pricing signals
19. `forecast-prep` — Prepare sales forecast with variance analysis
20. `client-health-check` — Assess client relationship health from communication patterns

**Operations Skills (5):**
21. `process-bottleneck-finder` — Identify process bottlenecks from shared workflow descriptions
22. `vendor-comparison` — Structured comparison of vendor proposals
23. `compliance-checker` — Check shared documents against known compliance requirements
24. `resource-optimizer` — Analyze resource allocation from shared project data
25. `risk-register-updater` — Maintain risk register from ongoing shared information

**Strategy Skills (5):**
26. `strategic-signal-daily` — Morning briefing of relevant strategic signals
27. `decision-scenario-modeler` — Build scenarios for strategic decisions
28. `board-prep-synthesizer` — Compile board materials from shared cross-departmental content
29. `strategy-gap-analyzer` — Compare current activities against strategic priorities
30. `competitive-position-tracker` — Track competitive positioning from accumulated intelligence

**Management Skills (5):**
31. `team-workload-analyzer` — Analyze team workload patterns from shared information
32. `one-on-one-prep` — Prepare 1:1 meeting agendas based on context
33. `delegation-optimizer` — Suggest task delegation based on team capabilities
34. `performance-pattern-detector` — Identify patterns relevant to team performance
35. `cross-team-connector` — Identify collaboration opportunities across teams

---

### Appendix D: References & Inspiration

| Reference | Relevance |
|---|---|
| **OpenClaw / nanoclaw** | Self-generating skill engine architecture. Proof that skill-based assistants can be built rapidly. |
| **Wardley Mapping** | Strategic framework for organizational intelligence — mapping value chains and evolution. |
| **Blue Ocean Strategy (ERRC)** | Competitive positioning framework used in Play New's own strategy. |
| **Jobs to Be Done** | User need identification framework. Applied to both individual users and organizational buyers. |
| **Differential Privacy** | Mathematical framework for privacy-preserving data aggregation. Phase 2+ implementation. |
| **Model Context Protocol (MCP)** | Anthropic's standard for LLM-to-data connections. Core integration architecture. |

---

*This document is a living artifact. It will evolve as Phase 0 produces learnings. Major revisions should be version-controlled and reviewed with the full team.*

**Next actions:**
1. Team review of this PRD (1 week)
2. Architecture sprint: validate tech stack decisions (W1-2)
3. Design partner outreach: identify 8-10 candidates (immediate)
4. Skill library v1: build first 10 skills and test internally (W2-4)
5. Privacy architecture deep-dive: detailed technical specification (W2-3)
