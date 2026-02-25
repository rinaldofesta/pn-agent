# Slack Channel Specification

**Status:** Draft
**Version:** 0.1
**Last Updated:** 2026-02-25
**Owner:** Technical Architecture

---

## Context

Slack is the primary delivery channel for Play New's personal AI assistants in Phase 0. Most design partner organizations already use Slack as their internal communication platform, making it the lowest-friction entry point for the assistant. The Slack channel implements a DM-primary design where each user communicates with their personal assistant through a direct message conversation -- private, persistent, and always available in the user's existing workspace.

The key design choice is **DM-primary interaction**: the assistant lives in the user's DM list like a colleague, not in a shared channel. This reinforces the privacy model (conversations are between the user and their assistant only) and reduces the social friction of asking an AI for help in front of colleagues.

---

## Nanoclaw Foundation

Nanoclaw's `.claude/skills/add-slack/` directory contains a complete `SlackChannel` implementation that serves as our starting point:

**What nanoclaw's Slack implementation provides:**
- `SlackChannel` class implementing the `Channel` interface
- `@slack/bolt` integration with Socket Mode
- Basic message send/receive via Bot Events API
- DM detection and routing
- Connection lifecycle management
- WebSocket-based real-time messaging (no public URL required)

**What we extend for Play New:**
- Multi-workspace support (one Slack app installation per org)
- User identity mapping (Slack user ID -> Play New user instance)
- Rich formatting with Slack Block Kit
- Slash command registration and routing
- File/attachment handling (upload and download)
- Thread-aware conversations
- Message splitting for >4000 character responses
- Proactive messaging (assistant-initiated DMs)
- Workspace user enumeration for onboarding

---

## Play New Requirements

From the PRD:

- **Section 8.1:** Slack delivery is a "Must" for Phase 0
- **Section 8.3 (User Journey):** User receives a personal Slack DM from their assistant; orientation happens in DM; forward mode includes sharing Slack messages with assistant
- **Section 14.1:** Slack Bot (Socket Mode or Events API), primary delivery channel
- **Section 16.1:** Conversational design; proactive but not noisy (max 1 unprompted message/day); slash commands for skill invocation; rich formatting with Slack blocks; thread-aware conversations
- **FR-001.1:** Each user gets an isolated assistant instance accessible via Slack DM
- **FR-002.3:** User can share Slack messages with assistant via "share to DM" or mention
- **FR-003.6:** User can invoke skills via slash commands (e.g., `/pipeline-risk`, `/weekly-prep`)

---

## Technical Specification

### Architecture Overview

```
┌──────────────────────────────────────────────┐
│              Slack Workspace (Org A)          │
│                                              │
│  User A ──DM──┐                              │
│  User B ──DM──┤                              │
│  User C ──DM──┼──► Slack App (Bot User)      │
│  ...     ──DM──┘        │                    │
│                          │ Socket Mode       │
└──────────────────────────┼───────────────────┘
                           │ WebSocket
                           ▼
┌──────────────────────────────────────────────┐
│           SlackChannel Adapter                │
│                                              │
│  ┌─────────────┐  ┌──────────────────┐       │
│  │ Bolt App    │  │ User Mapping     │       │
│  │ (Socket     │  │ Cache            │       │
│  │  Mode)      │  │                  │       │
│  └──────┬──────┘  └────────┬─────────┘       │
│         │                  │                 │
│  ┌──────▼──────────────────▼─────────┐       │
│  │     Message Router                │       │
│  │  DM → personal instance           │       │
│  │  @mention → team routing           │       │
│  │  Slash cmd → skill invocation      │       │
│  └───────────────────┬───────────────┘       │
└──────────────────────┼───────────────────────┘
                       │
                       ▼
              PlayNewChannel Router
              (to user instances)
```

### Slack App Configuration

Each design partner organization gets its own Slack app installation. This provides:
- Isolated bot tokens (one per workspace)
- Independent permissions and event subscriptions
- No cross-workspace data leakage
- Independent app lifecycle (install, update, uninstall)

#### Required OAuth Scopes

