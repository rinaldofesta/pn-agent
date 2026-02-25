# Writing Skills

**Version:** 0.1.0
**Last Updated:** 2026-02-25
**Status:** Draft -- Pre-Phase 0 Architecture
**Owner:** Technical Architecture

---

## Context

Skills are the unit of capability in Play New. Each skill is a SKILL.md file -- a structured markdown document that tells the assistant how to perform a specific task for the user. Good skills are the difference between "this assistant is helpful" and "I can't work without this assistant."

This guide covers how to author SKILL.md files for the pre-built skill library. For the full format specification, see [skill-md-format.md](../specs/skills/skill-md-format.md). For the complete Phase 0 skill catalog, see [skill-library-spec.md](../specs/skills/skill-library-spec.md).

**Who writes skills:**
- Play New engineers (Phase 0: building the initial library)
- Play New advisors (Phase 0+: customizing skills for specific orgs)
- The skill engine (Phase 1+: auto-generating skills from observed patterns)

---

## Skill Structure Reference

Every SKILL.md file has this structure:

```markdown
# SKILL: {Skill Name}

## Metadata
- ID: skill_{snake_case_name}_{number}
- Version: {MAJOR.MINOR}
- Category: {Communication|Analysis|Sales|Operations|Strategy|Management|Creative}
- Generated: {YYYY-MM-DD}
- Source: {Pre-built|Advisor-created|Auto-generated from user pattern observation}
- Status: {Observed|Proposed|Approved|Active|Refined|Retired}

## Trigger
{How the skill is invoked}

## Context Required
{What data the skill needs}

## Instructions
{Step-by-step instructions for the LLM}

## Output Format
{How to format the response}

## Quality Criteria          (recommended)
{Self-assessment criteria}

## Feedback Loop             (recommended)
{How to collect user feedback}
```

---

## Step-by-Step Authoring Process

### Step 1: Identify the User Job-to-Be-Done

Start with the user's need, not the technology. Answer these questions:

1. **Who is the user?** Which persona (knowledge worker, manager, sales rep, leadership) will use this skill?
2. **What task are they trying to accomplish?** Be specific. "Analyze emails" is too broad. "Summarize a forwarded email and extract action items" is a job.
3. **What do they do today?** How do they accomplish this without the assistant? Understanding the current workflow reveals what the skill must improve.
4. **What does success look like?** When the skill output is on screen, what makes the user say "yes, this is exactly what I needed"?
5. **How often does this happen?** Daily tasks build habits. Weekly tasks drive engagement. Monthly tasks must deliver high value to justify learning.

**Example thought process for "Pipeline Risk Scan":**
- Who: Sales reps and managers
- Task: Identify at-risk deals in their CRM pipeline before they slip
- Today: Manually review each deal in CRM, check last activity dates, look for stalled deals. Takes 30-60 minutes per week.
- Success: A concise list of at-risk deals with specific evidence and recommended actions. The rep says "this caught a deal I missed."
- Frequency: Weekly (Monday morning ritual)

### Step 2: Define the Trigger

How will the user invoke this skill? There are three trigger types:

**Slash command (explicit invocation):**
```markdown
## Trigger
User invokes `/pipeline-risk` in their Slack or Teams DM.
```

**Automatic (system-initiated):**
```markdown
## Trigger
System detects it is Monday morning (user's timezone) and user has
CRM access configured.
```

**Content-triggered (user shares something):**
```markdown
## Trigger
User forwards an email to their assistant email address, OR user
pastes email content in chat, OR user invokes `/email-summary`.
```

**Best practices for triggers:**
- Always include at least one explicit trigger (slash command or keyword). Users should always be able to invoke a skill on demand.
- Automatic triggers should be conservative. Maximum one proactive message per day (PRD Section 16.1).
- Slash commands should be short, memorable, and consistent: `/pipeline-risk`, `/meeting-prep`, `/email-summary`.

### Step 3: Identify Required Context

List every data source the skill needs to produce a good output. Classify each as required or optional:

```markdown
## Context Required
- CRM pipeline data (deals, stages, values, last activity dates) -- REQUIRED
- Historical win/loss patterns for this organization -- optional, enhances accuracy
- User's specific accounts and territory -- REQUIRED
- Organizational strategic context (current quarter priorities) -- optional, enhances relevance
```

**Context sources available in Phase 0:**

