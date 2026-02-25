# SKILL: Data Interpreter

## Metadata
- ID: skill_anal_data_interpreter_001
- Version: 1.0
- Category: Analysis
- Generated: 2026-02-25
- Source: Pre-built
- Status: Active
- Quality Score: null
- Usage: 0 activations

## Trigger
User invokes `/interpret-data` OR user shares a dataset, spreadsheet extract, CSV data, or data table for analysis.

## Context Required
- The data to analyze (table, CSV, numbers, chart description) — REQUIRED
- The user's question or analysis goal — REQUIRED (what they want to understand)
- Organizational context: KPIs, targets, benchmarks, strategic priorities — optional, enables comparative analysis
- Historical data or previous analyses from personal memory — optional, enables trend identification

## Instructions
1. Examine the provided data carefully. Identify the data structure: columns, rows, data types, time periods, and units of measurement.
2. Perform an initial data quality check:
   - Flag missing values, obvious outliers, or inconsistencies
   - Note any data limitations that affect the analysis
   - Identify the time range and granularity of the data
3. Address the user's specific question or analysis goal. If no specific question was asked, perform a general exploratory analysis.
4. Identify the most important patterns in the data:
   - **Trends:** Directional movements over time (increasing, decreasing, stable, volatile)
   - **Anomalies:** Data points that deviate significantly from expected patterns
   - **Correlations:** Relationships between different variables in the dataset
   - **Distributions:** How values are spread (concentrated, skewed, uniform)
5. Quantify findings with specific numbers: percentages, growth rates, ratios, or averages. Avoid vague language like "significant increase" — use "23% increase" instead.
6. If organizational context is available, compare findings against known KPIs, targets, or benchmarks.
7. Provide 2-3 actionable insights: what the data suggests the user should do, investigate further, or monitor.
8. If the data is insufficient to answer the user's question, state what additional data would be needed.

## Output Format
Structured analysis, max 25 lines. Use this format:

**Data Overview:** [what the data contains, time range, size]

**Key Findings:**
1. [Finding with specific numbers]
2. [Finding with specific numbers]
3. [Finding with specific numbers]

**Anomalies/Flags:**
- [Any data quality issues or outliers]

**Insights:**
- [Actionable insight 1]
- [Actionable insight 2]

**Data Gaps:** [what additional data would strengthen this analysis, if any]

## Quality Criteria
- Every finding must include a specific number, percentage, or quantified comparison — no vague statements
- Anomalies must be identified with the specific data point and why it is unusual
- Insights must be actionable (suggest a decision or investigation), not merely descriptive
- If the data is too limited for reliable conclusions, say so explicitly rather than over-interpreting
- Never fabricate data points — if a calculation is an estimate, label it as such

## Feedback Loop
After delivering the analysis, ask: "Does this answer your question? Want me to dig deeper into any of these findings?"
Store the user's analysis preferences (level of detail, preferred metrics, common data sources) to improve future interpretations.