| Scope | Purpose | Required For |
|-------|---------|--------------|
| `chat:write` | Send messages as the bot | All message sending |
| `im:history` | Read DM message history | Processing user messages |
| `im:read` | View basic DM information | DM channel discovery |
| `im:write` | Open DMs with users | Proactive messaging, onboarding |
| `users:read` | Read user list and profiles | User identity mapping |
| `users:read.email` | Read user email addresses | Email-based identity matching |
| `files:read` | Access files shared in DMs | Processing forwarded attachments |
| `files:write` | Upload files to conversations | Sending file-based outputs |
| `commands` | Register slash commands | Skill invocation |
| `reactions:read` | Read message reactions | Feedback collection (Phase 1) |

#### Event Subscriptions (Socket Mode)

| Event | Trigger | Handler |
|-------|---------|---------|
| `message.im` | Any message in a DM with the bot | Core message processing |
| `app_mention` | Bot @mentioned in a channel | Channel mention routing |
| `member_joined_channel` | User joins a channel where bot is present | User discovery |
| `file_shared` | File shared in a DM with the bot | Attachment processing |

#### Socket Mode Configuration

Socket Mode is chosen for Phase 0 because:
1. **No public URL required:** The bot connects via WebSocket to Slack's servers. No need to expose an HTTP endpoint, configure SSL, or manage ingress.
2. **Simpler infrastructure:** Works behind firewalls, NATs, and in local development.
3. **Real-time:** WebSocket provides lower latency than HTTP-based Events API.
4. **Trade-off:** Socket Mode is limited to ~10 connections per app. Sufficient for Phase 0 (one app per org, one connection each). Events API migration planned for Phase 1 if scale demands it.

```typescript
// Socket Mode requires an app-level token (xapp-...) in addition to the bot token
interface SlackSocketModeConfig {
  /** Bot OAuth token (xoxb-...) */
  botToken: string;
  /** App-level token for Socket Mode (xapp-...) */
  appToken: string;
  /** Signing secret for request verification */
  signingSecret: string;
  /** Workspace ID (for JID construction) */
  workspaceId: string;
}
```

### SlackChannel Implementation

