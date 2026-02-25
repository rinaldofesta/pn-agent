# Adding a Channel

**Version:** 0.1.0
**Last Updated:** 2026-02-25
**Status:** Draft -- Pre-Phase 0 Architecture
**Owner:** Technical Architecture

---

## Context

Play New delivers personal AI assistants through multiple communication channels. The channel abstraction layer (see [channel-abstraction.md](../specs/channels/channel-abstraction.md)) provides a unified interface that isolates the assistant runtime from channel-specific concerns. This guide explains how to implement a new channel adapter, register it with the system, and test it.

**Prerequisite reading:**
- [Channel Abstraction & Multi-Channel Routing](../specs/channels/channel-abstraction.md) -- the interface specification
- [ADR-001: Nanoclaw as Foundation](../decisions/001-nanoclaw-as-foundation.md) -- understanding the nanoclaw base

**Existing implementations to reference:**
- `src/channels/slack/` -- Slack (Bolt SDK, Socket Mode + Events API)
- `src/channels/teams/` -- Microsoft Teams (Bot Framework)
- `src/channels/email/` -- Email bridge (IMAP/SMTP)

---

## Overview

Adding a new channel requires implementing the `PlayNewChannel` interface and registering the adapter with the channel registry. The process has 8 steps:

1. Create the channel adapter file
2. Implement required interface methods
3. Register the channel in the channel registry
4. Define the JID format for routing
5. Implement user identity resolution
6. Implement rich message formatting
7. Write tests
8. Add configuration

---

## Step 1: Create the Channel Adapter File

Create a new directory under `src/channels/` for your channel:

```
src/channels/
  slack/
    app.ts
    events.ts
    commands.ts
  teams/
    ...
  email/
    ...
  your-channel/            # New channel
    adapter.ts             # Main adapter implementation
    formatter.ts           # Rich message formatting
    identity.ts            # User identity resolution
    types.ts               # Channel-specific type definitions
```

The main adapter file (`adapter.ts`) exports a class that implements `PlayNewChannel`:

```typescript
// src/channels/your-channel/adapter.ts

import { PlayNewChannel, RichMessage, InboundMessage, ChatMetadata,
         ChannelCapabilities, Attachment, OnInboundMessage, OnChatMetadata
} from '../types';

export class YourChannelAdapter implements PlayNewChannel {
  readonly name = 'your-channel';
  orgId: string;

  private messageCallback: OnInboundMessage | null = null;
  private metadataCallback: OnChatMetadata | null = null;
  private connected = false;

  constructor(config: YourChannelConfig) {
    this.orgId = config.orgId;
    // Initialize your channel's SDK client here
  }

  // ... interface methods (Step 2)
}
```

---

## Step 2: Implement Required Interface Methods

The `PlayNewChannel` interface extends nanoclaw's `Channel` with Play New-specific methods. You must implement all of the following:

### Core Lifecycle (from nanoclaw)

```typescript
async connect(): Promise<void> {
  // Establish connection to the channel's API/service.
  // Examples:
  //   Slack: open Socket Mode WebSocket
  //   Teams: register webhook with Bot Framework
  //   Email: connect IMAP listener
  //   Discord: login with bot token, register gateway connection
  //
  // After connecting, set up event listeners that call
  // this.handleInboundMessage() when new messages arrive.

  // Your SDK connection logic here
  this.connected = true;
}

async disconnect(): Promise<void> {
  // Gracefully close the connection.
  // Clean up event listeners, close sockets, etc.
  this.connected = false;
}

isConnected(): boolean {
  return this.connected;
}
```

### Message Sending

