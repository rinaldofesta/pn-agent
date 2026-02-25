# Skill Engine Specification

**Status:** Draft
**Version:** 0.1
**Last Updated:** 2026-02-25
**Owner:** Technical Architecture

---

## Context

The skill engine is the capability layer of Play New. Rather than hardcoding features into the assistant runtime, every capability is expressed as a **skill** -- a structured instruction file that teaches the LLM how to perform a specific task. This makes the platform extensible without code changes: new capabilities are deployed by writing markdown files, not shipping code.

Play New has a dual skill system that serves two fundamentally different purposes:

1. **Platform skills** (nanoclaw-style): Modify the Play New codebase itself. These are developer tools that evolve the platform through code generation and git merge workflows.
2. **User skills** (Play New-style): LLM instruction documents that teach the personal assistant to perform specific tasks for the user. These are the skills that users interact with.

This specification focuses on **user skills** -- the core of the Play New experience. Platform skills are addressed briefly for architectural clarity.

---

## Nanoclaw Foundation

Nanoclaw provides a skill engine architecture in the `skills-engine/` directory and a SKILL.md format used for platform-level code modification skills. Key patterns we reuse:

**What nanoclaw provides:**
- SKILL.md format convention (metadata + instructions + quality criteria)
- `manifest.yaml` for skill metadata and dependencies
- Skills directory structure with versioning
- Three-way git merge for applying skill outputs to the codebase
- State tracking for skill lifecycle (created, applied, reverted)
- Skill registration and discovery patterns

**What we extend for Play New:**
- User-facing skills (LLM instructions, not code modifications)
- Per-user skill registries (each user has their own active skill set)
- Skill assignment by advisors based on role and observed patterns
- Slash command and automatic triggers
- Channel-specific output formatting
- Feedback loop and quality scoring
- Skill lifecycle management (observed -> proposed -> approved -> active -> refined -> retired)

---

## Play New Requirements

From the PRD:

- **Section 6.3.2 (Skill Engine):** Skills are structured markdown instruction files that teach the assistant specific tasks
- **Section 8.1 (Phase 0):** Pre-built skill library (no automated skill generation)
- **Section 12.1 (What Is a Skill?):** Full SKILL.md anatomy with metadata, trigger, context required, instructions, output format, quality criteria, feedback loop
- **Section 12.2 (Skill Lifecycle):** OBSERVED -> PROPOSED -> APPROVED -> ACTIVE -> REFINED -> RETIRED
- **Section 12.3 (Generation by Phase):** Phase 0: pre-built, advisor-curated; Phase 1: semi-automated with advisor review; Phase 2+: fully automated with quality scoring
- **Section 12.4 (Quality Scoring):** Activation rate (25%), completion rate (25%), feedback score (30%), output accuracy (20%)
- **FR-003.1:** Skills are structured markdown instruction files (SKILL.md format) that define capabilities
- **FR-003.2:** Pre-built library of 30-50 skills organized by role category
- **FR-003.3:** Play New advisor can assign skills to a user based on their role and observed patterns
- **FR-003.4:** User receives notification when a new skill is added with explanation and trial option
- **FR-003.5:** User can activate/deactivate any skill
- **FR-003.6:** User can invoke skills via slash commands in chat
- **FR-003.7:** Each skill has a feedback mechanism
- **FR-003.8:** Skills have usage analytics visible to the user

---

## Technical Specification