```typescript
import { App, LogLevel } from '@slack/bolt';
import type {
  PlayNewChannel,
  InboundMessage,
  ChatMetadata,
  RichMessage,
  Attachment,
  ChannelCapabilities,
  OnInboundMessage,
  OnChatMetadata,
} from '../types';

export class SlackChannel implements PlayNewChannel {
  readonly name = 'slack';
  readonly orgId: string;

  private app: App;
  private workspaceId: string;
  private connected = false;
  private messageCallback: OnInboundMessage | null = null;
  private metadataCallback: OnChatMetadata | null = null;

  /** Cache: Slack user ID -> ChatMetadata */
  private userCache = new Map<string, ChatMetadata>();

  /** Cache: Slack user ID -> DM channel ID */
  private dmChannelCache = new Map<string, string>();

  constructor(orgId: string, config: SlackSocketModeConfig) {
    this.orgId = orgId;
    this.workspaceId = config.workspaceId;

    this.app = new App({
      token: config.botToken,
      appToken: config.appToken,
      signingSecret: config.signingSecret,
      socketMode: true,
      logLevel: LogLevel.INFO,
    });

    this.registerEventHandlers();
  }

  // ── NanoclawChannel methods ─────────────────────────────────

  async connect(): Promise<void> {
    await this.app.start();
    this.connected = true;

    // Pre-populate user cache
    await this.discoverUsers();
  }

  async sendMessage(jid: string, text: string): Promise<void> {
    const channelId = this.extractChannelId(jid);
    await this.app.client.chat.postMessage({
      channel: channelId,
      text,
    });
  }

  isConnected(): boolean {
    return this.connected;
  }

  ownsJid(jid: string): boolean {
    return jid.startsWith(`slack:${this.workspaceId}:`);
  }

  async disconnect(): Promise<void> {
    await this.app.stop();
    this.connected = false;
  }

  async setTyping(jid: string, isTyping: boolean): Promise<void> {
    // Slack does not have a public API for typing indicators.
    // The bot automatically shows "typing" while processing,
    // but we cannot programmatically control it.
    // This is a known limitation -- see Known Limitations section.
  }

  // ── PlayNewChannel extensions ───────────────────────────────

  async sendRichMessage(jid: string, message: RichMessage): Promise<void> {
    const channelId = this.extractChannelId(jid);
    const chunks = this.splitForSlack(message);

    for (const chunk of chunks) {
      await this.app.client.chat.postMessage({
        channel: channelId,
        text: chunk.text, // Fallback for notifications
        blocks: chunk.blocks
          ? this.convertToSlackBlocks(chunk.blocks)
          : undefined,
        thread_ts: chunk.threadId || undefined,
        // Ephemeral messages require a user ID, not just a channel
        // Handled separately in sendEphemeral()
      });
    }

    // Send attachments separately
    if (message.attachments) {
      for (const attachment of message.attachments) {
        await this.sendFile(jid, attachment);
      }
    }
  }

  async sendFile(jid: string, attachment: Attachment): Promise<void> {
    const channelId = this.extractChannelId(jid);

    if (attachment.content) {
      await this.app.client.files.uploadV2({
        channel_id: channelId,
        file: attachment.content,
        filename: attachment.filename,
      });
    } else if (attachment.url) {
      // For URL-based attachments, share the URL as a message
      await this.app.client.chat.postMessage({
        channel: channelId,
        text: `📎 ${attachment.filename}: ${attachment.url}`,
      });
    }
  }

  onMessage(callback: OnInboundMessage): void {
    this.messageCallback = callback;
  }

  onMetadata(callback: OnChatMetadata): void {
    this.metadataCallback = callback;
  }

  async resolveUser(channelUserId: string): Promise<ChatMetadata | null> {
    return this.userCache.get(channelUserId) || null;
  }

  async listUsers(): Promise<string[]> {
    return Array.from(this.dmChannelCache.entries()).map(
      ([_userId, channelId]) =>
        `slack:${this.workspaceId}:${channelId}`
    );
  }

  getCapabilities(): ChannelCapabilities {
    return {
      richFormatting: true,
      fileUpload: true,
      fileDownload: true,
      threading: true,
      reactions: true,
      typingIndicator: false, // Not controllable via API
      slashCommands: true,
      ephemeralMessages: true,
      maxMessageLength: 4000,
    };
  }

  async openDM(channelUserId: string): Promise<string> {
    // Check cache first
    const cached = this.dmChannelCache.get(channelUserId);
    if (cached) {
      return `slack:${this.workspaceId}:${cached}`;
    }

    // Open DM conversation
    const result = await this.app.client.conversations.open({
      users: channelUserId,
    });

    const channelId = result.channel?.id;
    if (!channelId) {
      throw new Error(`Failed to open DM with Slack user ${channelUserId}`);
    }

    this.dmChannelCache.set(channelUserId, channelId);
    return `slack:${this.workspaceId}:${channelId}`;
  }

  // ── Private methods ─────────────────────────────────────────

  private registerEventHandlers(): void {
    // Handle DM messages
    this.app.message(async ({ message, say }) => {
      // Only process messages in DMs (im type)
      if (message.channel_type !== 'im') return;
      // Ignore bot messages (prevent loops)
      if ('bot_id' in message) return;
      // Ignore message edits and deletions for Phase 0
      if (message.subtype === 'message_changed' || message.subtype === 'message_deleted') return;

      const slackUserId = 'user' in message ? message.user : undefined;
      if (!slackUserId) return;

      const metadata = await this.resolveUser(slackUserId);
      if (!metadata) {
        // Unknown user -- send guidance
        await say(
          'I don\'t have you in my system yet. Please ask your Play New administrator to complete your setup.'
        );
        return;
      }

      const inbound: InboundMessage = {
        messageId: `slack:${message.ts}`,
        senderJid: `slack:${this.workspaceId}:${slackUserId}`,
        conversationJid: `slack:${this.workspaceId}:${message.channel}`,
        text: 'text' in message ? (message.text || '') : '',
        attachments: await this.extractAttachments(message),
        threadId: 'thread_ts' in message ? String(message.thread_ts) : undefined,
        timestamp: new Date(parseFloat(String(message.ts)) * 1000),
        rawMetadata: { slackMessage: message },
      };

      if (this.messageCallback) {
        await this.messageCallback(inbound, metadata);
      }
    });

    // Handle slash commands
    this.app.command(/.*/, async ({ command, ack, respond }) => {
      await ack();

      const slackUserId = command.user_id;
      const metadata = await this.resolveUser(slackUserId);

      if (!metadata) {
        await respond('I don\'t have you in my system yet. Please contact your administrator.');
        return;
      }

      // Convert slash command to an InboundMessage with special metadata
      const inbound: InboundMessage = {
        messageId: `slack:cmd:${Date.now()}`,
        senderJid: `slack:${this.workspaceId}:${slackUserId}`,
        conversationJid: `slack:${this.workspaceId}:${command.channel_id}`,
        text: `${command.command} ${command.text}`.trim(),
        timestamp: new Date(),
        rawMetadata: {
          isSlashCommand: true,
          command: command.command,
          commandText: command.text,
          responseUrl: command.response_url,
        },
      };

      if (this.messageCallback) {
        await this.messageCallback(inbound, metadata);
      }
    });

    // Handle app mentions in channels
    this.app.event('app_mention', async ({ event }) => {
      const slackUserId = event.user;
      const metadata = await this.resolveUser(slackUserId);

      if (!metadata) return;

      const inbound: InboundMessage = {
        messageId: `slack:${event.ts}`,
        senderJid: `slack:${this.workspaceId}:${slackUserId}`,
        conversationJid: `slack:${this.workspaceId}:${event.channel}`,
        text: event.text || '',
        threadId: event.thread_ts,
        timestamp: new Date(parseFloat(event.ts) * 1000),
        rawMetadata: {
          isMention: true,
          channel: event.channel,
        },
      };

      if (this.messageCallback) {
        await this.messageCallback(inbound, metadata);
      }
    });
  }

  /**
   * Discover all users in the workspace and build the user mapping cache.
   */
  private async discoverUsers(): Promise<void> {
    let cursor: string | undefined;

    do {
      const result = await this.app.client.users.list({ cursor, limit: 200 });

      for (const member of result.members || []) {
        if (member.is_bot || member.deleted || member.id === 'USLACKBOT') continue;

        // Look up Play New user by email
        const email = member.profile?.email;
        if (!email || !member.id) continue;

        // This will be resolved against the Play New user database
        // For now, we populate what we can from Slack
        const metadata: ChatMetadata = {
          userId: '', // To be resolved by the user mapping service
          orgId: this.orgId,
          channelName: 'slack',
          displayName: member.profile?.real_name || member.name || 'Unknown',
          channelUserId: member.id,
          timezone: member.tz || undefined,
          capabilities: this.getCapabilities(),
        };

        this.userCache.set(member.id, metadata);
      }

      cursor = result.response_metadata?.next_cursor || undefined;
    } while (cursor);
  }

  /**
   * Extract file attachments from a Slack message.
   */
  private async extractAttachments(message: any): Promise<Attachment[]> {
    if (!message.files || message.files.length === 0) return [];

    return message.files.map((file: any) => ({
      filename: file.name || 'unnamed',
      mimeType: file.mimetype || 'application/octet-stream',
      url: file.url_private_download || file.url_private,
      sizeBytes: file.size || 0,
    }));
  }

  /**
   * Extract the Slack channel ID from a Play New JID.
   */
  private extractChannelId(jid: string): string {
    // JID format: slack:{workspace_id}:{channel_id}
    const parts = jid.split(':');
    return parts[2];
  }

  /**
   * Convert Play New MessageBlocks to Slack Block Kit format.
   */
  private convertToSlackBlocks(blocks: import('../types').MessageBlock[]): any[] {
    return blocks.map((block) => {
      switch (block.type) {
        case 'header':
          return {
            type: 'header',
            text: { type: 'plain_text', text: block.text || '', emoji: true },
          };

        case 'section':
          if (block.fields) {
            return {
              type: 'section',
              fields: block.fields.map((f) => ({
                type: 'mrkdwn',
                text: `*${f.label}*\n${f.value}`,
              })),
            };
          }
          return {
            type: 'section',
            text: { type: 'mrkdwn', text: block.text || '' },
          };

        case 'divider':
          return { type: 'divider' };

        case 'context':
          return {
            type: 'context',
            elements: [{ type: 'mrkdwn', text: block.text || '' }],
          };

        case 'actions':
          return {
            type: 'actions',
            elements: (block.actions || []).map((action) => {
              if (action.type === 'button') {
                return {
                  type: 'button',
                  text: { type: 'plain_text', text: action.label },
                  action_id: action.actionId,
                  value: action.value,
                  ...(action.style && { style: action.style }),
                };
              }
              if (action.type === 'select') {
                return {
                  type: 'static_select',
                  placeholder: { type: 'plain_text', text: action.label },
                  action_id: action.actionId,
                  options: (action.options || []).map((o) => ({
                    text: { type: 'plain_text', text: o.label },
                    value: o.value,
                  })),
                };
              }
              return null;
            }).filter(Boolean),
          };

        case 'table':
          // Slack doesn't have native tables -- use section fields
          if (block.fields) {
            return {
              type: 'section',
              fields: block.fields.slice(0, 10).map((f) => ({
                type: 'mrkdwn',
                text: `*${f.label}*\n${f.value}`,
              })),
            };
          }
          return {
            type: 'section',
            text: { type: 'mrkdwn', text: block.text || '' },
          };

        default:
          return {
            type: 'section',
            text: { type: 'mrkdwn', text: block.text || '' },
          };
      }
    });
  }

  /**
   * Split a RichMessage into Slack-safe chunks.
   * Slack limit: 4000 chars per message, 50 blocks per message.
   */
  private splitForSlack(message: RichMessage): RichMessage[] {
    const MAX_TEXT = 3900; // Buffer below 4000
    const MAX_BLOCKS = 50;

    // If it fits, return as-is
    if (
      message.text.length <= MAX_TEXT &&
      (!message.blocks || message.blocks.length <= MAX_BLOCKS)
    ) {
      return [message];
    }

    const chunks: RichMessage[] = [];

    // Split text by paragraphs
    if (message.text.length > MAX_TEXT) {
      const paragraphs = message.text.split('\n\n');
      let currentChunk = '';

      for (const para of paragraphs) {
        if ((currentChunk + '\n\n' + para).length > MAX_TEXT) {
          if (currentChunk) {
            chunks.push({ text: currentChunk.trim(), threadId: message.threadId });
          }
          currentChunk = para;
        } else {
          currentChunk = currentChunk ? currentChunk + '\n\n' + para : para;
        }
      }
      if (currentChunk) {
        chunks.push({
          text: currentChunk.trim(),
          blocks: message.blocks?.slice(0, MAX_BLOCKS),
          threadId: message.threadId,
        });
      }
    } else if (message.blocks && message.blocks.length > MAX_BLOCKS) {
      // Split blocks across messages
      for (let i = 0; i < message.blocks.length; i += MAX_BLOCKS) {
        chunks.push({
          text: i === 0 ? message.text : '(continued)',
          blocks: message.blocks.slice(i, i + MAX_BLOCKS),
          threadId: message.threadId,
        });
      }
    }

    // If first message, subsequent messages become thread replies
    if (chunks.length > 1 && !chunks[0].threadId) {
      // The first chunk is the "parent"; subsequent chunks will be threaded
      // In practice, we need the timestamp of the first sent message to thread
      // This is handled at send time in sendRichMessage()
    }

    return chunks.length > 0 ? chunks : [message];
  }
}
```