```typescript
async sendMessage(jid: string, text: string): Promise<void> {
  // Send a plain text message to the conversation identified by jid.
  // This is the nanoclaw base method. It should work for simple text.
  //
  // Parse the JID to extract channel-specific identifiers:
  const { segments } = parseJid(jid);
  // segments[0] = server/workspace ID, segments[1] = channel/conversation ID, etc.

  // Send via your SDK
  await this.client.sendMessage(segments[1], text);
}

async sendRichMessage(jid: string, message: RichMessage): Promise<void> {
  // Send a rich message with formatting, blocks, and attachments.
  // If the channel does not support rich formatting, fall back to sendMessage().
  //
  // 1. Convert RichMessage blocks to your channel's native format
  //    (see Step 6: Rich Message Formatting)
  // 2. Handle threading (if message.threadId is set)
  // 3. Handle ephemeral messages (if message.ephemeral is true)
  // 4. Handle message size limits (split if necessary)

  const formatted = formatForYourChannel(message);
  const { segments } = parseJid(jid);

  if (message.threadId) {
    await this.client.sendReply(segments[1], message.threadId, formatted);
  } else {
    await this.client.send(segments[1], formatted);
  }
}

async sendFile(jid: string, attachment: Attachment): Promise<void> {
  // Upload and send a file attachment.
  // If the channel does not support file uploads, send a link instead.
  const { segments } = parseJid(jid);
  await this.client.uploadFile(segments[1], {
    filename: attachment.filename,
    content: attachment.content || await fetch(attachment.url!),
    mimeType: attachment.mimeType,
  });
}
```

### JID Ownership

```typescript
ownsJid(jid: string): boolean {
  // Return true if this channel adapter is responsible for the given JID.
  // Used by the router to dispatch messages to the correct channel.
  //
  // Check the JID prefix matches your channel name:
  return jid.startsWith('your-channel:');
}
```

### Typing Indicator (Optional)

```typescript
async setTyping(jid: string, isTyping: boolean): Promise<void> {
  // Show or hide a typing indicator in the conversation.
  // Not all channels support this. If unsupported, make this a no-op.
  if (!isTyping) return; // Most channels only support "start typing"

  const { segments } = parseJid(jid);
  await this.client.triggerTyping(segments[1]);
}
```

### Callback Registration

```typescript
onMessage(callback: OnInboundMessage): void {
  this.messageCallback = callback;
}

onMetadata(callback: OnChatMetadata): void {
  this.metadataCallback = callback;
}
```

### User Resolution

```typescript
async resolveUser(channelUserId: string): Promise<ChatMetadata | null> {
  // Map a channel-specific user ID to a Play New user.
  // See Step 5 for implementation details.
  return resolveYourChannelUser(this.orgId, channelUserId);
}

async listUsers(): Promise<string[]> {
  // Return all user JIDs currently registered with this channel instance.
  // Used for proactive messaging (sending messages to all users).
  return this.registeredUsers.map(u => u.dmJid);
}
```

### Channel Capabilities

```typescript
getCapabilities(): ChannelCapabilities {
  return {
    richFormatting: true,        // Does the channel support blocks/cards?
    fileUpload: true,            // Can the bot upload files?
    fileDownload: true,          // Can the bot download user-uploaded files?
    threading: true,             // Does the channel support threaded replies?
    reactions: true,             // Does the channel support message reactions?
    typingIndicator: true,       // Does the channel support typing indicators?
    slashCommands: true,         // Does the channel support slash commands?
    ephemeralMessages: false,    // Can the bot send messages only visible to one user?
    maxMessageLength: 2000,      // Maximum characters per message
  };
}
```

### Proactive DM

```typescript
async openDM(channelUserId: string): Promise<string> {
  // Open a direct message conversation with a user.
  // Returns the JID of the DM conversation.
  //
  // This is used during onboarding to send the welcome message,
  // and for proactive messages (weekly review, skill notifications).

  const dmConversation = await this.client.openDM(channelUserId);
  const jid = createYourChannelJid(this.workspaceId, dmConversation.id);
  return jid;
}
```

### Handling Inbound Messages

Add a private method that your SDK event listener calls when a message arrives:

```typescript
private async handleInboundMessage(rawEvent: YourChannelRawEvent): Promise<void> {
  // 1. Parse the raw event into an InboundMessage
  const message: InboundMessage = {
    messageId: rawEvent.id,
    senderJid: createYourChannelJid(this.workspaceId, rawEvent.senderId),
    conversationJid: createYourChannelJid(this.workspaceId, rawEvent.channelId),
    text: rawEvent.text,
    attachments: rawEvent.files?.map(f => ({
      filename: f.name,
      mimeType: f.mimeType,
      url: f.url,
      sizeBytes: f.size,
    })),
    threadId: rawEvent.threadId || undefined,
    rawMetadata: rawEvent,
    timestamp: new Date(rawEvent.timestamp),
  };

  // 2. Resolve the sender to a Play New user
  const metadata = await this.resolveUser(rawEvent.senderId);
  if (!metadata) {
    // Unknown user -- log and ignore, or send an "unregistered" message
    return;
  }

  // 3. Fire the callback
  if (this.messageCallback) {
    await this.messageCallback(message, metadata);
  }
}
```

