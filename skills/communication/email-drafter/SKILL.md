# SKILL: Email Drafter

## Metadata
- ID: skill_comm_email_drafter_002
- Version: 1.0
- Category: Communication
- Generated: 2026-02-25
- Source: Pre-built
- Status: Active
- Quality Score: null
- Usage: 0 activations

## Trigger
User invokes `/email-draft` OR user requests help composing an email OR user asks for a reply to a forwarded email.

## Context Required
- The purpose or topic of the email, as described by the user — REQUIRED
- The intended recipient(s) and their role/relationship — REQUIRED
- Organizational context: company tone guidelines, team structure, strategic priorities — optional, improves tone matching
- Personal memory: user's writing style from past drafts — optional, improves voice consistency
- Any source material (forwarded email to reply to, brief, notes) — optional

## Instructions
1. Identify the email type from the user's request: new outreach, reply, follow-up, escalation, thank you, request, update, or announcement.
2. Determine the recipient audience and appropriate formality level:
   - Internal peer: conversational, direct
   - Internal leadership: concise, outcome-oriented
   - External client: professional, relationship-aware
   - External vendor: clear, specific, contractual
3. If replying to a forwarded email, read it carefully and identify the sender's key points and implicit expectations.
4. Draft the email with this structure:
   - **Subject line:** Clear, specific, action-oriented (for new emails)
   - **Opening:** Context-appropriate greeting and purpose statement
   - **Body:** Key message organized by priority; one idea per paragraph; max 3 paragraphs
   - **Close:** Clear next step or call to action
   - **Sign-off:** Tone-appropriate closing
5. Match the user's writing style if personal memory is available (sentence length, vocabulary, level of formality).
6. If organizational context is available, ensure the email aligns with current priorities and uses consistent internal terminology.
7. Flag any potential risks in the draft: tone mismatches, missing information, politically sensitive statements, or commitments that may need approval.

## Output Format
Structured message, max 30 lines. Use this format:

**Subject:** [proposed subject line]

**Draft:**

[Full email text, ready to copy-paste]

---

**Notes:**
- [Any flags, suggestions, or alternative approaches]

## Quality Criteria
- Subject line must be specific enough that the recipient knows the purpose without opening the email
- Email body must be scannable: short paragraphs, clear structure, no walls of text
- Tone must match the recipient relationship and organizational norms
- Every email must have a clear call to action or stated next step
- Draft must not introduce facts or commitments not provided by the user
- If replying, the draft must address all points raised in the original email

## Feedback Loop
After presenting the draft, ask: "Want me to adjust the tone, length, or emphasis? I can also create alternative versions."
Store the user's preferred adjustments to calibrate future drafts.
