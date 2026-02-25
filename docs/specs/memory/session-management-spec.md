# Session Management Specification

**Version:** 0.1
**Status:** Draft
**Last Updated:** 2026-02-25
**Owner:** Rinaldo Festa (Technical Architecture)

---

## Context

Conversation continuity is fundamental to a personal assistant experience. A user should be able to start a conversation on Slack, continue it via email, and pick up where they left off the next day — without re-explaining context. Session management bridges the gap between ephemeral chat messages and persistent assistant memory.

Sessions also serve as the unit of work for pattern collection: each session produces categorical metadata about what kind of work the user engaged in, which feeds the organizational intelligence layer.

---

## Nanoclaw Foundation

Nanoclaw provides a session management infrastructure:

| Nanoclaw Concept | Location | Purpose |
|---|---|---|
| **Session IDs** | SQLite `sessions` table | Persistent session identifiers that survive container restarts |
| **Session resume** | Agent runner `--resume` flag | Resume a previous conversation by session ID |
| **JSONL transcripts** | `.claude/{session_id}/` directory | Full conversation transcript in JSONL format |
| **PreCompact hook** | `container/agent-runner/src/index.ts` | Fires before Claude SDK compacts the context window; saves full transcript before summarization |
| **Claude SDK sessions** | `@anthropic-ai/claude-sdk` | Native session management with conversation history and context window management |

Nanoclaw sessions are container-bound: they live on the container filesystem and are tied to a single communication channel. Play New must extend this to support cross-channel sessions, durable storage, and multi-user isolation.

---

## Play New Requirements

From the PRD:

| Requirement | PRD Reference | Description |
|---|---|---|
| FR-001.2 | Section 8.4 | Persistent memory across all conversations |
| FR-001.9 | Section 8.4 | Multi-turn conversations with context retention |
| FR-001.8 | Section 8.4 | Response within 30 seconds for standard queries |
| FR-002.3 | Section 8.4 | Share Slack/Teams messages with assistant via share or mention |
| Section 16.1 | Delivery | Thread-aware: keep related conversations in threads, not main DM |
| Section 6.3.1 | Architecture | Each user gets an isolated assistant instance |
| Section 8.5 | Non-functional | Support 150 concurrent users |

---

## Technical Specification

