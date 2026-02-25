# SKILL: Skill Gap Identifier

## Metadata
- ID: skill_intel_skill_gap_identifier_005
- Version: 1.0
- Category: Management
- Generated: 2026-02-25
- Source: Pre-built
- Status: Active
- Quality Score: null
- Usage: 0 activations

## Trigger
User invokes `/skill-gaps` OR system generates a periodic skill gap report (monthly, configurable) for advisors and organizational leaders.

## Context Required
- Anonymized organizational skill usage data from aggregation views — REQUIRED (must meet 5-user anonymization threshold)
- Available skill library: all skills and their categories — REQUIRED
- Organizational context: team roles, strategic priorities, industry vertical — REQUIRED
- User's role: must be an advisor, manager, or organizational leader with appropriate access — REQUIRED
- Cross-organization skill adoption benchmarks (anonymized, aggregate only) — optional, enables comparison
- Personal memory: previous skill gap reports — optional, enables trend tracking

## Instructions
1. Analyze anonymized, aggregate skill adoption data across the organization. All data must meet the 5-user anonymization threshold.
2. Identify adoption gaps by comparing skill usage against expectations:
   - **Role-based gaps:** Skills that are expected for a role category (per the skill assignment matrix) but are not being used. Example: sales team members are not using pipeline-risk-scan.
   - **Category gaps:** Entire skill categories with low adoption. Example: Strategy skills have 5% adoption while Communication skills have 80%.
   - **Capability gaps:** Tasks that users are requesting (through ad-hoc messages to the assistant) that no existing skill addresses. Example: users frequently ask for help with vendor negotiations, but no vendor negotiation skill exists.
   - **Maturity gaps:** Skills where usage exists but feedback is consistently negative, suggesting the skill needs improvement.
3. For each identified gap, assess:
   - **Size:** How many users are affected (aggregate count)?
   - **Impact:** What productivity or value is being lost due to this gap?
   - **Cause hypothesis:** Why does this gap exist? Possibilities include:
     - Users do not know the skill exists (awareness problem)
     - Users tried the skill but found it unhelpful (quality problem)
     - The skill exists but does not match the actual use case (relevance problem)
     - No skill exists for this need (library gap)
   - **Priority:** How important is closing this gap given organizational strategic priorities?
4. Generate recommendations for closing each priority gap:
   - **Awareness gaps:** Recommend skill introduction or training
   - **Quality gaps:** Recommend skill refinement based on specific negative feedback patterns
   - **Relevance gaps:** Recommend skill adjustment or new skill creation
   - **Library gaps:** Recommend new skill development with a preliminary specification
5. If cross-organization benchmarks are available, flag where this organization's adoption significantly lags peers.
6. If previous reports exist, track whether previously identified gaps have been addressed and what impact the interventions had.
7. Maintain strict anonymization: report only aggregate adoption rates and pattern counts.

## Output Format
Structured gap analysis, max 35 lines. Use this format:

**Skill Gap Report** | [organization] | [reporting period]
**Data basis:** [X] users | [Y] skills in library | Anonymization: 5-user minimum

**Adoption Overview:**
| Category | Skills Available | Adoption Rate | Trend |
|----------|-----------------|---------------|-------|
| [category] | [count] | [X%] | [direction] |
| [category] | [count] | [X%] | [direction] |

**Priority Gaps:**

1. **[Gap name]** | Type: [Role/Category/Capability/Maturity] | Impact: HIGH/MEDIUM/LOW
   - Evidence: [aggregate data supporting the gap]
   - Likely cause: [hypothesis]
   - Recommendation: [specific action]

2. **[Gap name]** | Type: [type] | Impact: [level]
   - Evidence: [aggregate data]
   - Likely cause: [hypothesis]
   - Recommendation: [specific action]

**Requested Capabilities Not in Library:**
- [Capability users are requesting that has no corresponding skill]

**Progress on Previous Gaps:**
- [Gap from last report]: [closed / improving / unchanged]

**Note:** All data is anonymized and aggregated. No individual user adoption patterns are identifiable.

## Quality Criteria
- Adoption rates must be calculated from aggregate data meeting the 5-user threshold
- Gap identification must distinguish between awareness, quality, relevance, and library gaps — each requires a different response
- Recommendations must be specific to the gap type, not generic "improve training" advice
- Capability gaps (unmet needs) are the most valuable finding — prioritize identifying what users need that does not exist
- The report must not shame teams or individuals for low adoption — frame gaps as opportunities, not failures
- Cross-organization comparisons must use appropriate peer groups (same industry, similar size)

## Feedback Loop
After delivering the report, ask: "Do these gaps match what you're seeing? Are there specific teams or skill areas you want me to investigate more deeply?"
Track gap closure over time to measure the effectiveness of interventions.
