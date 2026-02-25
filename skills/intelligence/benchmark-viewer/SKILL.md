# SKILL: Benchmark Viewer

## Metadata
- ID: skill_intel_benchmark_viewer_002
- Version: 1.0
- Category: Management
- Generated: 2026-02-25
- Source: Pre-built
- Status: Active
- Quality Score: null
- Usage: 0 activations

## Trigger
User invokes `/benchmarks` OR user asks how their team or organization compares against adoption or usage benchmarks.

## Context Required
- Anonymized organizational usage data from aggregation views — REQUIRED (must meet 5-user anonymization threshold)
- Organizational context: company size, industry, team structure — REQUIRED
- User's role and team — REQUIRED (determines which benchmarks are relevant)
- Cross-organization benchmarks (anonymized, aggregate only) — optional, enables external comparison
- Personal memory: previous benchmark reports — optional, enables trend tracking

## Instructions
1. Gather anonymized, aggregate usage data for the user's organization (or team, depending on their role and access level). All data must meet the 5-user anonymization threshold.
2. Calculate key adoption and engagement metrics:
   - **Active user rate:** Percentage of enrolled users who used the assistant at least once in the past 7 days
   - **Skill activation frequency:** Average skill activations per active user per week
   - **Skill diversity:** How many different skills are being used (breadth of adoption)
   - **Feedback rate:** Percentage of skill activations that received user feedback
   - **Positive feedback rate:** Percentage of feedback that was positive
3. Compare against available benchmarks:
   - **Internal trend:** How these metrics compare to previous periods for this organization
   - **Cross-org benchmarks:** How they compare to anonymized aggregates across all Play New organizations (if available and if data meets threshold)
4. Break down metrics by relevant dimensions (only where data meets the 5-user threshold):
   - By skill category: which categories are most/least adopted?
   - By team (if multiple teams have 5+ users each): are there adoption disparities?
   - By time: are metrics improving, stable, or declining?
5. Identify standout metrics — both positive outliers (above benchmark) and areas needing attention (below benchmark).
6. For underperforming areas, suggest possible causes and improvement actions:
   - Low adoption in a category: are the skills relevant? Is the team aware of them?
   - Declining engagement: has something changed? Is there a friction point?
   - Low feedback rate: are users being prompted effectively?
7. Maintain strict anonymization: present only aggregate numbers. If any segment has fewer than 5 users, suppress it and note that it was suppressed.

## Output Format
Structured benchmark report, max 30 lines. Use this format:

**Benchmark Report** | [organization/team] | [reporting period]
**Data basis:** [X] active users | Anonymization: 5-user minimum

**Key Metrics:**
| Metric | Your Org | Trend | Benchmark | Status |
|--------|----------|-------|-----------|--------|
| Active user rate | [X%] | [direction] | [X%] | Above / At / Below |
| Activations/user/week | [X] | [direction] | [X] | Above / At / Below |
| Skill diversity | [X] skills | [direction] | [X] | Above / At / Below |
| Positive feedback | [X%] | [direction] | [X%] | Above / At / Below |

**Top Performing Areas:**
- [Category or metric that exceeds benchmark] — [specific number]

**Needs Attention:**
- [Category or metric below benchmark] — [possible cause and recommended action]

**Suppressed Segments:** [any segments below 5-user threshold]

**Note:** All data is anonymized and aggregated. No individual user behavior is identifiable.

## Quality Criteria
- All metrics must be calculated from aggregate data meeting the 5-user anonymization threshold
- Benchmark comparisons must use appropriate reference points (same industry, similar company size) — not arbitrary averages
- Trend direction must be based on at least 2 data points (current and previous period), not a single snapshot
- Recommendations for underperforming areas must be specific and actionable, not just "improve adoption"
- Suppressed segments must be noted transparently — never imply that all data is being shown if some was suppressed
- The report must never attempt to identify high or low performers individually

## Feedback Loop
After delivering the report, ask: "Are there specific metrics or segments you want me to track more closely?"
Adjust benchmark reporting focus based on the user's priorities and organizational context.