### Dual Skill System Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                     PLAY NEW SKILL ENGINE                      │
│                                                                │
│  ┌─────────────────────────┐  ┌─────────────────────────────┐  │
│  │   PLATFORM SKILLS       │  │   USER SKILLS               │  │
│  │   (nanoclaw-style)      │  │   (Play New-style)          │  │
│  │                         │  │                             │  │
│  │  Purpose: Modify the    │  │  Purpose: Teach the LLM     │  │
│  │  Play New codebase      │  │  to perform user tasks      │  │
│  │                         │  │                             │  │
│  │  Format: SKILL.md +     │  │  Format: SKILL.md           │  │
│  │    manifest.yaml +      │  │  (instructions only)        │  │
│  │    code templates       │  │                             │  │
│  │                         │  │                             │  │
│  │  Execution: Git merge,  │  │  Execution: Instructions    │  │
│  │    code generation,     │  │  injected into LLM prompt   │  │
│  │    file modification    │  │  context at invocation time  │  │
│  │                         │  │                             │  │
│  │  Users: Developers      │  │  Users: Knowledge workers   │  │
│  │  Lifecycle: Dev workflow │  │  Lifecycle: See below       │  │
│  └─────────────────────────┘  └─────────────────────────────┘  │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                SHARED INFRASTRUCTURE                      │  │
│  │  - SKILL.md format parser                                │  │
│  │  - Skill registry (per-user, per-org)                    │  │
│  │  - Version control (git-backed)                          │  │
│  │  - State tracking (lifecycle management)                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

### User Skill Data Model

```typescript
/**
 * A user skill as stored in the skill registry.
 */
interface UserSkill {
  /** Unique skill identifier */
  id: string; // e.g., 'skill_pipeline_risk_001'

  /** Human-readable skill name */
  name: string; // e.g., 'Pipeline Risk Scan'

  /** Skill version (semver) */
  version: string; // e.g., '1.3'

  /** Skill category for organization */
  category: SkillCategory;

  /** Current quality score (0.0 - 1.0) */
  qualityScore: number;

  /** Current lifecycle status */
  status: SkillStatus;

  /** How this skill was created */
  source: SkillSource;

  /** Usage statistics */
  usage: SkillUsageStats;

  /** Trigger configuration */
  trigger: SkillTrigger;

  /** Required MCP connectors or data sources */
  contextRequired: SkillContextRequirement[];

  /** The LLM instructions (the core of the skill) */
  instructions: string;

  /** Channel-specific output format */
  outputFormat: SkillOutputFormat;

  /** Quality criteria for self-assessment */
  qualityCriteria: string[];

  /** Feedback loop instructions */
  feedbackLoop: string;

  /** File path to the SKILL.md source */
  skillMdPath: string;

  /** Timestamps */
  createdAt: Date;
  updatedAt: Date;

  /** Organization that owns this skill (null if shared/platform) */
  orgId: string | null;
}

type SkillCategory =
  | 'communication'
  | 'analysis'
  | 'sales'
  | 'operations'
  | 'strategy'
  | 'management'
  | 'creative';

type SkillStatus =
  | 'observed'   // Pattern detected, skill not yet drafted
  | 'proposed'   // Skill draft created, awaiting approval
  | 'approved'   // Approved by advisor or user, not yet activated
  | 'active'     // In active use, collecting feedback
  | 'refined'    // Updated based on feedback, in active use
  | 'retired';   // Deactivated (unused 30+ days or user deactivated)

type SkillSource =
  | 'pre_built'       // Phase 0: manually created by Play New team
  | 'advisor_created' // Created by a Play New advisor for a specific org
  | 'auto_generated'  // Phase 1+: system-generated from observed patterns
  | 'user_created'    // Phase 2+: created by the user
  | 'marketplace';    // Phase 2+: shared from another org

interface SkillUsageStats {
  /** Total number of times this skill has been activated */
  totalActivations: number;
  /** Number of times the user completed the skill (didn't cancel) */
  completions: number;
  /** Positive feedback count */
  positiveFeedback: number;
  /** Negative feedback count */
  negativeFeedback: number;
  /** Needs improvement feedback count */
  improvementFeedback: number;
  /** Last activation timestamp */
  lastActivatedAt: Date | null;
  /** Estimated time saved (minutes) across all activations */
  estimatedTimeSavedMinutes: number;
}

interface SkillTrigger {
  /** Slash command that invokes this skill */
  slashCommand?: string; // e.g., '/pipeline-risk'
  /** Automatic trigger conditions (Phase 1+) */
  automaticConditions?: AutomaticTriggerCondition[];
}

interface AutomaticTriggerCondition {
  type: 'schedule' | 'event' | 'pattern';
  /** Cron expression for scheduled triggers */
  schedule?: string; // e.g., '0 8 * * MON' (Monday 8am)
  /** Event type for event-based triggers */
  eventType?: string; // e.g., 'crm_deal_stage_change'
  /** Pattern description for pattern-based triggers */
  patternDescription?: string;
}

interface SkillContextRequirement {
  /** Type of context needed */
  type: 'mcp_connector' | 'org_context' | 'personal_memory' | 'external_api';
  /** Name/identifier of the specific context source */
  name: string; // e.g., 'salesforce_crm', 'strategic_context_doc'
  /** Whether this context is required or enhancing */
  required: boolean;
  /** Description of what data is needed */
  description: string;
}

interface SkillOutputFormat {
  /** Default format */
  default: 'concise' | 'detailed' | 'structured';
  /** Channel-specific overrides */
  channelOverrides?: {
    slack?: string;  // e.g., 'Block Kit with max 15 lines'
    teams?: string;  // e.g., 'Adaptive Card'
    email?: string;  // e.g., 'HTML email with sections'
  };
  /** Maximum output length hint */
  maxLength?: string; // e.g., '15 lines', '500 words', '1 page'
}
```

