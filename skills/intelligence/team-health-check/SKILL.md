# SKILL: Team Health Check

## Metadata
- ID: skill_intel_team_health_check_003
- Version: 1.0
- Category: Management
- Generated: 2026-02-25
- Source: Pre-built
- Status: Active
- Quality Score: null
- Usage: 0 activations

## Trigger
User invokes `/team-health` OR system suggests a team health check when aggregate patterns indicate potential team issues.

## Context Required
- Anonymized aggregate team data from pattern_logs (via aggregation views) — REQUIRED (must meet 5-user anonymization threshold)
- Organizational context: team size, structure, current projects, strategic pressures — REQUIRED
- User's role: must be a manager or team lead with appropriate access — REQUIRED
- Personal memory: previous team health reports — optional, enables trend tracking
- Calendar data (aggregate): meeting load, after-hours patterns — optional, enriches the assessment

## Instructions
1. Gather anonymized, aggregate team health indicators. All data must reflect groups of at least 5 users. Never report on individual team members or attempt to identify individuals through narrow segmentation.
2. Assess team health across these dimensions:
   - **Workload balance:** Is skill activation and interaction volume distributed evenly across the team, or concentrated in a few members? Report distribution patterns (e.g., "top quartile handles 60% of activations") without identifying individuals.
   - **Work-life signals:** Are there patterns of after-hours or weekend skill activations? What percentage of activations occur outside standard hours?
   - **Collaboration patterns:** Are team members using cross-functional skills? Is there evidence of siloed work patterns?
   - **Engagement trajectory:** Is overall team engagement (measured by activation frequency) trending up, stable, or declining?
   - **Help-seeking patterns:** Are team members using escalation or decision-support skills more frequently? This may indicate increasing complexity or difficulty.
3. For each dimension, rate the health as:
   - **Healthy:** Metrics within expected ranges, stable or improving
   - **Watch:** Metrics showing early signs of concern, worth monitoring
   - **Concern:** Metrics outside expected ranges, may require intervention
4. If previous health reports exist, compare trends: are health indicators improving, stable, or declining?
5. For any dimension rated "Concern," provide:
   - Specific data supporting the rating
   - Possible causes (present multiple hypotheses)
   - Suggested actions the manager can take (systemic actions, not individual targeting)
6. Provide an overall team health score based on the aggregate of all dimensions.
7. Emphasize: this report reflects aggregate patterns. Individual conversations with team members are the appropriate way to understand specific situations. Never use this data to evaluate or identify individual performance.

## Output Format
Structured health check, max 30 lines. Use this format:

**Team Health Check** | [team name] | [reporting period]
**Team size:** [X] members | **Data basis:** Aggregated, anonymized (5-user minimum)

**Health Dashboard:**
| Dimension | Status | Trend | Key Indicator |
|-----------|--------|-------|---------------|
| Workload balance | Healthy / Watch / Concern | [direction] | [specific aggregate metric] |
| Work-life signals | Healthy / Watch / Concern | [direction] | [specific aggregate metric] |
| Collaboration | Healthy / Watch / Concern | [direction] | [specific aggregate metric] |
| Engagement | Healthy / Watch / Concern | [direction] | [specific aggregate metric] |
| Help-seeking | Healthy / Watch / Concern | [direction] | [specific aggregate metric] |

**Overall Team Health:** Healthy / Watch / Concern

**Areas of Concern:**
- [Dimension]: [specific data] — Possible causes: [hypotheses] — Suggested action: [systemic intervention]

**Positive Signals:**
- [Dimension showing strength]

**Note:** This report uses anonymized aggregate data only. No individual team member can be identified. Use direct conversations, not this data, to understand individual situations.

## Quality Criteria
- Every health indicator must be based on aggregate data meeting the 5-user anonymization threshold
- The report must never enable identification of individual team members, even indirectly
- Status assessments must be backed by specific data, not subjective impressions
- Suggested actions must be systemic (adjust team processes, redistribute work, add resources) — never individual targeting
- The report must explicitly state that it is not a performance evaluation tool
- If the team has fewer than 5 active users, the report should state that insufficient data is available for a reliable assessment

## Feedback Loop
After delivering the check, ask: "Does this match your experience of the team? Are there dimensions I should weight more heavily?"
Track health trends over time to provide increasingly valuable longitudinal insights.