### Session Lifecycle

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  CREATE   │───►│ CONTINUE  │───►│ COMPACT  │───►│ ARCHIVE  │───►│ EXPORT   │───►│ DELETE   │
│           │    │           │    │           │    │           │    │ (optional│    │           │
│ New user  │    │ Messages  │    │ Context   │    │ Session   │    │  user    │    │ User or  │
│ message   │    │ appended  │    │ window    │    │ inactive  │    │  request)│    │ system   │
│ starts    │    │ to session│    │ full,     │    │ > 24h,    │    │          │    │ cleanup  │
│ session   │    │           │    │ PreCompact│    │ transcript│    │          │    │          │
│           │    │           │    │ hook fires│    │ archived  │    │          │    │          │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
```

**State transitions:**

| From | To | Trigger |
|---|---|---|
| (none) | `active` | First message from user with no active session |
| `active` | `active` | New message within active session |
| `active` | `compacting` | Context window exceeds threshold |
| `compacting` | `active` | Compaction complete, session continues |
| `active` | `archived` | No messages for 24 hours (configurable) |
| `archived` | `active` | User sends new message referencing archived session |
| `archived` | `exported` | User requests export |
| `active` / `archived` | `deleted` | User requests deletion or system cleanup |

### Session Data Model

```json
{
  "session_id": "ses_uuid_v7",
  "user_id": "usr_abc123",
  "org_id": "org_xyz789",
  "status": "active | compacting | archived | exported | deleted",

  "channels": [
    {
      "channel_type": "slack",
      "channel_id": "D04ABC123",
      "thread_ts": "1711900000.000100",
      "joined_at": "2026-04-12T09:00:00Z",
      "last_message_at": "2026-04-12T11:30:00Z"
    },
    {
      "channel_type": "email",
      "channel_id": "matteo.assistant@playnew.ai",
      "email_thread_id": "thread_xyz",
      "joined_at": "2026-04-12T10:15:00Z",
      "last_message_at": "2026-04-12T10:45:00Z"
    }
  ],

  "metadata": {
    "created_at": "2026-04-12T09:00:00Z",
    "last_active": "2026-04-12T11:30:00Z",
    "message_count": 24,
    "user_message_count": 12,
    "assistant_message_count": 12,
    "topic_summary": "Q3 pipeline risk analysis and client Acme renewal strategy",
    "topics": ["pipeline", "risk", "acme", "renewal"],
    "skills_activated": ["pipeline-risk-scan"],
    "total_tokens_used": 45000,
    "compaction_count": 0
  },

  "storage": {
    "transcript_ref": "s3://pn-sessions/org_xyz789/usr_abc123/ses_uuid_v7/transcript.jsonl",
    "claude_session_ref": "claude-sdk-session-id-xxx",
    "compact_summaries": []
  }
}
```

### SQL Schema

```sql
-- Session metadata
CREATE TABLE sessions (
    session_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL,
    org_id              UUID NOT NULL,
    status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
                            'active', 'compacting', 'archived', 'exported', 'deleted'
                        )),

    -- Claude SDK session reference
    claude_session_ref  TEXT,              -- Claude SDK internal session ID

    -- Timing
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_at         TIMESTAMPTZ,
    deleted_at          TIMESTAMPTZ,

    -- Metrics
    message_count       INTEGER NOT NULL DEFAULT 0,
    user_message_count  INTEGER NOT NULL DEFAULT 0,
    assistant_msg_count INTEGER NOT NULL DEFAULT 0,
    total_tokens_used   INTEGER NOT NULL DEFAULT 0,
    compaction_count    INTEGER NOT NULL DEFAULT 0,

    -- Topic tracking
    topic_summary       TEXT,
    topics              TEXT[] DEFAULT '{}',
    skills_activated    TEXT[] DEFAULT '{}',

    -- Storage references
    transcript_ref      TEXT NOT NULL,     -- S3/GCS path to JSONL transcript

    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(user_id),
    CONSTRAINT fk_org FOREIGN KEY (org_id) REFERENCES organizations(org_id)
);

CREATE INDEX idx_session_user_active ON sessions(user_id, last_active DESC)
    WHERE status = 'active';
CREATE INDEX idx_session_user_status ON sessions(user_id, status);
CREATE INDEX idx_session_org ON sessions(org_id, created_at DESC);

-- Session-channel mapping (a session can span multiple channels)
CREATE TABLE session_channels (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          UUID NOT NULL,
    channel_type        TEXT NOT NULL CHECK (channel_type IN ('slack', 'teams', 'email', 'web')),
    channel_id          TEXT NOT NULL,      -- Slack DM ID, Teams chat ID, email address, etc.
    thread_id           TEXT,               -- Slack thread_ts, email thread ID

    joined_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_message_at     TIMESTAMPTZ,
    message_count       INTEGER DEFAULT 0,

    CONSTRAINT fk_session FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
    CONSTRAINT uq_channel_thread UNIQUE (channel_type, channel_id, thread_id)
);

CREATE INDEX idx_channel_lookup ON session_channels(channel_type, channel_id, thread_id);
CREATE INDEX idx_channel_session ON session_channels(session_id);

-- Session compaction history
CREATE TABLE session_compactions (
    compaction_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          UUID NOT NULL,

    -- What was compacted
    messages_compacted  INTEGER NOT NULL,
    tokens_before       INTEGER NOT NULL,
    tokens_after        INTEGER NOT NULL,

    -- Archives
    full_transcript_ref TEXT NOT NULL,      -- S3 path to pre-compaction transcript
    summary_text        TEXT NOT NULL,      -- LLM-generated summary
    facts_extracted     JSONB DEFAULT '[]', -- structured facts extracted

    compacted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_session FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);
