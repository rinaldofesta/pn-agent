# Microsoft Teams Channel Specification

**Status:** Draft
**Version:** 0.1
**Last Updated:** 2026-02-25
**Owner:** Technical Architecture

---

## Context

Microsoft Teams is the second delivery channel for Play New's personal AI assistants in Phase 0. Several design partner organizations use Teams as their primary communication platform, particularly those in the Microsoft 365 ecosystem. The Teams channel provides the same DM-primary assistant experience as Slack, adapted to the Teams Bot Framework architecture.

The Teams integration introduces complexity that Slack does not have: Azure Active Directory (Entra ID) for identity, the Bot Framework service as a required intermediary, conversation references for proactive messaging, and Adaptive Cards for rich formatting. This specification defines how the `TeamsChannel` adapter handles these concerns while conforming to the shared `PlayNewChannel` interface.

---

## Nanoclaw Foundation

Nanoclaw does not include a Teams implementation. The `Channel` interface from `container/agent-runner/src/types.ts` serves as the contract, and the Slack implementation pattern (`.claude/skills/add-slack/`) serves as the architectural reference.

**What we inherit from nanoclaw:**
- The `Channel` interface contract (connect, sendMessage, isConnected, ownsJid, disconnect)
- The JID-based routing pattern
- The connection lifecycle model

**What we build new for Teams:**
- Bot Framework SDK (`botbuilder`) integration
- Azure Bot Service registration and message relay
- Azure AD identity resolution
- Conversation reference management for proactive messaging
- Adaptive Card rendering (Phase 1; plain text for Phase 0)
- Teams-specific message handling (personal chat, @mention)

---

## Play New Requirements

From the PRD:

- **Section 8.1 (Phase 0 Scope):** Slack and Teams delivery, "Must"
- **Section 14.1 (Phase 0 Integrations):** Microsoft Teams Bot Framework, alternative delivery channel
- **Section 16.1 (Delivery Interface Design):** Rich formatting with Teams adaptive cards; conversational design principles apply to all channels
- **FR-001.1:** Each user gets an isolated assistant instance accessible via Slack DM or Teams chat
- **Section 20.1 (Tech Stack):** Teams Bot Framework under Messaging layer

---

## Technical Specification

### Architecture Overview

```
┌──────────────────────────────────────────────────┐
│              Microsoft 365 Tenant (Org A)         │
│                                                  │
│  User A ──Chat──┐                                │
│  User B ──Chat──┤                                │
│  User C ──Chat──┼──► Teams App (Bot)             │
│  ...     ──Chat──┘        │                      │
└──────────────────────────┼───────────────────────┘
                           │ HTTPS
                           ▼
┌──────────────────────────────────────────────────┐
│          Azure Bot Service                        │
│  (Message relay, auth, channel registration)      │
└──────────────────────────┬───────────────────────┘
                           │ HTTPS (webhook)
                           ▼
┌──────────────────────────────────────────────────┐
│          TeamsChannel Adapter                     │
│                                                  │
│  ┌──────────────┐  ┌────────────────────┐        │
│  │ BotFramework │  │ Conversation       │        │
│  │ Adapter      │  │ Reference Store    │        │
│  └──────┬───────┘  └────────┬───────────┘        │
│         │                   │                    │
│  ┌──────▼───────────────────▼────────────┐       │
│  │     Message Router                    │       │
│  │  Personal chat → user instance        │       │
│  │  @mention → team routing              │       │
│  └───────────────────┬───────────────────┘       │
└──────────────────────┼───────────────────────────┘
                       │
                       ▼
              PlayNewChannel Router
              (to user instances)
```

**Key architectural difference from Slack:** Teams requires an HTTP endpoint (webhook) to receive messages from Azure Bot Service. Unlike Slack's Socket Mode (outbound WebSocket), Teams pushes messages to our server. This means the Teams adapter needs an exposed HTTPS endpoint with a valid SSL certificate.

### Azure Configuration

#### Azure Bot Service Registration

