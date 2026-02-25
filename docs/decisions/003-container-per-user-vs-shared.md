# ADR-003: Container Per User vs Shared

**Status:** Accepted
**Date:** 2026-02-25
**Deciders:** Rinaldo Festa (Technical Architect), Matteo Roversi (Product)
**Technical Story:** Play New needs a container isolation model that balances security, latency, resource usage, and operational complexity for running per-user AI assistant instances.

---

## Context

Play New gives every user their own isolated AI assistant instance. Each instance runs inside a Docker container that hosts the `agent-runner` process: Claude SDK, MCP servers, skill executor, and personal memory access. The question is how container lifecycles map to user sessions.

Nanoclaw's default model is **ephemeral container per invocation**: when a user sends a message, the system spawns a container, processes the message, and tears the container down. This provides strong isolation but introduces latency on every interaction.

Play New has specific constraints that make this decision non-trivial:

1. **Security is non-negotiable.** Personal conversations are encrypted and isolated per user. A shared container that processes multiple users' data would violate the privacy architecture (PRD Section 7).
2. **Response time SLA is <30 seconds** for standard queries (PRD Section 8.5). This includes container lifecycle overhead.
3. **Phase 0 scale is modest:** 150 concurrent users across 3 organizations.
4. **Phase 1+ scale is significant:** 2,000+ users, potentially 5,000+ in Phase 2.
5. **Resource budget is limited in Phase 0:** EU cloud infrastructure cost target of ~EUR 2-5K/month (PRD Section 20.2).

---

## Options Evaluated

### Option A: Ephemeral Container Per Invocation (Nanoclaw Default)

A new container is spawned for every user message (or batch of messages within a short window). The container runs the agent-runner, processes the message, produces a response, and terminates.

| Aspect | Assessment |
|--------|------------|
| **Security** | Excellent -- each invocation gets a fresh container. No state leakage between invocations. No risk of one user's data persisting in memory for another. |
| **Latency** | Moderate -- container spawn (~1-3s) + SDK initialization (~1-2s) + context loading (~1-3s) = ~3-8s overhead per invocation. Well within the 30s SLA for typical queries. |
| **Resource usage** | Higher per-invocation cost but zero idle cost. Containers exist only while processing. |
| **Complexity** | Low -- matches nanoclaw's existing architecture. No session affinity, no health monitoring for long-running containers. |
| **Scalability** | Limited by container spawn rate. Docker daemon can handle ~10-20 concurrent spawns. Beyond that, requires container pooling or orchestrator support. |
| **Data consistency** | Stateless -- all state lives in the database. No risk of container crash losing in-memory state. |

### Option B: Persistent Long-Running Container Per User

Each user gets a dedicated container that starts on first message and stays running for the duration of their session (or indefinitely). The container maintains a warm Claude SDK client, loaded MCP connections, and in-memory context cache.

| Aspect | Assessment |
|--------|------------|
| **Security** | Good -- one container per user, strong isolation. But long-running containers accumulate state in memory, increasing the surface area if compromised. |
| **Latency** | Excellent after first message -- no spawn overhead. First message still incurs cold start. Subsequent messages are near-instant (SDK already initialized, context cached). |
| **Resource usage** | High -- each active user consumes ~512 MB continuously. 150 users = ~75 GB memory. 2,000 users = ~1 TB. Not feasible without aggressive idle management. |
| **Complexity** | High -- requires session affinity (route messages to the correct container), health monitoring, graceful restart on crash, idle timeout management, container migration during deployments. |
| **Scalability** | Poor at scale -- memory-bound. Requires aggressive idle eviction (terminate containers after N minutes of inactivity) which reintroduces cold start for returning users. |
| **Data consistency** | Risk -- in-memory state can be lost on container crash. Requires careful state persistence or acceptance of state loss. |

### Option C: Shared Container Pool with Runtime Isolation

A pool of pre-warmed containers handles requests from multiple users. Each container processes one request at a time but is returned to the pool after completion. User isolation is enforced at the application layer (separate memory namespaces, credential injection per request).

| Aspect | Assessment |
|--------|------------|
| **Security** | Weak -- multiple users' data flows through the same container process. Even with namespace isolation, residual state in memory (LLM context, MCP connections, temporary files) could leak between users. This violates Play New's "infrastructure-level isolation" principle (PRD Section 6.3.1). |
| **Latency** | Excellent -- containers are pre-warmed. No spawn overhead. SDK is pre-initialized. |
| **Resource usage** | Efficient -- small pool of containers serves many users. 10-20 containers could serve 150 users. |
| **Complexity** | Very high -- request queuing, pool sizing, per-request credential injection, per-request memory namespace switching, cleanup validation between requests. |
| **Scalability** | Good -- pool size scales linearly with concurrent request rate, not total users. |
| **Data consistency** | Risk -- container reuse means thorough cleanup is critical. A bug in cleanup = cross-user data leak. |

---

## Decision

**Phase 0: Ephemeral container per invocation (Option A), inheriting nanoclaw's default model.**

**Phase 1: Evaluate persistent containers (Option B) with idle timeout if latency data from Phase 0 indicates cold start is approaching the 30s SLA boundary.**

