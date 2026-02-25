# ADR-006: LLM Provider Strategy

**Status:** Accepted
**Date:** 2026-02-25
**Deciders:** Rinaldo Festa (Technical Architect), Matteo Roversi (Product)
**Technical Story:** Play New needs a strategy for LLM provider selection that balances reasoning quality, resilience, cost control, and vendor lock-in risk across interactive sessions and background tasks.

---

## Context

Play New uses LLMs for two fundamentally different workloads:

### Interactive Sessions (User-Facing)

When a user messages their assistant, the system runs an interactive session: the LLM receives the user's message, organizational context, skill instructions, and conversation history, and produces a response. This workload is:

- **Latency-sensitive:** <30s SLA for standard queries.
- **Quality-critical:** The response is the product. A poor response = poor user experience.
- **Context-heavy:** Long prompts (org context + skill + conversation history + MCP data).
- **Agentic:** The LLM may invoke tools (MCP connectors, skill execution steps) in multi-turn loops.

Nanoclaw uses the **Claude Agent SDK** (`@anthropic-ai/sdk`) for interactive sessions. The Agent SDK provides:
- Structured tool use (function calling).
- Multi-turn conversation management.
- Streaming responses.
- Built-in retry and error handling.
- Deep integration with Claude's reasoning capabilities.

The Agent SDK is tightly coupled to Claude. It is not an abstraction layer -- it speaks Claude's API protocol directly.

### Background Tasks (System-Level)

Play New also uses LLMs for non-interactive tasks:

- **Pattern classification:** Categorizing user interactions into the work taxonomy (L1/L2/L3 categories).
- **Skill quality scoring:** Evaluating skill output quality against defined criteria.
- **Content generalization:** Transforming specific tool names and actions into generalized categories for anonymization.
- **Intelligence generation (Phase 1+):** Producing insight drafts from aggregated pattern data.
- **Skill draft generation (Phase 1+):** Generating SKILL.md files from observed patterns.

These tasks are:
- **Latency-tolerant:** Seconds or minutes are acceptable.
- **Throughput-oriented:** Many small calls processed in batch.
- **Cost-sensitive:** High volume, low per-call value.
- **Quality-flexible:** Good-enough is sufficient (results are reviewed or aggregated).

### Key Considerations

1. **PRD requirement:** "Primary: Claude (Anthropic API). Fallback: GPT-4o (OpenAI API). Model-agnostic from day one." (PRD Section 20.1, Section 8.5)
2. **Nanoclaw dependency:** The `agent-runner` uses Claude Agent SDK throughout. Replacing it with a model-agnostic abstraction would require rewriting the core agent loop.
3. **Resilience:** Anthropic API outages would make the entire product unavailable without a fallback.
4. **Cost:** Claude API pricing is competitive but varies by model (Sonnet vs Opus). Background tasks should use the cheapest adequate model.
5. **Vendor lock-in:** The Agent SDK creates deep coupling to Claude for interactive sessions. Is this acceptable?

---

## Options Evaluated

### Option A: Claude Only

Use Claude (Anthropic API) exclusively for all workloads. No fallback provider.

| Aspect | Assessment |
|--------|------------|
| **Simplicity** | Maximum -- one API client, one billing relationship, one set of prompt patterns |
| **Quality** | Excellent -- Claude's reasoning is best-in-class for complex analysis tasks |
| **Resilience** | Poor -- Anthropic API outage = total product outage. No fallback. |
| **Cost optimization** | Limited -- can use Sonnet for lighter tasks, but still Anthropic pricing |
| **Vendor lock-in** | Maximum -- no ability to switch if Anthropic changes pricing, terms, or quality |

### Option B: Claude Primary + GPT-4o Fallback (Workload-Split)

Use Claude Agent SDK for interactive sessions (deeply integrated). Use a separate, swappable LLM client for background tasks that defaults to Claude but can fall back to GPT-4o (or other providers).

| Aspect | Assessment |
|--------|------------|
| **Simplicity** | Moderate -- two client libraries, but clear separation of concerns |
| **Quality** | Excellent for interactive (Claude Agent SDK). Adequate for background (any capable model). |
| **Resilience** | Good -- interactive sessions fail over to a degraded mode on Anthropic outage. Background tasks seamlessly switch to GPT-4o. |
| **Cost optimization** | Good -- background tasks can use the cheapest adequate model per task type |
| **Vendor lock-in** | Moderate -- interactive sessions are locked to Claude SDK, but that is the core experience and is hard to abstract anyway. Background tasks are provider-agnostic. |

### Option C: Multi-Model Abstraction from Day One

Build an abstraction layer (like LiteLLM or a custom router) that makes all LLM calls provider-agnostic. Route each call to the best model based on task type, cost, and availability.