---

## Step 3: Register the Channel in the Channel Registry

The channel registry manages per-org channel instances. Register your new channel type in the registry factory:

```typescript
// src/channels/registry.ts

import { YourChannelAdapter } from './your-channel/adapter';

// Add your channel type to the ChannelConfig union
type ChannelConfig =
  | SlackChannelConfig
  | TeamsChannelConfig
  | EmailChannelConfig
  | YourChannelConfig;          // Add this

// Add your channel type to the factory function
function createChannelAdapter(config: ChannelConfig): PlayNewChannel {
  switch (config.type) {
    case 'slack':
      return new SlackChannelAdapter(config);
    case 'teams':
      return new TeamsChannelAdapter(config);
    case 'email':
      return new EmailBridgeAdapter(config);
    case 'your-channel':                            // Add this
      return new YourChannelAdapter(config);
    default:
      throw new Error(`Unknown channel type: ${(config as any).type}`);
  }
}
```

Define your channel's configuration type:

```typescript
// src/channels/your-channel/types.ts

export interface YourChannelConfig {
  type: 'your-channel';
  orgId: string;
  botToken: string;              // Authentication token
  workspaceId: string;           // Workspace/server identifier
  // Add any channel-specific configuration
}
```

---

## Step 4: Define the JID Format

Every channel has a JID (Jabber-like ID) format that uniquely identifies conversations. The format follows the convention `{channel-prefix}:{scope}:{conversation-id}`.

Define your JID utilities:

```typescript
// src/channels/your-channel/adapter.ts (or a shared jid-utils file)

const CHANNEL_PREFIX = 'your-channel';

function createYourChannelJid(workspaceId: string, conversationId: string): string {
  return `${CHANNEL_PREFIX}:${workspaceId}:${conversationId}`;
}

function parseYourChannelJid(jid: string): { workspaceId: string; conversationId: string } {
  const parts = jid.split(':');
  if (parts[0] !== CHANNEL_PREFIX || parts.length < 3) {
    throw new Error(`Invalid ${CHANNEL_PREFIX} JID: ${jid}`);
  }
  return {
    workspaceId: parts[1],
    conversationId: parts.slice(2).join(':'), // Handle colons in conversation IDs
  };
}

function isYourChannelJid(jid: string): boolean {
  return jid.startsWith(`${CHANNEL_PREFIX}:`);
}
```

**JID design rules:**
- The prefix must be unique across all channels.
- The JID must be stable (same conversation = same JID across reconnections).
- The JID must not contain PII (no user names, no email addresses). Hash if necessary.
- The JID must be parseable back to its components.

**Existing JID formats for reference:**

| Channel | Format | Example |
|---------|--------|---------|
| Slack | `slack:{workspace_id}:{channel_id}` | `slack:T04ABC123:D06XYZ789` |
| Teams | `teams:{tenant_id}:{conversation_id}` | `teams:abc-def-123:19:meeting_abc@thread.v2` |
| Email | `email:{sha256(email_address)}` | `email:a1b2c3d4e5f6...` |

---

## Step 5: Implement User Identity Resolution

Each channel has its own user identity system. The identity resolver maps channel-specific user IDs to Play New user instances.

```typescript
// src/channels/your-channel/identity.ts

import { ChatMetadata, ChannelCapabilities } from '../types';

export async function resolveYourChannelUser(
  orgId: string,
  channelUserId: string,
): Promise<ChatMetadata | null> {
  // 1. Look up the mapping in the database
  const mapping = await db.queryOne<UserChannelMapping>(
    `SELECT * FROM user_channel_mappings
     WHERE org_id = $1 AND channel_type = $2 AND channel_user_id = $3`,
    [orgId, 'your-channel', channelUserId],
  );

  if (!mapping) {
    return null; // User not mapped
  }

  // 2. Fetch the Play New user instance
  const user = await db.queryOne<UserInstance>(
    `SELECT * FROM user_instances WHERE user_instance_id = $1`,
    [mapping.userId],
  );

  if (!user) {
    return null;
  }

  // 3. Fetch channel-specific profile (display name, timezone, etc.)
  const profile = await fetchYourChannelProfile(channelUserId);

  return {
    userId: user.user_instance_id,
    orgId,
    channelName: 'your-channel',
    displayName: profile.displayName,
    channelUserId,
    timezone: profile.timezone,
    capabilities: getYourChannelCapabilities(),
  };
}
```

