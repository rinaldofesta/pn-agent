# SKILL: Content Creator

## Metadata
- ID: skill_crea_content_creator_004
- Version: 1.0
- Category: Creative
- Generated: 2026-02-25
- Source: Pre-built
- Status: Active
- Quality Score: null
- Usage: 0 activations

## Trigger
User invokes `/create-content` OR user requests help writing content (blog post, newsletter section, social media post, internal article, FAQ, knowledge base entry).

## Context Required
- The content type, topic, and purpose — REQUIRED
- The target audience and channel — REQUIRED
- Key messages, facts, or source material — REQUIRED
- Organizational context: brand voice, content guidelines, strategic messaging — optional, improves brand consistency
- Personal memory: user's content style and past content — optional, improves voice matching
- SEO requirements or keywords — optional (for external content)

## Instructions
1. Identify the content type and apply the appropriate format and conventions:
   - **Blog post:** Hook, narrative, key points, conclusion with CTA. 400-800 words.
   - **Newsletter section:** Brief, scannable, value-focused. 150-300 words.
   - **Social media post:** Platform-appropriate length, engaging, shareable. Under 280 characters for Twitter/X; under 2200 for LinkedIn.
   - **Internal article:** Informative, structured, referenced. 300-600 words.
   - **FAQ entry:** Question in natural language, clear answer, links to related content.
   - **Knowledge base:** Problem-solution format, step-by-step if procedural. 200-500 words.
2. Apply the appropriate tone for the channel and audience:
   - External customer-facing: professional, helpful, on-brand
   - Internal team: conversational, direct, team-aware
   - Social media: engaging, concise, personality-appropriate
   - Technical audience: precise, structured, example-driven
3. Structure the content for maximum readability on the target channel:
   - Use short paragraphs (2-3 sentences max)
   - Include subheadings for content over 200 words
   - Use bullet points for lists of 3+ items
   - Front-load key information — lead with the most important point
4. If organizational brand voice guidelines are available, apply them consistently. If not, maintain a professional, clear tone.
5. If source material is provided, build the content from those facts. Do not add unverified claims.
6. Include a call to action appropriate to the content type and purpose.
7. If SEO requirements are provided, incorporate keywords naturally without sacrificing readability.

## Output Format
Content draft with metadata. Max length varies by content type (see step 1).

**Content Type:** [type]
**Channel:** [where this will be published]
**Target Audience:** [who]
**Word Count:** [approximate]

---

[Full content draft]

---

**Notes:**
- [Suggestions for visuals, links, or timing]
- [SEO notes if applicable]

## Quality Criteria
- Content must match the conventions of its channel — a LinkedIn post should not read like a blog post
- Opening must capture attention within the first two sentences
- Every piece of content must have a clear purpose — the reader should know what to do or think after reading
- Facts and claims must come from provided source material, not fabricated
- Tone must be consistent throughout and match the organizational voice if guidelines were provided
- Word count must respect the target channel's conventions

## Feedback Loop
After presenting the draft, ask: "Does this match the tone and message you wanted? Should I create variations for other channels?"
Track content preferences and voice calibration for future content creation.
