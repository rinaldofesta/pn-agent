# SKILL: Meeting Prep

## Metadata
- ID: skill_comm_meeting_prep_003
- Version: 1.0
- Category: Communication
- Generated: 2026-02-25
- Source: Pre-built
- Status: Active
- Quality Score: null
- Usage: 0 activations

## Trigger
User invokes `/meeting-prep` with meeting details OR system detects an upcoming meeting within the next 2 hours and user has calendar access enabled.

## Context Required
- Meeting agenda, title, or topic — REQUIRED (provided by user or from calendar)
- List of attendees and their roles — REQUIRED
- Organizational context: team structure, strategic priorities, current initiatives — optional, enriches the brief
- Personal memory: past interactions with attendees, previous meeting outcomes — optional, adds continuity
- Calendar connector: meeting details, recurring meeting history — optional

## Instructions
1. Gather meeting details: title, time, attendees, agenda (from user input or calendar connector).
2. For each attendee, compile a brief profile:
   - Role and team within the organization
   - Recent interactions or shared context from personal memory (if available)
   - Known priorities or concerns relevant to this meeting's topic
3. Analyze the meeting agenda and prepare:
   - **Background context:** What has happened on this topic since the last meeting or recent activity
   - **Key discussion points:** The 3-5 most important items, ranked by strategic impact
   - **Potential questions:** Questions the user should be prepared to answer based on their role
   - **User's talking points:** 2-3 things the user should proactively raise based on organizational priorities
4. If this is a recurring meeting, reference previous meeting outcomes from personal memory and flag any open action items.
5. If the meeting involves external participants, note any relationship context and suggest an appropriate tone or approach.
6. Identify any risks: contentious topics, misaligned expectations, missing information that should be gathered before the meeting.
7. Suggest a time estimate for each agenda item if the agenda has more than 3 items.

## Output Format
Structured brief, max 25 lines. Use this format:

**Meeting:** [title] | [time] | [duration]
**Attendees:** [names and roles, comma-separated]

**Background:**
[2-3 sentences of relevant context]

**Key Discussion Points:**
1. [point] — [why it matters]
2. [point] — [why it matters]
3. [point] — [why it matters]

**Your Talking Points:**
- [what to raise and why]

**Watch For:**
- [risks, sensitivities, or things to prepare]

**Open Items from Last Time:**
- [ ] [if any, from personal memory]

## Quality Criteria
- Brief must be scannable in under 60 seconds — a user should be able to read it while walking to the meeting room
- Each discussion point must include why it matters, not just what it is
- Talking points must be specific to the user's role and current priorities, not generic meeting advice
- Attendee context must reference actual known information, never speculate about attendee intentions
- If calendar data is unavailable, clearly state what was provided manually vs. inferred

## Feedback Loop
After the meeting, ask: "How did the meeting go? Any topics I should track for next time?"
Store outcomes and action items to improve future prep for recurring meetings with the same attendees.
