# SKILL: Project Updater

## Metadata
- ID: skill_coord_project_updater_002
- Version: 1.0
- Category: Operations
- Generated: 2026-02-25
- Source: Pre-built
- Status: Active
- Quality Score: null
- Usage: 0 activations

## Trigger
User invokes `/project-update` OR user requests a project status update or asks to compile project progress.

## Context Required
- The project name or identifier — REQUIRED
- Progress information: completed work, blockers, metrics, team updates — REQUIRED (provided by user or gathered from context)
- Organizational context: project plan, milestones, stakeholders, success criteria — optional, enables variance analysis
- Personal memory: previous project updates — optional, enables progress tracking
- Project management connector: task completion data, timeline — optional

## Instructions
1. Identify the project and the update audience:
   - **Team update:** Detailed, covers technical progress, blockers, and next sprint
   - **Stakeholder update:** High-level, covers milestones, risks, and decisions needed
   - **Executive update:** Summary-level, covers health, timeline, and escalations
2. Gather progress information from the user's input and any available context:
   - What was accomplished since the last update
   - Current status of key milestones and deliverables
   - Active blockers or risks
   - Changes in scope, timeline, or resources
3. Assess overall project health on a three-level scale:
   - **On Track (green):** Milestones on schedule, no critical blockers, within budget
   - **At Risk (amber):** Some milestones delayed or at risk, manageable blockers, minor scope changes
   - **Off Track (red):** Critical milestones missed, unresolved blockers, significant scope/budget/timeline changes
4. If previous updates are available from personal memory, compare progress:
   - What improved since last update
   - What regressed or stalled
   - Whether previously flagged risks materialized or were mitigated
5. Identify decisions needed from stakeholders and frame them clearly with context and options.
6. Provide a concrete plan for the next reporting period: what will be worked on, key milestones coming up, anticipated blockers.
7. If organizational context includes project success criteria, assess progress against each criterion.

## Output Format
Structured update, max 25 lines. Use this format:

**Project Update: [Project Name]**
**Status:** ON TRACK / AT RISK / OFF TRACK | **Date:** [date]
**Reporting Period:** [from] to [to]

**Progress:**
- [Completed item 1]
- [Completed item 2]

**Milestone Status:**
| Milestone | Target Date | Status |
|-----------|------------|--------|
| [milestone] | [date] | [on track / delayed / complete] |

**Blockers:**
- [Blocker and proposed resolution]

**Risks:**
- [Risk and mitigation plan]

**Decisions Needed:**
- [Decision with context and options]

**Next Period Plan:**
- [Key focus area 1]
- [Key focus area 2]

## Quality Criteria
- Health assessment must be justified by specific evidence, not gut feeling
- Progress items must be concrete deliverables, not activities ("Delivered API v2" not "Worked on API")
- Blockers must include a proposed resolution or escalation path
- Decisions needed must provide enough context for the stakeholder to decide, including options and tradeoffs
- If comparing to previous update, changes must be specific ("Milestone X moved from May 1 to May 15" not "timeline shifted")

## Feedback Loop
After delivering the update, ask: "Is this the right level of detail for your audience? Any items to add or reframe?"
Track the update cadence and audience preferences to streamline future updates.
