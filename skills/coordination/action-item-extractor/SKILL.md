# SKILL: Action Item Extractor

## Metadata
- ID: skill_coord_action_item_extractor_005
- Version: 1.0
- Category: Operations
- Generated: 2026-02-25
- Source: Pre-built
- Status: Active
- Quality Score: null
- Usage: 0 activations

## Trigger
User invokes `/actions` OR user shares content (email, meeting notes, document, Slack thread) and asks to extract action items.

## Context Required
- The content to extract action items from (email, notes, transcript, document) — REQUIRED
- Organizational context: team members, roles, project assignments — optional, improves owner attribution
- Personal memory: user's current task list — optional, enables deduplication and integration

## Instructions
1. Read the provided content carefully. Identify all explicit and implicit action items:
   - **Explicit:** Statements that directly assign work ("John will send the report by Friday")
   - **Implicit:** Statements that suggest work needs to happen ("We need to figure out the pricing before launch")
   - **Questions needing answers:** Unresolved questions that someone needs to investigate ("What is the impact on our Q3 numbers?")
2. For each action item, extract:
   - **Task:** A clear, actionable description starting with a verb
   - **Owner:** Who is responsible (use the person's name or role; if unclear, mark as "Owner TBD")
   - **Deadline:** When it is due (use the stated date; if not mentioned, mark as "Deadline TBD")
   - **Context:** One sentence explaining why this task exists or what it relates to
   - **Source:** Where in the content this action item was identified
3. Categorize action items by owner:
   - Items for the user specifically
   - Items for other named individuals
   - Items with no clear owner (need assignment)
4. If personal memory contains the user's current task list, check for duplicates: if an extracted action item matches an existing task, note it rather than creating a duplicate.
5. Flag action items that have dependencies: items that cannot start until another item is completed.
6. If implicit action items are ambiguous, flag them for the user's confirmation rather than making assumptions.
7. Prioritize action items by urgency (deadline-driven) and importance (strategic relevance if organizational context is available).

## Output Format
Structured list, max 25 lines. Use this format:

**Action Items** | Extracted from: [source type] | [count] items found

**Your Action Items:**
- [ ] [Task] | Due: [date or TBD] | Context: [one sentence]
- [ ] [Task] | Due: [date or TBD] | Context: [one sentence]

**Others' Action Items:**
- [ ] [Task] | Owner: [name] | Due: [date or TBD]
- [ ] [Task] | Owner: [name] | Due: [date or TBD]

**Needs Assignment:**
- [ ] [Task] | Due: [date or TBD] | Context: [why this needs doing]

**Dependencies:**
- [Task A] depends on [Task B]

**Implicit (Confirm):**
- [Possible action item that was not explicitly stated — confirm if needed]

## Quality Criteria
- Every action item must start with a verb and be specific enough to act on without re-reading the source
- Owner attribution must be accurate — only attribute when the content clearly assigns responsibility
- Implicit action items must be flagged separately from explicit ones
- Deadlines must only be stated when the source material specifies them; never infer deadlines
- Duplicate detection must match on meaning, not just exact wording

## Feedback Loop
After extracting action items, ask: "Are these accurate? Any items I missed or misattributed? Should I add these to your task tracker?"
Use corrections to improve future extraction accuracy for this user's communication style.
