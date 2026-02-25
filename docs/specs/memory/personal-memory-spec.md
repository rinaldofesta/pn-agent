# Personal Memory Specification

**Version:** 0.1
**Status:** Draft
**Last Updated:** 2026-02-25
**Owner:** Rinaldo Festa (Technical Architecture)

---

## Context

Every Play New assistant must remember its user: conversation history, work patterns, preferences, and learned context. Without persistent personal memory, each interaction starts from zero — no different from a generic ChatGPT session. Personal memory is what transforms a stateless LLM into a trusted work companion that improves over time.

The critical constraint: personal memory is private. The organization never sees it. The user owns it, can inspect it, export it, selectively erase it, or destroy it entirely. This is not a feature toggle; it is an architectural guarantee enforced at the infrastructure level.

---

## Nanoclaw Foundation

Nanoclaw provides a lightweight memory model via the filesystem:

| Nanoclaw Concept | Location | Purpose |
|---|---|---|
| **Group CLAUDE.md** | `groups/{name}/CLAUDE.md` | Persistent instructions and accumulated knowledge per agent group |
| **Session transcripts** | `.claude/` directory | JSONL conversation logs stored on the container filesystem |
| **PreCompact hook** | `container/agent-runner/src/index.ts` | Fires before Claude SDK compacts the context window; used to archive the full transcript before it is summarized |
| **Session resume** | SQLite session table | Session IDs persisted in SQLite allow resuming a conversation after restart |

Nanoclaw's memory is file-based and ephemeral to the container lifecycle. For Play New, we must extend this into durable, encrypted, per-user storage that survives container restarts, supports similarity search, and complies with GDPR.

---

## Play New Requirements

From the PRD:

| Requirement | PRD Reference | Description |
|---|---|---|
| FR-001.2 | Section 8.4 | Assistant maintains persistent memory across all conversations with the user |
| FR-001.4 | Section 8.4 | User can ask the assistant to "forget" any specific conversation or piece of information |
| FR-001.5 | Section 8.4 | User can export all data the assistant has about them |
| FR-001.6 | Section 8.4 | User can delete their entire assistant instance and all associated data |
| Privacy | Section 6.3.1 | Encrypted vector DB (Qdrant/Weaviate), user-scoped, user-deletable |
| Privacy | Section 7.2 | Personal conversations visible to user only, encrypted with user-key |
| Privacy | Section 7.4 | Infrastructure isolation + encryption with user-held keys |
| Encryption | Section 8.5 | AES-256 at rest, TLS 1.3 in transit, user-scoped keys |
| Capacity | Section 20.2 | ~50GB Phase 0, ~2TB Phase 1, ~15TB Phase 2 |

---

## Technical Specification

### Architecture Overview

```
                    ┌──────────────────────────────────┐
                    │       Personal Memory Service      │
                    │                                    │
  User Query ──────►│  ┌────────────┐  ┌─────────────┐  │
                    │  │  Memory     │  │  Encryption  │  │
                    │  │  Operations │  │  Layer       │  │
                    │  │  API        │  │  (AES-256)   │  │
                    │  └─────┬──────┘  └──────┬──────┘  │
                    │        │                 │          │
                    │  ┌─────▼─────────────────▼──────┐  │
                    │  │    Per-User Memory Namespace   │  │
                    │  │                                │  │
                    │  │  ┌──────────┐  ┌───────────┐  │  │
                    │  │  │ CLAUDE.md│  │ Embeddings │  │  │
                    │  │  │ (context)│  │ (vectors)  │  │  │
                    │  │  └──────────┘  └───────────┘  │  │
                    │  │  ┌──────────┐  ┌───────────┐  │  │
                    │  │  │ Session  │  │ Metadata   │  │  │
                    │  │  │ Archive  │  │ Index      │  │  │
                    │  │  └──────────┘  └───────────┘  │  │
                    │  └───────────────────────────────┘  │
                    └──────────────────────────────────────┘
```

