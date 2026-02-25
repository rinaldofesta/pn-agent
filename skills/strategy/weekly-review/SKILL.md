# SKILL: Weekly Review

## Metadata
- ID: skill_strat_weekly_review_001
- Version: 1.0
- Category: Strategy
- Generated: 2026-02-25
- Source: Pre-built
- Status: Active
- Quality Score: null
- Usage: 0 activations

## Trigger
User invokes `/weekly-review` OR system activates automatically on Monday morning to generate the weekly review.

## Context Required
- Personal memory: all interactions, tasks, and content from the past 7 days — REQUIRED
- Organizational context: strategic priorities, team goals, project milestones — optional, enables alignment assessment
- Calendar connector: meetings attended, upcoming meetings — optional, adds schedule context
- Task tracker: completed and pending tasks — optional, adds task completion data

## Instructions
1. Compile all user activity from the past 7 days: messages sent, content shared, tasks completed, skills invoked, and meetings attended (if calendar data is available).
2. Organize the week into a structured review:
   - **Accomplishments:** What was completed or progressed meaningfully. Be specific — name the deliverables, decisions, or outcomes, not just activities.
   - **Key interactions:** The most significant communications, meetings, or conversations. Summarize the outcome, not just the occurrence.
   - **Patterns observed:** Recurring themes, escalating issues, or notable shifts in the user's work pattern (e.g., "You spent 60% of your communication time on Project X this week, up from 30% last week").
3. Assess the week against organizational priorities (if available):
   - Which strategic priorities received attention?
   - Which priorities were neglected?
   - Are there emerging priorities not on the official list?
4. Look ahead to the coming week:
   - **Upcoming deadlines:** Tasks and deliverables due in the next 7 days
   - **Key meetings:** Important meetings and what to prepare
   - **Carry-forward items:** Incomplete tasks or unresolved issues from this week
5. Provide 2-3 suggestions for the coming week:
   - What to prioritize based on deadline urgency and strategic importance
   - What to delegate or deprioritize if the load is heavy
   - What proactive steps could prevent issues from escalating
6. Compare with the previous week's review (if available from personal memory) and note trajectory: is work intensity increasing, decreasing, or stable?
7. End with a brief energy/capacity check-in: based on patterns, flag if the pace seems unsustainable.

## Output Format
Structured weekly review, max 30 lines. Use this format:

**Weekly Review** | [date range]

**Accomplishments:**
- [Specific outcome 1]
- [Specific outcome 2]
- [Specific outcome 3]

**Key Interactions:**
- [Meeting/conversation]: [outcome]
- [Meeting/conversation]: [outcome]

**Patterns This Week:**
- [Observed pattern with data]

**Strategic Alignment:**
- Focused on: [priorities that received attention]
- Needs attention: [priorities that were neglected]

**Looking Ahead:**
- Deadlines: [upcoming due dates]
- Key meetings: [important meetings]
- Carry-forward: [unfinished items]

**Suggestions:**
1. [Priority recommendation]
2. [Action recommendation]

## Quality Criteria
- Accomplishments must reference specific deliverables or outcomes, not generic activity ("Completed Q3 budget draft" not "Worked on budget")
- Patterns must include quantitative evidence when possible ("5 emails about pricing this week vs. 1 last week")
- Strategic alignment assessment must reference actual organizational priorities, not assumed ones
- Suggestions must be actionable and specific to the user's upcoming week
- The review must be honest about unproductive patterns — its value comes from candid reflection, not cheerleading

## Feedback Loop
After delivering the review, ask: "Does this capture your week accurately? Anything to add or correct before we set priorities for next week?"
Use corrections to improve future weekly reviews and learn what the user values in their reflection process.
