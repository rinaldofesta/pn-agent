# SKILL.md Format Reference

**Status:** Draft
**Version:** 0.1
**Last Updated:** 2026-02-25
**Owner:** Technical Architecture

---

## Context

SKILL.md is the file format for defining user-facing skills in Play New. Each skill is a structured markdown document that contains all the information the assistant needs to execute a specific task: what triggers it, what context it needs, step-by-step instructions for the LLM, and how to format the output.

The format is designed to be:
- **Human-readable:** Advisors and skill authors can read and write SKILL.md files without developer tools
- **Machine-parseable:** The skill engine extracts structured data from the markdown headings and fields
- **Self-contained:** Each SKILL.md file contains everything needed to execute the skill
- **Versionable:** Standard text files tracked in git

---

## Nanoclaw Foundation

Nanoclaw uses a SKILL.md format for platform-level (code modification) skills. The Play New format shares the same convention (markdown with structured sections) but differs in purpose:

| Aspect | Nanoclaw SKILL.md | Play New SKILL.md |
|--------|------------------|-------------------|
| **Purpose** | Describe code modifications to apply to the codebase | Describe instructions for the LLM to follow when executing a task |
| **Executor** | Claude Code agent (applies code changes) | Claude API (generates text response for the user) |
| **Output** | Modified source files, git commits | Formatted messages, analysis, recommendations |
| **Sections** | Description, files to modify, code patterns | Trigger, context required, instructions, output format |
| **Companion files** | `manifest.yaml`, code templates, test fixtures | None (self-contained) |
| **Lifecycle** | Applied once per codebase version | Executed repeatedly for users |

The Play New format reuses the `# SKILL: {name}` heading convention and the `## Metadata` section structure from nanoclaw. All other sections are Play New-specific.

---

## Play New Requirements

From the PRD:

- **Section 12.1 (What Is a Skill?):** Full SKILL.md anatomy with metadata, trigger, context required, instructions, output format, quality criteria, feedback loop
- **Section 12.1:** Example skill: Pipeline Risk Scan with all sections filled out
- **FR-003.1:** Skills are structured markdown instruction files (SKILL.md format) that define capabilities

---

## Technical Specification

### Format Overview

```markdown
# SKILL: {Skill Name}

## Metadata
- ID: {unique_identifier}
- Version: {semver}
- Category: {category}
- Generated: {date}
- Source: {source_type}
- Status: {lifecycle_status}
- Quality Score: {0.00-1.00}
- Usage: {activation_count} activations, {positive_pct}% positive feedback

## Trigger
{trigger_description}

## Context Required
{list_of_required_and_optional_context_sources}

## Instructions
{step_by_step_instructions_for_the_llm}

## Output Format
{output_formatting_instructions}

## Quality Criteria
{quality_requirements_for_self_assessment}

## Feedback Loop
{feedback_collection_instructions}
```

### Required Fields

Every SKILL.md file MUST contain the following sections:

#### `# SKILL: {Skill Name}`

The top-level heading. Must follow the exact format `# SKILL: ` followed by the skill name.

**Validation rules:**
- Must be the first non-empty line in the file
- Must start with `# SKILL: `
- Name must be 3-100 characters
- Name should be human-readable (title case, spaces allowed)

#### `## Metadata`

Structured key-value pairs describing the skill. Each field is a markdown list item in the format `- Key: Value`.

| Field | Required | Format | Description |
|-------|----------|--------|-------------|
| `ID` | Yes | `skill_{snake_case_name}_{number}` | Unique identifier. Immutable after creation. |
| `Version` | Yes | Semver (`MAJOR.MINOR`) | Skill version. Incremented on updates. |
| `Category` | Yes | One of: `Communication`, `Analysis`, `Sales`, `Operations`, `Strategy`, `Management`, `Creative` | Skill category for organization and filtering. |
| `Generated` | Yes | ISO date (`YYYY-MM-DD`) | Date the skill was created or last major revision. |
| `Source` | Yes | One of: `Pre-built`, `Advisor-created`, `Auto-generated from user pattern observation`, `User-created`, `Marketplace` | How this skill was created. |
| `Status` | Yes | One of: `Observed`, `Proposed`, `Approved`, `Active`, `Refined`, `Retired` | Current lifecycle status. |
| `Quality Score` | No | Decimal 0.00-1.00 | Computed quality score. Omit for new skills. |
| `Usage` | No | `{count} activations, {pct}% positive feedback` | Usage statistics. Omit for new skills. |

