# SKILL: Report Analyzer

## Metadata
- ID: skill_anal_report_analyzer_002
- Version: 1.0
- Category: Analysis
- Generated: 2026-02-25
- Source: Pre-built
- Status: Active
- Quality Score: null
- Usage: 0 activations

## Trigger
User invokes `/analyze-report` OR user forwards or pastes a report (financial report, project update, market research, operational review) for analysis.

## Context Required
- The report content (text, forwarded document, or pasted content) — REQUIRED
- The user's specific question about the report — optional (if not provided, do a comprehensive review)
- Organizational context: strategic priorities, KPIs, industry benchmarks — optional, enables relevance assessment
- Personal memory: previous reports on the same topic — optional, enables trend comparison

## Instructions
1. Read the entire report carefully. Identify the report type (financial, operational, market research, project status, compliance, etc.), author, date, and scope.
2. Extract the report's core findings:
   - **Thesis or main conclusion:** What is the report's primary message?
   - **Supporting evidence:** What data or arguments support the thesis?
   - **Key metrics:** Extract the 5-7 most important numbers with their context
3. Assess the report's quality and completeness:
   - Are conclusions supported by the evidence presented?
   - Are there gaps in the data or analysis?
   - Are there unstated assumptions?
   - Is there contradictory information?
4. Identify the implications for the user's organization:
   - What decisions does this report inform?
   - What risks does it highlight?
   - What opportunities does it suggest?
5. If organizational strategic priorities are available, map the report's findings to current priorities: which goals does this support, which does it challenge?
6. If personal memory contains previous reports on the same topic, compare findings and note changes or trends.
7. Provide a recommendation: what the user should do with this information (share with specific stakeholders, investigate further, take action, file for reference).

## Output Format
Structured analysis, max 25 lines. Use this format:

**Report:** [title/type] | [author] | [date]

**Core Message:** [one sentence]

**Key Metrics:**
- [metric]: [value] — [context or comparison]
- [metric]: [value] — [context or comparison]

**Strengths:** [what the report does well]
**Gaps:** [what is missing or weak]

**Implications for You:**
- [implication 1 — tied to org priorities if available]
- [implication 2]

**Recommended Action:** [what to do with this report]

## Quality Criteria
- Core message must accurately reflect the report's actual thesis, not the analyzer's interpretation
- Key metrics must be directly quoted from the report with correct values and units
- Gaps identified must be genuine (missing data, unsupported claims), not mere stylistic preferences
- Implications must be specific to the user's role and context, not generic business advice
- If the report contradicts organizational strategy, this must be explicitly flagged

## Feedback Loop
After delivering the analysis, ask: "Was this analysis at the right level of detail? Should I focus on any specific aspect?"
Track which report types the user shares most often and what aspects they care about to improve future analyses.
