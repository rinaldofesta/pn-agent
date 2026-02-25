# Phase 0 Skill Library Specification

**Status:** Draft
**Version:** 0.1
**Last Updated:** 2026-02-25
**Owner:** Technical Architecture

---

## Context

The Phase 0 skill library is the pre-built set of skills that ships with Play New for the design partner phase. These skills represent the initial value proposition for end users -- the concrete, immediately useful capabilities that make the personal assistant worth engaging with daily. The quality and relevance of these skills directly determines Phase 0's success criterion of ">50% weekly active users after 4 weeks" (PRD Section 8.8).

The library contains 35 skills across 7 categories, as defined in PRD Appendix C. For Phase 0, we prioritize 10-15 skills for initial implementation, with the remainder built and added iteratively during the design partnership period.

---

## Nanoclaw Foundation

Nanoclaw provides the skills directory structure and SKILL.md format convention. The Play New skill library extends this with:

- User-facing (LLM instruction) skills instead of code-modification skills
- Organization in `/skills/{category}/{skill-id}/SKILL.md`
- Versioned via git (skill files are tracked in the repository)
- Metadata in PostgreSQL `skill_definitions` table for queryability

---

## Play New Requirements

From the PRD:

- **Section 8.1:** Pre-built skill library of 30-50 skills organized by role category
- **Section 8.3 (Skill Activation):** Advisor reviews patterns and assigns relevant skills from pre-built library
- **Section 8.4 (FR-003.2):** Pre-built library of 30-50 skills organized by role category
- **Appendix C:** Full list of 35 skills across 7 categories with names and descriptions
- **Section 8.4 (FR-003 table):** Skill categories: Communication, Analysis, Sales, Operations, Strategy, Creative, Management

---

## Technical Specification

### Directory Structure

```
/skills/
  /communication/
    /email-summarizer/
      SKILL.md
    /response-drafter/
      SKILL.md
    /meeting-prep/
      SKILL.md
    /stakeholder-brief/
      SKILL.md
    /negotiation-analyzer/
      SKILL.md
    /escalation-detector/
      SKILL.md
    /action-item-extractor/
      SKILL.md
    /weekly-digest/
      SKILL.md
  /analysis/
    /data-pattern-finder/
      SKILL.md
    /report-analyzer/
      SKILL.md
    /competitive-scan/
      SKILL.md
    /market-signal-digest/
      SKILL.md
    /trend-spotter/
      SKILL.md
    /gap-analyzer/
      SKILL.md
    /benchmark-comparer/
      SKILL.md
  /sales/
    /pipeline-risk-scan/
      SKILL.md
    /deal-strategy-advisor/
      SKILL.md
    /competitor-pricing-alert/
      SKILL.md
    /forecast-prep/
      SKILL.md
    /client-health-check/
      SKILL.md
  /operations/
    /process-bottleneck-finder/
      SKILL.md
    /vendor-comparison/
      SKILL.md
    /compliance-checker/
      SKILL.md
    /resource-optimizer/
      SKILL.md
    /risk-register-updater/
      SKILL.md
  /strategy/
    /strategic-signal-daily/
      SKILL.md
    /decision-scenario-modeler/
      SKILL.md
    /board-prep-synthesizer/
      SKILL.md
    /strategy-gap-analyzer/
      SKILL.md
    /competitive-position-tracker/
      SKILL.md
  /management/
    /team-workload-analyzer/
      SKILL.md
    /one-on-one-prep/
      SKILL.md
    /delegation-optimizer/
      SKILL.md
    /performance-pattern-detector/
      SKILL.md
    /cross-team-connector/
      SKILL.md
```

### Complete Skill Catalog

#### Communication Skills (8)

