# SKILL: Workflow Optimizer

## Metadata
- ID: skill_intel_workflow_optimizer_004
- Version: 1.0
- Category: Management
- Generated: 2026-02-25
- Source: Pre-built
- Status: Active
- Quality Score: null
- Usage: 0 activations

## Trigger
User invokes `/optimize-workflow` OR user asks how to improve team or organizational workflows based on usage patterns.

## Context Required
- Anonymized organizational skill usage data from aggregation views — REQUIRED (must meet 5-user anonymization threshold)
- Organizational context: existing workflows, processes, team structure — REQUIRED
- User's role: must have appropriate access to organizational data — REQUIRED
- Personal memory: previous workflow optimization reports — optional, enables progress tracking
- Skill activation sequences and patterns (anonymized, aggregate) — optional, reveals workflow chains

## Instructions
1. Analyze anonymized, aggregate skill activation patterns across the organization. All data must meet the 5-user anonymization threshold.
2. Identify workflow patterns:
   - **Common sequences:** Which skills are frequently activated in sequence? (e.g., email-summary followed by email-draft — this is a "read and respond" workflow)
   - **Skill clusters:** Which skills are commonly used together by the same user groups? (e.g., meeting-prep + meeting-notes + action-item-extractor = "meeting workflow")
   - **Abandoned flows:** Where do users start a workflow but not complete it? (e.g., activate report-analyzer but rarely follow with action items)
   - **Redundant steps:** Are users activating multiple skills when one would suffice?
3. Identify optimization opportunities:
   - **Workflow automation:** Sequences that could be chained automatically (e.g., auto-trigger action-item-extractor after meeting-notes)
   - **Skill gaps:** Points in common workflows where no skill exists but users seem to need one
   - **Underutilized skills:** Skills that would add value in observed workflows but are not being activated
   - **Process bottlenecks:** Steps in the workflow that take disproportionately long or have high abandonment
4. For each optimization opportunity, provide:
   - **Current state:** How the workflow works now (with aggregate data)
   - **Proposed improvement:** What would change
   - **Expected benefit:** Time saved, quality improved, or friction reduced
   - **Implementation:** What needs to happen (new skill, automation, training)
5. Prioritize recommendations by estimated impact (time saved across the organization) and implementation effort.
6. Maintain strict anonymization: report patterns and aggregate counts only. Never identify which users or teams follow specific workflows.
7. If previous optimization reports exist, report on whether past recommendations were adopted and their measured impact.

## Output Format
Structured optimization report, max 30 lines. Use this format:

**Workflow Optimization Report** | [reporting period]
**Data basis:** [X] users | [Y] skill activations | Anonymization: 5-user minimum

**Identified Workflows:**
1. **[Workflow name]** ([X]% of users follow this pattern)
   - Sequence: [skill A] -> [skill B] -> [skill C]
   - Optimization: [proposed improvement]
   - Est. benefit: [time saved per user per week]

2. **[Workflow name]** ([X]% of users follow this pattern)
   - Sequence: [skill A] -> [skill B]
   - Optimization: [proposed improvement]
   - Est. benefit: [time saved per user per week]

**Skill Gaps Identified:**
- [Point in workflow where a skill is missing]

**Underutilized Skills:**
- [Skill that would benefit users in observed workflows]

**Recommendations (Prioritized):**
1. [Highest impact recommendation] — Effort: [Low/Medium/High]
2. [Second recommendation] — Effort: [Low/Medium/High]

**Note:** All data is anonymized and aggregated. No individual user workflows are identifiable.

## Quality Criteria
- Workflow patterns must be identified from aggregate data (5+ users following the pattern), not individual user sequences
- Optimization recommendations must be specific and actionable, with clear expected benefits
- Estimated benefits must be realistic and evidence-based, not aspirational
- Skill gap identification must be based on observed behavior gaps, not theoretical completeness
- The report must clearly distinguish between observed patterns and recommended changes
- Abandoned flows must be reported with care — abandonment may be appropriate, not always a problem

## Feedback Loop
After delivering the report, ask: "Are these workflow patterns what you expected? Should I investigate any specific process area more deeply?"
Track which recommendations are implemented and measure their impact in subsequent reports.