### Data Model

Personal memory stores four categories of information:

| Category | Description | Storage Format | Example |
|---|---|---|---|
| **Conversation History** | Full transcript of all user-assistant interactions | JSONL (Phase 0), Embeddings (Phase 1) | "User asked about Q3 pipeline risk on 2026-04-12" |
| **Work Patterns** | Observed patterns about the user's work habits | Structured JSON | "User typically reviews reports Monday morning" |
| **Preferences** | Communication style, output format preferences, tool preferences | Key-value pairs | "Prefers bullet points over prose" |
| **Learned Context** | Facts about the user's role, projects, relationships | Structured markdown + embeddings | "User manages 3 direct reports on the EMEA sales team" |

### Memory Record Schema

```json
{
  "memory_id": "mem_uuid_v7",
  "user_id": "usr_abc123",
  "org_id": "org_xyz789",
  "category": "conversation | work_pattern | preference | learned_context",
  "content_type": "transcript | summary | fact | preference | pattern",
  "content": "<encrypted payload>",
  "content_hash": "sha256:<hash>",
  "embedding_vector": [0.012, -0.034, ...],
  "source": {
    "session_id": "ses_abc123",
    "channel": "slack | teams | email | web",
    "message_id": "msg_abc123",
    "timestamp": "2026-04-12T09:15:00Z"
  },
  "metadata": {
    "topic_tags": ["pipeline", "Q3", "risk"],
    "importance_score": 0.85,
    "access_count": 12,
    "last_accessed": "2026-04-15T14:30:00Z",
    "compacted_from": ["mem_older1", "mem_older2"],
    "ttl": null
  },
  "created_at": "2026-04-12T09:15:00Z",
  "updated_at": "2026-04-12T09:15:00Z",
  "deleted_at": null
}
```

### SQL Schema (PostgreSQL — metadata and index)

```sql
-- Personal memory metadata (content stored encrypted in object storage or vector DB)
CREATE TABLE personal_memory (
    memory_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,
    org_id          UUID NOT NULL,
    category        TEXT NOT NULL CHECK (category IN (
                        'conversation', 'work_pattern', 'preference', 'learned_context'
                    )),
    content_type    TEXT NOT NULL CHECK (content_type IN (
                        'transcript', 'summary', 'fact', 'preference', 'pattern'
                    )),
    content_ref     TEXT NOT NULL,          -- reference to encrypted blob in object storage
    content_hash    TEXT NOT NULL,          -- SHA-256 of plaintext for dedup
    embedding_ref   TEXT,                   -- reference to vector in vector DB namespace

    -- Source traceability
    session_id      UUID,
    channel         TEXT CHECK (channel IN ('slack', 'teams', 'email', 'web')),
    source_msg_id   TEXT,

    -- Metadata
    topic_tags      TEXT[] DEFAULT '{}',
    importance_score FLOAT DEFAULT 0.5 CHECK (importance_score BETWEEN 0.0 AND 1.0),
    access_count    INTEGER DEFAULT 0,
    last_accessed   TIMESTAMPTZ,
    compacted_from  UUID[] DEFAULT '{}',

    -- Lifecycle
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,           -- soft delete for audit trail

    -- Constraints
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(user_id),
    CONSTRAINT fk_org FOREIGN KEY (org_id) REFERENCES organizations(org_id)
);

-- Index for per-user queries (all memory ops are user-scoped)
CREATE INDEX idx_memory_user_id ON personal_memory(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_memory_user_category ON personal_memory(user_id, category) WHERE deleted_at IS NULL;
CREATE INDEX idx_memory_user_created ON personal_memory(user_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_memory_topic_tags ON personal_memory USING GIN(topic_tags) WHERE deleted_at IS NULL;

-- Audit log for all memory operations (immutable, append-only)
CREATE TABLE memory_audit_log (
    audit_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,
    memory_id       UUID,
    operation       TEXT NOT NULL CHECK (operation IN (
                        'store', 'retrieve', 'update', 'forget', 'export', 'destroy', 'compact'
                    )),
    detail          JSONB,                 -- operation-specific metadata
    performed_by    TEXT NOT NULL,          -- 'system', 'user', 'admin'
    performed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON memory_audit_log(user_id, performed_at DESC);
```

