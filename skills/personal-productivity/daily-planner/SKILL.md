# SKILL: Daily Planner

## Metadata
- ID: skill_prod_daily_planner_001
- Version: 1.0
- Category: Management
- Generated: 2026-02-25
- Source: Pre-built
- Status: Active
- Quality Score: null
- Usage: 0 activations

## Trigger
User invokes `/plan-day` OR system activates at the start of each work day (configurable, default 8:30 AM) to suggest the daily plan.

## Context Required
- Calendar connector: today's meetings and commitments — optional but recommended
- Personal memory: tracked tasks, deadlines, carry-forward items from previous days — REQUIRED
- Organizational context: team priorities, sprint goals, standing commitments — optional, enables alignment
- Personal memory: user's energy patterns and scheduling preferences — optional, improves time blocking

## Instructions
1. Gather the day's fixed commitments:
   - Meetings from calendar (time, duration, attendees, topic)
   - Standing commitments (daily standup, office hours, etc.)
   - Deadlines that are today
2. Calculate available work time:
   - Total work hours (default 8, adjustable per user preference)
   - Minus meeting time and transition buffers (10 min between meetings)
   - Minus recurring commitments
   - Result: available deep work hours and fragmented time slots
3. Prioritize tasks for the day from the task tracker:
   - Tasks due today or overdue (highest priority)
   - Tasks due this week that need progress
   - Important but not urgent tasks that benefit from proactive attention
4. Build the daily plan:
   - **Morning block:** High-concentration work when possible (or morning meetings if scheduled)
   - **Afternoon block:** Collaborative work, emails, lower-concentration tasks
   - Match task type to time slot: deep work in uninterrupted blocks, administrative tasks in fragmented slots
5. If the user's energy patterns are known from personal memory, adjust: schedule demanding tasks during peak energy hours.
6. Include buffers:
   - 20-30% of available time for unplanned requests (do not schedule 100% of time)
   - Lunch break (if not already blocked on calendar)
7. Flag any conflicts: double-booked meetings, tasks that cannot fit in available time, or deadlines at risk.
8. Provide a "top 3" focus for the day: the three things that, if completed, would make it a productive day.

## Output Format
Structured daily plan, max 25 lines. Use this format:

**Daily Plan** | [day, date]
**Available:** [X] hours of work time | [Y] hours in meetings

**Top 3 Focus:**
1. [Most important outcome for today]
2. [Second most important]
3. [Third most important]

**Schedule:**
| Time | Activity | Type |
|------|----------|------|
| [time] | [activity] | Meeting / Deep work / Admin |
| [time] | [activity] | Meeting / Deep work / Admin |
| [time] | [activity] | Meeting / Deep work / Admin |

**Task Queue** (if time allows):
- [Additional task]
- [Additional task]

**Heads Up:**
- [Conflicts, deadline risks, or items needing attention]

## Quality Criteria
- The plan must be realistic — total scheduled time must not exceed available hours minus buffer
- Top 3 focus must be outcomes ("Complete Q3 budget draft"), not activities ("Work on budget")
- Meeting prep time must be accounted for if the user has important meetings
- The plan must respect the user's stated working hours and break preferences
- Conflicts must be flagged explicitly, with a suggestion for resolution
- Buffer time must be preserved — over-scheduling is worse than under-scheduling

## Feedback Loop
After presenting the plan, ask: "Does this plan look right? Any changes to your schedule or priorities today?"
At end of day (if configured), ask: "How did today go? What carried over to tomorrow?"
Track daily completion rates to improve future planning accuracy.