| Aspect | Assessment |
|--------|------------|
| **Simplicity** | Low -- significant abstraction layer to build and maintain. Must handle different tool-calling protocols, response formats, streaming behaviors, and error patterns across providers. |
| **Quality** | Good -- best model per task. But abstraction layers add latency and may not fully utilize provider-specific features (Claude's extended thinking, GPT-4o's function calling nuances). |
| **Resilience** | Excellent -- automatic failover between providers for all workloads |
| **Cost optimization** | Best -- fine-grained routing per task type and model capability |
| **Vendor lock-in** | Minimal -- can switch providers transparently |

---

## Decision

**Option B: Claude Agent SDK for interactive sessions, separate swappable LLM client for background tasks.**

Specifically:

### Interactive Sessions (Agent SDK)

1. **The `agent-runner` (inside each user container) uses the Claude Agent SDK directly.** This is inherited from nanoclaw and is the core of the assistant experience.
2. **No abstraction layer wraps the Agent SDK.** The Agent SDK's tool use, streaming, and conversation management are deeply integrated with Claude's capabilities. Abstracting them would lose functionality and add latency.
3. **Model selection for interactive sessions:** Use Claude Sonnet for standard queries (fast, cost-effective). Escalate to Claude Opus for complex analysis skills (board-prep-synthesizer, decision-scenario-modeler) where reasoning quality is critical.
4. **Fallback on Anthropic outage:** Interactive sessions enter a degraded mode. The user receives: "I'm experiencing a temporary issue with my primary reasoning engine. I can still help with simpler requests. Complex analysis may be delayed." A basic completion client (GPT-4o) handles simple queries. Skills requiring tool use are queued for retry.

### Background Tasks (Swappable Client)

1. **A separate `LlmClient` interface handles all non-interactive LLM calls.** This interface is provider-agnostic:

```typescript
// src/llm/client.ts

interface LlmClient {
  /**
   * Simple text completion. No tool use, no streaming.
   * Used for classification, scoring, and text transformation tasks.
   */
  complete(params: CompletionParams): Promise<CompletionResult>;

  /**
   * Structured output (JSON mode).
   * Used for pattern classification and skill quality scoring.
   */
  completeStructured<T>(params: StructuredParams<T>): Promise<T>;

  /**
   * Provider and model metadata.
   */
  readonly provider: string;
  readonly model: string;
}

interface CompletionParams {
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  temperature?: number;
}

interface CompletionResult {
  text: string;
  usage: { inputTokens: number; outputTokens: number };
  latencyMs: number;
}

interface StructuredParams<T> {
  systemPrompt: string;
  userPrompt: string;
  schema: JsonSchema;       // Expected output shape
  maxTokens: number;
  temperature?: number;
}
```

