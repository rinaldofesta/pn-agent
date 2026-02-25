# SKILL: Time Auditor

## Metadata
- ID: skill_prod_time_auditor_004
- Version: 1.0
- Category: Management
- Generated: 2026-02-25
- Source: Pre-built
- Status: Active
- Quality Score: null
- Usage: 0 activations

## Trigger
User invokes `/time-audit` OR user asks where their time is going or requests help analyzing how they spend their work hours.

## Context Required
- Calendar connector: meetings and events for the audit period — REQUIRED (or user provides manual log)
- Personal memory: task completion data, skill activations, interaction history — REQUIRED
- Organizational context: user's role expectations, strategic priorities — optional, enables alignment analysis
- Personal memory: previous time audits — optional, enables trend comparison

## Instructions
1. Define the audit period (default: past 5 work days, or as specified by the user).
2. Categorize all time into these buckets:
   - **Meetings:** Time in scheduled meetings, broken down by type (1:1, team, cross-functional, external, all-hands)
   - **Deep work:** Focused time on deliverables (estimated from task tracker and gaps between meetings)
   - **Communication:** Time on email, messages, and ad-hoc conversations (estimated from interaction volume)
   - **Administrative:** Routine tasks, expense reports, approvals, scheduling
   - **Strategic work:** Time on planning, thinking, strategy, and non-deliverable work
   - **Unaccounted:** Time that cannot be categorized from available data
3. Calculate percentages for each category and compare to role-appropriate benchmarks:
   - Individual contributor: should have 50-60% deep work
   - Manager: typically 40-50% meetings, 20-30% deep work
   - Executive: typically 60-70% meetings, 10-20% strategic work
4. Identify time sinks: categories consuming disproportionate time relative to the user's role:
   - Too many meetings? Calculate meeting load vs. benchmark
   - Too much reactive communication? Check message volume and response patterns
   - Insufficient deep work? Calculate longest uninterrupted block
5. Analyze meeting quality:
   - How many meetings had clear outcomes or action items?
   - How many were status updates that could have been async?
   - What is the average meeting length and could shorter meetings work?
6. Calculate the user's "maker's schedule" score: the longest uninterrupted block available for focused work each day.
7. Provide 3 specific recommendations to reclaim time, ranked by estimated hours recovered.
8. If previous audits exist, compare trends: is time allocation improving, stable, or degrading?

## Output Format
Structured audit report, max 30 lines. Use this format:

**Time Audit** | [audit period] | [total hours analyzed]

**Time Allocation:**
| Category | Hours | % | Benchmark | Status |
|----------|-------|---|-----------|--------|
| Meetings | [X] | [X%] | [X%] | Over / On target / Under |
| Deep work | [X] | [X%] | [X%] | Over / On target / Under |
| Communication | [X] | [X%] | [X%] | Over / On target / Under |
| Administrative | [X] | [X%] | — | — |
| Strategic | [X] | [X%] | [X%] | Over / On target / Under |

**Meeting Breakdown:**
- 1:1s: [count] ([hours]) | Team: [count] ([hours]) | Cross-functional: [count] ([hours])

**Maker's Schedule Score:** [longest uninterrupted block] average per day

**Time Sinks:**
- [Area consuming too much time] — [specific evidence]

**Recommendations:**
1. [Action to reclaim time] — Est. savings: [hours/week]
2. [Action to reclaim time] — Est. savings: [hours/week]
3. [Action to reclaim time] — Est. savings: [hours/week]

## Quality Criteria
- All time estimates must be based on actual data (calendar, interactions), not assumptions
- Benchmarks must be appropriate to the user's role level, not generic
- Recommendations must be specific and actionable ("Decline recurring Thursday ops review — you are not needed" not "have fewer meetings")
- The audit must acknowledge data limitations — time outside tracked systems is estimated, not known
- Meeting quality assessment must reference specific meetings, not generalize

## Feedback Loop
After delivering the audit, ask: "Does this feel accurate? Are there time commitments not reflected in your calendar that I should account for?"
Schedule follow-up audits to track whether recommendations led to improvements.