**Validation rules:**
- `ID` must match the pattern `/^skill_[a-z0-9_]+_\d{3}$/`
- `Version` must match `/^\d+\.\d+$/`
- `Category` must be one of the allowed values (case-insensitive)
- `Generated` must be a valid ISO date
- `Source` must be one of the allowed values
- `Status` must be one of the allowed values

#### `## Trigger`

Describes how the skill is invoked. Free text that may include slash commands and automatic conditions.

**Validation rules:**
- Must not be empty
- Should mention at least one invocation method (slash command, automatic condition, or "user request")

#### `## Context Required`

Lists the data sources and context the skill needs to execute. Each item is a markdown list item describing a context source.

**Validation rules:**
- Must not be empty
- Each list item should describe a specific context source
- Should indicate which sources are required vs. optional (using parenthetical annotations or bold/italic)

#### `## Instructions`

Step-by-step instructions for the LLM to follow when executing this skill. This is the core of the skill -- the "program" that the LLM executes.

**Validation rules:**
- Must not be empty
- Must contain at least 3 steps (numbered list items)
- Each step should be actionable (starts with a verb)
- Should reference context sources mentioned in `## Context Required`
- Must not contain hardcoded PII or organization-specific data

#### `## Output Format`

Describes how the LLM should format its response. May include channel-specific instructions.

**Validation rules:**
- Must not be empty
- Should specify length constraints (e.g., "no more than 15 lines")
- Should mention the primary output channel (Slack, Teams, email) or state "all channels"

### Optional Fields

These sections enhance the skill but are not required for basic operation:

#### `## Quality Criteria`

Specific criteria the LLM should use to self-assess its output quality before delivering to the user.

**When to include:** Always recommended for skills that produce analytical output. Can be omitted for simple utility skills (e.g., action-item-extractor).

#### `## Feedback Loop`

Instructions for collecting user feedback after skill execution.

**When to include:** Always recommended. Can be omitted if the skill is a one-shot utility with obvious success/failure.

#### `## Dependencies`

Other skills or system capabilities this skill depends on.

**When to include:** Only when the skill requires another skill to have been run first, or when it needs a specific system feature.

#### `## MCP Connectors Required`

Explicit list of MCP connectors needed, with the data each connector provides.

**When to include:** When the skill requires data from external systems (CRM, calendar, project management). This is a more structured alternative to listing connectors in `## Context Required`.

### Parsing Specification

The skill engine parses SKILL.md files into structured data using the following algorithm:

```typescript
interface ParsedSkill {
  name: string;
  metadata: {
    id: string;
    version: string;
    category: string;
    generated: string;
    source: string;
    status: string;
    qualityScore?: number;
    usage?: { activations: number; positivePct: number };
  };
  trigger: string;
  contextRequired: string;
  instructions: string;
  outputFormat: string;
  qualityCriteria?: string;
  feedbackLoop?: string;
  dependencies?: string;
  mcpConnectors?: string;
}

function parseSkillMd(content: string): ParsedSkill {
  const lines = content.split('\n');

  // Extract skill name from first heading
  const nameLine = lines.find((l) => l.startsWith('# SKILL:'));
  if (!nameLine) {
    throw new Error('Missing required heading: # SKILL: {name}');
  }
  const name = nameLine.replace('# SKILL:', '').trim();

  // Extract sections by ## headings
  const sections = new Map<string, string>();
  let currentSection = '';
  let currentContent: string[] = [];

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (currentSection) {
        sections.set(currentSection, currentContent.join('\n').trim());
      }
      currentSection = line.replace('## ', '').trim();
      currentContent = [];
    } else if (currentSection) {
      currentContent.push(line);
    }
  }
  // Don't forget the last section
  if (currentSection) {
    sections.set(currentSection, currentContent.join('\n').trim());
  }

  // Validate required sections
  const required = ['Metadata', 'Trigger', 'Context Required', 'Instructions', 'Output Format'];
  for (const section of required) {
    if (!sections.has(section)) {
      throw new Error(`Missing required section: ## ${section}`);
    }
  }

  // Parse metadata
  const metadata = parseMetadata(sections.get('Metadata')!);

  return {
    name,
    metadata,
    trigger: sections.get('Trigger')!,
    contextRequired: sections.get('Context Required')!,
    instructions: sections.get('Instructions')!,
    outputFormat: sections.get('Output Format')!,
    qualityCriteria: sections.get('Quality Criteria'),
    feedbackLoop: sections.get('Feedback Loop'),
    dependencies: sections.get('Dependencies'),
    mcpConnectors: sections.get('MCP Connectors Required'),
  };
}