2. **Default implementation uses Claude (Sonnet) for background tasks.** A `ClaudeLlmClient` implements the interface using the Anthropic Messages API (not the Agent SDK -- background tasks don't need tool use or streaming).

3. **Fallback implementation uses GPT-4o.** An `OpenAiLlmClient` implements the same interface. Configuration determines the default provider and fallback:

```typescript
// src/llm/factory.ts

function createLlmClient(config: LlmConfig): LlmClient {
  switch (config.provider) {
    case 'anthropic':
      return new ClaudeLlmClient({
        apiKey: config.anthropicApiKey,
        model: config.model || 'claude-sonnet-4-20250514',
      });
    case 'openai':
      return new OpenAiLlmClient({
        apiKey: config.openaiApiKey,
        model: config.model || 'gpt-4o',
      });
    default:
      throw new Error(`Unknown LLM provider: ${config.provider}`);
  }
}
```

4. **Automatic failover.** The `LlmClientWithFallback` wrapper tries the primary client and falls back on error:

```typescript
class LlmClientWithFallback implements LlmClient {
  constructor(
    private primary: LlmClient,
    private fallback: LlmClient,
    private metrics: MetricsCollector,
  ) {}

  async complete(params: CompletionParams): Promise<CompletionResult> {
    try {
      const result = await this.primary.complete(params);
      this.metrics.recordSuccess(this.primary.provider);
      return result;
    } catch (error) {
      this.metrics.recordFailover(this.primary.provider, this.fallback.provider, error);
      return this.fallback.complete(params);
    }
  }
}
```

### Cost Tracking

Every LLM call (interactive and background) records usage for per-org cost attribution:

```sql
INSERT INTO llm_usage_logs (
    org_id,
    user_instance_id,      -- NULL for background tasks
    provider,               -- 'anthropic' | 'openai'
    model,                  -- 'claude-sonnet-4-20250514' | 'gpt-4o' | ...
    task_type,              -- 'interactive' | 'classification' | 'scoring' | ...
    input_tokens,
    output_tokens,
    latency_ms,
    estimated_cost_eur,     -- computed from provider pricing table
    created_at
);
```

This enables:
- Per-org cost reporting (for pricing validation in Phase 0).
- Per-provider cost comparison (for negotiation leverage).
- Per-task-type cost analysis (optimize which model handles which task).
- Latency monitoring by provider and model.

---

## Consequences

### Positive

1. **Fast delivery.** The Agent SDK is already integrated via nanoclaw. No abstraction layer to build for the core experience. Background task client is a simple interface with two implementations.
2. **Best reasoning quality where it matters.** Interactive sessions use Claude's full Agent SDK capabilities (tool use, extended thinking, structured output). This is the product's core experience, and Claude is the best reasoning model for complex analysis tasks.
3. **Resilience for background tasks.** Pattern classification, skill scoring, and content generalization seamlessly fail over to GPT-4o if Anthropic is unavailable. These tasks are latency-tolerant and quality-flexible.
4. **Cost optimization.** Background tasks (high volume, lower quality requirements) can use cheaper models. Interactive sessions use Sonnet by default, escalating to Opus only for complex skills. This optimizes the cost curve.
5. **Per-org cost tracking.** Usage logs enable accurate cost attribution, which is essential for Phase 1 pricing validation and Phase 2 unit economics.
6. **Incremental abstraction.** If we need to add a third provider (Gemini, open-source models), we implement the `LlmClient` interface. No existing code changes.

### Negative

1. **Vendor lock-in for interactive sessions.** The Agent SDK creates deep coupling to Claude. If Anthropic significantly raises prices, degrades quality, or changes terms, migrating interactive sessions to another provider would require rewriting the agent-runner. This is the most significant risk.
2. **Two client patterns.** Developers must understand when to use the Agent SDK (interactive) vs the LlmClient (background). This adds cognitive overhead.
3. **Degraded interactive experience on Anthropic outage.** The fallback for interactive sessions is limited. GPT-4o cannot replicate Claude Agent SDK's tool use patterns without significant adaptation. Users will notice reduced capability.
4. **Prompt engineering per provider.** Background task prompts may need provider-specific tuning. Claude and GPT-4o have different instruction-following characteristics. The fallback may produce lower quality results.

### Neutral

1. **Agent SDK versioning.** The Claude Agent SDK is actively developed. API changes may require agent-runner updates. This is a maintenance cost we would have regardless of this decision.
2. **Model version pinning.** We pin specific model versions (e.g., `claude-sonnet-4-20250514`) in configuration, not code. Model upgrades are a configuration change, tested in staging before production rollout.

---

## Model Selection Guide

| Task Type | Default Model | Rationale | Fallback |
|-----------|--------------|-----------|----------|
| **Interactive: standard queries** | Claude Sonnet | Fast, cost-effective, good reasoning | GPT-4o (degraded mode) |
| **Interactive: complex analysis skills** | Claude Opus | Best reasoning for multi-step analysis | Claude Sonnet (reduced quality) |
| **Background: pattern classification** | Claude Haiku (or Sonnet) | High volume, simple classification | GPT-4o-mini |
| **Background: skill quality scoring** | Claude Sonnet | Moderate complexity, structured output | GPT-4o |
| **Background: content generalization** | Claude Haiku | Simple text transformation | GPT-4o-mini |
| **Background: insight generation (Phase 1+)** | Claude Sonnet | Strategic analysis quality matters | GPT-4o |
| **Background: skill draft generation (Phase 1+)** | Claude Opus | Complex, multi-section document generation | Claude Sonnet |

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Anthropic significantly raises API pricing** | Medium | High | Cost tracking enables early detection. Background tasks already have GPT-4o fallback. For interactive sessions, evaluate building an Agent SDK-compatible wrapper around other providers (significant effort, but possible). |
| **Anthropic API extended outage (>1 hour)** | Low | High | Background tasks fail over automatically. Interactive sessions enter degraded mode. Proactive user communication via channel (Slack/Teams). SLA for Phase 0 is 99.5% during business hours -- allows for occasional outages. |
| **Claude Agent SDK breaking changes** | Medium | Medium | Pin SDK version. Test upgrades in staging. Nanoclaw community will likely address major breaking changes. |
| **GPT-4o fallback produces significantly worse results** | Medium | Medium | Monitor fallback quality metrics. Tune GPT-4o prompts separately from Claude prompts. Accept that fallback is "good enough," not "equal." |
| **Cost tracking adds performance overhead** | Low | Low | Usage logging is async (fire-and-forget to a write queue). Does not block LLM response delivery. |
| **Model quality regression on provider version updates** | Medium | Medium | Pin model versions. Test new versions against a quality benchmark suite before adopting. Rollback is a config change. |

---

## Review Date

This decision will be reviewed at the Phase 0 midpoint (approximately May 2026) to assess:
- What is the actual cost split between interactive and background LLM usage?
- Has the Agent SDK lock-in created any practical problems?
- How often does GPT-4o fallback activate for background tasks?
- Is the model selection guide producing acceptable quality across all task types?
- Should we invest in a more sophisticated routing layer for Phase 1?
