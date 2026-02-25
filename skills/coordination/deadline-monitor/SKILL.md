# SKILL: Deadline Monitor

## Metadata
- ID: skill_coord_deadline_monitor_003
- Version: 1.0
- Category: Operations
- Generated: 2026-02-25
- Source: Pre-built
- Status: Active
- Quality Score: null
- Usage: 0 activations

## Trigger
User invokes `/deadlines` OR system runs automatically on Monday morning to provide the weekly deadline overview.

## Context Required
- Personal memory: all tracked tasks, commitments, and deadlines — REQUIRED
- Calendar connector: scheduled deadlines, milestones, review dates — optional, enriches the view
- Organizational context: project timelines, sprint cycles, reporting cadences — optional, adds organizational deadlines
- Personal memory: past deadline performance (met, missed, extended) — optional, enables pattern detection

## Instructions
1. Scan all known deadlines from personal memory, tracked tasks, and connected calendars for the next 14 days.
2. Categorize deadlines by urgency:
   - **Overdue:** Past deadline, not yet completed
   - **Due today:** Deadline is today
   - **Due this week:** Deadline within the current week (Mon-Fri)
   - **Due next week:** Deadline in the following week
   - **Upcoming (14 days):** Deadline within 14 days but beyond next week
3. For each deadline, assess completion risk:
   - **At risk:** The deadline is within 48 hours and the task has no evidence of progress or has unresolved dependencies
   - **On track:** The deadline has sufficient time and/or shows evidence of progress
   - **Blocked:** The task depends on something that has not yet been delivered
4. Identify deadline clusters: periods where multiple deadlines converge, which may create capacity issues.
5. If organizational context includes team dependencies, flag deadlines that depend on other people's deliverables.
6. If past deadline performance is available, note patterns: "You have historically needed 2 extra days for report-type deliverables."
7. Suggest prioritization for the upcoming week based on deadline urgency, importance, and estimated effort.
8. If overdue items exist, recommend a specific recovery plan: renegotiate deadline, delegate, or escalate.

## Output Format
Structured deadline view, max 25 lines. Use this format:

**Deadline Monitor** | [date] | [count] deadlines in next 14 days

**OVERDUE** ([count]):
- [task] | Due: [date] | [days overdue] | Action: [suggestion]

**DUE TODAY** ([count]):
- [task] | Status: [at risk / on track]

**THIS WEEK** ([count]):
- [task] | Due: [day] | Status: [at risk / on track / blocked]

**NEXT WEEK** ([count]):
- [task] | Due: [day]

**Cluster Alert:** [if multiple deadlines converge, note the date and count]

**Priority This Week:**
1. [Most urgent item and why]
2. [Second priority]
3. [Third priority]

## Quality Criteria
- Every deadline must include the specific date, not relative references ("in 3 days")
- Risk assessment must be based on evidence (progress status, dependencies), not arbitrary
- Overdue items must always include a specific recommended action, not just "needs attention"
- Deadline clusters must be flagged when 3+ items converge within a 2-day window
- The priority recommendation must factor in both urgency and importance, not just chronological order

## Feedback Loop
After delivering the monitor, ask: "Are any of these deadlines outdated or already handled? Any new deadlines to add?"
Update deadline tracking based on the user's corrections to keep future monitors accurate.
