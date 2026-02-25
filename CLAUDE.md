# Play New (pn-agent)

Continuous strategic intelligence platform. Personal AI assistants for every user + anonymized organizational intelligence. Built on [nanoclaw](https://github.com/qwibitai/nanoclaw).

## Architecture

**Dual-layer system:**
- **Layer 1 — Personal Assistant:** Per-user isolated AI instances delivered via Slack/Teams/Email. Each has personal memory, org context injection, and skills.
- **Layer 2 — Organizational Intelligence:** Anonymized aggregation of usage patterns into strategic insights (Automate/Differentiate/Innovate streams).

**Nanoclaw foundation:** This repo is a fork of nanoclaw. The key mapping: nanoclaw's "group" = Play New's "user instance." We inherit container isolation, Channel interface, task scheduler, skills engine, and Claude Agent SDK integration.

## Key Files

### Nanoclaw Core (inherited)
| File | Purpose |
|------|---------|
| `src/index.ts` | Orchestrator: state, message loop, agent invocation |
| `src/types.ts` | Core interfaces: Channel, RegisteredGroup, NewMessage, ScheduledTask |
| `src/channels/whatsapp.ts` | WhatsApp channel (nanoclaw default — Play New uses Slack/Teams) |
| `src/router.ts` | Message formatting and outbound routing |
| `src/config.ts` | Configuration: trigger patterns, paths, intervals |
| `src/container-runner.ts` | Spawns agent containers with mounts |
| `src/task-scheduler.ts` | Runs scheduled tasks (cron/interval/once) |
| `src/db.ts` | SQLite operations |
| `src/ipc.ts` | IPC watcher and task processing |
| `container/agent-runner/src/index.ts` | Agent entry point inside containers (Claude SDK integration) |

### Play New Extensions
| File | Purpose |
|------|---------|
| `src/channels/slack.ts` | Slack channel (primary for Phase 0) |
| `src/channels/teams.ts` | Teams channel |
| `src/channels/email-bridge.ts` | Email forward-mode bridge |
| `src/playnew/types.ts` | Play New types: UserInstance, Organization, Team, Skill |
| `src/playnew/tenant-resolver.ts` | Multi-tenant routing: channel ID → org + user instance |
| `src/playnew/pattern-collector.ts` | Categorical pattern logging (never content) |
| `src/playnew/context-engine.ts` | Org context RAG injection |
| `src/playnew/skill-runtime.ts` | User skill (SKILL.md) execution engine |
| `skills/` | User-facing skill library (SKILL.md format) |
| `groups/{name}/CLAUDE.md` | Per-group/user memory (isolated) |

## Documentation

| Category | Location | Purpose |
|----------|----------|---------|
| PRD | `PRD.md` | What we build (business requirements) |
| Architecture | `docs/architecture/` | How the system is designed |
| Specs | `docs/specs/` | Detailed technical specifications |
| Guides | `docs/guides/` | How-to documents |
| Decisions | `docs/decisions/` | Architecture Decision Records (ADRs) |
| Nanoclaw Reference | `docs/nanoclaw-reference/` | Original nanoclaw documentation |

## Development

```bash
npm run dev          # Run with hot reload
npm run build        # Compile TypeScript
npm test             # Run tests (vitest)
npm run typecheck    # TypeScript type checking
./container/build.sh # Rebuild agent container
```

## Key Conventions

- **Privacy is architecture, not a feature.** Personal data encrypted with user-scoped keys. Anonymization boundary enforced at DB level (PostgreSQL views with min 5-user threshold).
- **Skills over features.** New capabilities are SKILL.md files, not code changes.
- **Two types of skills:** Platform skills (`.claude/skills/`, nanoclaw-style code modification) vs User skills (`skills/`, LLM instruction documents for end users).
- **Wrap, don't build.** Use Claude/GPT as inference backbone. Build the context, skill, and intelligence layers.
- **Forward mode first (Phase 0).** Users push content to their assistant. No passive observation yet.

## Upstream Sync

```bash
git fetch upstream
git merge upstream/main  # Merge nanoclaw updates
```

Nanoclaw core files are in `src/`. Play New extensions are in `src/playnew/` and `src/channels/`. Conflicts should be rare since we extend rather than modify nanoclaw core.
