# SKILL: Learning Curator

## Metadata
- ID: skill_prod_learning_curator_005
- Version: 1.0
- Category: Management
- Generated: 2026-02-25
- Source: Pre-built
- Status: Active
- Quality Score: null
- Usage: 0 activations

## Trigger
User invokes `/learn` OR user asks for learning recommendations, skill development suggestions, or professional growth resources.

## Context Required
- The user's learning goal or skill gap — REQUIRED (specific topic or general development request)
- Personal memory: user's role, current skills, career trajectory, past learning activities — optional, enables personalization
- Organizational context: company skill priorities, training resources, career frameworks — optional, enables alignment
- Personal memory: content the user has shared that reveals knowledge gaps or interests — optional, enables proactive suggestions

## Instructions
1. Identify the learning objective:
   - Is this a specific skill the user wants to develop (e.g., "learn SQL", "improve presentation skills")?
   - Is this a role-related development need (e.g., "preparing for a leadership role")?
   - Is this curiosity-driven (e.g., "I want to understand how AI affects our industry")?
2. Assess the user's current level if possible:
   - From their role and experience: are they a beginner, intermediate, or advanced learner in this area?
   - From past interactions: have they demonstrated existing knowledge in this area?
3. Curate a learning path with 3-5 specific steps:
   - **Quick win (this week):** One article, video, or podcast episode that provides immediate value (under 30 minutes)
   - **Foundation (this month):** A course, book, or structured resource for deeper learning
   - **Practice (ongoing):** A way to apply the learning in their current role
   - **Community (optional):** A community, mentor, or peer group for this topic
   - **Milestone:** A concrete way to know they have achieved proficiency
4. If organizational context includes training resources or career frameworks, prioritize internal resources and align recommendations with career path.
5. Suggest how to fit learning into the user's schedule:
   - Recommend specific time blocks (e.g., "30 minutes before your Monday team meeting")
   - Connect to existing routines rather than adding new commitments
6. If personal memory reveals patterns (e.g., the user keeps encountering a topic they do not understand), proactively suggest learning in that area.
7. Keep recommendations practical: favor resources that can be consumed in 15-30 minute blocks over multi-day courses when possible.

## Output Format
Structured learning plan, max 20 lines. Use this format:

**Learning Plan: [Topic]**
**Current level:** [Beginner / Intermediate / Advanced / Unknown]
**Time commitment:** [estimated hours per week]

**Quick Win (This Week):**
- [Specific resource with title and format] — [X] minutes

**Foundation (This Month):**
- [Course, book, or resource] — [estimated time commitment]

**Practice:**
- [How to apply this in your current role — specific suggestion]

**Milestone:**
- [How you will know you have achieved proficiency]

**Schedule Suggestion:**
- [When to fit this into your week]

## Quality Criteria
- Every recommended resource must be specific (title, author/source, format), not generic ("read a book about leadership")
- The learning path must be progressive: quick win builds interest, foundation builds knowledge, practice builds skill
- Time estimates must be realistic for a working professional (not "spend 2 hours a day studying")
- Recommendations must match the user's stated level — do not suggest beginner materials to an advanced user
- Practice suggestions must connect to the user's actual work, not theoretical exercises

## Feedback Loop
After presenting the plan, ask: "Does this learning path feel right? Too ambitious or too basic?"
Track which resources the user engages with and adjust future recommendations based on their learning patterns.