### Skill Lifecycle

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ OBSERVED │ →  │ PROPOSED │ →  │ APPROVED │ →  │ ACTIVE   │ ⇄  │ REFINED  │
│          │    │          │    │          │    │          │    │          │
│ Pattern  │    │ Skill    │    │ Advisor  │    │ In use,  │    │ Updated  │
│ detected │    │ draft    │    │ or user  │    │ feedback │    │ based on │
│ (Phase   │    │ created  │    │ approves │    │ collected│    │ feedback │
│ 1+)      │    │          │    │          │    │          │    │          │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └────┬─────┘
                                                                     │
      Phase 0: Skills start                                    ┌─────▼─────┐
      here (pre-built)  ────────────────────────────────► ─────│ RETIRED   │
                                                               │           │
                                                               │ Unused    │
                                                               │ 30+ days  │
                                                               │ or user   │
                                                               │ deactivates│
                                                               └───────────┘
```

**Phase 0 simplified lifecycle:**
- Skills start in `approved` status (pre-built by Play New team)
- Advisor assigns skill to user -> status becomes `active`
- User provides feedback -> skill is `refined` (advisor updates SKILL.md)
- User deactivates or skill unused 30+ days -> `retired`

**Phase 1+ full lifecycle:**
- System observes a pattern in user behavior -> `observed`
- System generates a skill draft -> `proposed`
- Advisor reviews and approves (or rejects) -> `approved`
- User activates -> `active`
- Feedback triggers refinement -> `refined`
- Unused or user deactivates -> `retired`

### Skill Execution Flow

When a user invokes a skill, the following sequence executes:

```
1. TRIGGER
   User types /pipeline-risk in Slack
   OR: Automatic trigger fires (Phase 1+)

2. RESOLVE
   Skill engine looks up the skill in the user's skill registry
   Validates: is the skill active for this user?

3. CONTEXT GATHERING
   For each item in skill.contextRequired:
     - MCP connector: fetch data from connected system
     - Org context: retrieve relevant sections from org context engine
     - Personal memory: query user's vector store for relevant history
     - External API: call external service

   If a required context source is unavailable:
     → Inform user: "This skill needs CRM access. Connect your CRM first."
     → Abort execution

4. PROMPT CONSTRUCTION
   Build the LLM prompt:

   [System prompt]
   You are the user's personal AI assistant. You are executing
   a specific skill. Follow the instructions precisely.

   [Skill instructions]
   {skill.instructions}

   [Context data]
   {gathered context from step 3}

   [Output format]
   {skill.outputFormat}
   Format for {channel}: {channelOverride}

   [Quality criteria]
   {skill.qualityCriteria}

   [User input]
   {any additional text the user provided with the command}

