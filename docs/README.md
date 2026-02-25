# Play New (pn-agent) -- Technical Documentation

**Version:** 0.1.0
**Last Updated:** 2026-02-25
**Status:** Draft -- Pre-Phase 0 Architecture

---

## How to Read These Docs

This documentation set translates the Play New PRD (the "what") into technical specifications (the "how"). The PRD lives at `/PRD.md` in the repository root. These docs live in `/docs/`.

**Recommended reading order:**

```
1. This README                          -- Orientation, document index
2. architecture/00-system-overview      -- Full system picture, tech stack, repo layout
3. architecture/01-nanoclaw-foundation  -- What we inherit, what we build
4. architecture/02-multi-tenant         -- Org/user/instance isolation model
5. architecture/03-container-isolation  -- Per-user container design
6. architecture/04-data-flow            -- End-to-end message and data flows
7. architecture/05-privacy-boundary     -- Anonymization engine, encryption, GDPR
8. architecture/06-deployment           -- Infrastructure, scaling, monitoring, cost
```

After architecture docs, explore the `specs/` directory for component-level detail and `decisions/` for ADRs (Architecture Decision Records).

---

## Relationship to PRD

| Artifact | Purpose | Audience |
|----------|---------|----------|
| `PRD.md` | **What** to build, **why**, success criteria, business model | Product, leadership, advisors |
| `docs/architecture/` | **How** to build it -- system design, component interactions, technical decisions | Engineering, technical architect |
| `docs/specs/` | **Detailed how** -- component-level specifications, interfaces, schemas | Engineers implementing features |
| `docs/guides/` | **How to operate** -- runbooks, onboarding checklists, deployment procedures | Engineering, DevOps, advisors |
| `docs/decisions/` | **Why this way** -- ADRs recording key technical decisions and their rationale | Engineering, future team members |

---

## Document Index

| # | Document | Status | Owner | Last Updated | Description |
|---|----------|--------|-------|--------------|-------------|
| 0 | [System Overview](architecture/00-system-overview.md) | Draft | TBD | 2026-02-25 | High-level architecture, tech stack, repo structure |
| 1 | [Nanoclaw Foundation](architecture/01-nanoclaw-foundation.md) | Draft | TBD | 2026-02-25 | What nanoclaw provides, mapping to Play New |
| 2 | [Multi-Tenant Architecture](architecture/02-multi-tenant-architecture.md) | Draft | TBD | 2026-02-25 | Org/user isolation, routing, config hierarchy |
| 3 | [Container Isolation Model](architecture/03-container-isolation-model.md) | Draft | TBD | 2026-02-25 | Per-user containers, mounts, secrets, images |
| 4 | [Data Flow Architecture](architecture/04-data-flow-architecture.md) | Draft | TBD | 2026-02-25 | Message flows, pattern collection, skill execution |
| 5 | [Privacy Boundary Architecture](architecture/05-privacy-boundary-architecture.md) | Draft | TBD | 2026-02-25 | Anonymization engine, encryption, data controls |
| 6 | [Deployment Architecture](architecture/06-deployment-architecture.md) | Draft | TBD | 2026-02-25 | Infrastructure, scaling, monitoring, cost |

### Planned Specs (docs/specs/)

| Directory | Planned Documents | Status |
|-----------|-------------------|--------|
| `specs/channels/` | Slack integration, Teams integration, Email bridge | Not started |
| `specs/skills/` | Skill engine spec, SKILL.md format, skill registry | Not started |
| `specs/memory/` | Personal memory spec, vector DB design, RAG pipeline | Not started |
| `specs/intelligence/` | Pattern collection spec, Automate stream spec | Not started |
| `specs/data/` | Database schema, cross-org benchmarking schema | Not started |
| `specs/security/` | Encryption spec, auth spec, audit log spec | Not started |

### Planned Guides (docs/guides/)

| Document | Status |
|----------|--------|
| Local development setup | Not started |
| Design partner onboarding runbook | Not started |
| Deployment runbook | Not started |
| Incident response playbook | Not started |

### Planned Decisions (docs/decisions/)

| Decision | Status |
|----------|--------|
| ADR-001: Vector DB selection | Not started |
| ADR-002: LLM backbone strategy | Not started |
| ADR-003: Nanoclaw fork strategy | Not started |
| ADR-004: Queue technology | Not started |

---

## PRD-to-Spec Cross-Reference