```

### Multi-Channel Session Architecture

A single user can interact with their assistant through multiple channels. All channels converge to one active session.

```
     Slack DM                Email Forward             Teams Chat
        │                        │                        │
        │  "Analyze this         │  FWD: Client email     │  "What did we
        │   pipeline report"     │  from Acme Corp        │   discuss about
        │                        │                        │   Acme yesterday?"
        │                        │                        │
        └────────────┬───────────┴────────────┬───────────┘
                     │                        │
              ┌──────▼────────────────────────▼──────┐
              │         CHANNEL ROUTER                │
              │                                       │
              │  1. Identify user (from channel auth)  │
              │  2. Find active session for user       │
              │  3. Route message to session           │
              │  4. Track channel in session_channels   │
              └──────────────────┬────────────────────┘
                                 │
              ┌──────────────────▼────────────────────┐
              │     SESSION ses_abc123 (user_abc)      │
              │                                        │
              │  Context window includes ALL messages   │
              │  from ALL channels for this session     │
              │                                        │
              │  [slack] "Analyze this pipeline..."     │
              │  [asst]  "Here's the analysis..."      │
              │  [email] "FWD: Client email from Acme" │
              │  [asst]  "This email from Acme..."     │
              │  [teams] "What did we discuss..."      │
              │  [asst]  "Yesterday you shared..."     │
              └────────────────────────────────────────┘
```

**Channel routing rules:**

| Scenario | Behavior |
|---|---|
| User messages via Slack DM (no thread) | Route to active session. If no active session, create new one. |
| User messages in Slack thread | Sub-conversation within existing session. Thread context scoped to thread, but assistant has full session context. |
| User forwards email | Route to active session. If email mentions a topic from a prior session, consider resuming that session. |
| User messages via Teams | Route to active session (same as Slack). |
| User switches channel mid-conversation | Seamless continuation. Channel tracked in `session_channels`. |
| Multiple concurrent Slack threads | Each thread is a sub-conversation. All feed into the same session. |

**Channel identification:**

```typescript
interface ChannelMessage {
  channel_type: 'slack' | 'teams' | 'email' | 'web';
  channel_id: string;           // Slack DM ID, Teams chat ID, email address
  thread_id?: string;           // Slack thread_ts, email thread ID
  user_identifier: string;      // Slack user ID, Teams user ID, email address
  content: string;
  attachments?: Attachment[];
  timestamp: string;
}

// User resolution: map channel-specific user ID to Play New user_id
async function resolveUser(msg: ChannelMessage): Promise<string> {
  // Look up in user_channel_mappings table
  // Slack user ID → user_id
  // Teams user ID → user_id
  // Email address → user_id
  return userId;
}

// Session resolution: find or create session for this user
async function resolveSession(userId: string, msg: ChannelMessage): Promise<Session> {
  // 1. Find active session for user
  const active = await findActiveSession(userId);

  if (active) {
    // 2. Add this channel to session if not already tracked
    await trackChannel(active.session_id, msg);
    return active;
  }

  // 3. No active session — create new one
  return await createSession(userId, msg);
}
```

### Conversation Threading

Slack threads and email threads map to sub-conversations within a session.

```
Session ses_abc123
│
├── Main conversation (Slack DM)
│   ├── [09:00] User: "Good morning, what's on my agenda?"
│   ├── [09:01] Assistant: "You have 3 meetings today..."
│   └── [09:15] User: "Prep me for the Acme meeting"
│
├── Thread: Acme meeting prep (Slack thread on 09:15 message)
│   ├── [09:16] Assistant: "Here's your Acme prep..."
│   ├── [09:20] User: "What about their renewal timeline?"
│   └── [09:21] Assistant: "Based on CRM data, renewal is..."
│
├── Email forward (email channel)
│   ├── [10:30] User forwards: "FWD: Budget proposal from CFO"
│   └── [10:31] Assistant: "The CFO's proposal suggests..."
│
└── Thread: Budget analysis (Slack thread on new message)
    ├── [10:45] User: "Can you compare this to our Q2 actuals?"
    └── [10:46] Assistant: "Comparing the proposal to Q2..."