| # | Skill ID | Name | Description | Command | MCP Required | Target Personas | Priority |
|---|----------|------|-------------|---------|-------------|----------------|----------|
| 1 | `email-summarizer` | Email Summarizer | Summarize forwarded email with key actions, risks, and organizational context connections | `/email-summary` | None | All | P0 (launch) |
| 2 | `response-drafter` | Response Drafter | Draft a reply to a forwarded email in the user's tone, considering org context | `/draft-response` | None | All | P0 (launch) |
| 3 | `meeting-prep` | Meeting Prep | Prepare a brief for an upcoming meeting based on agenda, attendees, and historical context | `/meeting-prep` | Google Calendar / Outlook Calendar (optional) | All | P0 (launch) |
| 4 | `stakeholder-brief` | Stakeholder Brief | Synthesize information from multiple sources into a stakeholder-ready format | `/stakeholder-brief` | None | Managers, Leadership | P0 (week 4) |
| 5 | `negotiation-analyzer` | Negotiation Analyzer | Analyze negotiation dynamics in forwarded communication, identify leverage and risks | `/negotiate` | None | Sales, Leadership | P1 |
| 6 | `escalation-detector` | Escalation Detector | Flag communications that may require escalation based on tone, urgency, and org context | `/escalation-check` | None | Managers, Operations | P1 |
| 7 | `action-item-extractor` | Action Item Extractor | Extract and organize action items from any shared content (emails, meeting notes, documents) | `/actions` | None | All | P0 (launch) |
| 8 | `weekly-digest` | Weekly Digest | Compile a weekly summary of all interactions, patterns observed, and suggestions for next week | `/weekly-prep` | None | All | P0 (launch) |

#### Analysis Skills (7)

| # | Skill ID | Name | Description | Command | MCP Required | Target Personas | Priority |
|---|----------|------|-------------|---------|-------------|----------------|----------|
| 9 | `data-pattern-finder` | Data Pattern Finder | Identify patterns, anomalies, and trends in shared data or reports | `/find-patterns` | None | Analysts, Managers | P0 (week 4) |
| 10 | `report-analyzer` | Report Analyzer | Analyze forwarded reports and surface key insights, gaps, and recommendations | `/analyze-report` | None | Analysts, Managers, Leadership | P0 (launch) |
| 11 | `competitive-scan` | Competitive Scan | Analyze competitive information shared by user against org's competitive context | `/comp-scan` | None | Strategy, Sales | P1 |
| 12 | `market-signal-digest` | Market Signal Digest | Synthesize market signals from shared content into structured intelligence | `/market-signals` | None | Strategy, Leadership | P1 |
| 13 | `trend-spotter` | Trend Spotter | Identify emerging trends from accumulated shared content over time | `/trends` | Personal memory (accumulated content) | Strategy, Analysts | P2 |
| 14 | `gap-analyzer` | Gap Analyzer | Identify gaps between current state and strategic goals based on shared evidence | `/gap-analysis` | Strategic context document | Strategy, Leadership | P0 (week 6) |
| 15 | `benchmark-comparer` | Benchmark Comparer | Compare shared metrics against known industry benchmarks | `/benchmark` | None | Analysts, Leadership | P1 |

#### Sales Skills (5)

| # | Skill ID | Name | Description | Command | MCP Required | Target Personas | Priority |
|---|----------|------|-------------|---------|-------------|----------------|----------|
| 16 | `pipeline-risk-scan` | Pipeline Risk Scan | Assess pipeline deal health: engagement decay, stage stagnation, competitive signals | `/pipeline-risk` | CRM (Salesforce/HubSpot) | Sales | P0 (launch) |
| 17 | `deal-strategy-advisor` | Deal Strategy Advisor | Analyze deal dynamics and suggest strategy based on deal stage, contacts, and competitive context | `/deal-strategy` | CRM (optional) | Sales | P0 (week 4) |
| 18 | `competitor-pricing-alert` | Competitor Pricing Alert | Monitor and synthesize competitor pricing signals from shared intelligence | `/pricing-alert` | None | Sales, Strategy | P1 |
| 19 | `forecast-prep` | Forecast Prep | Prepare sales forecast with variance analysis and confidence levels | `/forecast` | CRM (Salesforce/HubSpot) | Sales Managers | P0 (week 6) |
| 20 | `client-health-check` | Client Health Check | Assess client relationship health from communication patterns and CRM activity | `/client-health` | CRM (optional) | Sales, Account Managers | P1 |