### Multi-Workspace Support

Each design partner organization gets its own Slack app instance:

```
Org A (Acme Corp)           Org B (TechStart)          Org C (MegaRetail)
  Slack Workspace A           Slack Workspace B          Slack Workspace C
  App: "Play New - Acme"      App: "Play New - Tech"     App: "Play New - Mega"
  Bot Token: xoxb-aaa...      Bot Token: xoxb-bbb...     Bot Token: xoxb-ccc...
       │                           │                           │
       └───────────┬───────────────┴───────────┬───────────────┘
                   │                           │
          SlackChannel(orgA)          SlackChannel(orgB)    SlackChannel(orgC)
                   │                           │                    │
                   └───────────────────────────┴────────────────────┘
                                    │
                           ChannelRouter
```

**Phase 0 approach:** One Slack app manifest, installed separately in each workspace. Each installation produces its own bot token and app token. The `ChannelRegistry` stores these credentials per org and creates a separate `SlackChannel` instance for each.

### Slack App Manifest (Template)

```yaml
display_information:
  name: "Play New Assistant"
  description: "Your personal AI work assistant"
  background_color: "#1a1a2e"
  long_description: >-
    Play New deploys a personal AI assistant to help you analyze information,
    spot patterns in your work, and surface opportunities you might miss.
    Everything you share is private to you.

features:
  bot_user:
    display_name: "Play New"
    always_online: true
  slash_commands:
    - command: "/pn"
      description: "Interact with your Play New assistant"
      usage_hint: "[command] [arguments]"
      should_escape: false
    - command: "/pipeline-risk"
      description: "Scan your pipeline for at-risk deals"
      should_escape: false
    - command: "/weekly-prep"
      description: "Prepare your weekly review"
      should_escape: false
    - command: "/meeting-prep"
      description: "Prepare for an upcoming meeting"
      usage_hint: "[meeting name or topic]"
      should_escape: false
    - command: "/email-summary"
      description: "Summarize a forwarded email"
      should_escape: false

oauth_config:
  scopes:
    bot:
      - chat:write
      - im:history
      - im:read
      - im:write
      - users:read
      - users:read.email
      - files:read
      - files:write
      - commands
      - reactions:read

settings:
  event_subscriptions:
    bot_events:
      - message.im
      - app_mention
      - file_shared
      - member_joined_channel
  interactivity:
    is_enabled: true
  org_deploy_enabled: false
  socket_mode_enabled: true
  token_rotation_enabled: false
```