This table maps every PRD section to the corresponding technical document(s) that specify its implementation.

| PRD Section | PRD Title | Technical Document(s) |
|-------------|-----------|----------------------|
| 6.1 | Architecture Philosophy | [00-system-overview](architecture/00-system-overview.md) |
| 6.2 | System Architecture Overview | [00-system-overview](architecture/00-system-overview.md) |
| 6.3.1 | Personal Assistant Runtime | [01-nanoclaw-foundation](architecture/01-nanoclaw-foundation.md), [03-container-isolation](architecture/03-container-isolation-model.md) |
| 6.3.2 | Skill Engine | [01-nanoclaw-foundation](architecture/01-nanoclaw-foundation.md), `specs/skills/` (planned) |
| 6.3.3 | Anonymization Engine | [05-privacy-boundary](architecture/05-privacy-boundary-architecture.md) |
| 6.3.4 | Organizational Intelligence Layer | [04-data-flow](architecture/04-data-flow-architecture.md), `specs/intelligence/` (planned) |
| 6.3.5 | Organizational Context Engine | [04-data-flow](architecture/04-data-flow-architecture.md), `specs/memory/` (planned) |
| 7 | Privacy Architecture | [05-privacy-boundary](architecture/05-privacy-boundary-architecture.md) |
| 8.4 FR-001 | Personal Assistant Core | [02-multi-tenant](architecture/02-multi-tenant-architecture.md), [03-container-isolation](architecture/03-container-isolation-model.md) |
| 8.4 FR-002 | Forward Mode | [04-data-flow](architecture/04-data-flow-architecture.md), `specs/channels/` (planned) |
| 8.4 FR-003 | Skill System | [01-nanoclaw-foundation](architecture/01-nanoclaw-foundation.md), `specs/skills/` (planned) |
| 8.4 FR-004 | Organizational Context | [04-data-flow](architecture/04-data-flow-architecture.md), `specs/memory/` (planned) |
| 8.4 FR-005 | Pattern Collection | [04-data-flow](architecture/04-data-flow-architecture.md), [05-privacy-boundary](architecture/05-privacy-boundary-architecture.md) |
| 8.4 FR-006 | Automate Intelligence Stream | [04-data-flow](architecture/04-data-flow-architecture.md), `specs/intelligence/` (planned) |
| 8.4 FR-007 | Admin & Operations | [06-deployment](architecture/06-deployment-architecture.md) |
| 8.5 | Non-Functional Requirements | [06-deployment](architecture/06-deployment-architecture.md), [05-privacy-boundary](architecture/05-privacy-boundary-architecture.md) |
| 12 | Skill Engine Specification | [01-nanoclaw-foundation](architecture/01-nanoclaw-foundation.md), `specs/skills/` (planned) |
| 13 | Organizational Intelligence Layer | [04-data-flow](architecture/04-data-flow-architecture.md), [05-privacy-boundary](architecture/05-privacy-boundary-architecture.md) |
| 14 | Integration Specifications | `specs/channels/` (planned), [04-data-flow](architecture/04-data-flow-architecture.md) |
| 15 | Data Model & Cross-Org Schema | [05-privacy-boundary](architecture/05-privacy-boundary-architecture.md), `specs/data/` (planned) |
| 16 | Delivery & Interface Design | `specs/channels/` (planned), [04-data-flow](architecture/04-data-flow-architecture.md) |
| 20 | Technical Requirements & Infrastructure | [06-deployment](architecture/06-deployment-architecture.md) |

---

## Conventions

- **ASCII diagrams** are used throughout for portability. They render in any editor or terminal.
- **PRD references** use the format `[PRD S6.2]` to cite PRD sections.
- **Nanoclaw references** use the format `[nc: src/router.ts]` to cite nanoclaw source files.
- **Phase tags** use `[Phase 0]`, `[Phase 1]`, `[Phase 2+]` to indicate when a feature ships.
- **Open questions** are marked with `[OQ-NNN]` and collected at the end of each document.

---

## Contributing

When adding or updating documentation:

1. Update the document index table above.
2. Update the Last Updated date in the document header.
3. If adding a new PRD mapping, update the cross-reference table.
4. Follow the document structure convention (Context, Nanoclaw Foundation, Play New Requirements, Technical Specification, Phase 0 Scope, Open Questions).
5. Use ASCII diagrams -- do not embed images.