Each organization requires:

1. **Azure Bot resource** registered in Play New's Azure subscription
2. **Microsoft App ID** and **App Secret** for authentication
3. **Messaging endpoint** pointing to our webhook URL: `https://api.playnew.ai/teams/{org_id}/messages`

```typescript
interface TeamsChannelConfig {
  /** Microsoft App ID (from Azure Bot registration) */
  appId: string;
  /** Microsoft App Password/Secret */
  appPassword: string;
  /** Azure AD Tenant ID of the customer org */
  tenantId: string;
  /** The Play New org ID */
  orgId: string;
}
```

#### Teams App Manifest

Each org installs a Teams app (custom app or from org store):

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/teams/v1.16/MicrosoftTeams.schema.json",
  "manifestVersion": "1.16",
  "version": "1.0.0",
  "id": "{{APP_ID}}",
  "developer": {
    "name": "Play New (Cosmico)",
    "websiteUrl": "https://playnew.ai",
    "privacyUrl": "https://playnew.ai/privacy",
    "termsOfUseUrl": "https://playnew.ai/terms"
  },
  "name": {
    "short": "Play New",
    "full": "Play New - Personal AI Assistant"
  },
  "description": {
    "short": "Your personal AI work assistant",
    "full": "Play New deploys a personal AI assistant that helps you analyze information, spot patterns in your work, and surface opportunities you might miss. Everything you share is private to you."
  },
  "icons": {
    "outline": "outline.png",
    "color": "color.png"
  },
  "accentColor": "#1a1a2e",
  "bots": [
    {
      "botId": "{{APP_ID}}",
      "scopes": ["personal", "team"],
      "supportsFiles": true,
      "isNotificationOnly": false,
      "commandLists": [
        {
          "scopes": ["personal"],
          "commands": [
            {
              "title": "pipeline-risk",
              "description": "Scan your pipeline for at-risk deals"
            },
            {
              "title": "weekly-prep",
              "description": "Prepare your weekly review"
            },
            {
              "title": "meeting-prep",
              "description": "Prepare for an upcoming meeting"
            },
            {
              "title": "help",
              "description": "Show available commands and skills"
            }
          ]
        }
      ]
    }
  ],
  "permissions": ["identity", "messageTeamMembers"],
  "validDomains": ["api.playnew.ai"]
}
```

#### Required Graph API Permissions

| Permission | Type | Purpose |
|-----------|------|---------|
| `User.Read` | Delegated | Read user profile for identity mapping |
| `User.ReadBasic.All` | Application | Enumerate org users for mapping |
| `TeamsActivity.Send` | Application | Send proactive messages |
| `ChatMessage.Read` | Delegated | Read messages in personal chat (optional Phase 1) |

### TeamsChannel Implementation

```typescript
import {
  CloudAdapter,
  ConfigurationBotFrameworkAuthentication,
  TurnContext,
  ActivityTypes,
  ConversationReference,
  TeamsInfo,
} from 'botbuilder';
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

export class TeamsChannel implements PlayNewChannel {
  readonly name = 'teams';
  readonly orgId: string;

  private adapter: CloudAdapter;
  private tenantId: string;
  private appId: string;
  private connected = false;
  private messageCallback: OnInboundMessage | null = null;
  private metadataCallback: OnChatMetadata | null = null;

  /** Cache: Azure AD user ID -> ChatMetadata */
  private userCache = new Map<string, ChatMetadata>();

  /**
   * Store conversation references for proactive messaging.
   * Key: Azure AD object ID (user ID)
   * Value: ConversationReference (serializable)
   */
  private conversationRefs = new Map<string, Partial<ConversationReference>>();