function parseMetadata(content: string): ParsedSkill['metadata'] {
  const fields = new Map<string, string>();

  for (const line of content.split('\n')) {
    const match = line.match(/^-\s*(.+?):\s*(.+)$/);
    if (match) {
      fields.set(match[1].trim(), match[2].trim());
    }
  }

  // Validate required metadata fields
  const requiredFields = ['ID', 'Version', 'Category', 'Generated', 'Source', 'Status'];
  for (const field of requiredFields) {
    if (!fields.has(field)) {
      throw new Error(`Missing required metadata field: ${field}`);
    }
  }

  // Parse usage stats if present
  let usage: { activations: number; positivePct: number } | undefined;
  const usageStr = fields.get('Usage');
  if (usageStr) {
    const usageMatch = usageStr.match(/(\d+)\s*activations.*?(\d+)%/);
    if (usageMatch) {
      usage = {
        activations: parseInt(usageMatch[1], 10),
        positivePct: parseInt(usageMatch[2], 10),
      };
    }
  }

  return {
    id: fields.get('ID')!,
    version: fields.get('Version')!,
    category: fields.get('Category')!,
    generated: fields.get('Generated')!,
    source: fields.get('Source')!,
    status: fields.get('Status')!,
    qualityScore: fields.has('Quality Score')
      ? parseFloat(fields.get('Quality Score')!)
      : undefined,
    usage,
  };
}
```

### Validation Rules Summary

| Section | Rule | Error Level |
|---------|------|-------------|
| `# SKILL:` | Must be first heading, 3-100 chars | Error (fatal) |
| `## Metadata > ID` | Match `/^skill_[a-z0-9_]+_\d{3}$/` | Error (fatal) |
| `## Metadata > Version` | Match `/^\d+\.\d+$/` | Error (fatal) |
| `## Metadata > Category` | Must be in allowed list | Error (fatal) |
| `## Metadata > Generated` | Valid ISO date | Warning |
| `## Metadata > Source` | Must be in allowed list | Error (fatal) |
| `## Metadata > Status` | Must be in allowed list | Error (fatal) |
| `## Trigger` | Not empty | Error (fatal) |
| `## Context Required` | Not empty | Error (fatal) |
| `## Instructions` | Not empty, >= 3 numbered steps | Error (fatal) |
| `## Instructions` | Each step starts with a verb | Warning |
| `## Instructions` | No hardcoded PII | Error (fatal) |
| `## Output Format` | Not empty | Error (fatal) |
| `## Output Format` | Mentions length constraint | Warning |
| `## Quality Criteria` | If present, >= 2 criteria | Warning |
| `## Feedback Loop` | If present, not empty | Warning |

---

## Examples

### Complete Example: Pipeline Risk Scan

This is the flagship sales skill, as specified in PRD Section 12.1:

```markdown
# SKILL: Pipeline Risk Scan

## Metadata
- ID: skill_pipeline_risk_001
- Version: 1.3
- Category: Sales
- Generated: 2026-05-12
- Source: Pre-built
- Status: Active
- Quality Score: 0.87
- Usage: 47 activations, 89% positive feedback

## Trigger
User invokes `/pipeline-risk` OR system detects it is Monday morning
and user has CRM access.

## Context Required
- CRM pipeline data (deals, stages, values, last activity dates) — REQUIRED
- Historical win/loss patterns for this organization — optional, enhances accuracy
- User's specific accounts and territory — REQUIRED
- Organizational strategic context (current quarter priorities) — optional, enhances relevance

## Instructions
1. Pull all open deals from CRM where user is owner or team member.
2. For each deal, assess risk on three dimensions:
   - Engagement decay: days since last meaningful client interaction
   - Stage stagnation: days in current stage vs. historical average
   - Competitive signals: any mentions of competitors in recent communications
3. Rank deals by composite risk score (weighted: engagement 40%, stagnation 35%, competitive 25%).
4. For top 5 at-risk deals, generate specific recommended actions based on deal context.
5. Format as concise brief with deal name, risk level, key concern, recommended action.
6. If organizational strategic context is available, flag deals that align with current quarter priorities.
7. Compare current risk assessment to previous week's scan (if available in personal memory) and highlight changes.

## Output Format
Concise Slack message. No more than 15 lines. Start with summary line:
"X deals flagged this week. Top concern: [deal name]."

For each flagged deal, use this structure:
- **Deal Name** | Risk: HIGH/MEDIUM/LOW
- Key concern: [specific evidence]
- Recommended action: [specific, actionable step]

End with: "Type /pipeline-risk details for full analysis."

Channel overrides:
- Teams: Same structure, plain text
- Email: Include full analysis with deal details table

## Quality Criteria
- Each flagged deal must cite specific evidence (dates, data points)
- Recommended actions must be specific to the deal, not generic advice
- Compare to previous week's scan to highlight changes
- Never fabricate deal data — if CRM data is incomplete, state what's missing
- Risk assessment must be defensible — show the reasoning

## Feedback Loop
After each use, ask: "Was this scan useful? Any deals I missed or
flagged incorrectly?" Incorporate feedback into next run by adjusting
risk thresholds if the user consistently disagrees with risk levels.
```

