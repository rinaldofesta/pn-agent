# SKILL: Pattern Reporter

## Metadata
- ID: skill_intel_pattern_reporter_001
- Version: 1.0
- Category: Management
- Generated: 2026-02-25
- Source: Pre-built
- Status: Active
- Quality Score: null
- Usage: 0 activations

## Trigger
User invokes `/org-patterns` OR system generates a periodic pattern report (weekly, configurable) for users with appropriate access.

## Context Required
- Anonymized organizational pattern data from pattern_logs (via aggregation views) — REQUIRED
- Organizational context: team structure, strategic priorities, current initiatives — REQUIRED
- User's role and access level — REQUIRED (pattern reports are only available to managers and above)
- Personal memory: previous pattern reports — optional, enables trend-of-trends analysis

## Instructions
1. Query the anonymized organizational pattern views. All data must meet the 5-user anonymization threshold: no pattern is reported unless it reflects behavior from at least 5 distinct users. Never attempt to identify or narrow down individual contributors.
2. Identify the top organizational patterns from the reporting period:
   - **Communication patterns:** Are teams communicating more or less? Are there cross-team communication gaps? Are escalations increasing?
   - **Skill usage patterns:** Which skills are most/least used? Are certain categories being adopted while others are ignored?
   - **Work patterns:** Are workload levels balanced across teams? Are there signs of burnout (after-hours activity, weekend work)?
   - **Content patterns:** What topics are employees bringing to their assistants most frequently? Are there emerging themes?
3. For each identified pattern, provide:
   - **What the data shows:** The aggregate finding with specific numbers (e.g., "72% of skill activations this week were in the Communication category")
   - **What it might mean:** Possible interpretations (always present multiple hypotheses)
   - **What to investigate:** Suggested follow-up if this pattern is concerning or interesting
4. Flag patterns that may indicate organizational risks:
   - Sudden spikes in escalation-related skill usage
   - Declining engagement (fewer skill activations across users)
   - Concentration of workload in specific teams
   - Topics appearing that suggest employee concerns
5. Compare with previous pattern reports to identify trajectory: are patterns new, recurring, or fading?
6. Maintain strict anonymization throughout: report only aggregate counts and percentages. If a pattern involves fewer than 5 users, suppress it entirely.
7. Frame insights as observations for investigation, not conclusions: "This pattern suggests X, which may be worth exploring" not "The team is doing X because Y."

## Output Format
Structured pattern report, max 30 lines. Use this format:

**Organizational Pattern Report** | [reporting period]
**Data basis:** [X] users | [Y] skill activations | Anonymization: 5-user minimum

**Top Patterns:**

1. **[Pattern Name]** | [category]
   - Data: [aggregate finding with numbers]
   - Interpretation: [what this might mean — multiple hypotheses]
   - Suggested action: [what to investigate]

2. **[Pattern Name]** | [category]
   - Data: [aggregate finding with numbers]
   - Interpretation: [what this might mean]
   - Suggested action: [what to investigate]

**Emerging Signals:**
- [New pattern that has appeared recently but not yet established]

**Risk Flags:**
- [Pattern that may indicate an organizational risk]

**Trend vs. Last Period:**
- [How this period compares to the previous one]

**Note:** All data is anonymized and aggregated. No individual user behavior is identifiable. Patterns reflect groups of 5+ users.

## Quality Criteria
- Every data point must come from aggregated views meeting the 5-user anonymization threshold — no exceptions
- Patterns must be presented with multiple possible interpretations, never a single definitive explanation
- Risk flags must be evidence-based, not speculative
- The report must never suggest investigating or identifying individual users
- Interpretations must frame patterns as signals for investigation, not established facts
- If data is insufficient to report on a category (fewer than 5 users), state that it was suppressed due to anonymization rules

## Feedback Loop
After delivering the report, ask: "Are any of these patterns surprising or worth investigating further? Which areas should I prioritize in next week's report?"
Adjust reporting focus based on what the user finds most valuable.