  constructor(orgId: string, config: TeamsChannelConfig) {
    this.orgId = orgId;
    this.tenantId = config.tenantId;
    this.appId = config.appId;

    const auth = new ConfigurationBotFrameworkAuthentication({
      MicrosoftAppId: config.appId,
      MicrosoftAppPassword: config.appPassword,
      MicrosoftAppTenantId: config.tenantId,
    });

    this.adapter = new CloudAdapter(auth);

    // Global error handler
    this.adapter.onTurnError = async (context, error) => {
      console.error(`[TeamsChannel:${orgId}] Turn error:`, error);
      await context.sendActivity(
        'I ran into an issue. Please try again in a moment.'
      );
    };
  }

  // ── NanoclawChannel methods ─────────────────────────────────

  async connect(): Promise<void> {
    // Teams doesn't have an explicit "connect" -- the adapter is ready
    // once configured. The webhook endpoint must be registered externally
    // (in the Express/Fastify route handler).
    this.connected = true;
  }

  async sendMessage(jid: string, text: string): Promise<void> {
    const { aadObjectId } = this.parseTeamsJid(jid);
    const ref = this.conversationRefs.get(aadObjectId);

    if (!ref) {
      throw new Error(
        `No conversation reference for user ${aadObjectId}. ` +
        `User must message the bot first to establish a conversation.`
      );
    }

    await this.adapter.continueConversationAsync(
      this.appId,
      ref as ConversationReference,
      async (context) => {
        await context.sendActivity(text);
      }
    );
  }

  isConnected(): boolean {
    return this.connected;
  }

  ownsJid(jid: string): boolean {
    return jid.startsWith(`teams:${this.tenantId}:`);
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    // Clean up: clear caches but preserve conversation references
    // (they remain valid for proactive messaging)
  }

  async setTyping(jid: string, isTyping: boolean): Promise<void> {
    if (!isTyping) return; // Teams only supports "start typing"

    const { aadObjectId } = this.parseTeamsJid(jid);
    const ref = this.conversationRefs.get(aadObjectId);
    if (!ref) return;

    await this.adapter.continueConversationAsync(
      this.appId,
      ref as ConversationReference,
      async (context) => {
        await context.sendActivity({ type: ActivityTypes.Typing });
      }
    );
  }

  // ── PlayNewChannel extensions ───────────────────────────────

  async sendRichMessage(jid: string, message: RichMessage): Promise<void> {
    const { aadObjectId } = this.parseTeamsJid(jid);
    const ref = this.conversationRefs.get(aadObjectId);

    if (!ref) {
      throw new Error(`No conversation reference for user ${aadObjectId}`);
    }

    await this.adapter.continueConversationAsync(
      this.appId,
      ref as ConversationReference,
      async (context) => {
        // Phase 0: plain text only
        // Phase 1: convert blocks to Adaptive Cards
        const chunks = this.splitForTeams(message);

        for (const chunk of chunks) {
          if (chunk.blocks && chunk.blocks.length > 0) {
            // Phase 1: Adaptive Card rendering
            const card = this.convertToAdaptiveCard(chunk);
            await context.sendActivity({
              type: ActivityTypes.Message,
              attachments: [
                {
                  contentType: 'application/vnd.microsoft.card.adaptive',
                  content: card,
                },
              ],
            });
          } else {
            await context.sendActivity(chunk.text);
          }
        }
      }
    );
  }

  async sendFile(jid: string, attachment: Attachment): Promise<void> {
    const { aadObjectId } = this.parseTeamsJid(jid);
    const ref = this.conversationRefs.get(aadObjectId);
    if (!ref) return;

    await this.adapter.continueConversationAsync(
      this.appId,
      ref as ConversationReference,
      async (context) => {
        if (attachment.url) {
          await context.sendActivity({
            type: ActivityTypes.Message,
            text: `Attachment: ${attachment.filename}`,
            attachments: [
              {
                contentType: attachment.mimeType,
                contentUrl: attachment.url,
                name: attachment.filename,
              },
            ],
          });
        } else if (attachment.content) {
          // For inline content, we need to upload to a blob first
          // Phase 0: send as a link message instead
          await context.sendActivity(
            `File: ${attachment.filename} (${Math.round(attachment.sizeBytes / 1024)}KB)`
          );
        }
      }
    );
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
    return Array.from(this.conversationRefs.keys()).map(
      (aadId) => `teams:${this.tenantId}:${aadId}`
    );
  }