### User Identity Mapping

Slack user IDs must be mapped to Play New user instances. The mapping process:

```
1. SlackChannel.discoverUsers() fetches all workspace members
2. For each Slack user, extract email from profile
3. Match email against Play New user records for this org
4. Store mapping: slack_user_id <-> pn_user_id
5. For matched users, open DM (conversations.open)
6. Cache DM channel ID for outbound messaging
```

**Mapping table (PostgreSQL):**

```sql
CREATE TABLE user_channel_mappings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id),
  org_id        UUID NOT NULL REFERENCES organizations(id),
  channel_type  VARCHAR(20) NOT NULL DEFAULT 'slack',
  channel_user_id VARCHAR(100) NOT NULL,  -- Slack user ID (U...)
  dm_jid        VARCHAR(200),             -- slack:{workspace}:{dm_channel}
  display_name  VARCHAR(200),
  timezone      VARCHAR(50),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ,

  UNIQUE(org_id, channel_type, channel_user_id)
);

CREATE INDEX idx_ucm_user ON user_channel_mappings(user_id);
CREATE INDEX idx_ucm_channel ON user_channel_mappings(channel_type, channel_user_id);
```

### Message Handling Patterns

#### DM Messages (Primary Flow)

```
User sends DM to bot
  -> message.im event fires
  -> SlackChannel validates: is this a known user?
  -> If yes: construct InboundMessage, resolve ChatMetadata, fire callback
  -> If no: respond with setup guidance
  -> Assistant runtime processes message
  -> Assistant produces RichMessage response
  -> SlackChannel converts to Block Kit and sends
```