```

**Thread handling rules:**

| Platform | Thread Mechanism | Play New Mapping |
|---|---|---|
| **Slack** | Thread via `thread_ts` on parent message | Sub-conversation. Assistant responds in-thread. Parent message context preserved. |
| **Teams** | Reply chain on message | Sub-conversation. Same as Slack threads. |
| **Email** | Email thread via `In-Reply-To` / `References` headers | Sub-conversation. Each reply continues the email thread analysis. |
| **Web** | Explicit thread UI | Sub-conversation. User can start new threads or continue existing. |

### Session Storage

Sessions must survive container restarts. All session data is stored in durable external storage, not the container filesystem.

**Storage architecture:**

```
Durable Storage (S3 / GCS / PVC)
│
├── /sessions/
│   └── /{org_id}/
│       └── /{user_id}/
│           ├── /{session_id}/
│           │   ├── transcript.jsonl      ← Live transcript (append-only)
│           │   ├── compact_001.json      ← First compaction summary
│           │   ├── compact_002.json      ← Second compaction summary
│           │   └── archive/
│           │       └── full_transcript_pre_compact_001.jsonl
│           └── /{session_id}/
│               └── ...
│
└── /claude-sdk-state/
    └── /{org_id}/
        └── /{user_id}/
            └── session_state.json        ← Claude SDK session persistence
```

**Transcript JSONL format:**

```jsonl
{"msg_id":"msg_001","role":"user","channel":"slack","thread_id":null,"content":"Good morning, what's on my agenda?","timestamp":"2026-04-12T09:00:00Z","tokens":15}
{"msg_id":"msg_002","role":"assistant","channel":"slack","thread_id":null,"content":"You have 3 meetings today...","timestamp":"2026-04-12T09:01:00Z","tokens":245}
{"msg_id":"msg_003","role":"user","channel":"slack","thread_id":"1711900000.000100","content":"Prep me for the Acme meeting","timestamp":"2026-04-12T09:15:00Z","tokens":12}
{"msg_id":"msg_004","role":"assistant","channel":"slack","thread_id":"1711900000.000100","content":"Here's your Acme prep...","timestamp":"2026-04-12T09:16:00Z","tokens":380}
{"msg_id":"msg_005","role":"user","channel":"email","thread_id":"thread_xyz","content":"FWD: Budget proposal from CFO\n\n[forwarded content]","timestamp":"2026-04-12T10:30:00Z","tokens":850}
```

### Compaction Strategy

When the context window exceeds the threshold, the PreCompact hook fires to preserve the full transcript before Claude SDK compacts.

**Compaction triggers:**

| Trigger | Threshold | Action |
|---|---|---|
| Context window size | > 80% of model limit (~160K tokens for Claude 3.5) | Initiate compaction |
| Message count | > 200 messages in session | Initiate compaction |
| Session duration | > 8 hours continuous | Suggest new session, offer compaction |

**Compaction process:**

```typescript
// Compaction flow (extends nanoclaw's PreCompact hook)
async function handleCompaction(session: Session): Promise<void> {
  // 1. Save full transcript to durable storage
  const transcriptRef = await saveFullTranscript(session);

  // 2. Generate summary of compacted messages
  const summary = await generateCompactionSummary(session.messages, {
    preserve: ['key_decisions', 'action_items', 'user_preferences', 'facts_learned'],
    max_summary_tokens: 2000,
  });

  // 3. Extract durable facts for personal memory
  const facts = await extractFacts(session.messages);
  for (const fact of facts) {
    await storeToPersonalMemory(session.userId, fact);
  }

  // 4. Record compaction metadata
  await recordCompaction({
    session_id: session.sessionId,
    messages_compacted: session.messages.length - 20, // keep last 20
    tokens_before: session.totalTokens,
    tokens_after: summary.tokenCount + lastNMessagesTokens(20),
    full_transcript_ref: transcriptRef,
    summary_text: summary.text,
    facts_extracted: facts,
  });

  // 5. Claude SDK compaction proceeds
  // (nanoclaw handles this: replaces old messages with summary + recent messages)

  // 6. Update session metadata
  await updateSession(session.sessionId, {
    compaction_count: session.compactionCount + 1,
    total_tokens_used: session.totalTokens,
  });
}
```

**Post-compaction context window:**

```
┌─────────────────────────────────────────┐
│ Context Window (after compaction)        │
│                                         │
│ [System prompt + org context]  ~10K     │
│ [Personal memory retrieval]    ~2K      │
│ [Compaction summary]           ~2K      │
│ [Last 20 messages]             ~8K      │
│ [Available for response]       ~178K    │
│                                         │
│ Total: ~200K token window               │
└─────────────────────────────────────────┘
```

### Session Metadata Updates

After each message, session metadata is updated for pattern collection and operational monitoring.

```typescript
interface SessionMetadataUpdate {
  // Increment counters
  message_count: number;
  user_message_count: number;
  assistant_msg_count: number;
  total_tokens_used: number;