### Minimal Example: Email Summarizer

A simple skill that requires no external connectors:

```markdown
# SKILL: Email Summarizer

## Metadata
- ID: skill_email_summarizer_001
- Version: 1.0
- Category: Communication
- Generated: 2026-03-01
- Source: Pre-built
- Status: Active

## Trigger
User forwards an email to their assistant email address, OR user
pastes email content in chat, OR user invokes `/email-summary`.

## Context Required
- The forwarded email content (text and/or attachments) — REQUIRED
- Organizational strategic context — optional, enhances relevance of risk assessment
- User's role and team context — optional, helps prioritize action items

## Instructions
1. Read the forwarded email content carefully.
2. Identify the sender and their likely intent.
3. Produce a structured summary with these elements:
   - One-sentence summary of the email's purpose
   - Key points (bulleted, max 5)
   - Action items for the user (if any)
   - Risks or concerns (if any)
   - Connections to organizational context (if available)
4. If the email contains attachments, note what they are and summarize
   their relevance.
5. If the email is part of a thread, summarize the thread context.

## Output Format
Structured message, max 200 words. Use this format:

**Summary:** [one sentence]

**Key Points:**
- [point 1]
- [point 2]

**Action Items:**
- [ ] [action 1]
- [ ] [action 2]

**Risks/Concerns:** [if any, otherwise omit this section]

**Context Connection:** [if org context available, how this relates
to strategic priorities]
```

### Complex Example: Board Prep Synthesizer

A multi-source skill that pulls from several context sources:

```markdown
# SKILL: Board Prep Synthesizer

## Metadata
- ID: skill_board_prep_001
- Version: 1.0
- Category: Strategy
- Generated: 2026-03-15
- Source: Pre-built
- Status: Approved

## Trigger
User invokes `/board-prep` with optional topic focus.

## Context Required
- Strategic context document (company strategy, goals, competitive position) — REQUIRED
- Financial data from connected ERP/accounting system — optional but recommended
- CRM pipeline summary (top-line revenue metrics) — optional but recommended
- Recent operational reports shared by user in past 30 days — from personal memory
- Industry and competitive intelligence from org context — optional
- User's notes and observations shared in past 60 days — from personal memory

## MCP Connectors Required
- CRM connector (Salesforce/HubSpot): pipeline summary, revenue metrics, forecast
- Financial system connector (if available): P&L summary, cash flow, key ratios
- Strategic context engine: company strategy, competitive position, market dynamics

## Instructions
1. Review the strategic context document for current company strategy,
   goals, and board-level priorities.
2. Gather financial data if available:
   - Revenue vs. target (current quarter and YTD)
   - Key financial ratios and trends
   - Cash position and runway
3. Gather pipeline/sales data if available:
   - Pipeline value and coverage ratio
   - Win rate trends
   - Top deals and risks
4. Review all content the user has shared in the past 30-60 days for
   relevant operational insights, challenges, and achievements.
5. Synthesize into a board-ready brief with these sections:
   a. Executive Summary (3-5 bullet points on company position)
   b. Financial Performance (actuals vs. plan, with commentary)
   c. Strategic Progress (status of key initiatives from strategy doc)
   d. Key Risks and Mitigations
   e. Decisions Required from the Board
   f. Outlook and Next Quarter Priorities
6. Frame everything in terms of the strategic context — connect
   operational details to strategic goals.
7. Highlight any data gaps — clearly state where information was
   unavailable and what additional inputs would strengthen the brief.
8. Use board-appropriate language: concise, evidence-based, action-oriented.

## Output Format
Detailed document format. Target length: 1-2 pages equivalent.

For Slack/Teams: Deliver as a structured message with clear section
headers. Offer to send the full version via email for printing.

For Email: Full HTML-formatted document with professional styling,
suitable for PDF conversion.

Structure:
### Executive Summary
[3-5 bullet points]

### Financial Performance
[Table or key metrics with commentary]

### Strategic Progress
[Status of each key initiative]

### Key Risks & Mitigations
[Numbered list]

### Board Decisions Required
[Clearly framed decisions with context]

### Outlook
[Forward-looking summary]

## Quality Criteria
- Every claim must be backed by data or explicitly marked as an estimate
- Financial figures must come from connected systems, never fabricated
- Strategic framing must align with the company's actual strategy document
- Risks must be specific and actionable, not generic
- Language must be appropriate for a board audience (no jargon, no technical debt)
- If data sources are incomplete, clearly state what's missing rather than guessing

## Feedback Loop
After delivery, ask: "Does this cover the key topics for your board
meeting? Any areas that need more depth or different framing?"

Store the user's feedback to improve future board prep — learn which
sections the board focuses on, which data points matter most, and
what level of detail is expected.

## Dependencies
- Requires at least the strategic context document to be useful
- Significantly more valuable with CRM and financial connectors
- Benefits from accumulated personal memory (user's shared content over time)
```