| Source | How Accessed | Notes |
|--------|-------------|-------|
| User's message content | Directly in the prompt | The user forwards/shares content |
| Conversation history | From personal memory (chat history) | Loaded by the skill engine |
| Organizational strategic context | From org context engine (RAG) | Available to all instances |
| Team structure | From `teams` + `user_instances` tables | Who works on what |
| CRM data | Via MCP connector (Salesforce/HubSpot) | If connected for this org |
| Calendar data | Via MCP connector (Google/Outlook) | If connected for this user |
| Personal memory | From vector DB (user-scoped) | Accumulated from past interactions |
| Skill output history | From previous skill runs stored in personal memory | For comparison/trends |

**Best practices:**
- Design skills to degrade gracefully when optional context is unavailable. Include fallback instructions: "If CRM data is not available, ask the user to paste their pipeline data."
- Never assume a connector is available. Phase 0 orgs may have 0-2 connectors.
- Reference the context source specifically. "CRM pipeline data" is better than "external data."

### Step 4: Write Clear, Testable Instructions

The `## Instructions` section is the core of the skill. It is the "program" the LLM executes. Write it as a numbered list of specific, actionable steps.

**Rules for good instructions:**

1. **Start each step with a verb.** "Pull all open deals from CRM" not "The deals should be pulled from CRM."
2. **Be specific about inputs and outputs.** "For each deal, assess risk on three dimensions: engagement decay, stage stagnation, competitive signals" is better than "assess the risk of each deal."
3. **Define the reasoning framework.** Don't just say "analyze." Say "rank by composite risk score (weighted: engagement 40%, stagnation 35%, competitive 25%)."
4. **Reference context sources.** "Pull all open deals from CRM" explicitly connects to the `## Context Required` section.
5. **Include conditional logic.** "If organizational strategic context is available, flag deals that align with current quarter priorities."
6. **Minimum 3 steps, maximum 10.** Fewer than 3 means the skill is too simple to be a skill (it is just a prompt). More than 10 means the skill should be split.
7. **Never hardcode PII.** No email addresses, company names, or specific product names in instructions. Use placeholders like "the user's accounts."

**Example -- good instructions:**

```markdown
## Instructions
1. Pull all open deals from CRM where user is owner or team member.
2. For each deal, assess risk on three dimensions:
   - Engagement decay: days since last meaningful client interaction
   - Stage stagnation: days in current stage vs. historical average
   - Competitive signals: any mentions of competitors in recent communications
3. Rank deals by composite risk score (weighted: engagement 40%,
   stagnation 35%, competitive 25%).
4. For top 5 at-risk deals, generate specific recommended actions
   based on deal context.
5. Format as concise brief with deal name, risk level, key concern,
   recommended action.
6. If organizational strategic context is available, flag deals that
   align with current quarter priorities.
7. Compare current risk assessment to previous week's scan (if available
   in personal memory) and highlight changes.
```

**Example -- poor instructions (avoid this):**

```markdown
## Instructions
1. Look at the user's deals.
2. Find the risky ones.
3. Tell the user about them.
```

This is too vague. The LLM will produce inconsistent, low-quality output.

### Step 5: Define Output Format per Channel

Specify exactly how the response should look. Include length constraints, structure, and channel-specific overrides:

```markdown
## Output Format
Concise Slack message. No more than 15 lines. Start with summary line:
"X deals flagged this week. Top concern: [deal name]."

For each flagged deal, use this structure:
- **Deal Name** | Risk: HIGH/MEDIUM/LOW
- Key concern: [specific evidence]
- Recommended action: [specific, actionable step]

End with: "Type /pipeline-risk details for full analysis."

Channel overrides:
- Teams: Same structure, plain text (no markdown bold)
- Email: Include full analysis with deal details table
```

**Best practices:**
- Always specify a maximum length. Without constraints, LLMs produce verbose output.
- Use a consistent structure. Users should recognize the skill's output format instantly.
- Include a "what's next" action: a follow-up command, a question, or a call-to-action.
- Channel overrides are optional but recommended for skills that produce structured output.

### Step 6: Add Quality Criteria

Quality criteria tell the LLM how to self-assess before delivering the output. These are the rules the LLM checks its own work against:

```markdown
## Quality Criteria
- Each flagged deal must cite specific evidence (dates, data points)
- Recommended actions must be specific to the deal, not generic advice
- Compare to previous week's scan to highlight changes
- Never fabricate deal data -- if CRM data is incomplete, state what's missing
- Risk assessment must be defensible -- show the reasoning
```