  // Update timing
  last_active: string;

  // Update topic tracking (LLM-generated after every 5 messages)
  topic_summary?: string;
  topics?: string[];

  // Track skill activations
  skills_activated?: string[];
}
```

**Topic summary generation:**

Every 5 messages, the system generates a brief topic summary:

```typescript
async function updateTopicSummary(session: Session): Promise<void> {
  if (session.messageCount % 5 !== 0) return;

  const summary = await llm.complete({
    system: "Summarize the conversation topic in one sentence. List 3-5 topic keywords.",
    messages: session.recentMessages(20),
    max_tokens: 100,
  });

  await updateSession(session.sessionId, {
    topic_summary: summary.sentence,
    topics: summary.keywords,
  });
}
```

---

## Phase 0 Scope

### What We Build Now

1. **Basic session management**: create, continue, archive sessions using SQLite (nanoclaw pattern) backed by durable transcript storage in S3.
2. **Single-channel sessions**: each channel interaction is its own session. Cross-channel continuity via shared personal memory (CLAUDE.md), not via shared session.
3. **PreCompact hook**: save full transcripts before Claude SDK compaction.
4. **Session metadata**: message counts, timing, basic topic tracking.
5. **Slack thread support**: threads map to the parent session.

**Phase 0 simplification:**

- No cross-channel session merging (Slack session and email session are separate)
- Context continuity across channels via personal memory (CLAUDE.md), not session state
- Transcript storage in S3 with SSE-KMS encryption
- Session archive after 24h inactivity
- No session export UI (available via API for GDPR requests)

### What We Defer

| Capability | Target Phase | Rationale |
|---|---|---|
| Cross-channel session unification | Phase 1 | Requires robust user identity resolution across channels |
| Session search (find old conversations) | Phase 1 | Requires transcript indexing |
| Session export UI | Phase 1 | API sufficient for Phase 0 GDPR compliance |
| Intelligent session resumption | Phase 1 | "Resume where we left off" across days |
| Session analytics dashboard | Phase 1 | Operational monitoring via logs sufficient for Phase 0 |
| Concurrent session support | Phase 2 | Phase 0: one active session per user at a time |

---

## Open Questions

1. **Session timeout**: 24h inactivity before archival — is this the right default? Some users may have ongoing multi-day analyses. Should users be able to "pin" a session to keep it active?

2. **Cross-channel identity resolution**: In Phase 1, we need to map Slack user ID, Teams user ID, and email address to a single Play New user. What if a user has multiple email addresses? Need a user identity service.

3. **Thread isolation vs session context**: When a user starts a Slack thread, should the thread have access to the full session context, or only the parent message context? Full session is more useful but may confuse the user if the thread topic diverges.

4. **Session size limits**: Should there be a hard limit on session size (messages or tokens)? Or should compaction handle unlimited growth? Risk: very long sessions may produce poor compaction summaries.

5. **Concurrent sessions**: Phase 0 supports one active session per user. But a user might want to run a pipeline analysis while also drafting a client email. Should Phase 1 support parallel sessions?

6. **Session handoff to advisor**: If a user's session reveals an issue that needs advisor attention (e.g., system confusion, sensitive topic), what is the escalation path? Session export to advisor with user consent?