### Encryption Architecture

```
Encryption Key Hierarchy:

    ┌─────────────────────────┐
    │  Org Master Key (KMS)    │  ← Stored in AWS KMS / GCP Cloud KMS
    │  org_mk_xyz789           │     Never leaves the KMS boundary
    └────────────┬────────────┘
                 │
                 │  HKDF derivation
                 │  salt = user_id + key_version
                 │
    ┌────────────▼────────────┐
    │  User Data Key (UDK)     │  ← Derived key, cached in memory during session
    │  udk_usr_abc123_v1       │     Never written to disk in plaintext
    └────────────┬────────────┘
                 │
        ┌────────┼────────┐
        │        │        │
    ┌───▼──┐ ┌──▼───┐ ┌──▼───┐
    │ Conv │ │ Pref │ │ Work │   ← Each memory blob encrypted with UDK
    │ Blob │ │ Blob │ │ Blob │      AES-256-GCM (authenticated encryption)
    └──────┘ └──────┘ └──────┘
```

**Key derivation:**

```
UDK = HKDF-SHA256(
    ikm  = org_master_key,
    salt = SHA256(user_id || key_version),
    info = "pn-personal-memory-v1",
    len  = 32 bytes
)
```

**Encryption per record:**

- Algorithm: AES-256-GCM
- Each record gets a unique 96-bit nonce (random, never reused)
- Authenticated additional data (AAD): `memory_id || user_id || created_at`
- Output: `nonce || ciphertext || auth_tag`

**Key rotation:**

- Key version tracked per record (`key_version` field in metadata)
- Rotation: generate new version, re-encrypt on next access (lazy rotation)
- Old versions kept in KMS until all records migrated

### Memory Operations

#### 1. Store

Persist a new memory record from a conversation or observation.

```typescript
interface StoreMemoryRequest {
  user_id: string;
  category: MemoryCategory;
  content_type: ContentType;
  content: string;                    // plaintext — encrypted before storage
  session_id?: string;
  channel?: Channel;
  source_msg_id?: string;
  topic_tags?: string[];
  importance_score?: number;          // 0.0-1.0, default 0.5
}

interface StoreMemoryResponse {
  memory_id: string;
  embedding_generated: boolean;
  content_hash: string;
  created_at: string;
}
```

**Process:**
1. Derive UDK from KMS for the user
2. Encrypt content with AES-256-GCM
3. Store encrypted blob in object storage (S3 with user-prefixed path)
4. Generate embedding from plaintext via embedding model
5. Store embedding in vector DB under user's namespace
6. Insert metadata record in PostgreSQL
7. Write audit log entry

#### 2. Retrieve (Similarity Search)

Find relevant memories given a query.

```typescript
interface RetrieveMemoryRequest {
  user_id: string;
  query: string;                      // natural language query
  category_filter?: MemoryCategory[];
  max_results?: number;               // default 10
  min_similarity?: number;            // default 0.7
  time_range?: {
    after?: string;                   // ISO8601
    before?: string;
  };
}

interface RetrieveMemoryResponse {
  memories: Array<{
    memory_id: string;
    category: MemoryCategory;
    content_type: ContentType;
    content: string;                  // decrypted plaintext
    similarity_score: number;
    topic_tags: string[];
    created_at: string;
  }>;
  total_searched: number;
  query_time_ms: number;
}
```

**Process:**
1. Generate embedding from query
2. Search user's vector namespace (cosine similarity)
3. Filter by category, time range, minimum similarity
4. For each match, fetch encrypted blob from object storage
5. Derive UDK, decrypt content
6. Update `access_count` and `last_accessed`
7. Return ranked results

