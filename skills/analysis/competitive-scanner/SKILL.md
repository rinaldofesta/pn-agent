# SKILL: Competitive Scanner

## Metadata
- ID: skill_anal_competitive_scanner_003
- Version: 1.0
- Category: Analysis
- Generated: 2026-02-25
- Source: Pre-built
- Status: Active
- Quality Score: null
- Usage: 0 activations

## Trigger
User invokes `/comp-scan` OR user shares competitive intelligence (competitor announcements, pricing changes, product launches, market reports mentioning competitors).

## Context Required
- Competitive information to analyze (article, announcement, forwarded intel, user observations) — REQUIRED
- Organizational context: known competitors, competitive positioning, product roadmap, pricing strategy — optional, enables comparative analysis
- Personal memory: accumulated competitive intelligence from past scans — optional, enables trend tracking
- Strategic context: current competitive priorities and market strategy — optional, improves relevance

## Instructions
1. Read the provided competitive intelligence carefully. Identify the competitor(s), the nature of the information (product launch, pricing change, partnership, hiring signal, market move), and the source reliability.
2. Assess the competitive impact on a three-level scale:
   - **High:** Directly threatens current revenue, customers, or strategic position
   - **Medium:** Requires monitoring and may require a response within the quarter
   - **Low:** Informational, no immediate action required
3. Analyze the competitive move across these dimensions:
   - **What they did:** Factual description of the competitive action
   - **Why it matters:** How this affects the user's organization specifically
   - **Market positioning:** How this changes the competitive landscape
   - **Customer impact:** How this might affect shared or target customers
4. If organizational context is available, compare the competitor's move against the user's organization:
   - Product/service comparison on the relevant dimension
   - Relative strengths and vulnerabilities exposed by this move
5. Generate specific recommended responses:
   - Immediate actions (if high impact): what to do this week
   - Strategic considerations: how to factor this into planning
   - Intelligence gaps: what additional information would help assess the threat
6. If personal memory contains previous competitive intelligence, note the trajectory: is this competitor accelerating, pivoting, or consistent with past behavior?
7. Flag if this intelligence should be shared with specific teams (sales, product, leadership) based on its nature.

## Output Format
Structured brief, max 25 lines. Use this format:

**Competitor:** [name] | **Impact:** HIGH/MEDIUM/LOW
**Source:** [where this information came from]

**What Happened:**
[2-3 sentence factual summary]

**Why It Matters:**
- [Specific impact on your organization]
- [Customer or market implications]

**Your Position:**
- Strength: [relevant advantage you hold]
- Vulnerability: [relevant gap this exposes]

**Recommended Response:**
- [Specific action 1]
- [Specific action 2]

**Share With:** [which teams should know about this]

## Quality Criteria
- Impact assessment must be justified with specific reasoning, not arbitrary
- Competitive analysis must distinguish between facts (what they did) and interpretation (what it means)
- Recommended responses must be specific and actionable, not generic ("monitor the situation")
- Never speculate about competitor internal strategy without flagging it as speculation
- Source reliability must be noted — press releases vs. rumors vs. first-hand observation

## Feedback Loop
After delivering the scan, ask: "Is this the right level of analysis? Should I track this competitor more closely?"
Accumulate competitive intelligence over time to build a progressively richer competitive picture.
