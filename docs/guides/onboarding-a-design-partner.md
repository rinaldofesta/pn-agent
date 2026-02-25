# Onboarding a Design Partner

**Version:** 0.1.0
**Last Updated:** 2026-02-25
**Status:** Draft -- Pre-Phase 0 Architecture
**Owner:** Matteo Roversi (Product), Rinaldo Festa (Technical Architecture)

---

## Context

Play New Phase 0 deploys personal AI assistants to 3 design partner organizations, 20-50 users each. The onboarding process is highly manual and relationship-driven. Each partner goes through a structured 8-week engagement that moves from discovery to live deployment to first intelligence delivery.

This guide is the operational playbook for onboarding a design partner. It covers both the business/advisory activities and the technical implementation steps.

**References:**
- PRD Section 17.1 -- Onboarding Process
- PRD Section 8.2 -- Design Partner Criteria
- PRD Section 8.3 -- Phase 0 User Journey
- [Development Setup](./development-setup.md) -- local dev environment
- [Deploying to Production](./deploying-to-production.md) -- production infrastructure

---

## Prerequisites

Before starting onboarding for a design partner:

- [ ] Design partner agreement signed (data processing agreement, NDA, partnership terms)
- [ ] C-level sponsor identified and committed
- [ ] DPO contact identified (if the org has one)
- [ ] Play New production infrastructure provisioned (see [Deploying to Production](./deploying-to-production.md))
- [ ] At least 1 Play New advisor assigned to this partner
- [ ] Technical architect available for infrastructure setup

---

## Week 1-2: Discovery and Connection

### Goal

Understand the organization's strategy, structure, data landscape, and privacy requirements. Establish the technical foundation.

### Business Activities

| Activity | Owner | Output | Duration |
|----------|-------|--------|----------|
| **Leadership interviews** | Play New advisor | Understanding of strategic priorities, culture, pain points, AI maturity | 2-3 sessions, 60 min each |
| **Team structure mapping** | Play New advisor | Org chart, team functions, key roles, team sizes | 1 session, 90 min |
| **Privacy and compliance review** | Play New advisor + legal | DPO alignment document, works-council briefing (if applicable), data processing agreement | 1-2 sessions |
| **Data infrastructure audit** | Technical architect | Map of available data sources, connection feasibility, API access | 1 session, 120 min |
| **User selection** | Play New advisor + sponsor | List of 20-50 users for deployment, organized by team and role | Collaborative |

#### Leadership Interview Guide

Cover these topics with the C-level sponsor and key leaders:

1. **Strategic context:** What are the top 3 strategic priorities for the next 12 months? What keeps you up at night?
2. **AI current state:** What AI tools are people using today? What is working? What is not?
3. **Pain points:** Where does the organization waste the most time on repetitive or low-value work?
4. **Culture:** How does the organization feel about AI? Are there pockets of resistance? Champions?
5. **Expectations:** What would success look like in 3 months? What would make this partnership a failure?
6. **Privacy sensitivity:** Have there been privacy incidents? Is there a works council? What are the red lines?

#### Privacy and Compliance Review

For EU organizations, this step is critical:

1. **GDPR alignment:** Review Play New's data processing approach with the DPO. Key points:
   - Personal data stays encrypted in user-scoped storage. The organization never sees it.
   - Organizational intelligence uses only anonymized, aggregated patterns (5-user minimum threshold).
   - Users can export or delete all their data at any time.
   - No model training on customer data.

2. **Works council briefing** (if applicable): Prepare a briefing document explaining:
   - The assistant is a personal productivity tool, not a surveillance tool.
   - The organization sees aggregate patterns (e.g., "35% of marketing time on reporting"), never individual behavior.
   - Forward mode means the user controls all data input.
   - The works council can audit the anonymization views at any time.

3. **Data processing agreement:** Sign the DPA covering data classification, retention, deletion rights, and incident notification.

### Technical Activities

