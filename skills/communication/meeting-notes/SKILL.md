# SKILL: Meeting Notes

## Metadata
- ID: skill_comm_meeting_notes_004
- Version: 1.0
- Category: Communication
- Generated: 2026-02-25
- Source: Pre-built
- Status: Active
- Quality Score: null
- Usage: 0 activations

## Trigger
User invokes `/meeting-notes` OR user pastes or forwards meeting transcript, recording summary, or raw notes.

## Context Required
- Meeting transcript, recording summary, or raw notes — REQUIRED
- Meeting agenda (if available) — optional, helps structure the notes against planned topics
- Attendee list and roles — optional, improves attribution
- Organizational context: strategic priorities, project timelines — optional, helps connect decisions to broader goals
- Personal memory: previous meetings on same topic — optional, adds continuity

## Instructions
1. Read the provided meeting content (transcript, summary, or raw notes) in full.
2. Identify all participants who spoke and their roles (from content or organizational context).
3. Extract and organize the following:
   - **Decisions made:** Concrete decisions reached during the meeting, with who made or approved them
   - **Action items:** Tasks assigned, with owner and deadline (if mentioned). If no deadline was stated, flag it as "deadline TBD"
   - **Key discussion points:** The substantive topics covered, summarized to their essential argument or outcome
   - **Open questions:** Items raised but not resolved, needing follow-up
   - **Parking lot:** Topics mentioned but deferred to a future discussion
4. If an agenda was provided, map notes back to agenda items and flag any agenda items that were not covered.
5. Connect decisions and action items to organizational strategic priorities where relevant.
6. If personal memory contains previous meetings on the same topic, note any progress or changes in direction.
7. Highlight any risks or concerns raised during the meeting that may need escalation.

## Output Format
Structured notes, max 35 lines. Use this format:

**Meeting:** [title/topic] | [date]
**Attendees:** [list]

**Decisions:**
1. [Decision] — approved by [who]
2. [Decision] — approved by [who]

**Action Items:**
- [ ] [Task] — Owner: [name] | Due: [date or TBD]
- [ ] [Task] — Owner: [name] | Due: [date or TBD]

**Key Discussion:**
- [Topic]: [Summary of discussion and outcome]
- [Topic]: [Summary of discussion and outcome]

**Open Questions:**
- [Question needing follow-up]

**Parking Lot:**
- [Deferred topic]

## Quality Criteria
- Every action item must have an owner; if unclear from the content, flag as "Owner: unclear — needs confirmation"
- Decisions must be stated as outcomes, not as discussion summaries ("We will launch in Q3" not "We discussed the launch timeline")
- Notes must not include verbatim transcript — they must be synthesized and concise
- Attribution must be accurate; never attribute a statement to someone who did not make it
- If meeting content is ambiguous, note the ambiguity rather than guessing

## Feedback Loop
After delivering the notes, ask: "Are these accurate? Any corrections or items I missed?"
Store corrections to improve future note-taking for this meeting series.