**What to include:**
- **Factual accuracy rules:** "Never fabricate data." "Cite evidence for every claim."
- **Specificity rules:** "Actions must be specific, not generic."
- **Honesty rules:** "State what information is missing rather than guessing."
- **Relevance rules:** "Connect findings to the user's context."

### Step 7: Design the Feedback Loop

Every skill should collect user feedback to drive improvement:

```markdown
## Feedback Loop
After each use, ask: "Was this scan useful? Any deals I missed or
flagged incorrectly?" Incorporate feedback into next run by adjusting
risk thresholds if the user consistently disagrees with risk levels.
```

**Feedback mechanisms:**
- **Quick rating:** "Was this useful? (yes / no / needs work)" -- low friction, high response rate.
- **Specific follow-up:** "Any deals I missed or flagged incorrectly?" -- higher quality signal.
- **Implicit feedback:** If the user immediately invokes the skill again with different parameters, the first output likely missed the mark.

The feedback is logged in the `pattern_logs` table as `skill_feedback` and aggregated in `v_skill_usage` for advisor analysis.

---

## Common Skill Patterns

### Pattern 1: Analysis Skills

**Shape:** Input content -> Analyze against framework -> Structured output

These skills take content the user shares (email, report, data) and produce analytical output.

**Examples:** email-summarizer, report-analyzer, competitive-scan, gap-analyzer

**Template:**

```markdown
## Instructions
1. Read the input content provided by the user.
2. Identify the content type and structure.
3. Apply [analysis framework]:
   - [Dimension 1]: [what to look for]
   - [Dimension 2]: [what to look for]
   - [Dimension 3]: [what to look for]
4. Synthesize findings into structured output.
5. Connect findings to organizational context (if available).
6. Highlight items requiring user attention or action.
```

### Pattern 2: Action Skills

**Shape:** Context + data -> Recommend specific actions -> Prioritized list

These skills analyze a situation and recommend concrete next steps.

**Examples:** pipeline-risk-scan, deal-strategy-advisor, delegation-optimizer

**Template:**

```markdown
## Instructions
1. Gather relevant data from [context sources].
2. Assess current state against [criteria / benchmarks / historical patterns].
3. Identify [gaps / risks / opportunities].
4. For each finding, generate a specific recommended action:
   - What to do (concrete, not vague)
   - Why (evidence from the data)
   - When (urgency / priority)
5. Rank recommendations by [impact / urgency / feasibility].
6. Present top [N] recommendations with supporting evidence.
```

### Pattern 3: Monitoring Skills

**Shape:** Scheduled check -> Compare to baseline -> Alert on changes

These skills run periodically and alert the user to significant changes.

**Examples:** strategic-signal-daily, competitive-position-tracker, client-health-check

**Template:**

```markdown
## Trigger
System detects it is [time/day] and user has [required context] configured.

## Instructions
1. Retrieve current state from [data sources].
2. Compare to previous [period] baseline (from personal memory).
3. Identify significant changes:
   - [Change type 1]: threshold = [X]
   - [Change type 2]: threshold = [Y]
4. If no significant changes, send brief confirmation: "[Domain] stable. No new signals."
5. If changes detected, produce alert with:
   - What changed
   - Why it matters (connect to user's context)
   - Recommended response
6. Update baseline in personal memory for next comparison.
```

### Pattern 4: Synthesis Skills

**Shape:** Multiple sources over time -> Combine and distill -> Summary document

These skills pull from accumulated context to produce comprehensive summaries.

**Examples:** weekly-digest, board-prep-synthesizer, stakeholder-brief

**Template:**

```markdown
## Instructions
1. Retrieve all relevant content from [time period] from personal memory.
2. Categorize content by [theme / source / priority].
3. For each category, synthesize key points:
   - What happened
   - What it means (interpretation)
   - What to do next (recommendations)
4. Identify cross-category patterns or connections.
5. Produce structured summary with [sections].
6. Highlight items that require the user's attention or decision.
```

---

## Testing Skills

### Manual Testing Flow

Before deploying a skill, test it through the following scenarios:

1. **Happy path:** Provide all required context. Does the skill produce good output?
2. **Missing optional context:** Remove optional context sources. Does the skill degrade gracefully?
3. **Missing required context:** Remove required context. Does the skill ask the user for input instead of failing silently?
4. **Edge case -- no data:** What happens when the CRM has no deals, or the inbox is empty?
5. **Edge case -- too much data:** What happens when there are 100 deals or a 5-page email? Does the output stay within length limits?
6. **Repeated invocation:** Run the skill twice in a row. Does the second run reference the first (comparison, trends)?
7. **Feedback loop:** Provide negative feedback. Does the next invocation acknowledge the feedback?

### Quality Checklist

Before marking a skill as `Active`:

- [ ] All required sections present (`Metadata`, `Trigger`, `Context Required`, `Instructions`, `Output Format`)
- [ ] Metadata fields pass validation (ID format, category, source, status)
- [ ] Instructions have at least 3 numbered steps
- [ ] Each instruction step starts with a verb
- [ ] No hardcoded PII in any section
- [ ] Output format specifies length constraints
- [ ] Quality criteria defined (at least 2 criteria)
- [ ] Feedback loop defined
- [ ] Tested on happy path with realistic data
- [ ] Tested with missing optional context
- [ ] Tested with missing required context
- [ ] Output stays within channel message limits
- [ ] Slash command is short, memorable, and unique
- [ ] Skill file passes `validateSkillMd()` with no errors and no warnings

### Running the Validator

Use the built-in skill validator to check a SKILL.md file:

```bash
npx ts-node scripts/validate-skill.ts skills/sales/pipeline-risk-scan/SKILL.md
```

Expected output for a valid skill:

```
Validating: skills/sales/pipeline-risk-scan/SKILL.md
  Skill: Pipeline Risk Scan
  ID: skill_pipeline_risk_001
  Category: Sales
  Status: Active
  Sections: 7/7 (all required + 2 optional)
  Instructions: 7 steps
  Result: VALID (0 errors, 0 warnings)
```

---

## Skill Examples by Category

### Communication: Email Summarizer

The simplest and most frequently used skill. Good model for any analysis skill that processes user-shared content.

**Key design choices:**
- No MCP connectors required (works with forwarded content only)
- Structured output with clear sections (Summary, Key Points, Action Items, Risks)
- Short -- max 200 words
- Universal -- works for any role

See: `skills/communication/email-summarizer/SKILL.md`

### Sales: Pipeline Risk Scan

The flagship data-connected skill. Good model for any skill that pulls from external data sources.

**Key design choices:**
- Requires CRM connector (degrades gracefully without it)
- Multi-dimensional analysis framework (engagement, stagnation, competitive)
- Weighted scoring system
- Comparison to previous run (builds over time)
- Channel-specific output overrides

See: `skills/sales/pipeline-risk-scan/SKILL.md`

### Strategy: Board Prep Synthesizer

The most complex skill in the library. Good model for multi-source synthesis skills.

**Key design choices:**
- Pulls from multiple context sources (strategic context, CRM, financials, personal memory)
- Longer output (1-2 pages) with clear section structure
- Board-appropriate language and framing
- Explicitly states data gaps rather than guessing
- Channel override: full HTML for email, structured message for Slack/Teams

See: `skills/strategy/board-prep-synthesizer/SKILL.md`

---

## Common Mistakes

**1. Instructions too vague.**
Bad: "Analyze the email." Good: "Read the forwarded email. Identify the sender's intent. Extract action items. Flag risks. Connect to organizational context."

**2. No length constraint.**
Bad: Output with no limit produces 500-word responses in Slack. Good: "Max 200 words" or "No more than 15 lines."

**3. No fallback for missing context.**
Bad: Skill fails silently when CRM is not connected. Good: "If CRM data is not available, ask the user to paste their pipeline data manually."

**4. Generic quality criteria.**
Bad: "Output should be good." Good: "Each flagged deal must cite specific evidence (dates, data points). Actions must be specific to the deal, not generic advice."

**5. Hardcoded specifics.**
Bad: "Check the Salesforce CRM for Acme Corp deals." Good: "Pull all open deals from CRM where user is owner or team member."

**6. No feedback mechanism.**
Bad: Skill delivers output with no way for user to react. Good: "Was this useful? Any deals I missed or flagged incorrectly?"

**7. Too many steps.**
Bad: 15-step instruction set that tries to do everything. Good: Split into 2 skills: a quick scan skill and a deep-dive detail skill.