#### Operations Skills (5)

| # | Skill ID | Name | Description | Command | MCP Required | Target Personas | Priority |
|---|----------|------|-------------|---------|-------------|----------------|----------|
| 21 | `process-bottleneck-finder` | Process Bottleneck Finder | Identify process bottlenecks from shared workflow descriptions and process data | `/bottleneck` | None | Operations, Managers | P0 (week 6) |
| 22 | `vendor-comparison` | Vendor Comparison | Structured comparison of vendor proposals with scoring matrix | `/compare-vendors` | None | Operations, Procurement | P1 |
| 23 | `compliance-checker` | Compliance Checker | Check shared documents against known compliance requirements and org policies | `/compliance-check` | Org compliance docs | Operations, Legal | P1 |
| 24 | `resource-optimizer` | Resource Optimizer | Analyze resource allocation from shared project data and suggest optimizations | `/optimize-resources` | Project management (optional) | Operations, Managers | P2 |
| 25 | `risk-register-updater` | Risk Register Updater | Maintain and update risk register from ongoing shared information | `/risk-update` | None | Operations, Project Managers | P0 (week 6) |

#### Strategy Skills (5)

| # | Skill ID | Name | Description | Command | MCP Required | Target Personas | Priority |
|---|----------|------|-------------|---------|-------------|----------------|----------|
| 26 | `strategic-signal-daily` | Strategic Signal Daily | Morning briefing of relevant strategic signals based on org context and shared intelligence | `/morning-brief` | Strategic context document | Leadership, Strategy | P0 (week 4) |
| 27 | `decision-scenario-modeler` | Decision Scenario Modeler | Build and analyze scenarios for strategic decisions with risk/reward assessment | `/scenario` | Strategic context document | Leadership, Strategy | P1 |
| 28 | `board-prep-synthesizer` | Board Prep Synthesizer | Compile board materials from shared cross-departmental content with strategic framing | `/board-prep` | Multiple data sources, strategic context | Leadership | P1 |
| 29 | `strategy-gap-analyzer` | Strategy Gap Analyzer | Compare current activities against strategic priorities to find alignment gaps | `/strategy-gaps` | Strategic context document | Leadership, Strategy | P0 (week 6) |
| 30 | `competitive-position-tracker` | Competitive Position Tracker | Track competitive positioning from accumulated shared intelligence over time | `/comp-track` | Strategic context document, personal memory | Strategy, Leadership | P2 |

#### Management Skills (5)

| # | Skill ID | Name | Description | Command | MCP Required | Target Personas | Priority |
|---|----------|------|-------------|---------|-------------|----------------|----------|
| 31 | `team-workload-analyzer` | Team Workload Analyzer | Analyze team workload patterns from shared information and suggest rebalancing | `/team-workload` | None | Managers | P0 (week 6) |
| 32 | `one-on-one-prep` | One-on-One Prep | Prepare 1:1 meeting agendas based on context, recent interactions, and team patterns | `/one-on-one` | None | Managers | P0 (week 4) |
| 33 | `delegation-optimizer` | Delegation Optimizer | Suggest task delegation based on team capabilities and current workload | `/delegate` | None | Managers | P1 |
| 34 | `performance-pattern-detector` | Performance Pattern Detector | Identify patterns relevant to team performance from shared observations | `/perf-patterns` | None | Managers | P2 |
| 35 | `cross-team-connector` | Cross-Team Connector | Identify collaboration opportunities across teams based on accumulated context | `/connect-teams` | Personal memory, org context | Managers, Leadership | P2 |

### Implementation Priority

Skills are prioritized in three tiers for Phase 0 implementation:

#### Tier 1 -- Launch Skills (Week 1-4)

These skills are available from day one of each design partner deployment:

