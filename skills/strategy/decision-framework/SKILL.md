# SKILL: Decision Framework

## Metadata
- ID: skill_strat_decision_framework_003
- Version: 1.0
- Category: Strategy
- Generated: 2026-02-25
- Source: Pre-built
- Status: Active
- Quality Score: null
- Usage: 0 activations

## Trigger
User invokes `/decide` OR user describes a decision they are struggling with and asks for help structuring their thinking.

## Context Required
- The decision to be made, with available options — REQUIRED
- Relevant constraints: budget, timeline, resources, organizational politics — REQUIRED (at least what is known)
- Organizational context: strategic priorities, values, precedents — optional, improves alignment
- Personal memory: past decisions on similar topics, outcomes of previous decisions — optional, enables pattern learning
- Stakeholder input: who is affected and their known positions — optional

## Instructions
1. Clarify the decision:
   - What specifically needs to be decided?
   - What is the deadline for the decision?
   - Who has decision-making authority?
   - What happens if no decision is made (status quo outcome)?
2. Identify and structure the options:
   - List all options the user has mentioned
   - If appropriate, suggest 1-2 additional options the user may not have considered (including "do nothing" or "delay")
   - For each option, ensure it is specific enough to evaluate
3. Define evaluation criteria based on the user's context:
   - **Strategic alignment:** Does this advance organizational priorities?
   - **Feasibility:** Can this realistically be implemented with available resources?
   - **Risk:** What could go wrong and how severe would that be?
   - **Impact:** What is the expected benefit if this succeeds?
   - **Reversibility:** How easy is it to change course if this is the wrong choice?
   - Add criteria specific to the decision context
4. Evaluate each option against each criterion:
   - Use specific evidence and reasoning, not just ratings
   - Be honest about uncertainties and information gaps
   - Note where options are close and where they clearly diverge
5. Identify the key differentiator: the one factor that most distinguishes the options from each other.
6. Present a recommendation with reasoning, but frame it as input to the user's judgment, not a directive.
7. Describe the "pre-mortem" for the recommended option: if this decision fails, what is the most likely reason?
8. Suggest the first concrete step for implementing the recommended option.

## Output Format
Structured framework, max 35 lines. Use this format:

**Decision: [What needs to be decided]**
**Deadline:** [when] | **Decision-maker:** [who]

**Options:**
1. [Option A]: [one-sentence description]
2. [Option B]: [one-sentence description]
3. [Option C]: [one-sentence description]

**Evaluation:**
| Criteria | Option A | Option B | Option C |
|----------|----------|----------|----------|
| Strategic alignment | [assessment] | [assessment] | [assessment] |
| Feasibility | [assessment] | [assessment] | [assessment] |
| Risk | [assessment] | [assessment] | [assessment] |
| Impact | [assessment] | [assessment] | [assessment] |
| Reversibility | [assessment] | [assessment] | [assessment] |

**Key Differentiator:** [The factor that matters most in this decision]

**Recommendation:** [Option X] — [reasoning in 2-3 sentences]

**Pre-mortem:** If this fails, the most likely reason is [specific risk]

**First Step:** [Concrete next action to implement]

## Quality Criteria
- Options must be genuinely distinct, not variations of the same approach
- Evaluation must include specific evidence and reasoning, not just "high/medium/low" ratings
- The recommendation must acknowledge uncertainty and present itself as input, not a directive
- The pre-mortem must identify a realistic failure mode, not a trivial or unlikely one
- If information is insufficient to evaluate an option fairly, state what additional information would help
- The framework must not bias toward action — "do nothing" or "delay" are legitimate options when appropriate

## Feedback Loop
After presenting the framework, ask: "Does this capture the key considerations? Are there criteria or constraints I should add?"
If the user shares the decision outcome later, store it to learn from the decision pattern.
