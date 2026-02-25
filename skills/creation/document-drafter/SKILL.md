# SKILL: Document Drafter

## Metadata
- ID: skill_crea_document_drafter_001
- Version: 1.0
- Category: Creative
- Generated: 2026-02-25
- Source: Pre-built
- Status: Active
- Quality Score: null
- Usage: 0 activations

## Trigger
User invokes `/draft-doc` OR user requests help writing a document (memo, policy, process document, SOP, guide, one-pager).

## Context Required
- The document type, topic, and purpose — REQUIRED
- The intended audience (team, leadership, clients, all-company) — REQUIRED
- Source material: notes, bullet points, data, or previous versions — optional, improves accuracy
- Organizational context: company voice guidelines, document templates, strategic priorities — optional, improves alignment
- Personal memory: user's writing style and document preferences — optional, improves consistency

## Instructions
1. Identify the document type and determine the appropriate structure:
   - **Memo:** Summary, background, analysis, recommendation
   - **Policy:** Purpose, scope, policy statements, procedures, exceptions
   - **SOP/Process:** Purpose, scope, prerequisites, step-by-step procedures, troubleshooting
   - **One-pager:** Problem, solution, evidence, call to action
   - **Guide:** Overview, sections by topic, examples, FAQ
   - **Other:** Ask the user for preferred structure or propose one
2. Determine the audience and adjust language complexity, tone, and level of detail:
   - Executive audience: concise, outcome-oriented, minimal jargon
   - Technical audience: detailed, precise, can include terminology
   - Broad audience: accessible language, defined terms, clear structure
3. If source material is provided, organize and expand it into the document structure. Do not invent facts beyond what was provided.
4. Write each section with:
   - Clear topic sentences that state the section's purpose
   - Supporting detail organized by importance
   - Transitions between sections
   - Consistent formatting (heading levels, list styles, emphasis)
5. Include placeholders marked with [PLACEHOLDER: description] for any information the user needs to fill in.
6. If organizational context includes style guidelines, apply them (e.g., active voice, specific terminology, brand voice).
7. End with a summary or next-steps section appropriate to the document type.

## Output Format
Full document draft. Length varies by document type:
- Memo: max 1 page equivalent (~400 words)
- Policy/SOP: max 2 pages equivalent (~800 words)
- One-pager: max 1 page (~350 words)
- Guide: max 3 pages (~1200 words)

Structure with clear markdown headings. Include:

**Document Title**
**Type:** [document type]
**Audience:** [intended audience]
**Date:** [current date]

---

[Full document content with proper headings and sections]

---
**Placeholders to fill:** [list any [PLACEHOLDER] items]

## Quality Criteria
- Document structure must match the standard format for its type — a policy should look like a policy, not a memo
- Every section must have substantive content, not just a heading with a one-line placeholder
- Language must be appropriate for the audience — no jargon for non-technical readers, sufficient precision for technical ones
- All claims must be traceable to provided source material or clearly marked as needing verification
- Placeholders must be specific about what information is needed, not just "[add details here]"

## Feedback Loop
After presenting the draft, ask: "Should I adjust the structure, tone, or level of detail? I can also expand any section."
Track document type preferences and formatting choices to improve future drafts.