#### Channel @Mentions (Secondary Flow)

```
User @mentions bot in a channel
  -> app_mention event fires
  -> SlackChannel resolves the mentioning user
  -> Construct InboundMessage with isMention=true in metadata
  -> Route to user's personal instance
  -> Response is sent as a thread reply in the channel (public)

Note: Channel mentions are public. The assistant must NOT include
private context in public channel responses. Response should be
generic or suggest continuing in DM.
```

#### Forward Mode (Share Content)

```
User shares/forwards a message to the bot DM
  -> Appears as a regular DM message with shared content
  -> If the shared message contains files: file_shared event
  -> SlackChannel extracts shared content and any attachments
  -> Route to user's personal instance with full context
  -> Assistant analyzes forwarded content with org context
  -> Response sent in the DM thread
```

#### Slash Commands

```
User types /pipeline-risk in any channel or DM
  -> Slack sends command event to our app
  -> SlackChannel ACKs within 3 seconds (Slack requirement)
  -> Resolve user, construct InboundMessage with isSlashCommand=true
  -> Route to user's personal instance
  -> Skill engine matches command to skill file
  -> Skill executes, produces RichMessage
  -> Response sent via respond() (visible only to invoking user) or
     posted to DM (for longer outputs)
```

### Slash Command Registry

Phase 0 slash commands map directly to skills:

| Command | Skill | Description | Response Location |
|---------|-------|-------------|-------------------|
| `/pn` | (router) | General assistant command: `/pn ask ...`, `/pn help` | DM |
| `/pipeline-risk` | `pipeline-risk-scan` | Scan pipeline for at-risk deals | DM (long output) |
| `/weekly-prep` | `weekly-digest` | Prepare weekly review | DM |
| `/meeting-prep` | `meeting-prep` | Prepare for upcoming meeting | DM |
| `/email-summary` | `email-summarizer` | Summarize forwarded email | Ephemeral (short) |
| `/forecast` | `forecast-prep` | Prepare sales forecast | DM |
| `/risk-scan` | `risk-register-updater` | Update risk register | DM |

**Slash command routing logic:**

```typescript
function routeSlashCommand(
  command: string,
  text: string
): { skillId: string; args: string } | { error: string } {
  const commandMap: Record<string, string> = {
    '/pipeline-risk': 'pipeline-risk-scan',
    '/weekly-prep': 'weekly-digest',
    '/meeting-prep': 'meeting-prep',
    '/email-summary': 'email-summarizer',
    '/forecast': 'forecast-prep',
    '/risk-scan': 'risk-register-updater',
  };

  if (command === '/pn') {
    // General router: /pn help, /pn skills, /pn ask <question>
    const subcommand = text.split(' ')[0];
    const rest = text.slice(subcommand.length).trim();

    switch (subcommand) {
      case 'help':
        return { skillId: '__help', args: '' };
      case 'skills':
        return { skillId: '__list_skills', args: '' };
      case 'ask':
        return { skillId: '__direct_question', args: rest };
      default:
        return { skillId: '__direct_question', args: text };
    }
  }

  const skillId = commandMap[command];
  if (!skillId) {
    return { error: `Unknown command: ${command}` };
  }

  return { skillId, args: text };
}
```

### Rich Formatting Examples

#### Skill Output (Pipeline Risk Scan)

```json
{
  "text": "3 deals flagged this week. Top concern: Acme Corp renewal.",
  "blocks": [
    {
      "type": "header",
      "text": "Pipeline Risk Scan - Week 9"
    },
    {
      "type": "section",
      "text": "3 deals flagged this week. Top concern: Acme Corp renewal."
    },
    { "type": "divider" },
    {
      "type": "section",
      "fields": [
        { "label": "Deal", "value": "Acme Corp Renewal" },
        { "label": "Risk Level", "value": "HIGH" },
        { "label": "Days Since Contact", "value": "23 days" },
        { "label": "Stage Stagnation", "value": "18 days (avg: 7)" }
      ]
    },
    {
      "type": "context",
      "text": "Recommended: Schedule call with Sarah (champion). Last engagement was a pricing discussion on Feb 2."
    },
    { "type": "divider" },
    {
      "type": "section",
      "fields": [
        { "label": "Deal", "value": "TechStart Platform" },
        { "label": "Risk Level", "value": "MEDIUM" },
        { "label": "Days Since Contact", "value": "12 days" },
        { "label": "Competitor Signal", "value": "Competitor X mentioned in last call notes" }
      ]
    }
  ]
}
```

This renders in Slack as:

```
━━━ Pipeline Risk Scan - Week 9 ━━━
3 deals flagged this week. Top concern: Acme Corp renewal.
────────────────────
Deal                    Risk Level
Acme Corp Renewal       HIGH
Days Since Contact      Stage Stagnation
23 days                 18 days (avg: 7)
⸻ Recommended: Schedule call with Sarah (champion). Last engagement
  was a pricing discussion on Feb 2.
────────────────────
Deal                    Risk Level
TechStart Platform      MEDIUM
...
```

### Proactive Messaging

The assistant sends proactive messages (max 1/day per PRD Section 16.1):