### Validation CLI Tool

A command-line validator for SKILL.md files:

```typescript
/**
 * Validate a SKILL.md file and report errors/warnings.
 *
 * Usage: npx ts-node validate-skill.ts /path/to/SKILL.md
 */
interface ValidationResult {
  valid: boolean;
  errors: ValidationMessage[];
  warnings: ValidationMessage[];
}

interface ValidationMessage {
  section: string;
  field?: string;
  message: string;
  line?: number;
}

function validateSkillMd(content: string): ValidationResult {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };

  const lines = content.split('\n');

  // 1. Validate top-level heading
  const firstNonEmpty = lines.find((l) => l.trim().length > 0);
  if (!firstNonEmpty || !firstNonEmpty.startsWith('# SKILL:')) {
    result.errors.push({
      section: 'heading',
      message: 'File must start with "# SKILL: {name}"',
      line: 1,
    });
    result.valid = false;
  } else {
    const name = firstNonEmpty.replace('# SKILL:', '').trim();
    if (name.length < 3 || name.length > 100) {
      result.errors.push({
        section: 'heading',
        message: `Skill name must be 3-100 characters (got ${name.length})`,
      });
      result.valid = false;
    }
  }

  // 2. Parse and validate sections
  try {
    const parsed = parseSkillMd(content);

    // Validate metadata fields
    validateMetadata(parsed.metadata, result);

    // Validate instructions
    const instrLines = parsed.instructions.split('\n').filter((l) => /^\d+\./.test(l.trim()));
    if (instrLines.length < 3) {
      result.errors.push({
        section: 'Instructions',
        message: `Must have at least 3 numbered steps (found ${instrLines.length})`,
      });
      result.valid = false;
    }

    // Check for hardcoded PII patterns
    const piiPatterns = [
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,  // Email
      /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/,  // Phone
      /\b(?:Mr|Mrs|Ms|Dr)\.\s+[A-Z][a-z]+\b/,  // Names with titles
    ];
    for (const pattern of piiPatterns) {
      if (pattern.test(parsed.instructions)) {
        result.errors.push({
          section: 'Instructions',
          message: 'Instructions must not contain hardcoded PII (email, phone, names)',
        });
        result.valid = false;
        break;
      }
    }

    // Validate output format has length constraint
    if (
      !parsed.outputFormat.match(/\d+\s*(lines|words|pages|characters)/i) &&
      !parsed.outputFormat.match(/concise|brief|short|max/i)
    ) {
      result.warnings.push({
        section: 'Output Format',
        message: 'Should specify a length constraint (e.g., "max 15 lines")',
      });
    }

    // Validate quality criteria count
    if (parsed.qualityCriteria) {
      const criteria = parsed.qualityCriteria.split('\n').filter((l) => l.trim().startsWith('-'));
      if (criteria.length < 2) {
        result.warnings.push({
          section: 'Quality Criteria',
          message: `Should have at least 2 criteria (found ${criteria.length})`,
        });
      }
    }

  } catch (error) {
    result.errors.push({
      section: 'parsing',
      message: String(error),
    });
    result.valid = false;
  }

  return result;
}

function validateMetadata(
  metadata: ParsedSkill['metadata'],
  result: ValidationResult
): void {
  // ID format
  if (!/^skill_[a-z0-9_]+_\d{3}$/.test(metadata.id)) {
    result.errors.push({
      section: 'Metadata',
      field: 'ID',
      message: `ID must match format skill_{name}_{number} (got "${metadata.id}")`,
    });
    result.valid = false;
  }

  // Version format
  if (!/^\d+\.\d+$/.test(metadata.version)) {
    result.errors.push({
      section: 'Metadata',
      field: 'Version',
      message: `Version must be MAJOR.MINOR format (got "${metadata.version}")`,
    });
    result.valid = false;
  }

  // Category
  const validCategories = [
    'Communication', 'Analysis', 'Sales', 'Operations',
    'Strategy', 'Management', 'Creative',
  ];
  if (!validCategories.some((c) => c.toLowerCase() === metadata.category.toLowerCase())) {
    result.errors.push({
      section: 'Metadata',
      field: 'Category',
      message: `Category must be one of: ${validCategories.join(', ')} (got "${metadata.category}")`,
    });
    result.valid = false;
  }

  // Source
  const validSources = [
    'Pre-built', 'Advisor-created',
    'Auto-generated from user pattern observation',
    'User-created', 'Marketplace',
  ];
  if (!validSources.some((s) => s.toLowerCase() === metadata.source.toLowerCase())) {
    result.errors.push({
      section: 'Metadata',
      field: 'Source',
      message: `Source must be one of: ${validSources.join(', ')} (got "${metadata.source}")`,
    });
    result.valid = false;
  }

  // Status
  const validStatuses = [
    'Observed', 'Proposed', 'Approved', 'Active', 'Refined', 'Retired',
  ];
  if (!validStatuses.some((s) => s.toLowerCase() === metadata.status.toLowerCase())) {
    result.errors.push({
      section: 'Metadata',
      field: 'Status',
      message: `Status must be one of: ${validStatuses.join(', ')} (got "${metadata.status}")`,
    });
    result.valid = false;
  }
}
```