| Activity | Owner | Output | Duration |
|----------|-------|--------|----------|
| **Provision org in platform** | Technical architect | Org record in `organizations` table, org schema in PostgreSQL | 1 hour |
| **Create org admin account** | Technical architect | Admin credentials for the organization | 30 min |
| **Initial data connections** | Technical architect | 1-2 MCP connectors configured and tested | 2-4 hours |
| **Slack/Teams app setup** | Technical architect | Bot installed in org workspace, credentials stored | 1-2 hours |

#### Provision the Organization

```sql
-- 1. Create the organization record
INSERT INTO public.organizations (
    name, industry, size_band, geo, plan, status,
    settings, encryption_key_ref
) VALUES (
    'Partner Organization Name',
    'professional_services',    -- or: tech, manufacturing, media, retail
    '200-500',                  -- or: 50-200, 500-2000, 2000+
    'EU_south',                 -- or: EU_north, EU_west, UK
    'design_partner',
    'onboarding',
    '{"llm_model": "claude-sonnet-4-20250514", "proactive_limit": 1}',
    'kms://pn/orgs/{org_id}/master-key'
);

-- 2. Create the org-scoped schema
CREATE SCHEMA org_{org_id};
SET search_path TO org_{org_id}, public;

-- 3. Run org-scoped migrations
-- (automated by: npm run db:migrate -- --org={org_id})
```

Or use the CLI tool:

```bash
npm run org:create -- \
  --name="Partner Organization Name" \
  --industry=professional_services \
  --size-band=200-500 \
  --geo=EU_south
```

#### Set Up Data Connections

For each data source identified in the data infrastructure audit:

1. **CRM (Salesforce or HubSpot):**
   ```bash
   npm run connector:test -- \
     --type=salesforce \
     --instance-url=https://partner.my.salesforce.com \
     --access-token=<token>
   ```
   If the test passes, store credentials in the org's secrets:
   ```bash
   npm run connector:configure -- \
     --org={org_id} \
     --type=salesforce \
     --instance-url=https://partner.my.salesforce.com
   ```

2. **Directory (Google Workspace or Microsoft 365):**
   ```bash
   npm run connector:test -- \
     --type=google-workspace \
     --domain=partner.com \
     --sa-key-path=./secrets/partner-google-sa.json
   ```

#### Set Up Channel

**For Slack:**

1. Create a new Slack app in the partner's workspace (or install the Play New Slack app if using a shared app manifest).
2. Enable Socket Mode.
3. Configure OAuth scopes: `chat:write`, `im:history`, `im:read`, `im:write`, `users:read`, `users:read.email`, `commands`.
4. Store credentials:
   ```bash
   npm run channel:configure -- \
     --org={org_id} \
     --type=slack \
     --bot-token=xoxb-... \
     --app-token=xapp-... \
     --signing-secret=...
   ```

**For Teams:**

1. Register a new Teams bot in the partner's Azure AD tenant.
2. Configure permissions: `TeamsActivity.Send`, `User.Read.All`.
3. Store credentials:
   ```bash
   npm run channel:configure -- \
     --org={org_id} \
     --type=teams \
     --app-id=... \
     --app-password=... \
     --tenant-id=...
   ```

### Week 1-2 Checklist

- [ ] Leadership interviews completed (2-3 sessions)
- [ ] Team structure mapped
- [ ] DPO aligned and data processing agreement signed
- [ ] Works council briefed (if applicable)
- [ ] Data infrastructure audit completed
- [ ] User list finalized (20-50 users with names, emails, teams, roles)
- [ ] Organization provisioned in platform (org record + schema)
- [ ] At least 1 MCP connector tested and configured
- [ ] Channel (Slack or Teams) installed and tested in org workspace
- [ ] Admin account created and tested

---

## Week 3-4: Context Building and Configuration

### Goal

Build the organizational knowledge base, select and customize skills, provision users, and run a beta deployment with 5-10 users.

### Business Activities

| Activity | Owner | Output | Duration |
|----------|-------|--------|----------|
| **Strategic context document creation** | Play New advisor | Living knowledge base capturing strategy, competitive position, industry context | 4-6 hours (advisor) |
| **Skill library selection** | Play New advisor | 10-15 skills selected and customized for this org | 2-3 hours |
| **Assistant personality calibration** | UX designer + advisor | Tone, communication style, proactive frequency configured | 1 hour |
| **Beta user selection** | Play New advisor + sponsor | 5-10 users from diverse teams/roles for beta | 30 min |

