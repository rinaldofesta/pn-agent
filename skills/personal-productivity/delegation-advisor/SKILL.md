# SKILL: Delegation Advisor

## Metadata
- ID: skill_prod_delegation_advisor_003
- Version: 1.0
- Category: Management
- Generated: 2026-02-25
- Source: Pre-built
- Status: Active
- Quality Score: null
- Usage: 0 activations

## Trigger
User invokes `/delegate` OR user expresses feeling overwhelmed or asks for help deciding what to hand off to others.

## Context Required
- The user's current task list and commitments — REQUIRED
- Organizational context: team members, their roles, capabilities, and current workload — REQUIRED
- The user's role and core responsibilities — optional, helps distinguish between delegatable and essential work
- Personal memory: past delegation outcomes, team member strengths — optional, improves recommendations
- Strategic priorities: what work is most important for the user personally to handle — optional

## Instructions
1. Review the user's current task list and categorize each item by delegation potential:
   - **Must do personally:** Tasks that require the user's specific authority, judgment, or expertise (e.g., performance reviews, strategic decisions, key stakeholder relationships)
   - **Could delegate with oversight:** Tasks that someone else could do with guidance and check-ins
   - **Should delegate:** Tasks below the user's role level that are consuming time better spent elsewhere
   - **Already delegated:** Tasks that are assigned to others but the user is still involved — check if they are over-managing
2. For items recommended for delegation, suggest:
   - **Who:** The best team member based on skills, capacity, and development goals
   - **How:** Level of delegation: full ownership, do with check-ins, do with final review
   - **Briefing:** What context the delegate needs to succeed
   - **Timeline:** When to delegate and when to expect delivery
3. Apply the delegation decision framework:
   - Is this a growth opportunity for someone on the team?
   - Does the quality need to be "perfect" or is "good enough" acceptable?
   - Is the time investment in briefing less than doing the task yourself?
   - Is there someone who could do this 80% as well?
4. Flag common delegation traps the user may be falling into:
   - Delegating tasks but not authority
   - Over-checking delegated work (micromanaging)
   - Only delegating unpleasant tasks (demoralizing for the team)
   - Not delegating because "it's faster to do it myself" (short-term thinking)
5. Estimate time recovered: how many hours per week the user would reclaim by delegating the recommended items.
6. If personal memory contains past delegation outcomes, reference what worked and what did not.

## Output Format
Structured advice, max 25 lines. Use this format:

**Delegation Review** | [count] tasks reviewed

**Keep (Do Personally):**
- [Task] — Why: [specific reason this requires you]

**Delegate:**
| Task | To Whom | How | Est. Time Saved |
|------|---------|-----|----------------|
| [task] | [person] | [full / with check-ins / with review] | [hours/week] |
| [task] | [person] | [full / with check-ins / with review] | [hours/week] |

**Briefing Needed:**
- [Task to delegate]: [key context the delegate needs]

**Delegation Traps to Watch:**
- [Pattern you may be falling into]

**Estimated Time Recovered:** [X] hours per week

## Quality Criteria
- Delegation recommendations must consider the delegate's actual capacity, not just their skills
- "Keep personally" items must have specific justification — not just comfort or habit
- Time savings estimates must be realistic, accounting for briefing and oversight time
- The advisor must be honest about over-managing patterns without being judgmental
- Recommendations must consider team development, not just task completion

## Feedback Loop
After presenting advice, ask: "Do these delegation suggestions feel right? Are there team constraints I should know about?"
Track delegation outcomes to learn which team members excel at which types of work.