---

## Phase 0 Scope

### In Scope

- Full SKILL.md format specification (this document)
- Parser implementation for extracting structured data from SKILL.md files
- Validation tool for checking SKILL.md files before deployment
- All required and optional sections supported
- Three example skills (pipeline-risk-scan, email-summarizer, board-prep-synthesizer) as reference implementations
- All 15 Phase 0 skills written in SKILL.md format

### Out of Scope (Phase 1+)

| Feature | Phase | Rationale |
|---------|-------|-----------|
| Automatic SKILL.md generation from patterns | Phase 1 | Requires pattern observation engine |
| Visual SKILL.md editor (web UI) | Phase 1 | Text editor sufficient for Phase 0 advisors |
| SKILL.md linting in CI/CD pipeline | Phase 1 | Manual validation sufficient for 15 skills |
| Internationalization (multi-language instructions) | Phase 1 | English only for Phase 0 |
| Conditional sections (if/else in instructions) | Phase 2 | Keep Phase 0 instructions linear |
| Skill composition (include/reference other skills) | Phase 2 | Keep Phase 0 skills independent |

---

## Open Questions

1. **Instruction specificity vs. flexibility:** Should instructions be highly prescriptive ("use exactly this format") or give the LLM latitude ("produce a concise analysis")? **Recommendation:** Err on the prescriptive side for Phase 0. The LLM performs better with specific constraints. Advisors can loosen instructions based on user feedback.

2. **Channel-specific output format:** Should we have separate output format sections per channel, or one section with channel annotations? **Recommendation:** One `## Output Format` section with inline channel overrides (as shown in the pipeline-risk-scan example). This keeps the file readable while supporting multi-channel output.

3. **Metadata field extensibility:** Can advisors add custom metadata fields? **Recommendation:** Yes, the parser should ignore unknown fields. Custom fields are passed through as-is to the skill definition record. This future-proofs the format without complicating the spec.

4. **Instruction length limits:** Is there a maximum instruction length? **Recommendation:** No hard limit, but practical guidance: instructions should be under 2000 tokens (~1500 words) to leave room for context data and output in the LLM's context window. Skills exceeding this should be split into sub-skills.

5. **Version number in filename:** Should the version be part of the filename (e.g., `SKILL-1.3.md`) or only in metadata? **Recommendation:** Only in metadata. The file is always `SKILL.md`. Version history is tracked via git commits. This prevents filename churn.
