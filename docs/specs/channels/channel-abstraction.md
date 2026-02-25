# Channel Abstraction & Multi-Channel Routing

**Status:** Draft
**Version:** 0.1
**Last Updated:** 2026-02-25
**Owner:** Technical Architecture

---

## Context

Play New delivers personal AI assistants through multiple communication channels: Slack, Microsoft Teams, email, and eventually a web dashboard. Each channel has different capabilities, message formats, identity models, and real-time features. The channel abstraction layer provides a unified interface that isolates the assistant runtime from channel-specific concerns, enabling the system to route messages to and from any supported channel without the core logic knowing which channel is in use.

The core challenge is that each channel has fundamentally different characteristics:
- **Slack** uses workspace IDs, channel IDs, and supports Block Kit for rich formatting
- **Teams** uses Azure AD identities, conversation references, and Adaptive Cards
- **Email** uses SMTP/IMAP, has no real-time presence, and requires plain text + HTML formatting

A clean channel abstraction ensures that adding a new channel (e.g., WhatsApp, web chat) requires only implementing the interface -- not modifying the assistant runtime, skill engine, or organizational intelligence layer.

---

## Nanoclaw Foundation

Play New builds on top of **nanoclaw** (github.com/qwibitai/nanoclaw), which provides a `Channel` interface in `container/agent-runner/src/types.ts`:

```typescript
interface Channel {
  name: string;
  connect(): Promise<void>;
  sendMessage(jid: string, text: string): Promise<void>;
  isConnected(): boolean;
  ownsJid(jid: string): boolean;
  disconnect(): Promise<void>;
  setTyping?(jid: string, isTyping: boolean): Promise<void>;
}
```

**What nanoclaw provides:**
- A minimal, transport-agnostic channel interface
- JID (Jabber-like ID) routing concept for addressing messages
- Connection lifecycle management (`connect`, `disconnect`, `isConnected`)
- Optional typing indicator support
- A working Slack implementation in `.claude/skills/add-slack/`

**What nanoclaw does NOT provide:**
- Multi-organization channel management
- Rich message formatting (blocks, cards, HTML)
- File and attachment handling
- Thread awareness and conversation threading
- Channel-specific metadata (reactions, read receipts)
- User identity mapping (channel user -> Play New user instance)

---

## Play New Requirements

From the PRD:

- **Section 6.2 (System Architecture):** Delivery layer includes Slack Bot, Teams Bot, Email Bridge, and Web Dashboard -- all feeding into the Personal Assistant Layer
- **Section 6.3.1 (Personal Assistant Runtime):** Messenger I/O component handles bidirectional communication through user's preferred channel
- **Section 8.1 (Phase 0 Scope):** Slack and Teams delivery only
- **Section 14.1 (Phase 0 Integrations):** Slack (Socket Mode or Events API), Teams (Bot Framework), Email (IMAP/SMTP bridge)
- **Section 16.1 (Delivery Interface Design):** Rich formatting with Slack blocks / Teams adaptive cards; thread-aware conversations; slash commands for skill invocation
- **FR-001.1:** Each user gets an isolated assistant instance accessible via Slack DM or Teams chat

---

## Technical Specification

### Extended Channel Interface

Play New extends the nanoclaw `Channel` interface to support organizational context, rich formatting, file handling, and thread awareness:

```typescript
// ── Foundation (from nanoclaw) ──────────────────────────────────

interface NanoclawChannel {
  name: string;
  connect(): Promise<void>;
  sendMessage(jid: string, text: string): Promise<void>;
  isConnected(): boolean;
  ownsJid(jid: string): boolean;
  disconnect(): Promise<void>;
  setTyping?(jid: string, isTyping: boolean): Promise<void>;
}

// ── Play New Extensions ─────────────────────────────────────────

/**
 * Rich message content that can be rendered differently per channel.
 * The assistant runtime produces RichMessage objects; each channel
 * adapter converts them to the native format (Block Kit, Adaptive Cards, HTML).
 */
interface RichMessage {
  /** Plain text fallback (always required) */
  text: string;
  /** Structured blocks for rich rendering */
  blocks?: MessageBlock[];
  /** File attachments */
  attachments?: Attachment[];
  /** Thread context — if set, message is posted as a thread reply */
  threadId?: string;
  /** Ephemeral — only visible to the target user, not persisted in channel */
  ephemeral?: boolean;
  /** Metadata for analytics and pattern collection */
  metadata?: Record<string, string>;
}

interface MessageBlock {
  type: 'header' | 'section' | 'divider' | 'actions' | 'context' | 'table';
  text?: string;
  fields?: { label: string; value: string }[];
  actions?: MessageAction[];
}

interface MessageAction {
  type: 'button' | 'select';
  label: string;
  actionId: string;
  value?: string;
  options?: { label: string; value: string }[];
  style?: 'primary' | 'danger';
}

interface Attachment {
  filename: string;
  mimeType: string;
  /** URL to download the attachment (pre-signed, time-limited) */
  url?: string;
  /** Inline content for small payloads (<1MB) */
  content?: Buffer;
  sizeBytes: number;
}

/**
 * Inbound message from a channel user to the assistant.
 */
interface InboundMessage {
  /** Globally unique message ID */
  messageId: string;
  /** JID of the sender (channel-prefixed) */
  senderJid: string;
  /** JID of the conversation/channel where the message was received */
  conversationJid: string;
  /** Plain text content */
  text: string;
  /** Attachments included with the message */
  attachments?: Attachment[];
  /** Thread ID if this is a threaded reply */
  threadId?: string;
  /** Channel-specific raw metadata */
  rawMetadata?: Record<string, unknown>;
  /** Timestamp of the message in the source channel */
  timestamp: Date;
}

/**
 * Metadata about the chat session (user identity, channel capabilities).
 */
interface ChatMetadata {
  /** The Play New user ID this channel user maps to */
  userId: string;
  /** The organization this user belongs to */
  orgId: string;
  /** Channel name (slack, teams, email) */
  channelName: string;
  /** Display name of the user in this channel */
  displayName: string;
  /** Channel-specific user ID (e.g., Slack user ID, Azure AD object ID) */
  channelUserId: string;
  /** User's timezone (from channel profile) */
  timezone?: string;
  /** Channel capabilities */
  capabilities: ChannelCapabilities;
}

interface ChannelCapabilities {
  richFormatting: boolean;
  fileUpload: boolean;
  fileDownload: boolean;
  threading: boolean;
  reactions: boolean;
  typingIndicator: boolean;
  slashCommands: boolean;
  ephemeralMessages: boolean;
  maxMessageLength: number;
}

// ── Callback Types ──────────────────────────────────────────────

/**
 * Called when a message arrives from any channel.
 * The channel adapter parses the raw event and produces an InboundMessage.
 */
type OnInboundMessage = (
  message: InboundMessage,
  metadata: ChatMetadata
) => Promise<void>;

/**
 * Called when chat metadata changes (user profile update, channel reconnection).
 */
type OnChatMetadata = (
  metadata: ChatMetadata,
  event: 'connected' | 'disconnected' | 'profile_updated'
) => Promise<void>;

// ── Extended Channel Interface ──────────────────────────────────

interface PlayNewChannel extends NanoclawChannel {
  /**
   * Organization this channel instance belongs to.
   * Each org gets its own channel instance (e.g., its own Slack app).
   */
  orgId: string;

  /**
   * Send a rich message with formatting, attachments, and threading.
   * Falls back to plain text via sendMessage() if the channel
   * does not support rich content.
   */
  sendRichMessage(jid: string, message: RichMessage): Promise<void>;

  /**
   * Send a file/attachment to a conversation.
   */
  sendFile(jid: string, attachment: Attachment): Promise<void>;

  /**
   * Register callback for inbound messages.
   */
  onMessage(callback: OnInboundMessage): void;

  /**
   * Register callback for metadata changes.
   */
  onMetadata(callback: OnChatMetadata): void;

  /**
   * Resolve a channel-specific user ID to Play New user identity.
   * Returns null if the user is not mapped.
   */
  resolveUser(channelUserId: string): Promise<ChatMetadata | null>;

  /**
   * List all user JIDs currently registered with this channel instance.
   */
  listUsers(): Promise<string[]>;

  /**
   * Get capabilities of this channel.
   */
  getCapabilities(): ChannelCapabilities;

  /**
   * Initiate a DM conversation with a user (for proactive messaging).
   * Returns the JID of the DM conversation.
   */
  openDM(channelUserId: string): Promise<string>;
}
```

