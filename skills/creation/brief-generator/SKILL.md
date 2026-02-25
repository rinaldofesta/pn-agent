# SKILL: Brief Generator

## Metadata
- ID: skill_crea_brief_generator_005
- Version: 1.0
- Category: Creative
- Generated: 2026-02-25
- Source: Pre-built
- Status: Active
- Quality Score: null
- Usage: 0 activations

## Trigger
User invokes `/create-brief` OR user requests a stakeholder brief, project brief, executive summary, or situation brief.

## Context Required
- The topic or situation to brief on — REQUIRED
- The intended audience (stakeholders, executives, team, board) — REQUIRED
- Source material: reports, data, emails, meeting notes, or user's own knowledge — REQUIRED
- Organizational context: strategic priorities, stakeholder interests, relevant history — optional, improves framing
- Personal memory: previous briefs on the same topic — optional, enables continuity

## Instructions
1. Identify the brief type and purpose:
   - **Stakeholder brief:** Inform stakeholders about a situation, decision, or progress. Focus on impact and next steps.
   - **Project brief:** Define a project scope, objectives, and approach for team alignment.
   - **Executive summary:** Distill a complex situation or report into its essential elements for senior leaders.
   - **Situation brief:** Provide rapid context on an emerging situation or issue.
2. Organize the source material by relevance to the audience. Stakeholders care about impact and decisions; teams care about specifics and next steps.
3. Write the brief with ruthless conciseness — every sentence must earn its place:
   - **Bottom line up front:** State the key message or recommendation in the first sentence
   - **Context:** Only the background necessary to understand the key message (2-3 sentences max)
   - **Key facts:** The 3-5 most important data points or findings, with specific numbers
   - **Implications:** What this means for the audience specifically
   - **Recommendation or next steps:** What action is needed, by whom, and by when
4. If multiple source materials are provided, synthesize them into a coherent narrative rather than summarizing each one separately.
5. Use the "so what?" test on every point: if a fact does not lead to an implication or action, cut it.
6. If organizational context is available, frame findings in terms of strategic priorities and stakeholder interests.
7. Flag any areas of uncertainty or incomplete information rather than presenting assumptions as facts.

## Output Format
Concise brief, max 20 lines. Use this format:

**Brief: [Topic]**
**For:** [audience] | **Date:** [current date]

**Bottom Line:** [one sentence — the most important thing the reader needs to know]

**Context:**
[2-3 sentences of essential background]

**Key Facts:**
- [Fact 1 with specific number or evidence]
- [Fact 2 with specific number or evidence]
- [Fact 3 with specific number or evidence]

**Implications:**
- [What this means for the audience]

**Recommended Action:**
- [Specific next step, owner, and timeline]

## Quality Criteria
- The bottom line must be a complete, actionable statement that stands alone — not "this is about revenue"
- Key facts must include specific numbers, dates, or evidence — no vague qualifiers
- The brief must be readable in under 2 minutes
- Every point must pass the "so what?" test — irrelevant context is worse than missing context
- Information gaps must be flagged explicitly, not papered over
- The brief must synthesize source material, not just summarize it sequentially

## Feedback Loop
After presenting the brief, ask: "Is this at the right level for your audience? Should I add depth to any section or simplify further?"
Track audience preferences and framing patterns for future briefs.