#### 3. Forget (Selective Delete)

User requests deletion of specific memories.

```typescript
interface ForgetMemoryRequest {
  user_id: string;
  target:
    | { memory_ids: string[] }                    // specific records
    | { session_id: string }                      // entire session
    | { query: string; confirm_matches: boolean } // semantic search + confirm
    | { before: string }                          // everything before date
    | { topic_tags: string[] };                   // by topic
}

interface ForgetMemoryResponse {
  deleted_count: number;
  memory_ids: string[];
  audit_id: string;
}
```

**Process:**
1. Resolve target to specific memory_ids
2. If `query` target: perform similarity search, return matches for user confirmation
3. Delete encrypted blob from object storage
4. Delete embedding vector from vector DB namespace
5. Soft-delete metadata in PostgreSQL (`deleted_at = NOW()`)
6. Write audit log entry with `operation = 'forget'`
7. After 30-day retention window, hard-delete metadata record

#### 4. Export (JSON)

User exports all their data in a portable format.

```typescript
interface ExportMemoryRequest {
  user_id: string;
  format: 'json' | 'markdown';
  categories?: MemoryCategory[];      // default: all
  include_metadata?: boolean;          // default: true
}

interface ExportMemoryResponse {
  export_id: string;
  download_url: string;               // signed URL, expires in 24h
  record_count: number;
  total_size_bytes: number;
  generated_at: string;
}
```

**Export JSON structure:**

```json
{
  "export_version": "1.0",
  "user_id": "usr_abc123",
  "exported_at": "2026-04-15T10:00:00Z",
  "record_count": 847,
  "categories": {
    "conversation": {
      "count": 623,
      "records": [
        {
          "memory_id": "mem_...",
          "content": "User asked about Q3 pipeline risk...",
          "session_id": "ses_...",
          "channel": "slack",
          "topic_tags": ["pipeline", "Q3"],
          "created_at": "2026-04-12T09:15:00Z"
        }
      ]
    },
    "work_pattern": {
      "count": 89,
      "records": [...]
    },
    "preference": {
      "count": 34,
      "records": [...]
    },
    "learned_context": {
      "count": 101,
      "records": [...]
    }
  }
}
```

#### 5. Destroy (Cascade Delete)

User deletes their entire assistant instance and all associated data.

```typescript
interface DestroyMemoryRequest {
  user_id: string;
  confirmation_token: string;         // requires explicit user confirmation
}

interface DestroyMemoryResponse {
  destroyed: boolean;
  records_deleted: number;
  vectors_deleted: number;
  blobs_deleted: number;
  audit_id: string;                   // audit record retained for compliance
}
```

**Process (irreversible):**
1. Validate confirmation token (user must explicitly confirm)
2. Delete ALL encrypted blobs from object storage for user prefix
3. Drop user's entire namespace from vector DB
4. Hard-delete ALL metadata records from PostgreSQL
5. Delete user's derived encryption key version records
6. Retain only the audit log entry recording the destruction
7. Return confirmation

### Memory Compaction

When the assistant's context window fills, older memories must be summarized and re-embedded to maintain quality retrieval without unbounded growth.

**Compaction strategy:**

```
Before Compaction:
┌──────────────────────────────────────────────┐
│ Memory Namespace (user_abc123)               │
│                                              │
│ [msg1] [msg2] [msg3] ... [msg450] [msg451]   │  ← 450+ individual messages
│ Total tokens: ~180,000                        │
│ Retrieval quality degrading (too many small   │
│ vectors with overlapping content)             │
└──────────────────────────────────────────────┘

After Compaction:
┌──────────────────────────────────────────────┐
│ Memory Namespace (user_abc123)               │
│                                              │
│ [summary_week12] [summary_week13]            │  ← Weekly summaries
│ [fact_1] [fact_2] ... [fact_45]              │  ← Extracted facts
│ [pref_1] [pref_2] ... [pref_12]             │  ← Preferences
│ [msg448] [msg449] [msg450] [msg451]          │  ← Recent messages (kept raw)
│ Total tokens: ~25,000                         │
│ Retrieval quality restored                    │
└──────────────────────────────────────────────┘
```

