# SKILL: OKR Tracker

## Metadata
- ID: skill_strat_okr_tracker_005
- Version: 1.0
- Category: Strategy
- Generated: 2026-02-25
- Source: Pre-built
- Status: Active
- Quality Score: null
- Usage: 0 activations

## Trigger
User invokes `/okr-check` OR user asks about OKR progress, goal tracking, or quarterly objective status.

## Context Required
- The user's OKRs or goals (objectives with key results, targets, and timelines) — REQUIRED
- Current progress data for each key result — REQUIRED (from user input or connected systems)
- Organizational context: company-level OKRs, team OKRs, quarter timeline — optional, enables alignment view
- Personal memory: OKR progress history from previous check-ins — optional, enables trajectory analysis
- Calendar: quarter end date and review dates — optional

## Instructions
1. Identify the user's current OKRs. If they are not stored in personal memory, ask the user to provide them on first use and store for future tracking.
2. For each Objective, assess the Key Results:
   - **Current value:** Where the metric stands today
   - **Target value:** What the goal is for the period
   - **Progress percentage:** Current / Target as a percentage
   - **Trajectory:** Based on current rate of progress, will this be achieved by the deadline? (On track, at risk, off track)
3. Calculate time-adjusted progress:
   - What percentage of the quarter has elapsed?
   - Is progress ahead of, on pace with, or behind the time-adjusted target?
   - Example: At 50% through the quarter, a KR at 40% completion is behind pace
4. For Key Results that are off track, diagnose the likely cause:
   - Insufficient effort or attention
   - External blockers or dependencies
   - The target was too ambitious
   - The metric is a lagging indicator and effort has not yet shown results
5. Provide specific recommendations for each off-track Key Result:
   - Accelerate: What specific actions could close the gap?
   - Adjust: Should the target be revised based on new information?
   - Escalate: Does this need leadership attention or additional resources?
6. If organizational OKRs are available, show how the user's OKRs connect to company-level objectives and flag any alignment gaps.
7. Compare to the previous check-in (if available) and note momentum: improving, declining, or stable for each KR.

## Output Format
Structured OKR review, max 30 lines. Use this format:

**OKR Check-in** | [quarter] | Week [X] of [Y] | [X%] of quarter elapsed

**Objective 1: [Objective Statement]**
| Key Result | Current | Target | Progress | Trajectory |
|-----------|---------|--------|----------|------------|
| [KR1] | [value] | [value] | [X%] | On Track / At Risk / Off Track |
| [KR2] | [value] | [value] | [X%] | On Track / At Risk / Off Track |

**Objective 2: [Objective Statement]**
| Key Result | Current | Target | Progress | Trajectory |
|-----------|---------|--------|----------|------------|
| [KR1] | [value] | [value] | [X%] | On Track / At Risk / Off Track |

**Off-Track Items:**
- [KR]: [diagnosis] — Recommendation: [specific action]

**Momentum vs. Last Check-in:**
- [KR]: [improving / declining / stable]

**Overall:** [X] of [Y] Key Results on track | Quarter health: [assessment]

## Quality Criteria
- Progress percentages must be calculated from actual data, not estimated
- Trajectory must account for time elapsed, not just absolute progress
- Diagnoses for off-track items must be specific, not just "needs more effort"
- Recommendations must be actionable within the user's control
- If data for a Key Result is unavailable, state it explicitly rather than guessing
- The overall assessment must be honest — if the quarter is not going well, say so

## Feedback Loop
After the check-in, ask: "Are these numbers current? Any Key Results that need updated targets or new action plans?"
Store progress data to build trajectory over time and improve future check-ins.
