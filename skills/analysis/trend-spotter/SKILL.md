# SKILL: Trend Spotter

## Metadata
- ID: skill_anal_trend_spotter_004
- Version: 1.0
- Category: Analysis
- Generated: 2026-02-25
- Source: Pre-built
- Status: Active
- Quality Score: null
- Usage: 0 activations

## Trigger
User invokes `/trends` OR system detects that the user has accumulated enough content over the past 30 days to surface meaningful patterns.

## Context Required
- Personal memory: accumulated content shared by the user over the past 30-90 days — REQUIRED (this skill relies on longitudinal data)
- A focus area or question from the user — optional (if not provided, scan across all accumulated content)
- Organizational context: strategic priorities, industry vertical, market position — optional, helps filter for relevance
- Previous trend reports from personal memory — optional, enables trend-of-trends analysis

## Instructions
1. Review the user's accumulated content from the past 30-90 days: forwarded emails, shared reports, meeting notes, data analyses, and other interactions.
2. Identify recurring themes, topics, or patterns that appear across multiple pieces of content:
   - Topics mentioned repeatedly across different contexts
   - Metrics that are consistently moving in one direction
   - Concerns or questions that keep surfacing
   - Changes in language or emphasis over time
3. Categorize each identified trend:
   - **Emerging:** Appeared recently and is gaining frequency (mentioned in 3+ separate contexts in the last 2 weeks)
   - **Established:** Consistent pattern over 30+ days
   - **Fading:** Previously prominent but declining in frequency
4. For each trend, provide:
   - **Evidence:** Specific references to the content where this pattern appears (dates and context, not raw content)
   - **Trajectory:** Direction and velocity — is it accelerating, steady, or slowing?
   - **Significance:** Why this matters for the user's role and organizational priorities
5. If organizational strategic context is available, flag trends that align with or diverge from strategic priorities.
6. Identify any trends that the user may not have noticed because they span different contexts (e.g., a theme appearing in both client emails and internal reports).
7. Suggest 2-3 trends worth investigating further and what questions to ask.

## Output Format
Structured report, max 30 lines. Use this format:

**Trend Report** | Based on [X] items from [date range]

**Emerging Trends:**
1. **[Trend name]** (appeared [X] times in [Y] weeks)
   - Evidence: [brief references]
   - Significance: [why it matters]

**Established Patterns:**
1. **[Pattern name]** (consistent over [timeframe])
   - Evidence: [brief references]
   - Trajectory: [direction]

**Fading Topics:**
- [Topic that was previously prominent but is declining]

**Worth Investigating:**
- [Trend to dig into and why]

## Quality Criteria
- Every trend must be supported by at least 3 distinct content references — no single-occurrence items
- Trends must span multiple contexts (not just "you got 5 emails about the same topic")
- Trajectory assessment must be based on frequency and recency, not speculation
- The report must distinguish between organizational trends and personal workload patterns
- If insufficient content has been accumulated for meaningful trend analysis, state that clearly rather than forcing weak patterns

## Feedback Loop
After delivering the report, ask: "Are any of these trends surprising? Which ones should I keep tracking?"
Use the user's response to prioritize which trends to monitor and surface proactively in future reports.
