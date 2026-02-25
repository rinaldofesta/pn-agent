# SKILL: Task Tracker

## Metadata
- ID: skill_coord_task_tracker_001
- Version: 1.0
- Category: Operations
- Generated: 2026-02-25
- Source: Pre-built
- Status: Active
- Quality Score: null
- Usage: 0 activations

## Trigger
User invokes `/task-track` OR user asks to add, update, list, or review their tracked tasks.

## Context Required
- Task details: description, priority, deadline, owner — REQUIRED (for adding/updating tasks)
- Personal memory: previously tracked tasks and their status — REQUIRED (for listing/reviewing)
- Organizational context: project timelines, team assignments, sprint cycles — optional, improves prioritization
- Calendar connector: upcoming deadlines and meetings — optional, enables scheduling context

## Instructions
1. Determine the user's intent:
   - **Add task:** User wants to track a new task. Extract: description, priority (P1/P2/P3), deadline, owner, and project/context.
   - **Update task:** User wants to change status, priority, or deadline of an existing task. Identify which task and what changed.
   - **List tasks:** User wants to see their current task list. Determine filtering and sorting preferences.
   - **Review tasks:** User wants an assessment of their task load and priorities. Provide analysis.
2. For adding tasks:
   - Parse the task description into a clear, actionable statement starting with a verb
   - If no priority is stated, infer from deadline urgency and context (flag the inference)
   - If no deadline is stated, ask the user or mark as "no deadline"
   - Store the task in personal memory with timestamp
3. For updating tasks:
   - Match the user's description to an existing tracked task
   - Update the specified field(s)
   - If the task is marked complete, archive it and note the completion date
4. For listing tasks:
   - Sort by priority (P1 first), then by deadline (soonest first)
   - Group by project or context if the user has tasks across multiple areas
   - Show overdue tasks at the top with a flag
5. For reviewing tasks:
   - Count tasks by priority and status
   - Flag overdue items and items due within the next 48 hours
   - Identify potential conflicts (overlapping deadlines, too many P1 items)
   - Suggest reprioritization if the task load seems unsustainable (more than 5 P1 items)
6. If organizational context is available, connect tasks to project milestones and flag alignment issues.

## Output Format
Varies by intent. Max 25 lines.

**For task list:**
**Your Tasks** | [count] active | [count] overdue

**Overdue:**
- [task] | P[X] | Due: [date] | [owner]

**Due Soon (48h):**
- [task] | P[X] | Due: [date] | [owner]

**Upcoming:**
- [task] | P[X] | Due: [date] | [owner]

**For task added:**
Added: "[task]" | P[X] | Due: [date]
You now have [count] active tasks ([count] P1).

**For review:**
**Task Review** | [date]
- Active: [count] | Overdue: [count] | Due this week: [count]
- P1: [count] | P2: [count] | P3: [count]
- [Assessment and recommendations]

## Quality Criteria
- Task descriptions must be actionable statements starting with a verb ("Review Q3 budget", not "Q3 budget")
- Priority must be explicitly stated or clearly inferred with reasoning
- Overdue tasks must always appear prominently, never buried in a list
- Task matching (for updates) must confirm the right task before modifying — if ambiguous, ask
- The review must provide an honest assessment of task load, including when it is unsustainable

## Feedback Loop
After each interaction, confirm the action taken: "I've added/updated/listed your tasks. Anything to adjust?"
Continuously refine task tracking based on the user's organizational patterns and priorities.