  getCapabilities(): ChannelCapabilities {
    return {
      richFormatting: true, // Via Adaptive Cards (Phase 1)
      fileUpload: true,
      fileDownload: true,
      threading: true,
      reactions: true,
      typingIndicator: true,
      slashCommands: false, // Teams uses bot commands, not slash commands
      ephemeralMessages: false, // Teams doesn't support ephemeral messages
      maxMessageLength: 4096,
    };
  }

  async openDM(channelUserId: string): Promise<string> {
    // In Teams, we need a conversation reference to message a user.
    // This is typically established when the user first messages the bot,
    // or when we use proactive messaging via the Teams API.
    //
    // For proactive initiation, we need the user's Azure AD object ID
    // and the bot's service URL.

    const existing = this.conversationRefs.get(channelUserId);
    if (existing) {
      return `teams:${this.tenantId}:${channelUserId}`;
    }

    // If we don't have a conversation reference yet, we cannot initiate.
    // The user must message the bot first, or we use the Graph API to
    // install the app for the user (requires admin consent).
    throw new Error(
      `Cannot open DM with user ${channelUserId} -- no conversation reference. ` +
      `User must message the bot first.`
    );
  }

  // ── Webhook Handler (called by Express/Fastify route) ───────

  /**
   * Process incoming webhook requests from Azure Bot Service.
   * This method should be called from the HTTP route handler:
   *
   *   app.post('/teams/:orgId/messages', async (req, res) => {
   *     const channel = registry.get(orgId, 'teams');
   *     await channel.processActivity(req, res);
   *   });
   */
  async processActivity(req: any, res: any): Promise<void> {
    await this.adapter.process(req, res, async (context: TurnContext) => {
      // Store conversation reference for proactive messaging
      const ref = TurnContext.getConversationReference(context.activity);
      const aadObjectId = context.activity.from?.aadObjectId;

      if (aadObjectId) {
        this.conversationRefs.set(aadObjectId, ref);
      }

      switch (context.activity.type) {
        case ActivityTypes.Message:
          await this.handleMessage(context);
          break;

        case ActivityTypes.ConversationUpdate:
          await this.handleConversationUpdate(context);
          break;

        case ActivityTypes.InstallationUpdate:
          await this.handleInstallation(context);
          break;

        default:
          // Ignore other activity types in Phase 0
          break;
      }
    });
  }

  // ── Private methods ─────────────────────────────────────────

  private async handleMessage(context: TurnContext): Promise<void> {
    const activity = context.activity;
    const aadObjectId = activity.from?.aadObjectId;

    if (!aadObjectId) {
      await context.sendActivity(
        'I was unable to identify your account. Please contact your administrator.'
      );
      return;
    }

    const metadata = await this.resolveUser(aadObjectId);
    if (!metadata) {
      // Try to resolve on-the-fly using Teams context
      const resolved = await this.resolveTeamsUser(context, aadObjectId);
      if (!resolved) {
        await context.sendActivity(
          'I don\'t have you in my system yet. Please ask your Play New administrator to complete your setup.'
        );
        return;
      }
    }

    const finalMetadata = (await this.resolveUser(aadObjectId))!;

    // Detect if this is a personal chat or a team/channel @mention
    const isPersonalChat =
      activity.conversation?.conversationType === 'personal';

    // Extract text (remove @mention of the bot)
    let text = activity.text || '';
    if (activity.entities) {
      for (const entity of activity.entities) {
        if (entity.type === 'mention' && entity.mentioned?.id === this.appId) {
          text = text.replace(entity.text || '', '').trim();
        }
      }
    }

    // Check if this looks like a bot command
    const isCommand = text.startsWith('/') || text.startsWith('!');

    const inbound: InboundMessage = {
      messageId: `teams:${activity.id}`,
      senderJid: `teams:${this.tenantId}:${aadObjectId}`,
      conversationJid: `teams:${this.tenantId}:${activity.conversation?.id || aadObjectId}`,
      text,
      attachments: this.extractAttachments(activity),
      threadId: activity.conversation?.id,
      timestamp: new Date(activity.timestamp || Date.now()),
      rawMetadata: {
        isPersonalChat,
        isCommand,
        conversationType: activity.conversation?.conversationType,
        activityId: activity.id,
        serviceUrl: activity.serviceUrl,
      },
    };

    if (this.messageCallback) {
      // Send typing indicator while processing
      await context.sendActivity({ type: ActivityTypes.Typing });
      await this.messageCallback(inbound, finalMetadata);
    }
  }