### JID Format Conventions

JIDs (Jabber-like IDs) are the universal addressing scheme for routing messages. Each channel uses a prefix to namespace its identifiers:

| Channel | JID Format | Example | Notes |
|---------|-----------|---------|-------|
| **Slack** | `slack:{workspace_id}:{channel_id}` | `slack:T04ABC123:D06XYZ789` | `D` prefix = DM channel |
| **Teams** | `teams:{tenant_id}:{conversation_id}` | `teams:abc-def-123:19:meeting_abc@thread.v2` | Tenant scoped |
| **Email** | `email:{sha256(user_email_address)}` | `email:a1b2c3d4e5f6...` | Hashed for privacy |
| **Web** | `web:{session_id}` | `web:sess_abc123def456` | Phase 1+ |

**JID design principles:**

1. **Channel prefix:** The first segment always identifies the channel type. This enables O(1) routing to the correct channel adapter.
2. **Org scoping:** Slack workspace IDs and Teams tenant IDs inherently scope to an organization. Email JIDs use hashing for privacy.
3. **Stable identifiers:** JIDs should be stable across reconnections. Slack channel IDs and Teams conversation IDs are persistent.
4. **No PII in JIDs:** Email addresses are SHA-256 hashed. User display names are never part of JIDs.

```typescript
// JID utility functions

function parseJid(jid: string): { channel: string; segments: string[] } {
  const parts = jid.split(':');
  return {
    channel: parts[0],
    segments: parts.slice(1),
  };
}

function getChannelFromJid(jid: string): string {
  return jid.split(':')[0];
}

function isSlackJid(jid: string): boolean {
  return jid.startsWith('slack:');
}

function isTeamsJid(jid: string): boolean {
  return jid.startsWith('teams:');
}

function isEmailJid(jid: string): boolean {
  return jid.startsWith('email:');
}

function createSlackJid(workspaceId: string, channelId: string): string {
  return `slack:${workspaceId}:${channelId}`;
}

function createTeamsJid(tenantId: string, conversationId: string): string {
  return `teams:${tenantId}:${conversationId}`;
}

function createEmailJid(emailAddress: string): string {
  const hash = crypto.createHash('sha256').update(emailAddress.toLowerCase()).digest('hex');
  return `email:${hash}`;
}
```

### Multi-Channel Router

The router dispatches inbound messages to user instances and outbound messages to the correct channel adapter:

```typescript
interface ChannelRouter {
  /**
   * Register a channel adapter. Called during system startup
   * or when an org admin connects a new channel.
   */
  registerChannel(channel: PlayNewChannel): void;

  /**
   * Remove a channel adapter (org disconnects a channel).
   */
  unregisterChannel(orgId: string, channelName: string): void;

  /**
   * Route an outbound message to the correct channel based on JID prefix.
   */
  sendMessage(jid: string, message: RichMessage): Promise<void>;

  /**
   * Find the channel adapter that owns a given JID.
   */
  resolveChannel(jid: string): PlayNewChannel | null;

  /**
   * Get all channels registered for an organization.
   */
  getOrgChannels(orgId: string): PlayNewChannel[];

  /**
   * Get the health status of all registered channels.
   */
  getHealthStatus(): ChannelHealthReport[];
}

interface ChannelHealthReport {
  orgId: string;
  channelName: string;
  isConnected: boolean;
  lastMessageAt: Date | null;
  errorCount24h: number;
  userCount: number;
}
```

**Routing flow:**

```
Inbound:
  Channel event (Slack message, Teams activity, email received)
    -> Channel adapter parses raw event into InboundMessage + ChatMetadata
    -> OnInboundMessage callback fires
    -> Router resolves ChatMetadata.userId to a user instance
    -> User instance processes message with assistant runtime
    -> Assistant produces response (RichMessage)
    -> Router.sendMessage(conversationJid, response)
    -> Router resolves JID prefix to channel adapter
    -> Channel adapter converts RichMessage to native format
    -> Native SDK sends to channel

Outbound (proactive):
  Assistant runtime triggers proactive message (weekly review, skill output)
    -> Runtime looks up user's preferred channel JID
    -> Router.sendMessage(jid, message)
    -> Same resolution as above
```

### Channel Registration Flow

When an org admin connects a channel, the following sequence occurs:

```
1. Org admin initiates channel connection
   (e.g., installs Slack app to workspace, adds Teams bot)

2. System creates a new PlayNewChannel instance:
   - Configures with org-specific credentials (bot token, app ID)
   - Sets orgId on the channel instance

3. Channel.connect() establishes the connection:
   - Slack: opens Socket Mode WebSocket
   - Teams: registers webhook endpoint with Bot Framework
   - Email: connects IMAP listener

4. Channel discovery:
   - Channel fetches workspace/tenant user list
   - System matches channel users to Play New user records
     (by email, by SSO identity, or by manual mapping)
   - For each matched user, Channel.openDM() establishes a DM conversation
   - Unmatched users are flagged for manual mapping

5. Router.registerChannel() makes the channel available for routing

6. Users receive welcome messages via their new DM conversations
```

### Per-Org Channel Registration

Each organization gets its own channel instances. This is critical for:

- **Security isolation:** Org A's Slack bot token cannot access Org B's workspace
- **Independent lifecycle:** Org A can disconnect Slack without affecting Org B
- **Credential management:** Each org's channel credentials are stored in their org-scoped vault

```typescript
/**
 * Channel registry manages per-org channel instances.
 */
interface ChannelRegistry {
  /**
   * Register a channel for an organization.
   * Stores credentials and creates the channel adapter instance.
   */
  register(
    orgId: string,
    channelType: 'slack' | 'teams' | 'email',
    config: ChannelConfig
  ): Promise<PlayNewChannel>;

  /**
   * Retrieve a specific channel for an org.
   */
  get(orgId: string, channelType: string): PlayNewChannel | null;

  /**
   * List all channels for an organization.
   */
  listForOrg(orgId: string): PlayNewChannel[];

  /**
   * Disconnect and remove a channel.
   */
  remove(orgId: string, channelType: string): Promise<void>;
}

type ChannelConfig =
  | SlackChannelConfig
  | TeamsChannelConfig
  | EmailChannelConfig;

interface SlackChannelConfig {
  type: 'slack';
  botToken: string;
  appToken: string; // Socket Mode app-level token
  signingSecret: string;
  workspaceId: string;
}

interface TeamsChannelConfig {
  type: 'teams';
  appId: string;
  appPassword: string;
  tenantId: string;
}

interface EmailChannelConfig {
  type: 'email';
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  credentials: {
    username: string;
    password: string;
  };
  domain: string; // e.g., "playnew.ai"
}
```

### User Identity Mapping

Each channel has its own user identity system. The mapping layer translates between channel-specific user IDs and Play New user instances:

```typescript
interface UserChannelMapping {
  /** Play New internal user ID */
  userId: string;
  /** Organization ID */
  orgId: string;
  /** Channel type */
  channelType: 'slack' | 'teams' | 'email';
  /** Channel-specific user identifier */
  channelUserId: string;
  /** JID for the user's DM conversation with the bot */
  dmJid: string;
  /** When this mapping was created */
  createdAt: Date;
  /** Last message timestamp */
  lastActiveAt: Date | null;
}
```

**Mapping resolution order:**

1. **SSO/OIDC match:** If the org uses SSO, match by email claim in the SSO token
2. **Email match:** Match channel user's email to Play New user email
3. **Manual mapping:** Admin explicitly maps a channel user to a Play New user
4. **Auto-create:** (Phase 1+) If the org allows it, create a new Play New user instance for unmapped channel users

### Rich Message Formatting

The `RichMessage` format is channel-agnostic. Each channel adapter converts it to native format:

| RichMessage Element | Slack | Teams | Email |
|--------------------|-------|-------|-------|
| `text` | `mrkdwn` text | Plain text | Plain text body |
| `blocks[type=header]` | `header` block | `TextBlock` (large) | `<h2>` tag |
| `blocks[type=section]` | `section` block | `TextBlock` | `<p>` tag |
| `blocks[type=divider]` | `divider` block | Horizontal rule | `<hr>` tag |
| `blocks[type=table]` | `section` with fields | `Table` element | `<table>` tag |
| `blocks[type=actions]` | `actions` block with buttons | `ActionSet` with `Action.Submit` | Links in email |
| `attachments` | File upload via `files.upload` | Attachment via Bot Framework | MIME attachment |
| `threadId` | `thread_ts` parameter | Reply to activity | `In-Reply-To` header |
| `ephemeral` | `chat.postEphemeral` | Not supported (fallback: DM) | Not applicable |

