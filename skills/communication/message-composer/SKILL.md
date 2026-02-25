# SKILL: Message Composer

## Metadata
- ID: skill_comm_message_composer_005
- Version: 1.0
- Category: Communication
- Generated: 2026-02-25
- Source: Pre-built
- Status: Active
- Quality Score: null
- Usage: 0 activations

## Trigger
User invokes `/compose` OR user asks for help writing a Slack message, Teams message, announcement, or internal communication.

## Context Required
- The purpose and key message to communicate — REQUIRED
- The target audience (team, channel, individual, all-hands) — REQUIRED
- The channel: Slack, Teams, email, or other — optional, defaults to Slack-style
- Organizational context: company culture, communication norms, current events — optional, improves tone
- Personal memory: user's communication style — optional, improves voice consistency

## Instructions
1. Determine the message type from the user's request: announcement, status update, request for input, celebration, sensitive communication, or casual message.
2. Determine the audience size and relationship:
   - Direct message: personal, specific, conversational
   - Small team channel: direct, context-aware, collaborative
   - Large channel or all-hands: clear, inclusive, structured
3. Draft the message following channel-appropriate conventions:
   - **Slack/Teams:** Use short paragraphs, bullet points for lists, bold for key points, emoji sparingly and only if the user's style includes them
   - **Email:** More structured with subject line, greeting, body, sign-off
   - **Announcement:** Lead with the key news, then context, then next steps
4. Apply the appropriate tone:
   - Good news: enthusiastic but professional
   - Bad news or changes: empathetic, transparent, action-oriented
   - Requests: clear ask, context for why, easy to act on
   - Updates: concise, outcome-focused, scannable
5. If the communication is sensitive (layoffs, org changes, performance issues), flag it and suggest the user review carefully before sending.
6. Include a clear call to action when the message requires a response or action from recipients.
7. Keep the message as short as possible while retaining clarity — aim for under 150 words for Slack/Teams messages.

## Output Format
Concise message, max 20 lines. Use this format:

**Channel:** [where this is intended for]
**Tone:** [detected tone]

**Message:**

[Ready-to-send message text]

---
**Notes:** [any suggestions on timing, audience, or sensitivity]

## Quality Criteria
- Message must be appropriate for the channel and audience size
- Sensitive communications must be flagged with a review recommendation before sending
- Length must be appropriate for the channel: Slack/Teams messages under 150 words, emails can be longer
- Tone must match the message type: celebrations should feel genuine, difficult messages should feel empathetic
- The message must have a clear purpose — a reader should know what to do after reading it

## Feedback Loop
After presenting the draft, ask: "Ready to send, or should I adjust the tone or length?"
Track the user's channel preferences and tone adjustments to calibrate future messages.