  private async handleConversationUpdate(context: TurnContext): Promise<void> {
    const activity = context.activity;

    // Bot was added to a personal chat
    if (activity.membersAdded) {
      for (const member of activity.membersAdded) {
        if (member.id === activity.recipient?.id) {
          // Bot was added -- this is the user initiating a conversation
          continue;
        }

        // A user was added (they started chatting with the bot)
        const aadObjectId = member.aadObjectId;
        if (aadObjectId) {
          // Store conversation reference
          const ref = TurnContext.getConversationReference(activity);
          this.conversationRefs.set(aadObjectId, ref);

          // Try to resolve and cache the user
          await this.resolveTeamsUser(context, aadObjectId);
        }
      }
    }
  }

  private async handleInstallation(context: TurnContext): Promise<void> {
    const activity = context.activity;

    if (activity.action === 'add') {
      // App installed -- send welcome message
      await context.sendActivity(
        'Welcome! I\'m your personal AI assistant from Play New. ' +
        'Everything we discuss here is private to you. ' +
        'You can ask me questions, forward content for analysis, ' +
        'or use commands like "pipeline-risk" or "weekly-prep". ' +
        'Type "help" to see what I can do.'
      );
    }
  }

  /**
   * Resolve a Teams user via the Teams SDK and cache the result.
   */
  private async resolveTeamsUser(
    context: TurnContext,
    aadObjectId: string
  ): Promise<ChatMetadata | null> {
    try {
      const member = await TeamsInfo.getMember(context, aadObjectId);

      const metadata: ChatMetadata = {
        userId: '', // To be resolved by user mapping service
        orgId: this.orgId,
        channelName: 'teams',
        displayName: member.name || 'Unknown',
        channelUserId: aadObjectId,
        timezone: undefined, // Teams doesn't expose timezone directly
        capabilities: this.getCapabilities(),
      };

      this.userCache.set(aadObjectId, metadata);
      return metadata;
    } catch (error) {
      console.error(
        `[TeamsChannel:${this.orgId}] Failed to resolve user ${aadObjectId}:`,
        error
      );
      return null;
    }
  }

  private extractAttachments(activity: any): Attachment[] {
    if (!activity.attachments || activity.attachments.length === 0) return [];

    return activity.attachments
      .filter((a: any) => a.contentType !== 'text/html') // Skip inline HTML
      .map((a: any) => ({
        filename: a.name || 'unnamed',
        mimeType: a.contentType || 'application/octet-stream',
        url: a.contentUrl,
        sizeBytes: 0, // Size not always available in Teams
      }));
  }

  private parseTeamsJid(jid: string): { tenantId: string; aadObjectId: string } {
    // Format: teams:{tenant_id}:{aad_object_id_or_conversation_id}
    const parts = jid.split(':');
    return {
      tenantId: parts[1],
      aadObjectId: parts.slice(2).join(':'), // Conversation IDs may contain colons
    };
  }

