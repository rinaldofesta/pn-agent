# SKILL: Email Summarizer

## Metadata
- ID: skill_email_summarizer_001
- Version: 1.0.0
- Category: Communication
- Generated: 2026-02-25
- Source: Pre-built
- Status: Active
- Quality Score: null
- Usage: 0 activations

## Trigger
User invokes `/email-summary` OR forwards an email to the assistant.

## Context Required
- Organizational context: team structure, strategic priorities
- Personal memory: user's communication patterns and preferences

## Instructions
1. Identify the forwarded email content in the user's message.
2. Extract the following elements:
   - **Sender and recipients** (generalize: "from your CFO", "to the marketing team")
   - **Subject and core topic** in one sentence
   - **Key points** (max 5 bullet points, prioritized by relevance to the user's role)
   - **Action items** directed at the user or their team
   - **Risks or concerns** that may need attention
   - **Connections to organizational context** (does this relate to current strategic priorities?)
3. If the email references previous conversations or decisions, note what context would help the user respond.
4. Suggest a response approach if the email seems to require one (reply, escalate, delegate, or archive).

## Output Format
Concise message. No more than 20 lines. Structure:

**Subject:** [one-line summary]
**From:** [generalized sender]

**Key Points:**
- [point 1]
- [point 2]

**Action Items:**
- [ ] [action 1]

**Risks:** [if any]

**Suggested Response:** [one sentence recommendation]

## Quality Criteria
- Summary must capture the email's core purpose in the first line
- Action items must be specific and attributed
- Never include raw email addresses or phone numbers in the summary
- Connect to organizational context when relevant (don't force it)

## Feedback Loop
After delivering the summary, ask: "Was this summary helpful? Anything I missed or got wrong?"
Store feedback to improve future summaries for this user.