```typescript
interface ProactiveMessageConfig {
  /** Maximum proactive messages per user per day */
  maxPerDay: number; // Default: 1
  /** Quiet hours -- no proactive messages during these times */
  quietHours: { start: string; end: string }; // e.g., "20:00" - "08:00"
  /** Respect user timezone for quiet hours */
  useUserTimezone: boolean; // Default: true
}

async function sendProactiveMessage(
  channel: SlackChannel,
  userId: string,
  message: RichMessage,
  config: ProactiveMessageConfig
): Promise<boolean> {
  // Check rate limit
  const sentToday = await getProactiveCountToday(userId);
  if (sentToday >= config.maxPerDay) {
    return false; // Queued for tomorrow
  }

  // Check quiet hours
  const metadata = await channel.resolveUser(userId);
  if (metadata && isQuietHours(config, metadata.timezone)) {
    return false; // Queued for after quiet hours
  }

  // Get user's DM JID
  const dmJid = await getDmJid(userId, channel.orgId, 'slack');
  if (!dmJid) {
    return false;
  }

  await channel.sendRichMessage(dmJid, message);
  await recordProactiveMessage(userId);
  return true;
}
```

---

## Known Limitations

| Limitation | Impact | Mitigation | Resolution Phase |
|-----------|--------|------------|-----------------|
| **Typing indicator not controllable** | User doesn't see "assistant is typing" during processing | Send a quick "Thinking..." message, then edit it with the response | Phase 1 (explore undocumented APIs) |
| **4000 char message limit** | Long skill outputs get split | Automatic message splitting; long outputs go to threads | Permanent (Slack platform limit) |
| **Socket Mode connection limit** | Max ~10 concurrent WebSocket connections per app | One connection per org is sufficient for Phase 0 | Phase 1: migrate to Events API if needed |
| **Thread flattening** | Deep thread conversations lose context in Slack notifications | Keep threads shallow (max 2-3 levels); suggest DM for complex conversations | Permanent (Slack UX limitation) |
| **File download auth** | Downloading files shared in DMs requires the bot token | Always use bot token for file URLs; implement token refresh | Permanent |
| **Slash command 3s ACK** | Must ACK within 3 seconds or Slack shows error | ACK immediately, process async, respond via response_url | Permanent (Slack requirement) |
| **Rate limits** | Slack rate limits: ~1 msg/sec per channel (Tier 3) | Queue outbound messages; backoff on 429 responses | Permanent |
| **No message editing for blocks** | Cannot edit messages with complex blocks easily | Send new messages instead of editing; use ephemeral for transient content | Permanent (Slack API limitation) |

---

## Phase 0 Scope

### In Scope

- DM-only conversations (1:1 with bot)
- Text messages (send and receive)
- Basic file attachments (receive only: PDFs, documents forwarded in DMs)
- Slash commands for skill invocation (5-7 commands)
- Socket Mode connection (one per org)
- User discovery and mapping (email-based)
- Message splitting for long responses
- Basic Block Kit formatting (headers, sections, dividers)
- Proactive messaging (weekly review, max 1/day)

### Out of Scope (Phase 1+)

- Channel-based conversations (only DMs)
- Interactive components (buttons, menus) -- text + slash commands only
- File sending (bot sends files to users)
- Message editing/updating
- Reaction-based feedback
- Events API migration
- Custom emoji and rich text formatting
- Workflow Builder integration
- Slack Connect (cross-workspace channels)

---

## Open Questions

1. **Slash command naming:** Should all commands be prefixed (`/pn-pipeline-risk`) or use short names (`/pipeline-risk`)? Short names risk collision with other apps. **Recommendation:** Use `/pn` as the universal prefix with subcommands: `/pn pipeline-risk`, `/pn weekly-prep`. This registers only one slash command.

2. **Bot display name customization per org:** Should each org's bot have a custom name (e.g., "Alex" for Acme, "Aria" for TechStart)? **Recommendation:** Allow customization in Phase 0 via Slack app settings. Default: "Play New".

3. **Message retention:** Should the Slack channel adapter retain message history for context, or rely entirely on the assistant's personal memory? **Recommendation:** Do not retain in the channel adapter. The assistant runtime manages memory. Channel adapter is stateless except for user mapping cache.

4. **Handling of shared channels:** If a user shares a message from a public channel to the bot DM, should the bot have access to the original channel context? **Recommendation:** Phase 0: process only the shared text/attachments, not the channel context. Phase 1: if bot is in the channel, provide thread context.

5. **Error message format:** When the assistant encounters an error (LLM timeout, skill failure), what should the user see? **Recommendation:** Friendly error with retry suggestion: "I ran into an issue processing that. Want me to try again?" Never expose technical errors.