5. LLM EXECUTION
   Send constructed prompt to LLM (Claude API primary)
   Stream response if channel supports it (Slack: no, Teams: no, Web: Phase 1)

6. FORMAT OUTPUT
   Apply channel-specific formatting:
   - Slack: convert to Block Kit via RichMessage
   - Teams: convert to plain text (Phase 0) / Adaptive Card (Phase 1)
   - Email: convert to HTML email

7. DELIVER
   Send formatted response through the appropriate channel adapter

8. COLLECT FEEDBACK
   After delivery, append feedback prompt:
   "Was this helpful? (yes / no / needs improvement)"
   Record user's response in skill.usage stats

9. LOG
   Record skill activation for:
   - User-facing analytics (how often used, time saved)
   - Pattern collection (anonymized, categorical only)
```

```typescript
/**
 * Execute a skill for a user.
 */
async function executeSkill(
  skillId: string,
  userId: string,
  userInput: string,
  channelName: string
): Promise<RichMessage> {
  // 1. Resolve skill
  const skill = await getUserSkill(userId, skillId);
  if (!skill || skill.status === 'retired') {
    return { text: `Skill "${skillId}" is not available. Type /pn skills to see your active skills.` };
  }

  // 2. Gather context
  const context = await gatherSkillContext(skill, userId);
  if (context.missingRequired.length > 0) {
    return {
      text: `This skill requires: ${context.missingRequired.join(', ')}. ` +
            `Please ask your administrator to connect these data sources.`,
    };
  }

  // 3. Construct prompt
  const prompt = buildSkillPrompt(skill, context.data, userInput, channelName);

  // 4. Execute LLM
  const llmResponse = await callLLM(prompt);

  // 5. Format for channel
  const formatted = formatForChannel(llmResponse, channelName, skill.outputFormat);

  // 6. Record activation
  await recordSkillActivation(userId, skillId);

  // 7. Append feedback prompt
  formatted.blocks = [
    ...(formatted.blocks || []),
    { type: 'divider' },
    {
      type: 'context',
      text: '_Was this helpful?_ Reply with *yes*, *no*, or *needs improvement*',
    },
  ];

  return formatted;
}

function buildSkillPrompt(
  skill: UserSkill,
  contextData: Record<string, string>,
  userInput: string,
  channelName: string
): string {
  const sections: string[] = [];

  // System context
  sections.push(
    'You are executing a specific skill for the user. Follow the instructions precisely. ' +
    'Use only the provided context data. Do not fabricate information.'
  );

  // Skill instructions
  sections.push(`## Skill: ${skill.name}\n\n${skill.instructions}`);

  // Context data
  if (Object.keys(contextData).length > 0) {
    sections.push('## Available Context\n');
    for (const [source, data] of Object.entries(contextData)) {
      sections.push(`### ${source}\n${data}\n`);
    }
  }

  // Output format
  const channelFormat =
    skill.outputFormat.channelOverrides?.[channelName as keyof typeof skill.outputFormat.channelOverrides] ||
    skill.outputFormat.default;
  sections.push(
    `## Output Format\n` +
    `Format: ${channelFormat}\n` +
    `Max length: ${skill.outputFormat.maxLength || 'reasonable length'}`
  );

  // Quality criteria
  if (skill.qualityCriteria.length > 0) {
    sections.push(
      `## Quality Requirements\n` +
      skill.qualityCriteria.map((c) => `- ${c}`).join('\n')
    );
  }

  // User input
  if (userInput) {
    sections.push(`## User Input\n${userInput}`);
  }

  return sections.join('\n\n');
}
```

### Per-User Skill Registry

Each user has their own set of active skills. The registry is stored in PostgreSQL:

```sql
CREATE TABLE user_skills (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id),
  skill_id            VARCHAR(100) NOT NULL,
  org_id              UUID NOT NULL REFERENCES organizations(id),

  -- Skill metadata (denormalized for fast access)
  skill_name          VARCHAR(200) NOT NULL,
  skill_category      VARCHAR(50) NOT NULL,
  skill_version       VARCHAR(20) NOT NULL,

  -- Lifecycle
  status              VARCHAR(20) NOT NULL DEFAULT 'approved',
  assigned_by         VARCHAR(100), -- advisor ID or 'system' or 'user'
  activated_at        TIMESTAMPTZ,
  retired_at          TIMESTAMPTZ,
  retirement_reason   VARCHAR(200),

  -- Usage stats
  total_activations   INTEGER NOT NULL DEFAULT 0,
  completions         INTEGER NOT NULL DEFAULT 0,
  positive_feedback   INTEGER NOT NULL DEFAULT 0,
  negative_feedback   INTEGER NOT NULL DEFAULT 0,
  improvement_feedback INTEGER NOT NULL DEFAULT 0,
  last_activated_at   TIMESTAMPTZ,
  est_time_saved_min  INTEGER NOT NULL DEFAULT 0,

  -- Quality
  quality_score       DECIMAL(3,2) DEFAULT 0.00,

  -- Timestamps
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, skill_id)
);