#### Creating the Strategic Context Document

The strategic context document is a living markdown document that provides organizational awareness to every assistant instance. It is stored in the `org_context_docs` table and injected into LLM prompts via RAG.

Structure:

```markdown
# Strategic Context: [Organization Name]

## Company Overview
- Industry: [industry]
- Size: [employee count], [revenue range]
- Markets: [geographic and market segments]
- Founded: [year]
- Key products/services: [list]

## Strategic Priorities (Current Year)
1. [Priority 1 -- e.g., "Expand DACH market presence"]
2. [Priority 2 -- e.g., "Reduce operational costs by 15%"]
3. [Priority 3 -- e.g., "Launch AI-augmented client advisory service"]

## Competitive Landscape
- Key competitors: [list with brief positioning]
- Our differentiation: [what makes this org unique]
- Market dynamics: [trends affecting the industry]

## Team Structure
- [Team 1]: [function], [size], [key responsibilities]
- [Team 2]: ...

## Culture and Communication
- Communication style: [formal/informal, language preferences]
- Decision-making: [consensus-driven, top-down, data-driven]
- AI attitude: [early adopter, cautious, mixed]

## Key Metrics
- [Metric 1]: [current value and target]
- [Metric 2]: ...

## Constraints and Sensitivities
- [Regulatory constraints]
- [Budget constraints]
- [Cultural sensitivities]
- [Competitor names that should not appear in output]
```

The advisor creates this document from the leadership interviews and data audit. It is reviewed with the C-level sponsor before deployment.

#### Selecting Skills

Using the skill assignment matrix from [skill-library-spec.md](../specs/skills/skill-library-spec.md), select 10-15 skills for the initial deployment:

1. **Start with universal skills** (all users): email-summarizer, response-drafter, action-item-extractor, weekly-digest. These require no connectors and provide immediate value.

2. **Add role-specific skills** based on the user list:
   - Sales teams: pipeline-risk-scan, deal-strategy-advisor (if CRM connected)
   - Managers: meeting-prep, one-on-one-prep, report-analyzer
   - Leadership/Strategy: strategic-signal-daily, gap-analyzer

3. **Customize skill instructions** if needed. For example, if the org uses specific terminology or frameworks, add org-specific notes to the skill instructions via `skill_overrides`.

4. **Assign skills to role categories** in the admin interface.

### Technical Activities

| Activity | Owner | Output | Duration |
|----------|-------|--------|----------|
| **Import strategic context document** | Technical architect | Document stored in `org_context_docs`, indexed for RAG | 30 min |
| **Import user list** | Technical architect | User instances created, channel mappings established | 1-2 hours |
| **Configure skill assignments** | Technical architect + advisor | Skills assigned to role categories | 1 hour |
| **Beta deployment** | Technical architect | 5-10 users can message their assistant | 2-4 hours |
| **Beta testing and refinement** | Product team + advisor | Issues identified and fixed | 3-5 days |

#### Import Users

From the user list (CSV with columns: email, name, team, role_category):

```bash
npm run users:import -- \
  --org={org_id} \
  --file=./onboarding/partner-users.csv \
  --channel=slack
```

This script:
1. Creates `user_instances` records for each user.
2. Resolves channel user IDs (by email match against Slack/Teams workspace members).
3. Creates `user_channel_mappings` records.
4. Opens DM conversations with each user (but does not send a welcome message yet).

#### Beta Deployment

Deploy to 5-10 beta users:

1. Select beta users from diverse teams and roles.
2. Send a personal introduction from the advisor (not the bot) explaining the beta.
3. Activate the assistant for beta users only.
4. Monitor logs daily for errors, slow responses, or unexpected behavior.
5. Collect feedback from beta users (15-minute interviews or Slack survey).
6. Fix issues identified during beta.

### Week 3-4 Checklist