Option C (shared pool) is rejected for all phases because it conflicts with Play New's infrastructure-level privacy isolation requirement. The risk of cross-user data leakage in a shared container -- even with application-layer safeguards -- is unacceptable for a product whose core trust promise is "your data is invisible to everyone else."

Specifically for Phase 0:

1. Inherit nanoclaw's ephemeral container lifecycle without modification.
2. Each user message triggers: spawn container -> inject credentials -> load context -> process -> respond -> terminate.
3. Container image is pre-built and cached locally (`pn-agent-runner:latest`), eliminating image pull latency.
4. Context loading is optimized by pre-serializing org context and user skill definitions into the container's mounted volume.

---

## Latency Budget

The 30-second SLA for standard queries breaks down as follows under the ephemeral model:

| Phase | Duration | Notes |
|-------|----------|-------|
| Container spawn | 1-3s | Docker `create` + `start`. Pre-pulled image. |
| SDK initialization | 1-2s | Claude SDK client creation, API key validation. |
| MCP server startup | 0-2s | Only if the skill requires MCP connectors. |
| Context loading | 1-3s | Org context, user skills, conversation history from DB. |
| LLM inference | 3-15s | Depends on prompt complexity. Claude API response time. |
| Response formatting | <1s | Rich message construction. |
| Container teardown | <1s | Async -- does not block response delivery. |
| **Total** | **~7-26s** | **Within 30s SLA for standard queries.** |

For complex analysis queries (board-prep-synthesizer, pipeline-risk-scan with CRM data), the LLM inference phase may take 15-25s, potentially pushing total time near the 2-minute complex query allowance (PRD Section 8.5).

---

## Consequences

### Positive

1. **Proven security model.** Ephemeral containers provide the strongest possible isolation. No state persists between invocations. A compromised container cannot access another user's session because there are no other sessions in that container.
2. **Nanoclaw compatibility.** No modification to nanoclaw's container lifecycle code. Fewer conflicts on upstream merges.
3. **Simple operational model.** No long-running container health monitoring, no session affinity routing, no idle timeout management. Containers either exist (processing) or don't.
4. **Zero idle cost.** Containers consume resources only while actively processing a message. Nights, weekends, and inactive users cost nothing.
5. **Clean failure mode.** If a container crashes mid-processing, the user gets an error and retries. No corrupted session state to recover.

### Negative

1. **Cold start on every interaction.** Users experience 3-8s overhead on every message. This is perceptible and may feel sluggish compared to ChatGPT's instant responses.
2. **Higher per-interaction resource cost.** Container spawn/teardown overhead is repeated for every message, not amortized across a session.
3. **MCP connection overhead.** MCP servers that maintain connections (e.g., to Salesforce) must reconnect on every invocation. This adds latency for connector-heavy skills.
4. **Container spawn rate limits.** Docker daemon has practical limits on concurrent container operations. Under load (50+ simultaneous messages), spawn queue may add latency.

### Neutral

1. **Pre-warming is possible.** We can pre-spawn containers and keep a small warm pool (3-5 containers per org) that are assigned to users on demand and recycled after use. This is a hybrid of Option A and Option C, but with single-user-per-container guarantee. Decision deferred to Phase 0 performance analysis.
2. **Container teardown can be deferred.** Instead of immediate teardown, containers can idle for 30-60 seconds to handle follow-up messages in a conversation burst. This is a micro-optimization within the ephemeral model, not a shift to persistent containers.

---

## Phase 1 Re-Evaluation Criteria

At the Phase 0 retrospective (approximately July 2026), evaluate whether to move to persistent containers based on:

| Criterion | Threshold | Action |
|-----------|-----------|--------|
| **P95 cold start latency** | >8 seconds | Investigate persistent containers or pre-warming |
| **Total P95 response time** | >25 seconds (standard queries) | Persistent containers become necessary |
| **User feedback on speed** | >20% of users cite "slow" as a complaint | Persistent containers or pre-warming |
| **Container spawn failures** | >1% failure rate | Investigate Docker daemon limits, consider Kubernetes |
| **MCP reconnection latency** | >5 seconds for CRM connectors | Consider persistent containers for MCP-heavy skills |

If none of these thresholds are met, stay with ephemeral containers through Phase 1.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Cold start approaches 30s SLA** | Medium | High | Pre-warm containers. Optimize SDK initialization. Cache org context in container volume. Profile and optimize each phase of the latency budget. |
| **Container spawn rate limits at scale** | Medium (Phase 1+) | Medium | Move to Kubernetes with pod-based isolation. K8s handles scheduling at scale. Pre-warm pod pool. |
| **Users perceive latency as poor quality** | Medium | Medium | Show typing indicator immediately on message receipt. Send "thinking..." status. Set expectations during onboarding. |
| **MCP connector cold start adds too much latency** | Low-Medium | Medium | Cache MCP connector state. Use connection pooling at the host level (outside containers). For Phase 0, most skills don't require MCP. |
| **Docker daemon instability under concurrent spawns** | Low | High | Monitor Docker daemon health. Set concurrency limits (max 20 simultaneous spawns). Queue excess requests with user-facing "high demand" message. |

---

## Review Date

This decision will be reviewed at the Phase 0 retrospective (approximately July 2026) using the re-evaluation criteria above. If Phase 0 latency data is favorable, the ephemeral model carries forward into Phase 1 unchanged.