  /**
   * Convert RichMessage blocks to an Adaptive Card (Phase 1).
   * Phase 0: returns a simple text card.
   */
  private convertToAdaptiveCard(message: RichMessage): object {
    const body: any[] = [];

    if (message.blocks) {
      for (const block of message.blocks) {
        switch (block.type) {
          case 'header':
            body.push({
              type: 'TextBlock',
              text: block.text || '',
              size: 'Large',
              weight: 'Bolder',
              wrap: true,
            });
            break;

          case 'section':
            if (block.fields) {
              const columns: any[] = [];
              for (let i = 0; i < block.fields.length; i += 2) {
                const col: any[] = [];
                col.push({
                  type: 'TextBlock',
                  text: block.fields[i].label,
                  weight: 'Bolder',
                  size: 'Small',
                  wrap: true,
                });
                col.push({
                  type: 'TextBlock',
                  text: block.fields[i].value,
                  wrap: true,
                });
                const col2: any[] = [];
                if (block.fields[i + 1]) {
                  col2.push({
                    type: 'TextBlock',
                    text: block.fields[i + 1].label,
                    weight: 'Bolder',
                    size: 'Small',
                    wrap: true,
                  });
                  col2.push({
                    type: 'TextBlock',
                    text: block.fields[i + 1].value,
                    wrap: true,
                  });
                }
                columns.push({
                  type: 'ColumnSet',
                  columns: [
                    { type: 'Column', width: 'stretch', items: col },
                    { type: 'Column', width: 'stretch', items: col2 },
                  ],
                });
              }
              body.push(...columns);
            } else {
              body.push({
                type: 'TextBlock',
                text: block.text || '',
                wrap: true,
              });
            }
            break;

          case 'divider':
            body.push({
              type: 'TextBlock',
              text: '---',
              separator: true,
            });
            break;

          case 'context':
            body.push({
              type: 'TextBlock',
              text: block.text || '',
              size: 'Small',
              isSubtle: true,
              wrap: true,
            });
            break;

          case 'actions':
            // Phase 1: Action.Submit buttons
            body.push({
              type: 'ActionSet',
              actions: (block.actions || []).map((action) => ({
                type: 'Action.Submit',
                title: action.label,
                data: { actionId: action.actionId, value: action.value },
              })),
            });
            break;

          default:
            body.push({
              type: 'TextBlock',
              text: block.text || '',
              wrap: true,
            });
        }
      }
    } else {
      body.push({
        type: 'TextBlock',
        text: message.text,
        wrap: true,
      });
    }

    return {
      type: 'AdaptiveCard',
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      version: '1.5',
      body,
    };
  }

  /**
   * Split a RichMessage for Teams message limits.
   */
  private splitForTeams(message: RichMessage): RichMessage[] {
    const MAX_TEXT = 4000;

    if (message.text.length <= MAX_TEXT) {
      return [message];
    }

    const chunks: RichMessage[] = [];
    const paragraphs = message.text.split('\n\n');
    let current = '';

    for (const para of paragraphs) {
      if ((current + '\n\n' + para).length > MAX_TEXT) {
        if (current) chunks.push({ text: current.trim() });
        current = para;
      } else {
        current = current ? current + '\n\n' + para : para;
      }
    }

    if (current) {
      chunks.push({ text: current.trim(), blocks: message.blocks });
    }

    return chunks.length > 0 ? chunks : [message];
  }
}
```

### Azure AD Integration for User Identity Mapping

Teams users are identified by their Azure AD Object ID (`aadObjectId`). The mapping flow:

```
1. User messages the bot for the first time (or bot is installed for user)
2. TeamsChannel receives the activity with from.aadObjectId
3. TeamsChannel calls TeamsInfo.getMember() to get user details
4. System matches user by:
   a. Azure AD email (UPN) against Play New user email
   b. Azure AD Object ID against previously stored mappings
   c. Manual mapping by admin
5. Store mapping and conversation reference
6. Future messages resolve instantly from cache
```

**Mapping table extension (adds to the table defined in channel-abstraction.md):**

```sql
-- Azure AD specific fields
ALTER TABLE user_channel_mappings
  ADD COLUMN aad_object_id  VARCHAR(100),
  ADD COLUMN aad_upn        VARCHAR(200),
  ADD COLUMN service_url    VARCHAR(500);