- [ ] Strategic context document created and reviewed with sponsor
- [ ] Strategic context document imported and indexed
- [ ] 10-15 skills selected and assigned to role categories
- [ ] Skill customizations applied (if any)
- [ ] All users imported into the platform
- [ ] Channel user mappings verified (email match rate > 90%)
- [ ] Beta deployment active for 5-10 users
- [ ] Beta feedback collected and issues resolved
- [ ] Assistant personality and tone validated by advisor

---

## Week 5-6: Rollout

### Goal

Deploy to all 20-50 users. Run onboarding sessions. Establish daily usage patterns.

### Business Activities

| Activity | Owner | Output | Duration |
|----------|-------|--------|----------|
| **User onboarding sessions** | Play New advisor | 30-minute team sessions introducing the assistant | 3-5 sessions |
| **Individual activation** | Automated + advisor | Each user receives welcome message, completes orientation | Automated |
| **Adoption support** | Customer success + advisor | Daily check-ins with teams, troubleshooting | Ongoing |
| **Champion identification** | Customer success | 3-5 power users identified per org | Week 6 |

#### User Onboarding Sessions

Run 30-minute team sessions (groups of 5-10 users) covering:

1. **What is Play New?** (5 min)
   - "Your personal AI assistant that works for you, not the company."
   - Privacy guarantees: "Everything you share is private. The company sees only aggregate patterns."
   - Forward mode: "You control what the assistant sees."

2. **How to interact** (10 min)
   - Find the assistant in your Slack DMs / Teams chat.
   - Forward emails: show the dedicated email address.
   - Share messages: show how to share a Slack message to the DM.
   - Slash commands: demonstrate `/email-summary`, `/meeting-prep`.
   - Live demo: forward an email and show the response.

3. **Your first skills** (10 min)
   - Walk through the 3-4 skills assigned to this team.
   - Show example outputs.
   - Explain feedback: "Tell the assistant if the output was useful."

4. **Q&A** (5 min)
   - Common questions: "Can my manager see what I ask?", "What happens if I share something confidential?", "How do I delete data?"

#### Individual Activation

After the team session, the system sends each user a welcome message:

```
Hi [name]! I'm your personal Play New assistant.

I work for you -- not your company. Everything we discuss is private.
Your employer only sees anonymized patterns across the whole organization,
never your individual conversations.

I can help you:
- Summarize emails and extract action items (/email-summary)
- Prepare for meetings (/meeting-prep)
- Analyze reports and data (/analyze-report)
- [role-specific skill] (/command)

To get started, try forwarding me an email or asking me a question.

Type /help to see all my skills. Type /privacy to review what I know
about you and delete anything.
```

After the welcome message, the assistant asks 3-4 orientation questions:
1. What is your role? What do you spend most time on?
2. What tools do you use daily?
3. What is the most repetitive part of your job?
4. What would you do with an extra 5 hours per week?

The responses are stored in personal memory and used to calibrate skill recommendations.

#### Champion Identification

By the end of week 6, identify 3-5 power users per org who:
- Use the assistant daily
- Try multiple skills
- Provide detailed feedback
- Naturally recommend the assistant to colleagues

Champions become:
- Beta testers for new skills
- Feedback sources for the advisor
- Internal advocates who drive peer adoption

### Technical Activities

| Activity | Owner | Output | Duration |
|----------|-------|--------|----------|
| **Full deployment activation** | Technical architect | All users can message their assistant | 1 hour |
| **Monitoring setup** | Technical architect | Dashboards for error rates, response times, user activity | 2 hours |
| **Daily monitoring** | Technical architect | Review logs, fix issues | 30 min/day |
| **Scale verification** | Technical architect | System handles 20-50 concurrent users | 1 hour |

#### Monitoring Dashboard

Set up monitoring for:

| Metric | Alert Threshold | Dashboard |
|--------|----------------|-----------|
| Response time P95 | >25 seconds | Grafana |
| Error rate | >5% of requests | Grafana + Sentry |
| Container spawn failures | >1% | Grafana |
| Active users (daily) | <30% of deployed | Admin dashboard |
| LLM API errors | >2% | Sentry |
| Channel connection status | Disconnected >5 min | Grafana |

