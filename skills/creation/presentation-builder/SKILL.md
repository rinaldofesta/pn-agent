# SKILL: Presentation Builder

## Metadata
- ID: skill_crea_presentation_builder_002
- Version: 1.0
- Category: Creative
- Generated: 2026-02-25
- Source: Pre-built
- Status: Active
- Quality Score: null
- Usage: 0 activations

## Trigger
User invokes `/build-deck` OR user requests help creating a presentation, slide deck, or pitch.

## Context Required
- The presentation topic, purpose, and occasion — REQUIRED
- The intended audience (clients, board, team, conference) — REQUIRED
- Key points, data, or messages to include — REQUIRED (at least a rough outline)
- Time allocation: how long the presentation should take — optional, defaults to 15 minutes
- Organizational context: brand guidelines, strategic messaging, company positioning — optional, improves alignment
- Personal memory: user's presentation style — optional, improves consistency

## Instructions
1. Determine the presentation type and structure:
   - **Business update:** Agenda, progress, metrics, challenges, next steps
   - **Pitch/proposal:** Problem, solution, evidence, competitive advantage, ask
   - **Strategy review:** Context, analysis, options, recommendation, implementation
   - **Team meeting:** Agenda, updates, discussion topics, action items
   - **Conference talk:** Hook, narrative arc, key insights, takeaway
2. Calculate the slide count based on time allocation (roughly 1 slide per 1-2 minutes, excluding title and closing slides).
3. Create a detailed slide-by-slide outline:
   - **Slide title:** Clear, specific, and action-oriented (state the point, not just the topic)
   - **Key message:** The one thing the audience should take from this slide
   - **Content:** Bullet points, data points, or visuals to include (max 4 items per slide)
   - **Speaker notes:** What the presenter should say that is not on the slide
4. Apply the "one idea per slide" principle — if a slide has two distinct points, split it.
5. Ensure narrative flow: each slide should logically lead to the next. Include transition points in speaker notes.
6. For data slides, specify the chart type that best represents the data (bar, line, pie, table) and what it should emphasize.
7. Include a strong opening slide (that captures attention) and a clear closing slide (with takeaway and call to action).
8. If organizational brand guidelines are available, note them in formatting suggestions.

## Output Format
Structured slide outline, max 40 lines. Use this format:

**Presentation:** [title]
**Audience:** [who] | **Duration:** [minutes] | **Slides:** [count]

---

**Slide 1: [Title]**
- Key message: [one sentence]
- Content: [bullet points or visual description]
- Speaker notes: [what to say]

**Slide 2: [Title]**
- Key message: [one sentence]
- Content: [bullet points or visual description]
- Speaker notes: [what to say]

[...continue for all slides...]

---

**Design Notes:** [suggestions for visuals, brand alignment, chart types]

## Quality Criteria
- Each slide title must convey the point, not just the topic ("Revenue grew 15% YoY" not "Revenue Update")
- No slide should have more than 4 content items — if it does, it needs to be split
- The presentation must have a clear narrative arc: setup, development, conclusion
- Speaker notes must add value beyond what is on the slide — they are what the presenter says, not a repeat of the bullets
- Data visualization recommendations must match the data type (trends = line chart, comparison = bar chart, composition = pie chart)

## Feedback Loop
After presenting the outline, ask: "Should I adjust the narrative flow, add or remove slides, or change the emphasis?"
Track the user's preferred presentation style, length, and level of detail.