CREATE INDEX idx_us_user ON user_skills(user_id, status);
CREATE INDEX idx_us_org ON user_skills(org_id, skill_category);
CREATE INDEX idx_us_skill ON user_skills(skill_id);

-- Skill definitions (the SKILL.md content, parsed)
CREATE TABLE skill_definitions (
  id                  VARCHAR(100) PRIMARY KEY, -- skill_id
  org_id              UUID REFERENCES organizations(id), -- NULL if platform-wide
  name                VARCHAR(200) NOT NULL,
  category            VARCHAR(50) NOT NULL,
  version             VARCHAR(20) NOT NULL,
  source              VARCHAR(50) NOT NULL DEFAULT 'pre_built',
  skill_md_content    TEXT NOT NULL, -- Raw SKILL.md content
  parsed_instructions TEXT NOT NULL, -- Extracted instructions section
  trigger_config      JSONB,
  context_required    JSONB,
  output_format       JSONB,
  quality_criteria    JSONB,
  feedback_loop       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Skill activation log (for analytics and pattern collection)
CREATE TABLE skill_activations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id),
  skill_id            VARCHAR(100) NOT NULL,
  org_id              UUID NOT NULL REFERENCES organizations(id),
  channel             VARCHAR(20) NOT NULL, -- 'slack', 'teams', 'email'
  trigger_type        VARCHAR(20) NOT NULL, -- 'slash_command', 'automatic', 'direct'
  completed           BOOLEAN NOT NULL DEFAULT true,
  feedback            VARCHAR(20), -- 'positive', 'negative', 'improvement', NULL
  feedback_text       TEXT, -- Optional free-text feedback
  duration_ms         INTEGER, -- How long the skill took to execute
  activated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sa_user ON skill_activations(user_id, activated_at);
CREATE INDEX idx_sa_org ON skill_activations(org_id, activated_at);
CREATE INDEX idx_sa_skill ON skill_activations(skill_id, activated_at);
```

### Skill Assignment Flow

In Phase 0, Play New advisors manually assign skills to users:

```
1. Advisor reviews user's role, team, and observed interaction patterns
2. Advisor selects skills from the pre-built library
3. System creates user_skills records with status='active'
4. User receives notification in their DM:

   "I've gained a new capability! 🆕

   **Pipeline Risk Scan** (/pipeline-risk)
   I can now scan your CRM pipeline and flag deals that might be
   at risk based on engagement patterns and stage stagnation.

   This was added based on your role in sales operations.
   Want to try it now? Just type /pipeline-risk"

5. User can:
   - Try the skill immediately
   - Activate/deactivate via /pn skills
   - Provide feedback after each use
```

```typescript
/**
 * Assign a skill to a user (advisor action).
 */