### Week 5-6 Checklist

- [ ] All users activated (welcome messages sent)
- [ ] Onboarding sessions completed for all teams
- [ ] Orientation responses collected from >80% of users
- [ ] Monitoring dashboards operational
- [ ] Daily error rate below 5%
- [ ] Response time P95 below 25 seconds
- [ ] >50% of users have sent at least one message
- [ ] 3-5 champions identified
- [ ] No privacy concerns raised by users or DPO

---

## Week 7-8: First Intelligence

### Goal

Produce the first Automate Intelligence Brief. Establish ongoing cadence.

### Business Activities

| Activity | Owner | Output | Duration |
|----------|-------|--------|----------|
| **Pattern collection review** | Play New advisor | Assessment of data quality and pattern volume | 2 hours |
| **Query anonymized views** | Play New advisor | Structured pattern data for analysis | 2-3 hours |
| **First Automate Intelligence Brief** | Play New advisor | Top 3 automation opportunities with evidence and recommendations | 4-6 hours |
| **Leadership feedback session** | Play New advisor + Matteo | Presentation of brief, reaction, calibration | 60-90 min session |
| **Establish ongoing cadence** | Play New advisor | Schedule for weekly check-ins, monthly briefs, quarterly reviews | 30 min |

#### Producing the Intelligence Brief

1. **Review pattern volume:** Query `v_org_patterns` to verify sufficient data (are there patterns that meet the 5-user threshold?).

   ```sql
   SELECT category_l1, category_l2, SUM(interaction_count) as total,
          SUM(user_count) as users
   FROM v_org_patterns
   WHERE period_week >= '2026-W18'
   GROUP BY category_l1, category_l2
   ORDER BY total DESC;
   ```

2. **Identify automation candidates:** Look for high-volume, repetitive work categories:

   ```sql
   SELECT category_l1, category_l2, category_l3,
          SUM(interaction_count) as total_interactions,
          SUM(user_count) as total_users,
          array_agg(DISTINCT unnested_tool) as tools
   FROM v_team_patterns,
        LATERAL unnest(tools_observed) AS unnested_tool
   WHERE period_week >= '2026-W18'
   GROUP BY category_l1, category_l2, category_l3
   HAVING SUM(user_count) >= 5
   ORDER BY total_interactions DESC
   LIMIT 10;
   ```

3. **Review skill feedback:** Identify which skills are delivering value:

   ```sql
   SELECT s.name, vu.activation_count, vu.positive_feedback_rate
   FROM v_skill_usage vu
   JOIN public.skill_definitions s ON s.skill_id = vu.skill_id
   WHERE vu.period_week >= '2026-W18'
   ORDER BY vu.activation_count DESC;
   ```

4. **Apply strategic analysis:** Using the leadership interview notes and strategic context document, frame patterns as automation opportunities:
   - Which patterns represent the most time investment?
   - Which are most amenable to automation?
   - Which align with the org's strategic priorities?
   - What is the estimated impact (time saved, cost reduced)?

5. **Write the brief** following the PRD Section 13.1 format:

   ```
   AUTOMATE INTELLIGENCE BRIEF -- [Organization] -- [Month]

   TOP OPPORTUNITY:
   [Team]: [Description of repetitive work pattern]
   - Estimated time: [X] hours/month across team (aggregated from [N]+ users)
   - Tools involved: [generalized tool categories]
   - Similar orgs have automated this, reducing to ~[Y] hours/month
   - Estimated annual saving: EUR [amount]
   - Implementation: [complexity assessment]
   - Recommended action: [specific steps]

   OPPORTUNITY #2: [...]
   OPPORTUNITY #3: [...]

   TREND: [notable pattern in adoption or usage]
   ```

#### Leadership Feedback Session

Present the brief to the C-level sponsor and relevant leaders:

1. Walk through each opportunity with supporting data.
2. Gauge reaction: "Is this accurate? Is this actionable? What would you do with this?"
3. Calibrate: "What intelligence would be more useful? What did we miss?"
4. Agree on next steps: "Which opportunity should we explore first?"