**User mapping resolution order** (from [channel-abstraction.md](../specs/channels/channel-abstraction.md)):

1. **SSO/OIDC match:** If the org uses SSO, match by email claim in the SSO token.
2. **Email match:** Match the channel user's email to a Play New user email.
3. **Manual mapping:** Admin explicitly maps a channel user to a Play New user.
4. **Auto-create (Phase 1+):** If the org allows it, create a new Play New user instance for unmapped channel users.

---

## Step 6: Implement Rich Message Formatting

Create a formatter that converts Play New's `RichMessage` format to your channel's native format:

```typescript
// src/channels/your-channel/formatter.ts

import { RichMessage, MessageBlock, MessageAction } from '../types';

/**
 * Convert a RichMessage to your channel's native format.
 *
 * Reference the mapping table in channel-abstraction.md:
 *   RichMessage blocks -> your channel's native blocks/cards/elements
 */
export function formatForYourChannel(message: RichMessage): YourChannelNativeMessage {
  const nativeMessage: YourChannelNativeMessage = {
    content: message.text, // Always include plain text fallback
  };

  if (message.blocks && message.blocks.length > 0) {
    nativeMessage.embeds = message.blocks.map(block => convertBlock(block));
  }

  return nativeMessage;
}

function convertBlock(block: MessageBlock): YourChannelNativeBlock {
  switch (block.type) {
    case 'header':
      return { type: 'heading', text: block.text || '' };
    case 'section':
      return { type: 'paragraph', text: block.text || '' };
    case 'divider':
      return { type: 'separator' };
    case 'table':
      return {
        type: 'fields',
        fields: (block.fields || []).map(f => ({
          name: f.label,
          value: f.value,
        })),
      };
    case 'actions':
      return {
        type: 'action_row',
        components: (block.actions || []).map(a => convertAction(a)),
      };
    case 'context':
      return { type: 'footer', text: block.text || '' };
    default:
      return { type: 'paragraph', text: block.text || '' };
  }
}

function convertAction(action: MessageAction): YourChannelNativeButton {
  return {
    type: 'button',
    label: action.label,
    customId: action.actionId,
    style: action.style === 'danger' ? 'destructive' : 'primary',
  };
}
```

**Message size handling:** If your channel has message length limits, implement splitting:

```typescript
export function splitForYourChannel(message: RichMessage): RichMessage[] {
  const MAX_LENGTH = 2000; // Your channel's limit

  if (message.text.length <= MAX_LENGTH) {
    return [message];
  }

  // Use the shared splitMessage utility from channel-abstraction
  return splitMessage(message, MAX_LENGTH);
}
```

---

## Step 7: Write Tests

Follow the existing channel test patterns. Tests should cover:

### Unit Tests

```typescript
// src/channels/your-channel/adapter.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { YourChannelAdapter } from './adapter';

describe('YourChannelAdapter', () => {
  let adapter: YourChannelAdapter;

  beforeEach(() => {
    adapter = new YourChannelAdapter({
      type: 'your-channel',
      orgId: 'org_test_001',
      botToken: 'test-token',
      workspaceId: 'ws_001',
    });
  });

  describe('ownsJid', () => {
    it('returns true for matching JIDs', () => {
      expect(adapter.ownsJid('your-channel:ws_001:conv_123')).toBe(true);
    });

    it('returns false for other channel JIDs', () => {
      expect(adapter.ownsJid('slack:T04ABC:D06XYZ')).toBe(false);
    });
  });

  describe('JID parsing', () => {
    it('creates valid JIDs', () => {
      const jid = createYourChannelJid('ws_001', 'conv_123');
      expect(jid).toBe('your-channel:ws_001:conv_123');
    });

    it('parses JIDs correctly', () => {
      const parsed = parseYourChannelJid('your-channel:ws_001:conv_123');
      expect(parsed.workspaceId).toBe('ws_001');
      expect(parsed.conversationId).toBe('conv_123');
    });
  });

  describe('getCapabilities', () => {
    it('returns correct capabilities', () => {
      const caps = adapter.getCapabilities();
      expect(caps.richFormatting).toBe(true);
      expect(caps.maxMessageLength).toBeGreaterThan(0);
    });
  });
});
```

### Formatter Tests

