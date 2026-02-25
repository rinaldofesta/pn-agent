# ADR-004: Skill Format Compatibility

**Status:** Accepted
**Date:** 2026-02-25
**Deciders:** Rinaldo Festa (Technical Architect), Matteo Roversi (Product)
**Technical Story:** Play New has two distinct types of "skills" -- nanoclaw platform skills (code modification instructions) and Play New user skills (LLM task instructions). We need a strategy that keeps both working without confusion.

---

## Context

The word "skill" in pn-agent refers to two fundamentally different things:

### Nanoclaw Platform Skills

Nanoclaw uses a `SKILL.md` format to describe code modifications that Claude Code applies to the codebase. These are developer-facing, infrastructure-level instructions:

- **Purpose:** Teach Claude Code how to modify the pn-agent codebase (add a feature, integrate a service, refactor a module).
- **Location:** `.claude/skills/{skill-name}/SKILL.md`
- **Companion files:** `manifest.yaml` (metadata, file targets), code templates, test fixtures.
- **Execution model:** Claude Code reads the SKILL.md + manifest, applies a three-way git merge to modify source files, and commits the result.
- **Audience:** Developers contributing to the platform.
- **Example:** "add-slack" skill that adds Slack integration to nanoclaw by modifying `container/agent-runner/src/index.ts` and adding Slack SDK configuration.

### Play New User Skills

Play New uses a `SKILL.md` format to describe tasks the AI assistant performs for end users. These are user-facing, runtime-level instructions:

- **Purpose:** Teach the Claude-powered assistant how to execute a specific task (summarize an email, scan a pipeline, prepare a board brief).
- **Location:** `skills/{category}/{skill-id}/SKILL.md`
- **Companion files:** None -- self-contained markdown.
- **Execution model:** The skill engine parses the SKILL.md, injects it into the LLM prompt alongside user context, and Claude generates a response following the skill instructions.
- **Audience:** End users (knowledge workers) via their personal assistant.
- **Example:** "Pipeline Risk Scan" skill that pulls CRM data and produces a risk assessment for the user's deals.

Both formats use `SKILL.md` as the filename and share the `# SKILL: {name}` heading convention. But they serve entirely different purposes, have different section structures, different execution models, and different lifecycles.

### The Problem

Without a clear separation strategy, there is risk of:

1. **Developer confusion:** A contributor might modify a user skill thinking it is a platform skill, or vice versa.
2. **Tool conflicts:** If the skill engine scans for `SKILL.md` files, it might pick up platform skills and try to serve them to users.
3. **Upstream merge conflicts:** If nanoclaw changes its SKILL.md format, we need to be certain which files are affected.
4. **Documentation ambiguity:** References to "skills" without qualification become confusing.

---

## Options Evaluated

### Option A: Unify Into a Single Format

Merge both skill types into one format with a `type` field in metadata (`type: platform` vs `type: user`).

| Aspect | Assessment |
|--------|------------|
| **Simplicity** | Single format to document and maintain |
| **Risk** | High -- the formats serve fundamentally different purposes. Forcing them into one schema would require either (a) a very generic format that serves neither purpose well, or (b) extensive conditional sections. |
| **Nanoclaw compat** | Would break nanoclaw's SKILL.md format. Every upstream merge would conflict. |
| **Clarity** | Poor -- developers must read the `type` field to understand what a file does |

### Option B: Rename One Format

Rename Play New user skills to a different filename (e.g., `TASK.md`, `CAPABILITY.md`, `PLAYBOOK.md`) to eliminate filename collision.

| Aspect | Assessment |
|--------|------------|
| **Simplicity** | Clear differentiation at the filename level |
| **Risk** | Low technical risk. But introduces a new concept name that doesn't align with the PRD (which uses "skill" throughout). |
| **Nanoclaw compat** | Excellent -- nanoclaw's SKILL.md files are untouched |
| **Clarity** | Good for developers, confusing for product/business stakeholders who think in terms of "skills" |

### Option C: Separate Directories, Same Format Name

Keep `SKILL.md` as the filename for both types. Differentiate by directory:
- `.claude/skills/` for platform skills (nanoclaw convention)
- `skills/` for user skills (Play New convention)

The skill engine only scans `skills/`. Claude Code only scans `.claude/skills/`.

| Aspect | Assessment |
|--------|------------|
| **Simplicity** | Convention-based separation. No format changes. |
| **Risk** | Low -- directory-based separation is a well-understood pattern. The skill engine's scan path is configurable. |
| **Nanoclaw compat** | Excellent -- `.claude/skills/` directory is unchanged |
| **Clarity** | Requires documentation. Directory convention must be understood by contributors. |

---

## Decision

**Option C: Separate directories, same format name.**

Specifically:

1. **Platform skills** (nanoclaw-style) live in `.claude/skills/{skill-name}/SKILL.md` with their existing `manifest.yaml` companion files. This directory is owned by nanoclaw's convention and is read by Claude Code during development.

2. **User skills** (Play New-style) live in `skills/{category}/{skill-id}/SKILL.md` as self-contained markdown files. This directory is owned by Play New's skill engine and is read at runtime to provide assistant capabilities to end users.

3. **The skill engine** (`src/skills/skill-registry.ts`) scans **only** `skills/` when syncing skill definitions to the database. It ignores `.claude/skills/` entirely.

4. **Claude Code** (`.claude/` directory) scans **only** `.claude/skills/` for platform skills. It ignores `skills/` during code modification tasks.

5. **Naming convention in documentation:** When ambiguity is possible, use "platform skill" for nanoclaw-style and "user skill" for Play New-style. In user-facing contexts (PRD, product documentation, advisor materials), "skill" always means "user skill."

