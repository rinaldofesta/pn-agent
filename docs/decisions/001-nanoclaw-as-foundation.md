# ADR-001: Nanoclaw as Foundation

**Status:** Accepted
**Date:** 2026-02-25
**Deciders:** Rinaldo Festa (Technical Architect), Matteo Roversi (Product)
**Technical Story:** Play New needs a per-user AI assistant runtime with container isolation, Claude SDK integration, and a messaging channel layer.

---

## Context

Play New requires a runtime that gives every user their own isolated AI assistant instance. The core requirements are:

1. **Per-user isolation** -- each user's conversations and memory must be completely separated from every other user, enforced at the infrastructure level.
2. **Claude SDK integration** -- the assistant uses Claude as its primary LLM backbone.
3. **Messaging channel integration** -- users interact via Slack (and later Teams, email).
4. **Skill system** -- assistants execute structured skill definitions (SKILL.md files).
5. **MCP support** -- data source connections via Model Context Protocol.
6. **Container-based execution** -- each assistant instance runs in a Docker container for security isolation.

Building all of this from scratch would take months. [PRD Appendix D] identifies nanoclaw (github.com/qwibitai/nanoclaw) as a reference architecture that already provides most of these capabilities.

### What Nanoclaw Provides

Nanoclaw is an open-source framework for deploying self-generating AI assistants. It provides:

| Capability | Nanoclaw Implementation | Play New Need |
|-----------|------------------------|---------------|
| **Container isolation** | One Docker container per "group" (user/channel) | One container per user instance |
| **Claude SDK integration** | `agent-runner` uses Claude Anthropic SDK for inference | Claude as primary LLM |
| **Slack integration** | Slack Bolt SDK with Socket Mode and Events API | Slack as primary delivery channel |
| **Skill system** | SKILL.md format, skill registry, skill execution | Pre-built and auto-generated skills |
| **MCP support** | `.mcp.json` config, stdio MCP server management | Data source connections |
| **SQLite persistence** | `better-sqlite3` for chats, messages, sessions, tasks | Database layer |
| **Message routing** | Router dispatches messages to correct container | Multi-tenant message routing |
| **Session management** | Container lifecycle (start, idle, terminate) | User instance lifecycle |

### What Nanoclaw Does NOT Provide

| Capability | Play New Requirement |
|-----------|---------------------|
| **Multi-tenancy** | Organizations, teams, user instances. Nanoclaw has "groups" but no org hierarchy. |
| **Encryption** | User-scoped and org-scoped encryption at rest. Nanoclaw has no encryption layer. |
| **Anonymization engine** | Privacy boundary between personal data and organizational patterns. Not in nanoclaw. |
| **Organizational intelligence** | Pattern collection, aggregation, insight generation. Not in nanoclaw. |
| **RBAC** | Role-based access control (user, team_lead, leadership, advisor, admin). Nanoclaw has basic group-level auth. |
| **PostgreSQL support** | Production database. Nanoclaw uses SQLite only. |
| **Teams / Email channels** | Nanoclaw supports Slack only. |
| **Audit logging** | Comprehensive audit trail with hash chain. Not in nanoclaw. |

### Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| **Build from scratch** | Full control, no fork maintenance | 3-6 months just for the container isolation + Slack + Claude SDK layer. We need to launch Phase 0 in 5 months total. |
| **Use LangChain / CrewAI** | Large community, many integrations | Python-focused (team prefers TypeScript). No container isolation. No Slack integration out of the box. Agent-focused, not assistant-focused. |
| **Use Vercel AI SDK** | Modern TypeScript, good DX | No container isolation. No skill system. Web-focused, not Slack-focused. Would need to build most of what nanoclaw provides. |
| **Fork nanoclaw** | 80% of runtime already built. Container isolation proven. Same tech stack (TypeScript, Claude SDK, Slack). | Young project. Fork maintenance burden. Single-process architecture doesn't scale. |

---

## Decision

**Fork nanoclaw and extend its core abstractions for Play New's multi-tenant, privacy-first architecture.**

Specifically:
1. Fork the nanoclaw repository as `pn-agent`.
2. Map nanoclaw's "group" concept to Play New's "user instance" -- one group per user per organization.
3. Extend the database schema with org/team/user hierarchy, pattern logs, insights, and audit tables.
4. Add encryption, RBAC, and audit layers on top of nanoclaw's existing security model.
5. Build the anonymization engine, organizational intelligence, and MCP connector extensions as new modules.
6. Maintain a database abstraction layer to support both SQLite (nanoclaw compat, dev) and PostgreSQL (production).

