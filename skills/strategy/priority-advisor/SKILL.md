# SKILL: Priority Advisor

## Metadata
- ID: skill_strat_priority_advisor_002
- Version: 1.0
- Category: Strategy
- Generated: 2026-02-25
- Source: Pre-built
- Status: Active
- Quality Score: null
- Usage: 0 activations

## Trigger
User invokes `/priorities` OR user asks for help prioritizing their work, deciding what to focus on, or managing competing demands.

## Context Required
- The user's current tasks, commitments, and deadlines — REQUIRED (from task tracker or user input)
- The prioritization question or competing demands — REQUIRED
- Organizational context: strategic priorities, team goals, performance expectations — optional, enables strategic alignment
- Personal memory: user's role, strengths, and past prioritization patterns — optional, improves advice
- Calendar: upcoming commitments and available time — optional, enables capacity-based advice

## Instructions
1. Gather the full picture of the user's current commitments:
   - Active tasks with deadlines and estimated effort
   - Meetings and recurring obligations consuming time
   - Incoming requests and ad-hoc work
   - Strategic projects and long-term goals
2. Apply the Eisenhower framework to each item:
   - **Urgent + Important:** Do first — deadline-driven and strategically significant
   - **Important + Not Urgent:** Schedule — strategic work that needs protected time
   - **Urgent + Not Important:** Delegate or streamline — time-sensitive but not high-impact
   - **Not Urgent + Not Important:** Eliminate or defer — low value, consuming time
3. Assess capacity for the relevant time period:
   - Available working hours (minus meetings and recurring obligations)
   - Estimated effort for each prioritized item
   - Buffer for unplanned work (typically 20-30% of capacity)
4. Generate a prioritized plan:
   - Top 3 priorities for the period (with reasoning)
   - Items to delegate (with suggested delegate if organizational context is available)
   - Items to defer (with suggested new timeline)
   - Items to decline or eliminate (with justification)
5. If organizational strategic priorities are available, weight importance by strategic alignment: work that advances current quarter priorities ranks higher.
6. Identify tradeoffs explicitly: "Choosing to focus on X means Y will be delayed by [timeframe]."
7. If the user's task load exceeds reasonable capacity, say so directly and suggest what to renegotiate.

## Output Format
Structured advice, max 25 lines. Use this format:

**Priority Advisor** | [time period]
**Capacity:** [available hours] after meetings and commitments

**Top Priorities (Do First):**
1. [Task] — Why: [strategic reason + urgency] | Est: [hours]
2. [Task] — Why: [strategic reason + urgency] | Est: [hours]
3. [Task] — Why: [strategic reason + urgency] | Est: [hours]

**Delegate:**
- [Task] — Suggested: [person/team] | Why: [reason]

**Defer:**
- [Task] — Move to: [new timeline] | Impact: [consequence]

**Decline/Eliminate:**
- [Task] — Why: [not aligned with priorities]

**Tradeoffs:**
- [Explicit tradeoff the user should be aware of]

**Capacity Check:** [honest assessment — sustainable or overloaded?]

## Quality Criteria
- Prioritization must be justified by specific reasoning (deadline, strategic alignment, impact), not just intuition
- The plan must be realistic — total estimated effort for top priorities must not exceed available capacity
- Delegate recommendations must suggest a specific person or team, not just "delegate this"
- Tradeoffs must be stated explicitly so the user can make informed decisions
- If the user is overloaded, the advisor must say so directly rather than creating an unrealistic plan

## Feedback Loop
After delivering advice, ask: "Does this prioritization feel right? Are there constraints or considerations I'm missing?"
Track which priorities the user actually follows through on to improve future advice calibration.