**Compaction process:**

1. **Trigger**: when total memory tokens exceed threshold (configurable, default 150K tokens)
2. **Archive**: invoke Nanoclaw's PreCompact hook to save full transcript to durable storage
3. **Summarize**: LLM summarizes older conversations into weekly summaries, extracting:
   - Key facts learned about the user
   - Work patterns observed
   - Preference changes detected
   - Important decisions or outcomes
4. **Re-embed**: generate new embeddings for summaries and extracted facts
5. **Replace**: swap individual message embeddings with summary embeddings in vector DB
6. **Retain originals**: encrypted originals kept in object storage (for export/audit), but removed from active vector search

**Nanoclaw PreCompact hook integration:**

```typescript
// Extends nanoclaw's PreCompact hook in container/agent-runner/src/index.ts
async function onPreCompact(session: Session, transcript: Message[]): Promise<void> {
  // 1. Archive full transcript to durable storage
  await archiveTranscript({
    user_id: session.userId,
    session_id: session.sessionId,
    messages: transcript,
    archived_at: new Date().toISOString(),
  });

  // 2. Extract and store durable memories before SDK compaction
  const extractedMemories = await extractMemories(transcript);
  for (const memory of extractedMemories) {
    await storeMemory({
      user_id: session.userId,
      category: memory.category,
      content_type: memory.contentType,
      content: memory.content,
      session_id: session.sessionId,
      topic_tags: memory.tags,
      importance_score: memory.importance,
    });
  }

  // 3. Claude SDK proceeds with context window compaction
  // (this is handled by nanoclaw's agent runner after our hook returns)
}
```

**Compaction thresholds:**

| Metric | Threshold | Action |
|---|---|---|
| Total memory tokens | > 150,000 | Trigger compaction for oldest 70% |
| Individual session messages | > 200 messages | Summarize session, keep last 20 raw |
| Memory age | > 90 days without access | Candidate for archival |
| Duplicate content hash | Exact match | Deduplicate, keep most recent |

### GDPR Compliance

| GDPR Right | Implementation |
|---|---|
| **Right to Access** (Art. 15) | Export operation returns all personal data in JSON/markdown format within 24 hours |
| **Right to Erasure** (Art. 17) | Forget operation for selective deletion; Destroy operation for complete erasure. Hard delete from all storage layers within 30 days. |
| **Right to Rectification** (Art. 16) | User can instruct assistant to correct any stored fact or pattern |
| **Right to Portability** (Art. 20) | Export produces machine-readable JSON that can be imported into another system |
| **Right to Restriction** (Art. 18) | User can freeze memory (stop new writes) while keeping existing data accessible |
| **Lawful Basis** | Legitimate interest (contract performance) for memory storage; consent for pattern collection |

**Data processing agreement (DPA) requirements:**

- Play New is the data processor; the user's organization is the data controller
- Personal memory data is encrypted with keys derived from org master key
- User has independent deletion rights regardless of organization's instructions
- Data residency: EU-only storage (AWS eu-south-1 or eu-central-1)
- Sub-processors: AWS (storage), Anthropic (embedding generation — content not retained)

---

## Phase 0 Scope

### What We Build Now

Phase 0 uses a simplified memory model that validates the concept before investing in vector DB infrastructure.

**Phase 0 implementation: CLAUDE.md-style memory files**

```
Storage Layout (S3 or PVC):
/memory/
  /{org_id}/
    /{user_id}/
      CLAUDE.md              ← Persistent context (accumulated knowledge)
      preferences.json       ← User preferences (structured)
      sessions/
        {session_id}.jsonl   ← Raw conversation transcripts
      exports/
        {export_id}.json     ← Generated exports (temporary)
```