| Skill | Rationale | Dependencies |
|-------|-----------|-------------|
| `email-summarizer` | Lowest friction, highest frequency use case. Validates forward mode. | None |
| `response-drafter` | Natural follow-up to email-summarizer. Immediate productivity gain. | None |
| `action-item-extractor` | Universal value. Works with any shared content. | None |
| `meeting-prep` | High frequency, clear value, builds daily habit. | Calendar access (optional) |
| `weekly-digest` | Engagement driver. Creates weekly touchpoint. | Personal memory |
| `report-analyzer` | Common knowledge worker task. Works with forwarded reports. | None |
| `pipeline-risk-scan` | High value for sales teams. Flagship skill for CRM-connected orgs. | CRM connector |

**Target: 7 skills at launch.**

#### Tier 2 -- Early Expansion (Week 4-8)

Added after initial adoption data and advisor observations:

| Skill | Rationale | Dependencies |
|-------|-----------|-------------|
| `stakeholder-brief` | Frequently requested by managers after they see email-summarizer. | None |
| `data-pattern-finder` | Validates analysis capability. | None |
| `deal-strategy-advisor` | Expands sales skill set beyond pipeline-risk. | CRM (optional) |
| `strategic-signal-daily` | Engagement driver for leadership. Creates daily habit. | Strategic context doc |
| `one-on-one-prep` | High value for managers. Weekly use case. | None |
| `gap-analyzer` | Connects user tasks to org strategy. Validates context injection. | Strategic context doc |
| `strategy-gap-analyzer` | Leadership engagement. Connects to org intelligence goals. | Strategic context doc |
| `forecast-prep` | Extends sales coverage. Monthly cadence. | CRM connector |

**Target: 15 skills by week 8.**

#### Tier 3 -- Full Library (Week 8-20)

Remaining skills built based on demand signals from design partners:

All remaining skills from the catalog (20 additional). Priority order adjusted based on:
- Which roles are most active in each design partner org
- Which skill categories get the most requests
- Which MCP connectors are available per org

### Skill Assignment Matrix

Default skill assignments by role category. Advisors use this as a starting point and customize based on observed patterns:

| Role Category | Default Skills (Tier 1) | Additional Skills (Tier 2) |
|--------------|------------------------|---------------------------|
| **All Users** | email-summarizer, response-drafter, action-item-extractor, weekly-digest | stakeholder-brief |
| **Sales** | + pipeline-risk-scan, meeting-prep | + deal-strategy-advisor, forecast-prep |
| **Sales Manager** | + pipeline-risk-scan, meeting-prep, report-analyzer | + forecast-prep, team-workload-analyzer, one-on-one-prep |
| **Analyst** | + report-analyzer, meeting-prep | + data-pattern-finder, gap-analyzer |
| **Operations** | + report-analyzer, meeting-prep | + process-bottleneck-finder, risk-register-updater |
| **Manager** | + meeting-prep, report-analyzer | + one-on-one-prep, team-workload-analyzer, stakeholder-brief |
| **Strategy/Leadership** | + report-analyzer, meeting-prep | + strategic-signal-daily, strategy-gap-analyzer, gap-analyzer |

### Skill Storage and Versioning

Skills are stored as SKILL.md files in the repository under `/skills/{category}/{skill-id}/SKILL.md`. Each skill file follows the format defined in `skill-md-format.md`.

**Version control:**
- Each SKILL.md change is a git commit with a structured message: `skill({skill-id}): {description}`
- Version numbers follow semver: `MAJOR.MINOR.PATCH`
  - PATCH: typo fixes, formatting changes
  - MINOR: instruction refinements, output format tweaks
  - MAJOR: fundamental instruction changes, new context requirements
- The `skill_definitions` table stores the parsed content for runtime access
- On startup, the system syncs SKILL.md files to the database