This session is critical for Phase 0 success. The goal is not just to deliver information but to validate that the dual-layer model (personal assistant + organizational intelligence) produces insights that leadership values.

### Technical Activities

| Activity | Owner | Output | Duration |
|----------|-------|--------|----------|
| **Verify pattern collection** | Technical architect | Pattern logs being written correctly | 1 hour |
| **Test anonymized views** | Technical architect | Views return correct aggregations | 1 hour |
| **Usage metrics report** | Technical architect | Adoption and engagement numbers | 30 min |

### Week 7-8 Checklist

- [ ] Pattern logs have sufficient volume for meaningful analysis
- [ ] Anonymized views return results (5-user threshold met for at least some patterns)
- [ ] First Automate Intelligence Brief written
- [ ] Leadership feedback session completed
- [ ] Leadership reaction documented (actionable? accurate? valuable?)
- [ ] At least 1 opportunity identified that leadership considers acting on
- [ ] Ongoing cadence established:
  - [ ] Weekly: advisor check-in (15 min, async or call)
  - [ ] Monthly: Automate Intelligence Brief delivery
  - [ ] Quarterly: Strategic review session (leadership + advisor)
- [ ] Phase 0 success criteria tracking started (see PRD Section 8.8)

---

## Ongoing Operations (Post-Onboarding)

After week 8, the partner enters steady-state operations:

| Activity | Frequency | Owner |
|----------|-----------|-------|
| Weekly advisor check-in | Weekly | Play New advisor |
| Skill library expansion (add 2-3 skills based on demand) | Biweekly | Play New advisor + engineer |
| Strategic context document update | Monthly | Play New advisor |
| Automate Intelligence Brief | Monthly | Play New advisor |
| Usage and adoption metrics review | Monthly | Customer success |
| Quarterly strategic review with leadership | Quarterly | Play New advisor + Matteo |
| User satisfaction survey | Monthly | Product team |

### Success Metrics to Track

| Metric | Target | Measurement |
|--------|--------|-------------|
| Weekly active users | >50% of deployed | System data (3+ interactions/week) |
| User trust | >70% comfortable | Monthly survey |
| Skill usefulness | 10+ skills rated "useful" | Skill feedback aggregation |
| Organizational intelligence | 1+ actionable insight | Leadership interview |
| Leadership action | 1+ concrete action taken | Documented decision |
| Privacy acceptance | No major objections | DPO/works-council feedback |

---

## Troubleshooting Common Issues

### Low adoption (< 30% weekly active)

**Diagnosis:**
- Check onboarding completion: did all users complete orientation?
- Check response quality: are assistant responses helpful?
- Check response time: are responses slow (>25s)?
- Check channel: are users on the right channel (Slack vs Teams)?

**Actions:**
- Re-run onboarding sessions for teams with low adoption.
- Ask champions to demonstrate usage in team meetings.
- Review skill assignments -- are the right skills assigned to the right roles?
- Check if privacy concerns are dampening usage (conduct anonymous survey).

### Privacy concerns raised

**Diagnosis:**
- What specific concern was raised? (data visibility, employer access, data retention)
- Who raised it? (individual user, works council, DPO)

**Actions:**
- If individual user: advisor explains privacy guarantees one-on-one. Show the user `/privacy` command.
- If works council: schedule a technical briefing with the technical architect. Demonstrate the anonymized views and the 5-user threshold.
- If DPO: provide the data processing impact assessment. Offer access to audit the anonymization views.

### Insufficient data for intelligence

**Diagnosis:**
- Check pattern log volume: are users active enough?
- Check team sizes: are teams large enough to meet the 5-user threshold?
- Check interaction types: are patterns diverse enough for meaningful analysis?

**Actions:**
- Extend the collection period (wait 2 more weeks before the first brief).
- Combine teams at the org level for analysis (use `v_org_patterns` instead of `v_team_patterns`).
- Focus on skill usage patterns (often hit threshold faster than work category patterns).