-- Conversation references for proactive messaging (stored as JSON)
CREATE TABLE teams_conversation_refs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organizations(id),
  aad_object_id     VARCHAR(100) NOT NULL,
  conversation_ref  JSONB NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(org_id, aad_object_id)
);
```

### Proactive Messaging

Teams proactive messaging requires a stored `ConversationReference` from a previous user interaction:

```typescript
/**
 * Send a proactive message to a Teams user.
 *
 * IMPORTANT: In Teams, you cannot proactively message a user who has never
 * interacted with the bot. The user must either:
 * 1. Message the bot first (establishes conversation reference), OR
 * 2. Have the app installed for them by an admin (triggers installationUpdate)
 *
 * This is a Teams platform constraint, not a Play New limitation.
 */
async function sendProactiveTeamsMessage(
  channel: TeamsChannel,
  aadObjectId: string,
  message: RichMessage
): Promise<boolean> {
  try {
    const jid = `teams:${channel['tenantId']}:${aadObjectId}`;
    await channel.sendRichMessage(jid, message);
    return true;
  } catch (error) {
    // No conversation reference -- user hasn't interacted yet
    console.warn(
      `Cannot send proactive message to ${aadObjectId}: ` +
      `no conversation reference`
    );
    return false;
  }
}
```

### Per-Org Teams App Installation

Each design partner organization gets a Teams app installed in their tenant:

| Step | Action | Who |
|------|--------|-----|
| 1 | Play New creates an Azure Bot registration | Play New ops |
| 2 | Generate app manifest with unique App ID | Play New ops |
| 3 | Org admin uploads app to their Teams Admin Center | Org IT admin |
| 4 | App is published to org's Teams app catalog | Org IT admin |
| 5 | App is installed for target users (or all users) | Org IT admin |
| 6 | Users see the bot in their Teams chat list | Automatic |
| 7 | Users message the bot, establishing conversation references | User action |

**Alternative (Phase 1):** Use Graph API with `TeamsAppInstallation` to programmatically install the app for specific users, removing the dependency on the org admin publishing it.

### Message Handling Patterns

#### Personal Chat (1:1 with Bot)

```
User sends message in personal chat with bot
  -> Azure Bot Service receives the message
  -> Relays to our webhook endpoint
  -> TeamsChannel.processActivity() handles the request
  -> Detects conversationType === 'personal'
  -> Resolves user by aadObjectId
  -> Creates InboundMessage, fires callback
  -> Assistant processes and produces response
  -> TeamsChannel sends response in the same conversation
```

#### @Mention in Team Channel

```
User @mentions bot in a team channel
  -> Azure Bot Service receives the message
  -> TeamsChannel handles it
  -> Strips bot mention from text
  -> Resolves user, creates InboundMessage with isPersonalChat=false
  -> Route to user's personal instance
  -> Response is sent as a reply in the channel

Note: Same privacy concern as Slack -- do NOT include private
context in public channel responses.
```

#### Bot Commands

Teams doesn't use slash commands like Slack. Instead, it uses "bot commands" that appear in the compose box when the user types the bot name:

```
User types: @Play New pipeline-risk
  -> Received as a regular message with mention entity
  -> TeamsChannel strips the mention
  -> Remaining text: "pipeline-risk"
  -> Detected as a command (matches known command list)
  -> Routed to skill engine
  -> Response sent in conversation