6. **Nanoclaw's SKILL.md format** (in `.claude/skills/`) remains unchanged. We do not modify it, extend it, or add Play New-specific sections. This preserves upstream compatibility.

7. **Play New's SKILL.md format** (in `skills/`) follows the specification in `docs/specs/skills/skill-md-format.md`. It shares the `# SKILL:` heading convention but has entirely different required sections (`## Trigger`, `## Context Required`, `## Instructions`, `## Output Format`) from nanoclaw's format.

### Directory Layout

```
pn-agent/
  .claude/
    skills/                          # Platform skills (nanoclaw)
      add-slack/
        SKILL.md                     # Code modification instructions
        manifest.yaml                # File targets, metadata
      add-mcp-connector/
        SKILL.md
        manifest.yaml
      ...

  skills/                            # User skills (Play New)
    communication/
      email-summarizer/
        SKILL.md                     # LLM task instructions
      response-drafter/
        SKILL.md
      ...
    sales/
      pipeline-risk-scan/
        SKILL.md
      ...
    analysis/
    operations/
    strategy/
    management/
```

### Format Comparison

| Aspect | Platform Skill (`.claude/skills/`) | User Skill (`skills/`) |
|--------|-----------------------------------|----------------------|
| **Heading** | `# SKILL: {name}` | `# SKILL: {name}` |
| **Metadata** | In `manifest.yaml` (YAML) | In `## Metadata` section (markdown list items) |
| **Core sections** | Description, files to modify, code patterns, tests | Trigger, Context Required, Instructions, Output Format |
| **Optional sections** | Dependencies, rollback plan | Quality Criteria, Feedback Loop, MCP Connectors Required |
| **Companion files** | `manifest.yaml`, templates, fixtures | None (self-contained) |
| **Executor** | Claude Code agent | Claude API via skill engine |
| **Lifecycle** | Applied once per codebase version | Executed repeatedly for users |
| **Validation** | Claude Code's built-in skill validation | `validateSkillMd()` function (see `skill-md-format.md`) |

---

## Consequences

### Positive

1. **Upstream compatibility preserved.** Nanoclaw's `.claude/skills/` directory is untouched. Upstream merges will not conflict with our user skill files because they live in a completely separate directory tree.
2. **Clear scanning boundaries.** The skill engine has a single, unambiguous scan path (`skills/`). No risk of accidentally parsing a platform skill as a user skill or vice versa.
3. **Familiar naming for all audiences.** Product stakeholders, advisors, and users all use "skill" to mean the user-facing capability, which aligns with the PRD. Developers understand the platform skill distinction through directory convention.
4. **Independent evolution.** If nanoclaw changes its SKILL.md format (new sections, different structure), it does not affect Play New's user skill format. The two formats can evolve independently.
5. **Simple onboarding.** A new developer reads the directory structure and immediately understands: `.claude/` is for development tooling, `skills/` is for the product runtime.

### Negative

1. **Name collision.** Both types use `SKILL.md`. A text search for "SKILL.md" returns results from both directories. Developers must be aware of the directory context.
2. **Documentation overhead.** Every reference to "skills" in technical documentation must be qualified (platform vs. user) or the reader must infer from context. This is a recurring communication cost.
3. **Potential for future confusion.** If a third type of skill emerges (e.g., "org-level skills" in Phase 2 that advisors create for an organization), the directory convention must extend cleanly. We address this below.

### Neutral

1. **Org-specific skill overrides.** Per-org customizations of user skills (see `skill-library-spec.md`, Open Question 1) are stored in the database (`skill_overrides` table), not as additional SKILL.md files. This keeps the file-based library clean and avoids directory proliferation.

---

## Future Skill Types

If additional skill types emerge in later phases, they follow the same directory convention:

| Skill Type | Directory | Phase | Description |
|-----------|-----------|-------|-------------|
| **Platform** | `.claude/skills/` | All | Code modification instructions for developers |
| **User (pre-built)** | `skills/` | 0+ | Pre-built library of user-facing skills |
| **User (auto-generated)** | Database only | 1+ | System-generated skills stored in `skill_definitions` table. No SKILL.md file on disk. |
| **User (marketplace)** | Database only | 2+ | Skills imported from cross-org marketplace. Stored in database. |
| **Org-level** | Database (`skill_overrides`) | 1+ | Advisor-customized variants of pre-built skills for a specific org. |

The key principle: pre-built skills that ship with the product live as files in `skills/`. Everything else lives in the database with SKILL.md content stored as a text column. This keeps the repository manageable while supporting dynamic skill creation at scale.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Developer edits wrong SKILL.md type** | Low | Low | Directory structure is self-documenting. Add a comment header to each SKILL.md indicating its type. Code review catches misplaced edits. |
| **Skill engine accidentally scans .claude/ directory** | Very Low | Medium | Skill scan path is explicitly configured (`SKILL_LIBRARY_PATH=./skills`). Integration test verifies the engine does not load platform skills. |
| **Nanoclaw renames .claude/skills/ directory** | Very Low | Low | Our code does not depend on nanoclaw's skill directory. Only Claude Code reads it. An upstream rename does not affect our skill engine. |
| **Terminology confusion in team communication** | Medium | Low | Establish convention: "skill" = user skill in all product contexts. "Platform skill" or "Claude Code skill" when referring to `.claude/skills/`. Enforce in PR reviews. |
| **Third skill type breaks convention** | Low | Low | The directory + database separation pattern extends naturally. Pre-built = files. Dynamic = database. No new convention needed. |

---

## Review Date

This decision is unlikely to require revision unless nanoclaw fundamentally changes its skill architecture. Review if nanoclaw introduces a skill registry that conflicts with our `skills/` directory, or if the number of skill types exceeds what the current convention can handle cleanly (estimated: not before Phase 2).