```typescript
/**
 * Sync skill files from disk to database.
 * Called on system startup and after skill file updates.
 */
async function syncSkillLibrary(skillsDir: string): Promise<SyncResult> {
  const skillFiles = await glob(`${skillsDir}/**/SKILL.md`);
  const results: SyncResult = { added: 0, updated: 0, errors: [] };

  for (const filePath of skillFiles) {
    try {
      const content = await readFile(filePath, 'utf-8');
      const parsed = parseSkillMd(content);

      const existing = await getSkillDefinition(parsed.id);

      if (!existing) {
        await createSkillDefinition(parsed, filePath, content);
        results.added++;
      } else if (existing.version !== parsed.version) {
        await updateSkillDefinition(parsed, filePath, content);
        results.updated++;
      }
    } catch (error) {
      results.errors.push({ filePath, error: String(error) });
    }
  }

  return results;
}

interface SyncResult {
  added: number;
  updated: number;
  errors: { filePath: string; error: string }[];
}
```

### Per-Skill MCP Connector Requirements

Skills that require MCP connectors degrade gracefully when the connector is not available:

| Skill | Required Connector | Behavior Without Connector |
|-------|-------------------|---------------------------|
| `pipeline-risk-scan` | CRM (Salesforce/HubSpot) | User can paste pipeline data manually; skill analyzes pasted content |
| `forecast-prep` | CRM (Salesforce/HubSpot) | User provides forecast data manually; skill structures and analyzes |
| `meeting-prep` | Calendar (Google/Outlook) | User provides meeting details manually; skill prepares brief from input |
| `strategic-signal-daily` | Strategic context doc | Produces generic briefing without org-specific framing |
| `gap-analyzer` | Strategic context doc | Asks user to describe strategic goals; analyzes gap from user input |
| `strategy-gap-analyzer` | Strategic context doc | Same as gap-analyzer fallback |
| `client-health-check` | CRM (optional) | Analyzes relationship based on user's shared communications only |
| `compliance-checker` | Org compliance docs | Checks against general best practices; flags for manual compliance review |

---

## Phase 0 Scope

### In Scope

- 7 Tier 1 skills implemented and tested at launch
- 8 Tier 2 skills implemented during weeks 4-8
- SKILL.md files for all 15 Tier 1+2 skills in the repository
- Skill assignment matrix for initial advisor guidance
- Database sync for skill definitions
- Each skill tested with at least 3 realistic scenarios before deployment

### Out of Scope

- Tier 3 skills (built on demand during weeks 8-20)
- Creative category skills (not in PRD Appendix C)
- Skill marketplace infrastructure
- Cross-org skill sharing
- Automatic skill generation
- Skill A/B testing framework

---

## Open Questions

1. **Skill customization per org:** Should advisors be able to modify skill instructions for a specific org (e.g., change the output format of pipeline-risk-scan for Org A)? **Recommendation:** Yes. Store org-level overrides in a separate `skill_overrides` table. The base SKILL.md provides the template; org overrides patch specific sections. This keeps the library clean while allowing customization.

2. **Skill bundling:** Should we offer "skill packs" (e.g., "Sales Pack", "Manager Pack") instead of individual skill assignment? **Recommendation:** Both. Advisors can assign a pack (which is just a named list of skills) or individual skills. Packs simplify onboarding; individual assignment enables fine-tuning.

3. **Skill deprecation process:** When we release a v2 of a skill that fundamentally changes its behavior, what happens to users on v1? **Recommendation:** Run both versions for 2 weeks. Notify users of the change. Auto-migrate to v2 after the grace period unless they explicitly opt to stay on v1.

4. **Localization:** Should skills support multiple languages from Phase 0? **Recommendation:** No. Phase 0 design partners are Italian companies, but the product language is English. Skills are written in English. Italian language support planned for Phase 1.

5. **Skill metrics dashboard for advisors:** Should advisors see cross-user skill metrics (anonymized) to inform their assignment decisions? **Recommendation:** Yes. An advisor dashboard showing: "In Org A, pipeline-risk-scan has 87% positive feedback across 12 users" helps advisors make better assignment decisions. Aggregate only, never per-user.