---

## Consequences

### Positive

1. **Faster time to Phase 0.** We inherit container isolation, Slack integration, Claude SDK, skill system, and MCP support. This saves an estimated 8-12 weeks of development.
2. **Proven container isolation.** Nanoclaw's per-group container architecture is already debugged and tested. We avoid reinventing this critical security layer.
3. **Skill compatibility.** SKILL.md format is already defined and tested. Our pre-built skill library works out of the box.
4. **MCP foundation.** Nanoclaw's MCP server management (stdio, lifecycle, config) is production-ready. We extend it with multi-tenant credential injection.
5. **Community alignment.** If nanoclaw grows, we benefit from upstream improvements (new features, bug fixes, security patches).

### Negative

1. **Fork maintenance burden.** We must track nanoclaw upstream changes and merge them periodically. Conflicts will arise in files we modify.
2. **Single-process constraint.** Nanoclaw runs as a single Node.js process. For Phase 0 (150 users), this is acceptable. For Phase 1+ (2000+ users), we need to distribute -- which requires re-architecting the router, session manager, and database layer.
3. **SQLite assumption.** Nanoclaw's code assumes synchronous SQLite queries (`better-sqlite3`). Our database abstraction layer must translate this to async PostgreSQL without breaking nanoclaw's internals.
4. **Nanoclaw conventions.** Some nanoclaw naming conventions (group, registered_groups) don't map cleanly to Play New concepts. We maintain a mapping layer rather than renaming nanoclaw internals.

### Neutral

1. **TypeScript stack.** Nanoclaw uses TypeScript/Node.js. This matches our team's preference but limits certain ecosystem options (e.g., Python ML libraries for intelligence layer).
2. **Docker dependency.** Nanoclaw requires Docker for container isolation. This is a production requirement we would have had anyway, but it makes local development setup heavier.

---

## Fork Management Strategy

### Upstream Tracking

We maintain nanoclaw as an upstream remote:

```bash
git remote add upstream https://github.com/qwibitai/nanoclaw.git
```

### Merge Cadence

- **Weekly:** Check upstream for new commits. Review changelog.
- **Monthly:** Merge upstream if there are meaningful changes (new features, security fixes).
- **Immediately:** Merge any security-related upstream patches.

### Conflict Zones

Files we modify that may conflict with upstream:

| File / Directory | Our Changes | Conflict Risk |
|-----------------|-------------|---------------|
| `src/db.ts` | Add org_id, user_instance_id columns | High -- schema changes |
| `src/router.ts` | Add multi-tenant routing logic | Medium |
| `container/agent-runner/src/index.ts` | Extend MCP config generation | Medium |
| `package.json` | Add Play New dependencies | Low (additive) |
| New directories (`src/security/`, `src/intelligence/`, etc.) | Entirely new code | None (no upstream equivalent) |

### Merge Strategy

1. Use `git merge` (not rebase) to preserve clear merge history.
2. Keep Play New extensions in separate files/directories where possible (reduces conflicts).
3. When we must modify nanoclaw files, add clear `// PLAY NEW EXTENSION` comments.
4. If nanoclaw makes breaking changes in a file we've modified, we review the upstream change and decide whether to adopt, skip, or adapt.

### Contributing Back

If we develop improvements that would benefit nanoclaw (e.g., MCP server health monitoring, better container lifecycle management), we can submit PRs upstream. This reduces our fork divergence.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Nanoclaw makes breaking changes** | Medium | Medium | Pin to specific upstream commit. Merge selectively. Our abstraction layers insulate Play New code. |
| **Nanoclaw is abandoned** | Low | Low | We already have a full fork. We can maintain independently. The codebase is small enough (~5K LOC) to fully own. |
| **Single-process scaling limit** | High (Phase 1+) | High | Planned: distribute the router and container orchestrator in Phase 1. Database abstraction layer enables this. |
| **SQLite-to-PostgreSQL migration issues** | Medium | Medium | Database adapter pattern with dual implementations. Comprehensive integration tests on both backends. |
| **Nanoclaw licensing changes** | Low | Medium | Current MIT license. Fork preserves license at time of fork. |

---

## Review Date

This decision will be reviewed at the Phase 0 retrospective (approximately July 2026) to assess:
- Was the fork strategy effective?
- How much upstream divergence occurred?
- Is the single-process architecture a bottleneck?
- Should we consider a full rewrite of the runtime for Phase 1?