### Message Size Handling

Different channels have different message size limits:

| Channel | Max Message Length | Strategy |
|---------|-------------------|----------|
| **Slack** | 4,000 characters (text), 50 blocks | Split into multiple messages; long outputs become thread replies |
| **Teams** | 28 KB (Adaptive Card), ~4,000 chars text | Split into multiple messages; use cards for structured content |
| **Email** | No practical limit | Single message; long content is acceptable in email |

```typescript
/**
 * Splits a RichMessage into channel-appropriate chunks.
 */
function splitMessage(
  message: RichMessage,
  maxLength: number
): RichMessage[] {
  if (message.text.length <= maxLength && (!message.blocks || message.blocks.length <= 50)) {
    return [message];
  }

  const chunks: RichMessage[] = [];
  let currentText = '';
  const sentences = message.text.split(/(?<=[.!?])\s+/);

  for (const sentence of sentences) {
    if ((currentText + sentence).length > maxLength - 100) { // 100 char buffer
      chunks.push({ ...message, text: currentText.trim(), blocks: undefined });
      currentText = sentence;
    } else {
      currentText += (currentText ? ' ' : '') + sentence;
    }
  }

  if (currentText) {
    chunks.push({ ...message, text: currentText.trim(), blocks: message.blocks });
  }

  return chunks;
}
```

---

## Phase 0 Scope

### What We Build Now

- **Core interface:** `PlayNewChannel` interface with all methods defined
- **JID routing:** JID prefix parsing and channel resolution
- **Channel registry:** Per-org channel registration and lifecycle
- **User mapping:** Channel user -> Play New user mapping (email-based + manual)
- **Slack adapter:** Full `SlackChannel` implementation (see `slack-channel.md`)
- **Teams adapter:** Basic `TeamsChannel` implementation (see `teams-channel.md`)
- **Email bridge:** Basic `EmailBridgeChannel` implementation (see `email-bridge.md`)
- **Rich message:** `RichMessage` type with plain text + basic blocks
- **Message splitting:** Automatic splitting for Slack/Teams message limits

### What We Defer to Later Phases

| Deferred Feature | Target Phase | Rationale |
|-----------------|--------------|-----------|
| Web dashboard channel | Phase 1 | Not needed for DM-based Phase 0 interaction |
| Reaction handling | Phase 1 | Nice-to-have, not core for forward mode |
| Read receipts | Phase 1 | Not critical for Phase 0 experience |
| Interactive message actions (button clicks) | Phase 1 | Phase 0 uses text + slash commands only |
| Multi-channel per user (same user on Slack AND Teams) | Phase 1 | Phase 0: one channel per user |
| Channel failover (auto-switch if channel is down) | Phase 2 | Operational maturity requirement |
| WhatsApp channel | Phase 2+ | Enterprise demand dependent |

---

## Open Questions

1. **Multi-channel user routing:** If a user is on both Slack and Teams, which channel receives proactive messages? Options: (a) user selects primary channel, (b) most recently active channel, (c) always both. **Recommendation:** (a) user selects primary, with option to change.

2. **JID stability for email:** SHA-256 of email address means JID changes if user changes email. Should we use an internal stable ID instead? **Recommendation:** Use SHA-256 for Phase 0 (email addresses rarely change), migrate to stable internal ID in Phase 1 if needed.

3. **Channel credential rotation:** How do we handle expired Slack bot tokens or rotated Teams app secrets? **Recommendation:** Build credential refresh into the channel registry with alerting on expiry.

4. **Rate limiting:** Each channel has API rate limits (Slack: 1 msg/sec per channel, Teams: 5 msgs/sec). Should rate limiting live in the channel adapter or the router? **Recommendation:** Channel adapter, since limits are channel-specific.

5. **Message ordering guarantees:** If the assistant produces a multi-part response, do we guarantee ordering? **Recommendation:** Yes, send sequentially within a single channel adapter. Accept eventual consistency across channels.

6. **Offline message queuing:** If a channel is disconnected, do we queue outbound messages? **Recommendation:** Yes, queue with 24h TTL. Deliver on reconnection. Alert admin if channel is down >1h.