async function assignSkillToUser(
  userId: string,
  skillId: string,
  assignedBy: string, // advisor ID
  orgId: string
): Promise<void> {
  // Load skill definition
  const skillDef = await getSkillDefinition(skillId);
  if (!skillDef) {
    throw new Error(`Skill ${skillId} not found`);
  }

  // Check if user already has this skill
  const existing = await getUserSkill(userId, skillId);
  if (existing && existing.status === 'active') {
    throw new Error(`User ${userId} already has skill ${skillId}`);
  }

  // Create or reactivate
  await upsertUserSkill({
    userId,
    skillId,
    orgId,
    skillName: skillDef.name,
    skillCategory: skillDef.category,
    skillVersion: skillDef.version,
    status: 'active',
    assignedBy,
    activatedAt: new Date(),
  });

  // Send notification to user
  await sendSkillNotification(userId, skillDef);
}

/**
 * User activates/deactivates a skill.
 */
async function toggleSkill(
  userId: string,
  skillId: string,
  active: boolean
): Promise<void> {
  const skill = await getUserSkill(userId, skillId);
  if (!skill) {
    throw new Error(`Skill ${skillId} not found for user ${userId}`);
  }

  if (active) {
    await updateUserSkillStatus(userId, skillId, 'active');
  } else {
    await updateUserSkillStatus(userId, skillId, 'retired', 'user_deactivated');
  }
}
```

### Skill Quality Scoring (Phase 1+)

Each skill is scored on four dimensions, weighted as specified in the PRD:

| Dimension | Weight | Formula | Measurement |
|-----------|--------|---------|-------------|
| **Activation rate** | 25% | `activations_last_30d / available_days` | How often the skill is used relative to availability |
| **Completion rate** | 25% | `completions / total_activations` | How often users let the skill finish vs. canceling |
| **Feedback score** | 30% | `(positive - negative) / total_feedback` (normalized 0-1) | User ratings after each use |
| **Output accuracy** | 20% | Spot-checked by advisors (0-1 scale) | Does the output match reality? |

```typescript
function calculateQualityScore(skill: UserSkill): number {
  const stats = skill.usage;

  // Activation rate (0-1)
  const daysAvailable = Math.max(
    1,
    daysSince(skill.createdAt)
  );
  const activationRate = Math.min(1, stats.totalActivations / daysAvailable);

  // Completion rate (0-1)
  const completionRate =
    stats.totalActivations > 0
      ? stats.completions / stats.totalActivations
      : 0;

  // Feedback score (0-1)
  const totalFeedback =
    stats.positiveFeedback + stats.negativeFeedback + stats.improvementFeedback;
  const feedbackScore =
    totalFeedback > 0
      ? (stats.positiveFeedback - stats.negativeFeedback * 0.5) / totalFeedback
      : 0.5; // Neutral default
  const normalizedFeedback = Math.max(0, Math.min(1, (feedbackScore + 1) / 2));

  // Output accuracy (advisor-assessed, default 0.5)
  const outputAccuracy = skill.qualityScore > 0 ? skill.qualityScore : 0.5;

  // Weighted composite
  const score =
    activationRate * 0.25 +
    completionRate * 0.25 +
    normalizedFeedback * 0.30 +
    outputAccuracy * 0.20;

  return Math.round(score * 100) / 100;
}
```

**Quality thresholds:**

| Score Range | Action |
|------------|--------|
| 0.8 - 1.0 | Excellent. Candidate for skill marketplace sharing. |
| 0.6 - 0.8 | Good. Normal operation. |
| 0.5 - 0.6 | Needs attention. Flag for advisor review. |
| < 0.5 (after 10+ activations) | Flagged for retirement or redesign. |

### Skill Discovery and User Interface

Users interact with their skills through channel-native commands:

```
/pn skills
→ Lists all active skills with usage stats

  Your Active Skills:

  1. Pipeline Risk Scan (/pipeline-risk) — Sales
     Used 12 times | Last: 2 days ago | Score: 0.87

  2. Email Summarizer (/email-summary) — Communication
     Used 45 times | Last: today | Score: 0.92

  3. Weekly Digest (/weekly-prep) — Communication
     Used 8 times | Last: 5 days ago | Score: 0.78

  4. Meeting Prep (/meeting-prep) — Communication
     Used 6 times | Last: 1 day ago | Score: 0.81

  Type the command to use a skill, or reply with a number
  to see details.