```

### Adaptive Cards (Phase 1)

Phase 0 uses plain text for all responses. Phase 1 introduces Adaptive Cards for structured outputs:

```json
{
  "type": "AdaptiveCard",
  "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
  "version": "1.5",
  "body": [
    {
      "type": "TextBlock",
      "text": "Pipeline Risk Scan - Week 9",
      "size": "Large",
      "weight": "Bolder"
    },
    {
      "type": "TextBlock",
      "text": "3 deals flagged this week. Top concern: Acme Corp renewal.",
      "wrap": true
    },
    {
      "type": "ColumnSet",
      "columns": [
        {
          "type": "Column",
          "width": "stretch",
          "items": [
            { "type": "TextBlock", "text": "Deal", "weight": "Bolder", "size": "Small" },
            { "type": "TextBlock", "text": "Acme Corp Renewal" }
          ]
        },
        {
          "type": "Column",
          "width": "stretch",
          "items": [
            { "type": "TextBlock", "text": "Risk", "weight": "Bolder", "size": "Small" },
            { "type": "TextBlock", "text": "HIGH", "color": "Attention" }
          ]
        }
      ]
    },
    {
      "type": "TextBlock",
      "text": "Recommended: Schedule call with Sarah (champion).",
      "size": "Small",
      "isSubtle": true,
      "wrap": true
    }
  ],
  "actions": [
    {
      "type": "Action.Submit",
      "title": "View Details",
      "data": { "action": "view_deal", "dealId": "acme-renewal-001" }
    },
    {
      "type": "Action.Submit",
      "title": "Dismiss",
      "data": { "action": "dismiss" }
    }
  ]
}
```

---

## Phase 0 Scope

### In Scope

- Personal chat only (1:1 with bot)
- Text messages (send and receive)
- Basic file attachments (receive: documents shared in chat)
- Bot commands (text-based, not interactive cards)
- Webhook endpoint for Azure Bot Service
- User mapping via Azure AD (email-based matching)
- Conversation reference storage for proactive messaging
- Typing indicator (supported natively by Bot Framework)
- Plain text responses (no Adaptive Cards)
- Welcome message on app installation

### Out of Scope (Phase 1+)

| Feature | Phase | Rationale |
|---------|-------|-----------|
| Adaptive Cards | Phase 1 | Plain text sufficient for Phase 0 validation |
| Interactive card actions (buttons) | Phase 1 | Requires card action handlers |
| @mention in team channels | Phase 1 | Focus on DM experience first |
| Message Extensions (compose actions) | Phase 2 | Advanced Teams integration |
| Task Modules (modal dialogs) | Phase 2 | Complex interactive workflows |
| Tab integration (embedded web view) | Phase 2 | Dashboard-like experience |
| Graph API user enumeration | Phase 1 | Phase 0: rely on users messaging first |
| Programmatic app installation | Phase 1 | Phase 0: manual admin install |

---

## Open Questions

1. **Single Azure Bot vs. per-org bot:** Should we create one Azure Bot registration and route by tenant, or one registration per org? **Recommendation:** One Azure Bot registration with multi-tenant support. Simpler management, single endpoint. Use tenant ID to route to the correct `TeamsChannel` instance.

2. **Proactive messaging bootstrapping:** Users must interact with the bot before we can proactively message them. How do we ensure all users message the bot during onboarding? **Recommendation:** Org admin installs the app for all target users. Onboarding session instructs users to say "hello" to the bot. Track which users have established conversation references; follow up with those who haven't.

3. **Token refresh and auth:** Azure Bot Service tokens expire. The Bot Framework SDK handles refresh automatically, but we need to monitor for auth failures. **Recommendation:** Use `ConfigurationBotFrameworkAuthentication` which handles token refresh. Add alerting on repeated 401/403 errors.

4. **Rate limits:** Teams/Bot Framework rate limits differ from Slack. Currently: 200 msgs per conversation per 10 seconds (generous). Monitor but unlikely to be a Phase 0 issue. **Recommendation:** No throttling logic needed for Phase 0. Add monitoring.

5. **Webhook security:** How do we secure the Teams webhook endpoint from unauthorized callers? **Recommendation:** Bot Framework SDK validates the JWT token in the Authorization header, confirming the request comes from Azure Bot Service. No additional security needed at the application layer.

6. **Fallback behavior:** If the Azure Bot Service is down, messages are lost (no retry from Teams side). **Recommendation:** Acceptable for Phase 0. Phase 1: implement a health check that alerts on webhook delivery failures.