- **CLAUDE.md**: A growing markdown file that the assistant reads at the start of every session. Contains accumulated facts, patterns, and context about the user. Appended to after each session.
- **preferences.json**: Structured key-value store for explicit preferences.
- **sessions/**: JSONL transcript logs, one file per session. Encrypted at rest via S3 SSE with per-user key prefix.
- **Retrieval**: keyword search over CLAUDE.md + recent session files (no vector similarity search).
- **Forget**: remove lines from CLAUDE.md, delete specific session files.
- **Export**: bundle all files into JSON export.
- **Destroy**: delete entire user directory.

**Phase 0 limitations (accepted):**

- No similarity search (keyword matching only)
- No embeddings (no semantic retrieval)
- Linear growth of CLAUDE.md (manual compaction by appending summaries)
- Simple encryption (S3 SSE-KMS, not per-record AES-GCM)

### What We Defer

| Capability | Target Phase | Rationale |
|---|---|---|
| Vector DB (Qdrant/Weaviate) | Phase 1 | Evaluate after Phase 0 validates memory utility |
| Embedding-based similarity search | Phase 1 | Requires vector DB |
| Per-record AES-256-GCM encryption | Phase 1 | S3 SSE-KMS sufficient for Phase 0 scale |
| Automated compaction with LLM summarization | Phase 1 | Manual compaction sufficient at 150 users |
| Memory importance scoring | Phase 1 | Need usage data to calibrate |
| Key rotation automation | Phase 2 | Manual rotation acceptable at Phase 0-1 scale |

### Phase 0 Capacity Planning

| Metric | Phase 0 Estimate |
|---|---|
| Users | 150 (3 orgs x 50) |
| Avg CLAUDE.md size | 50-200 KB per user |
| Avg session transcript | 10-50 KB per session |
| Sessions per user per month | ~20 |
| Monthly storage growth | ~500 MB |
| Total storage (5 months) | ~3 GB active, ~50 GB with archives |
| S3 cost | < $5/month |

### Phase 1 Capacity Planning

| Metric | Phase 1 Estimate |
|---|---|
| Users | 2,000 |
| Vector DB records per user | ~5,000 |
| Total vectors | ~10M |
| Embedding dimensions | 1536 (OpenAI) or 1024 (Anthropic) |
| Vector storage | ~60 GB |
| Object storage (encrypted blobs) | ~500 GB |
| Total | ~2 TB (with replication and backups) |

---

## Open Questions

1. **Vector DB selection**: Qdrant vs Weaviate vs pgvector. Key criteria: per-namespace encryption support, EU hosting options, cost at 10M+ vectors, operational complexity. Decision needed by Phase 1 architecture sprint.

2. **Embedding model**: Use Anthropic's embedding model (keeps data in same provider), OpenAI's text-embedding-3-large (better benchmarks), or open-source (Nomic, BGE) for privacy? Trade-off: quality vs data residency vs cost.

3. **User-held keys vs org-derived keys**: The PRD mentions "user-held keys" but the practical model is org-master-key + user-salt derivation. True user-held keys would mean data loss if user loses their key. Which model do we adopt?

4. **Memory across model switches**: If we switch from Claude to GPT-4o for a specific task, does the memory context translate cleanly? Embedding compatibility across models needs investigation.

5. **CLAUDE.md growth**: In Phase 0, the CLAUDE.md file will grow linearly. At what size does it become impractical to inject into every prompt? Estimated limit: ~50KB (~12K tokens). Need compaction strategy even for Phase 0.

6. **Transcript retention period**: How long do we keep raw session transcripts after compaction? 90 days? 1 year? Indefinite until user deletes? Impacts storage cost and GDPR posture.

7. **Works-council review**: Some EU organizations require works-council approval for any system that stores employee work data. Do we need a standardized works-council briefing package for Phase 0 onboarding?