/pn skills available
→ Lists skills available but not yet activated

/pn skills deactivate <skill-name>
→ Deactivates a skill

/pn skills feedback <skill-name>
→ Provide detailed feedback on a skill
```

### Relationship to Nanoclaw's skills-engine/

| Aspect | Nanoclaw Platform Skills | Play New User Skills |
|--------|------------------------|---------------------|
| **Purpose** | Modify codebase | Teach assistant tasks |
| **Executor** | Claude Code (agent) | LLM (Claude API) |
| **Output** | Code changes, file modifications | Text, formatted messages |
| **Format** | SKILL.md + manifest.yaml + code templates | SKILL.md (instructions only) |
| **Lifecycle** | Created -> Applied -> Reverted | Observed -> Proposed -> Active -> Retired |
| **Storage** | Git repository (`.claude/skills/`) | PostgreSQL + file storage |
| **Versioning** | Git commits | Semantic versioning in DB |
| **Users** | Developers | Knowledge workers |
| **Trigger** | Developer invocation | Slash command, schedule, pattern |

**Shared patterns we reuse:**
- SKILL.md format parsing (same parser, extended schema)
- State machine for lifecycle tracking
- Version numbering convention
- Skill metadata structure

---

## Phase 0 Scope

### In Scope

- Pre-built skill library (10-15 skills initially, expanding to 35)
- SKILL.md format for all skill definitions
- Skill registry per user (PostgreSQL `user_skills` table)
- Advisor-driven skill assignment
- User skill activation/deactivation
- Slash command invocation
- Skill execution: context gathering -> prompt construction -> LLM call -> formatted output
- Feedback collection (yes / no / needs improvement)
- Basic usage analytics per user (activation count, last used)
- Skill notification on assignment

### Out of Scope (Phase 1+)

| Feature | Phase | Rationale |
|---------|-------|-----------|
| Automatic skill generation from patterns | Phase 1 | Requires observation engine (full access mode) |
| Automatic triggers (scheduled, event-based) | Phase 1 | Phase 0: manual invocation only |
| Quality scoring algorithm | Phase 1 | Need sufficient activation data first |
| Skill marketplace (cross-org sharing) | Phase 2 | Need 10+ orgs |
| User-created skills | Phase 2 | Need to validate pre-built skills first |
| Skill A/B testing | Phase 2 | Need automated generation first |
| Skill dependency chains (skill A requires skill B) | Phase 2 | Keep Phase 0 skills independent |

---

## Open Questions

1. **Skill versioning strategy:** When an advisor updates a skill's instructions, do all users get the update automatically, or do they need to accept it? **Recommendation:** Automatic updates for minor changes (formatting, clarification). Explicit notification for major changes (new instructions, changed output format). Use semver: patch = auto, minor = notify, major = re-approval.

2. **Skill execution timeout:** How long should a skill be allowed to run before timing out? **Recommendation:** 60 seconds for Phase 0 (includes context gathering + LLM call). Skills that require large context (board-prep-synthesizer) may need 120 seconds. Configurable per skill.

3. **Concurrent skill execution:** Can a user run two skills simultaneously? **Recommendation:** Yes, but queue within the same channel (one response at a time in DM). Skills invoked from different channels can run in parallel.

4. **Skill context caching:** Should we cache MCP connector data across skill invocations? **Recommendation:** Yes, with a 5-minute TTL. CRM data doesn't change between two back-to-back skill runs. This reduces API calls and latency.

5. **Skill output storage:** Should skill outputs be stored for later reference? **Recommendation:** Yes, store in the user's personal memory (vector store). This enables "show me last week's pipeline risk scan" queries. The skill output becomes part of the assistant's memory.

6. **Feedback fatigue:** Asking for feedback after every skill invocation may annoy users. **Recommendation:** Ask for feedback on the first 3 uses of each skill, then once per week per skill. Always accept unsolicited feedback via `/pn feedback`.
