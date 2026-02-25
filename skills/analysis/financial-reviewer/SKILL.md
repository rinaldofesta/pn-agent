# SKILL: Financial Reviewer

## Metadata
- ID: skill_anal_financial_reviewer_005
- Version: 1.0
- Category: Analysis
- Generated: 2026-02-25
- Source: Pre-built
- Status: Active
- Quality Score: null
- Usage: 0 activations

## Trigger
User invokes `/review-financials` OR user shares financial data (P&L, budget vs. actual, cash flow statement, expense report, financial projections).

## Context Required
- Financial data to review (report, spreadsheet extract, budget, projections) — REQUIRED
- The user's specific question or concern about the financials — optional (if not provided, do a comprehensive review)
- Organizational context: budget targets, fiscal year calendar, financial KPIs — optional, enables variance analysis
- Previous financial data from personal memory — optional, enables period-over-period comparison
- Industry benchmarks for financial ratios — optional, enables competitive comparison

## Instructions
1. Read the financial data carefully. Identify the type (P&L, balance sheet, cash flow, budget vs. actual, projection, expense report), the time period, and the currency/units.
2. Perform a structural review:
   - Verify that totals add up where checkable
   - Identify the largest line items by absolute value
   - Note any unusual categorizations or missing standard categories
3. Analyze the financial performance:
   - **Revenue/income:** Growth rate, composition, concentration risks
   - **Costs/expenses:** Largest categories, trends, ratio to revenue
   - **Margins:** Gross margin, operating margin, net margin and their trends
   - **Cash flow:** Operating cash flow vs. net income, burn rate if applicable
4. Identify variances and anomalies:
   - Items that deviate more than 10% from budget, target, or prior period
   - Unexpected line items or one-time charges
   - Trends that diverge from the organizational trajectory
5. If organizational financial KPIs are available, assess performance against each target.
6. If previous period data is available from personal memory, provide period-over-period comparison with specific percentage changes.
7. Provide 3-5 specific observations: what looks strong, what needs attention, and what requires investigation.
8. If the data contains projections, assess the assumptions and flag optimistic or pessimistic elements.

## Output Format
Structured review, max 30 lines. Use this format:

**Financial Review:** [type of report] | [period] | [currency]

**Headline:** [one-sentence summary of financial health]

**Key Metrics:**
| Metric | Value | vs. Target/Prior | Status |
|--------|-------|-----------------|--------|
| [metric] | [value] | [variance] | [on track / needs attention / at risk] |

**Variances Requiring Attention:**
1. [Line item]: [actual] vs. [expected] ([% variance]) — [likely cause if identifiable]
2. [Line item]: [actual] vs. [expected] ([% variance]) — [likely cause if identifiable]

**Observations:**
- [Strong point with evidence]
- [Concern with evidence]
- [Item needing investigation]

**Recommended Actions:**
- [Specific action based on the findings]

## Quality Criteria
- Every metric must include the actual number, not just qualitative assessments
- Variance analysis must flag items over 10% deviation and explain the likely driver
- Never fabricate financial figures — if data is incomplete, state what is missing
- Recommendations must be tied to specific findings in the data, not generic financial advice
- If assumptions are questionable (in projections), state the specific concern
- Units and currency must be clearly stated throughout

## Feedback Loop
After delivering the review, ask: "Is this the right level of detail? Are there specific line items or metrics you want me to focus on?"
Track which financial metrics the user prioritizes to tailor future reviews.
