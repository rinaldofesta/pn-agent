# SKILL: Risk Assessor

## Metadata
- ID: skill_strat_risk_assessor_004
- Version: 1.0
- Category: Strategy
- Generated: 2026-02-25
- Source: Pre-built
- Status: Active
- Quality Score: null
- Usage: 0 activations

## Trigger
User invokes `/assess-risk` OR user shares a plan, proposal, or initiative and asks for a risk assessment.

## Context Required
- The plan, initiative, or situation to assess for risks — REQUIRED
- Organizational context: industry, regulatory environment, risk appetite, past incidents — optional, improves relevance
- Personal memory: previously identified risks and their outcomes — optional, enables pattern recognition
- Stakeholder context: who is affected and their risk tolerance — optional

## Instructions
1. Read the provided plan or initiative carefully. Understand the objectives, timeline, key assumptions, and dependencies.
2. Identify risks across multiple categories:
   - **Execution risk:** Can the team deliver on time, within budget, at the required quality?
   - **Market/external risk:** Could market conditions, competitors, regulations, or economic changes affect this?
   - **People risk:** Key person dependencies, skill gaps, team capacity, stakeholder resistance
   - **Technical risk:** Technology failures, integration issues, security concerns
   - **Financial risk:** Budget overruns, revenue shortfalls, funding dependencies
   - **Reputational risk:** Could this damage relationships, trust, or brand if it goes wrong?
3. For each identified risk, assess:
   - **Likelihood:** Low (unlikely but possible), Medium (could happen), High (probable)
   - **Impact:** Low (manageable, recoverable), Medium (significant disruption), High (could be fatal to the initiative)
   - **Detection:** How early would you know this risk is materializing?
   - **Velocity:** How quickly would the impact be felt once the risk triggers?
4. Calculate a risk priority score: High likelihood + High impact = Critical; prioritize risks by this combined assessment.
5. For the top 5 risks, develop mitigation strategies:
   - **Prevent:** Actions to reduce the likelihood of the risk occurring
   - **Detect:** Indicators that would signal the risk is materializing
   - **Respond:** Specific actions to take if the risk triggers
   - **Accept:** For some risks, the mitigation is to accept and budget for the potential impact
6. Identify any "hidden" risks not explicitly in the plan: assumptions that are unstated, dependencies that are implicit, or scenarios the plan does not account for.
7. Provide an overall risk rating for the initiative: Low, Medium, High, or Critical.

## Output Format
Structured risk assessment, max 35 lines. Use this format:

**Risk Assessment: [Plan/Initiative Name]**
**Overall Risk Level:** LOW / MEDIUM / HIGH / CRITICAL
**Risks Identified:** [count]

**Critical Risks:**
1. **[Risk name]** | Likelihood: HIGH | Impact: HIGH
   - Description: [what could happen]
   - Early indicators: [what to watch for]
   - Mitigation: [specific prevention or response]

2. **[Risk name]** | Likelihood: [level] | Impact: [level]
   - Description: [what could happen]
   - Early indicators: [what to watch for]
   - Mitigation: [specific prevention or response]

**Significant Risks:**
- [Risk]: [likelihood] x [impact] — Mitigation: [action]
- [Risk]: [likelihood] x [impact] — Mitigation: [action]

**Hidden Risks (Not in Plan):**
- [Risk the plan does not account for]

**Risk Summary:**
[2-3 sentence overall assessment of the risk profile and key recommendation]

## Quality Criteria
- Every risk must be specific to the initiative, not generic ("vendor delays shipment" not "things could go wrong")
- Likelihood and impact assessments must be justified, not arbitrary
- Mitigation strategies must be actionable and specific, not just "monitor the situation"
- Hidden risks are the most valuable part of the assessment — at least 1-2 risks the user likely has not considered
- The overall risk rating must be consistent with the individual risk assessments
- Never downplay risks to make the plan look better — the value is in honest assessment

## Feedback Loop
After delivering the assessment, ask: "Did I capture the key risks? Are there internal dynamics or constraints that would change these assessments?"
If the user shares outcomes later, store them to improve future risk assessments.
