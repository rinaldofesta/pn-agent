# SKILL: Focus Guard

## Metadata
- ID: skill_prod_focus_guard_002
- Version: 1.0
- Category: Management
- Generated: 2026-02-25
- Source: Pre-built
- Status: Active
- Quality Score: null
- Usage: 0 activations

## Trigger
User invokes `/focus` OR user starts a focus session OR user reports being distracted or overwhelmed during work.

## Context Required
- The task or project the user wants to focus on — REQUIRED
- The user's daily plan or current priorities — optional, provides context for what matters
- Calendar: upcoming meetings that would interrupt the focus session — optional, helps set realistic focus windows
- Personal memory: user's typical focus patterns, distraction triggers, productive session lengths — optional, improves advice

## Instructions
1. Identify what the user wants to focus on and estimate the required focus time.
2. Assess the available focus window:
   - When is the next meeting or commitment?
   - How much uninterrupted time is available?
   - Is this enough time for meaningful progress on the stated task?
3. Create a focus session plan:
   - **Session scope:** Exactly what to work on during this block (narrow the scope to fit the available time)
   - **Success criteria:** What "done" looks like for this session (specific, achievable within the window)
   - **Breakpoints:** If the session is longer than 90 minutes, suggest natural break points
4. Identify and preempt likely distractions:
   - Flag incoming messages or requests that are not urgent and can wait
   - Suggest what to do about pending tasks that might create mental load ("Your report is due Friday — parking that for now")
   - If the user has a pattern of getting pulled into specific types of distractions, acknowledge it
5. Provide a refocusing prompt for when the user gets distracted:
   - "Your current focus: [task]. You have [X] minutes remaining. Next step: [specific action]."
6. At the end of the focus window (or when the user checks in):
   - Summarize what was accomplished during the session
   - Capture any notes or decisions made
   - Suggest next steps for continuing the work
7. If the focus task connects to the daily plan, update progress accordingly.

## Output Format
Concise message, max 15 lines. Use this format:

**Focus Session** | [duration] until [end time]

**Working on:** [specific task scoped to this session]
**Goal for this session:** [what "done" looks like]

**Distractions to ignore:**
- [Pending item that can wait]
- [Request that is not urgent]

**Refocus reminder:**
> Your current task: [task]. Next step: [specific action].

**Session ends at [time]** — I'll check in then.

## Quality Criteria
- The session scope must be narrow enough to make meaningful progress within the available time
- Success criteria must be specific and achievable, not aspirational
- Distraction triage must distinguish between truly urgent interruptions and ones that can wait
- The refocus prompt must include a specific next action, not just the general task name
- Focus windows must respect calendar commitments — never suggest ignoring a meeting

## Feedback Loop
At the end of the session, ask: "Did you achieve your focus goal? What pulled you off track (if anything)?"
Track focus session completion rates and common distractions to improve future session planning.
