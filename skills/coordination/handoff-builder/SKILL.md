# SKILL: Handoff Builder

## Metadata
- ID: skill_coord_handoff_builder_004
- Version: 1.0
- Category: Operations
- Generated: 2026-02-25
- Source: Pre-built
- Status: Active
- Quality Score: null
- Usage: 0 activations

## Trigger
User invokes `/handoff` OR user requests to create a handoff document for transitioning work to another person.

## Context Required
- The work being handed off: project, task, responsibility, or role — REQUIRED
- The recipient of the handoff — REQUIRED (name and role)
- Current status and context of the work — REQUIRED
- Personal memory: history of work on this topic, decisions made, lessons learned — optional, enriches the handoff
- Organizational context: relevant stakeholders, processes, tools — optional, improves completeness
- Open tasks and deadlines related to this work — optional (from task tracker)

## Instructions
1. Identify the handoff type:
   - **Project handoff:** Full transfer of project ownership (most comprehensive)
   - **Task handoff:** Transferring a specific task or set of tasks
   - **Coverage handoff:** Temporary coverage during vacation/leave (focus on urgent items and contacts)
   - **Role transition:** Transitioning a role or responsibility permanently
2. Compile the handoff document with these sections:
   - **Overview:** What is being handed off and why, in 2-3 sentences
   - **Current status:** Where things stand right now — what is done, what is in progress, what is not started
   - **Key contacts:** People the recipient will need to work with, their roles, and their preferred communication method
   - **Open items:** Tasks, decisions, and commitments that need attention, with deadlines
   - **Critical context:** Decisions that were made and why, tribal knowledge, known pitfalls, workarounds
   - **Recurring responsibilities:** Regular tasks, meetings, or check-ins that come with this work
   - **Access and tools:** Systems, tools, documents, and access the recipient will need
   - **Escalation path:** Who to contact if something goes wrong or a decision needs to be made
3. Prioritize open items by urgency: what needs attention in the first 48 hours, first week, and first month.
4. Include "watch for" items: situations or triggers the recipient should be aware of that may not be obvious.
5. If personal memory contains relevant history, include key decisions and their rationale — this prevents the recipient from re-litigating settled issues.
6. If this is a coverage handoff, focus on: what is time-sensitive, who might reach out, and what can wait.
7. Flag any items where the recipient may need additional context or training beyond what the handoff provides.

## Output Format
Structured handoff document, max 40 lines. Use this format:

**Handoff: [Work/Project Name]**
**From:** [user] **To:** [recipient] | **Date:** [date]
**Type:** [Project / Task / Coverage / Role Transition]

**Overview:**
[2-3 sentences on what and why]

**Current Status:**
- [Status of key work streams]

**Priority Items (First 48 Hours):**
1. [Urgent item with context]
2. [Urgent item with context]

**Open Items:**
- [ ] [Task] | Due: [date] | Context: [brief]
- [ ] [Task] | Due: [date] | Context: [brief]

**Key Contacts:**
| Person | Role | When to Contact |
|--------|------|----------------|
| [name] | [role] | [situation] |

**Critical Context:**
- [Decision/knowledge that the recipient needs]

**Watch For:**
- [Non-obvious trigger or situation]

**Access Needed:**
- [System/tool/document access]

## Quality Criteria
- Open items must each have enough context for the recipient to act without asking the original owner
- Key contacts must include when and why to contact each person, not just a name list
- Critical context must explain the "why" behind decisions, not just the "what"
- Coverage handoffs must clearly distinguish between time-sensitive items and items that can wait
- The handoff must be self-contained — the recipient should not need to chase the original owner for basic questions

## Feedback Loop
After generating the handoff, ask: "Is this complete enough for [recipient] to pick up without questions? Any context I should add?"
If the user has used the handoff builder before, apply their preferred level of detail and formatting.
