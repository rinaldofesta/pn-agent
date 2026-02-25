# SKILL: Proposal Writer

## Metadata
- ID: skill_crea_proposal_writer_003
- Version: 1.0
- Category: Creative
- Generated: 2026-02-25
- Source: Pre-built
- Status: Active
- Quality Score: null
- Usage: 0 activations

## Trigger
User invokes `/write-proposal` OR user requests help drafting a proposal (business proposal, project proposal, budget request, initiative pitch).

## Context Required
- The proposal purpose: what is being proposed and to whom — REQUIRED
- Key facts: scope, budget, timeline, team, resources — REQUIRED (at least what is known)
- The decision-maker(s) and their known priorities — REQUIRED
- Organizational context: strategic priorities, approval processes, competing initiatives — optional, improves positioning
- Previous proposals or templates from personal memory — optional, improves consistency
- Any RFP or brief the proposal responds to — optional

## Instructions
1. Identify the proposal type and audience:
   - **Internal initiative:** Proposing a new project, investment, or change to leadership
   - **Client proposal:** Responding to a client need or RFP with a solution
   - **Budget request:** Requesting funding for a specific purpose
   - **Partnership proposal:** Proposing a collaboration with an external entity
2. Structure the proposal using the appropriate format:
   - **Executive summary:** The proposal in 3-4 sentences — what, why, how much, by when
   - **Problem/opportunity:** What issue this addresses or what opportunity it captures
   - **Proposed solution:** What specifically is being proposed, with enough detail to evaluate
   - **Scope and deliverables:** What is included and what is explicitly excluded
   - **Timeline:** Key milestones and target dates
   - **Budget/investment:** Cost breakdown by category, with total
   - **Expected outcomes:** Measurable results the proposal aims to deliver (metrics, KPIs)
   - **Risks and mitigations:** Honest assessment of what could go wrong and how to manage it
   - **Next steps:** What approval or action is needed to proceed
3. Frame the proposal in terms of the decision-maker's priorities: if the CEO cares about market share, connect the proposal to market share impact.
4. Include specific, quantified benefits wherever possible. "Increase efficiency" becomes "reduce processing time by 30%, saving approximately 200 hours per quarter."
5. Address likely objections preemptively in the risks section.
6. If responding to an RFP or brief, ensure every requirement is addressed point by point.
7. Mark any assumptions or estimates clearly with [ASSUMPTION] or [ESTIMATE] tags.

## Output Format
Full proposal draft. Length: 500-1000 words depending on complexity.

**Proposal: [Title]**
**Submitted to:** [decision-maker/team]
**Date:** [current date]
**Prepared by:** [user name placeholder]

---

### Executive Summary
[3-4 sentences]

### Problem / Opportunity
[Description]

### Proposed Solution
[Details]

### Scope & Deliverables
[What is included/excluded]

### Timeline
| Milestone | Target Date |
|-----------|------------|
| [milestone] | [date] |

### Investment Required
| Category | Amount |
|----------|--------|
| [category] | [amount] |
| **Total** | **[total]** |

### Expected Outcomes
[Measurable results]

### Risks & Mitigations
[Honest assessment]

### Next Steps
[What is needed to proceed]

---
**Assumptions:** [list any [ASSUMPTION] items]

## Quality Criteria
- Executive summary must stand alone — a decision-maker should understand the proposal from the summary without reading further
- Budget must include specific numbers, not ranges, even if they are estimates (label them as such)
- Timeline must include concrete milestones, not just a duration
- Benefits must be quantified with metrics, not qualitative statements
- Risks section must be honest — at least 2 genuine risks, not token risks that are easily dismissed
- Every claim about outcomes must be traceable to evidence or clearly marked as a projection

## Feedback Loop
After presenting the draft, ask: "Does this hit the right points for your decision-maker? Should I adjust the framing, scope, or budget?"
Track the user's proposal preferences and decision-maker priorities for future proposals.