```typescript
// src/channels/your-channel/formatter.test.ts

describe('formatForYourChannel', () => {
  it('converts header blocks', () => {
    const message: RichMessage = {
      text: 'fallback',
      blocks: [{ type: 'header', text: 'My Header' }],
    };
    const result = formatForYourChannel(message);
    expect(result.embeds[0].type).toBe('heading');
    expect(result.embeds[0].text).toBe('My Header');
  });

  it('falls back to plain text when no blocks', () => {
    const message: RichMessage = { text: 'plain text only' };
    const result = formatForYourChannel(message);
    expect(result.content).toBe('plain text only');
    expect(result.embeds).toBeUndefined();
  });

  it('splits long messages', () => {
    const longText = 'x'.repeat(3000);
    const chunks = splitForYourChannel({ text: longText });
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach(chunk => {
      expect(chunk.text.length).toBeLessThanOrEqual(2000);
    });
  });
});
```

### Integration Tests

```typescript
// tests/integration/your-channel.test.ts

describe('YourChannel Integration', () => {
  it('sends and receives messages through the full pipeline', async () => {
    // 1. Create adapter with test credentials
    // 2. Connect
    // 3. Register message callback
    // 4. Simulate an inbound message
    // 5. Verify callback was called with correct InboundMessage
    // 6. Send a reply via sendRichMessage
    // 7. Verify the reply was formatted correctly
    // 8. Disconnect
  });
});
```

---

## Step 8: Add Configuration

### Environment Variables

Add your channel's environment variables to `.env.example`:

```bash
# === Your Channel Configuration ===
YOUR_CHANNEL_BOT_TOKEN=...            # Bot authentication token
YOUR_CHANNEL_APP_ID=...               # Application ID
YOUR_CHANNEL_WEBHOOK_SECRET=...       # Webhook signature secret (if applicable)
```

### Per-Org Credentials

In production, channel credentials are stored per-organization in the database (`channel_configs` table) and managed through the admin interface:

```sql
INSERT INTO channel_configs (
    org_id,
    channel_type,
    config_encrypted,       -- Encrypted JSONB with credentials
    status,
    created_at
) VALUES (
    'org_abc123',
    'your-channel',
    encrypt_config('{"botToken": "...", "workspaceId": "..."}'),
    'active',
    now()
);
```

### Configuration Loading

Add your channel to the configuration loader:

```typescript
// src/config.ts

interface ChannelConfigs {
  slack?: SlackChannelConfig;
  teams?: TeamsChannelConfig;
  email?: EmailChannelConfig;
  yourChannel?: YourChannelConfig;    // Add this
}
```

---

## Example: Discord Channel (Hypothetical)

To make this guide concrete, here is a skeleton for a hypothetical Discord channel adapter:

```typescript
// src/channels/discord/adapter.ts

import { Client, GatewayIntentBits, Message } from 'discord.js';
import { PlayNewChannel, RichMessage, InboundMessage, ChatMetadata,
         ChannelCapabilities, Attachment, OnInboundMessage, OnChatMetadata
} from '../types';

export interface DiscordChannelConfig {
  type: 'discord';
  orgId: string;
  botToken: string;
  guildId: string;            // Discord server ID
}

export class DiscordChannelAdapter implements PlayNewChannel {
  readonly name = 'discord';
  orgId: string;

  private client: Client;
  private guildId: string;
  private messageCallback: OnInboundMessage | null = null;
  private metadataCallback: OnChatMetadata | null = null;
  private connected = false;

  constructor(config: DiscordChannelConfig) {
    this.orgId = config.orgId;
    this.guildId = config.guildId;
    this.client = new Client({
      intents: [
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
      ],
    });
  }

  async connect(): Promise<void> {
    this.client.on('messageCreate', (msg) => this.handleInboundMessage(msg));
    await this.client.login(this.botToken);
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.client.destroy();
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  ownsJid(jid: string): boolean {
    return jid.startsWith('discord:');
  }

  async sendMessage(jid: string, text: string): Promise<void> {
    const { channelId } = parseDiscordJid(jid);
    const channel = await this.client.channels.fetch(channelId);
    if (channel?.isTextBased()) {
      await channel.send(text);
    }
  }

  async sendRichMessage(jid: string, message: RichMessage): Promise<void> {
    const { channelId } = parseDiscordJid(jid);
    const channel = await this.client.channels.fetch(channelId);
    if (channel?.isTextBased()) {
      const embed = formatForDiscord(message);
      await channel.send({ content: message.text, embeds: [embed] });
    }
  }

  async sendFile(jid: string, attachment: Attachment): Promise<void> {
    const { channelId } = parseDiscordJid(jid);
    const channel = await this.client.channels.fetch(channelId);
    if (channel?.isTextBased()) {
      await channel.send({
        files: [{
          attachment: attachment.content || attachment.url!,
          name: attachment.filename,
        }],
      });
    }
  }

  async setTyping(jid: string, isTyping: boolean): Promise<void> {
    if (!isTyping) return;
    const { channelId } = parseDiscordJid(jid);
    const channel = await this.client.channels.fetch(channelId);
    if (channel?.isTextBased()) {
      await channel.sendTyping();
    }
  }

  onMessage(callback: OnInboundMessage): void {
    this.messageCallback = callback;
  }

  onMetadata(callback: OnChatMetadata): void {
    this.metadataCallback = callback;
  }

  async resolveUser(channelUserId: string): Promise<ChatMetadata | null> {
    return resolveDiscordUser(this.orgId, channelUserId);
  }

  async listUsers(): Promise<string[]> {
    // Fetch all mapped users for this org + Discord
    const mappings = await db.query<{ dm_jid: string }>(
      `SELECT dm_jid FROM user_channel_mappings
       WHERE org_id = $1 AND channel_type = 'discord'`,
      [this.orgId],
    );
    return mappings.map(m => m.dm_jid);
  }

  getCapabilities(): ChannelCapabilities {
    return {
      richFormatting: true,       // Discord embeds
      fileUpload: true,
      fileDownload: true,
      threading: true,            // Discord threads
      reactions: true,
      typingIndicator: true,
      slashCommands: true,        // Discord slash commands
      ephemeralMessages: true,    // Discord ephemeral responses
      maxMessageLength: 2000,
    };
  }

  async openDM(channelUserId: string): Promise<string> {
    const user = await this.client.users.fetch(channelUserId);
    const dm = await user.createDM();
    return `discord:${this.guildId}:${dm.id}`;
  }

  private async handleInboundMessage(msg: Message): Promise<void> {
    if (msg.author.bot) return;     // Ignore bot messages
    if (!msg.channel.isDMBased()) return; // Only process DMs

    const inbound: InboundMessage = {
      messageId: msg.id,
      senderJid: `discord:${this.guildId}:${msg.author.id}`,
      conversationJid: `discord:${this.guildId}:${msg.channel.id}`,
      text: msg.content,
      attachments: msg.attachments.map(a => ({
        filename: a.name || 'attachment',
        mimeType: a.contentType || 'application/octet-stream',
        url: a.url,
        sizeBytes: a.size,
      })),
      threadId: msg.reference?.messageId || undefined,
      rawMetadata: { discordMessageId: msg.id },
      timestamp: msg.createdAt,
    };

    const metadata = await this.resolveUser(msg.author.id);
    if (!metadata) return;

    if (this.messageCallback) {
      await this.messageCallback(inbound, metadata);
    }
  }
}

// JID utilities
function createDiscordJid(guildId: string, channelId: string): string {
  return `discord:${guildId}:${channelId}`;
}

function parseDiscordJid(jid: string): { guildId: string; channelId: string } {
  const parts = jid.split(':');
  return { guildId: parts[1], channelId: parts[2] };
}
```

---

## Checklist

Before submitting a new channel adapter for review:

- [ ] `PlayNewChannel` interface fully implemented (all methods)
- [ ] JID format defined and documented
- [ ] JID utilities (create, parse, validate) implemented
- [ ] User identity resolution implemented
- [ ] Rich message formatter converts all `MessageBlock` types
- [ ] Message splitting handles the channel's size limits
- [ ] Channel registered in `registry.ts`
- [ ] Channel config type added to `ChannelConfig` union
- [ ] Environment variables documented in `.env.example`
- [ ] Unit tests for JID parsing, `ownsJid`, `getCapabilities`, and formatter
- [ ] Integration test for send/receive flow
- [ ] Error handling for API rate limits, connection drops, and auth failures
- [ ] Logging at appropriate levels (debug for message flow, error for failures)
- [ ] No PII in JIDs (hash if necessary)
- [ ] `setTyping` implemented or explicitly made a no-op
