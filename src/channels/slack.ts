import { App, LogLevel } from '@slack/bolt';
import type { GenericMessageEvent, BotMessageEvent } from '@slack/types';

import { ASSISTANT_NAME, TRIGGER_PATTERN } from '../config.js';
import { updateChatName } from '../db.js';
import { readEnvFile } from '../env.js';
import { logger } from '../logger.js';
import {
  Channel,
  OnInboundMessage,
  OnChatMetadata,
  RegisteredGroup,
} from '../types.js';
import type {
  PlayNewChannel,
  RichMessage,
  RichBlock,
  UserInstance,
} from '../playnew/types.js';

// Slack's chat.postMessage API limits text to ~4000 characters per call.
// Messages exceeding this are split into sequential chunks.
const MAX_MESSAGE_LENGTH = 4000;

// Buffer below the absolute limit so we never accidentally exceed it
// when appending continuation markers.
const SAFE_MESSAGE_LENGTH = 3900;

// Slack limits Block Kit messages to 50 blocks per payload.
const MAX_BLOCKS_PER_MESSAGE = 50;

// The message subtypes we process. Bolt delivers all subtypes via app.event('message');
// we filter to regular messages (GenericMessageEvent, subtype undefined) and bot messages
// (BotMessageEvent, subtype 'bot_message') so we can track our own output.
type HandledMessageEvent = GenericMessageEvent | BotMessageEvent;

export interface SlackChannelOpts {
  onMessage: OnInboundMessage;
  onChatMetadata: OnChatMetadata;
  registeredGroups: () => Record<string, RegisteredGroup>;
  /**
   * Optional: resolve a Slack user ID to a Play New UserInstance.
   * When provided, enables the PlayNewChannel.resolveUser method.
   * The resolver is injected by the Play New orchestrator, keeping
   * the channel adapter decoupled from the user database.
   */
  resolveUserInstance?: (slackUserId: string) => Promise<UserInstance | null>;
}

export class SlackChannel implements Channel, PlayNewChannel {
  name = 'slack';

  private app: App;
  private teamId: string | undefined;
  private botUserId: string | undefined;
  private connected = false;
  private outgoingQueue: Array<{ jid: string; text: string }> = [];
  private flushing = false;
  private userNameCache = new Map<string, string>();

  private opts: SlackChannelOpts;

  constructor(opts: SlackChannelOpts) {
    this.opts = opts;

    // Read tokens from .env (not process.env -- keeps secrets off the environment
    // so they don't leak to child processes, matching NanoClaw's security pattern)
    const env = readEnvFile(['SLACK_BOT_TOKEN', 'SLACK_APP_TOKEN']);
    const botToken = env.SLACK_BOT_TOKEN;
    const appToken = env.SLACK_APP_TOKEN;

    if (!botToken || !appToken) {
      throw new Error(
        'SLACK_BOT_TOKEN and SLACK_APP_TOKEN must be set in .env',
      );
    }

    this.app = new App({
      token: botToken,
      appToken,
      socketMode: true,
      logLevel: LogLevel.ERROR,
    });

    this.setupEventHandlers();
  }

  // ── Channel interface ───────────────────────────────────────────

  async connect(): Promise<void> {
    await this.app.start();

    // Get bot's own user ID and team ID for self-message detection and JID construction.
    // Resolve this BEFORE setting connected=true so that messages arriving
    // during startup can correctly detect bot-sent messages.
    try {
      const auth = await this.app.client.auth.test();
      this.botUserId = auth.user_id as string;
      this.teamId = auth.team_id as string;
      logger.info(
        { botUserId: this.botUserId, teamId: this.teamId },
        'Connected to Slack',
      );
    } catch (err) {
      logger.warn(
        { err },
        'Connected to Slack but failed to get bot user ID / team ID',
      );
    }

    this.connected = true;

    // Flush any messages queued before connection
    await this.flushOutgoingQueue();

    // Sync channel names on startup
    await this.syncChannelMetadata();
  }

  async sendMessage(jid: string, text: string): Promise<void> {
    const channelId = this.extractChannelId(jid);

    if (!this.connected) {
      this.outgoingQueue.push({ jid, text });
      logger.info(
        { jid, queueSize: this.outgoingQueue.length },
        'Slack disconnected, message queued',
      );
      return;
    }

    try {
      const chunks = splitText(text, MAX_MESSAGE_LENGTH);
      for (const chunk of chunks) {
        await this.app.client.chat.postMessage({ channel: channelId, text: chunk });
      }
      logger.info({ jid, length: text.length, chunks: chunks.length }, 'Slack message sent');
    } catch (err) {
      this.outgoingQueue.push({ jid, text });
      logger.warn(
        { jid, err, queueSize: this.outgoingQueue.length },
        'Failed to send Slack message, queued',
      );
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  ownsJid(jid: string): boolean {
    return jid.startsWith('slack:');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    await this.app.stop();
  }

  // Slack does not expose a typing indicator API for bots.
  // This no-op satisfies the Channel interface so the orchestrator
  // doesn't need channel-specific branching.
  async setTyping(_jid: string, _isTyping: boolean): Promise<void> {
    // no-op: Slack Bot API has no typing indicator endpoint
  }

  // ── PlayNewChannel extensions ───────────────────────────────────

  async resolveUser(channelUserId: string): Promise<UserInstance | null> {
    if (!this.opts.resolveUserInstance) return null;
    return this.opts.resolveUserInstance(channelUserId);
  }

  async sendRichMessage(jid: string, message: RichMessage): Promise<void> {
    const channelId = this.extractChannelId(jid);

    if (!this.connected) {
      // Fall back to plain text queueing for rich messages when disconnected
      this.outgoingQueue.push({ jid, text: message.text });
      logger.info(
        { jid, queueSize: this.outgoingQueue.length },
        'Slack disconnected, rich message queued as plain text',
      );
      return;
    }

    try {
      const chunks = splitRichMessage(message);
      for (const chunk of chunks) {
        await this.app.client.chat.postMessage({
          channel: channelId,
          text: chunk.text, // Fallback for notifications
          blocks: chunk.blocks
            ? (convertToSlackBlocks(chunk.blocks) as any[])
            : undefined,
        });
      }

      // Send attachments separately
      if (message.attachments) {
        for (const attachment of message.attachments) {
          await this.app.client.files.uploadV2({
            channel_id: channelId,
            file: attachment.content,
            filename: attachment.filename,
          });
        }
      }

      logger.info({ jid, chunks: chunks.length }, 'Slack rich message sent');
    } catch (err) {
      // Fall back to plain text on rich message failure
      logger.warn({ jid, err }, 'Failed to send rich message, falling back to plain text');
      await this.sendMessage(jid, message.text);
    }
  }

  // ── Public utilities ────────────────────────────────────────────

  /**
   * Sync channel metadata from Slack.
   * Fetches channels the bot is a member of and stores their names in the DB.
   */
  async syncChannelMetadata(): Promise<void> {
    try {
      logger.info('Syncing channel metadata from Slack...');
      let cursor: string | undefined;
      let count = 0;

      do {
        const result = await this.app.client.conversations.list({
          types: 'public_channel,private_channel',
          exclude_archived: true,
          limit: 200,
          cursor,
        });

        for (const ch of result.channels || []) {
          if (ch.id && ch.name && ch.is_member) {
            updateChatName(this.buildJid(ch.id), ch.name);
            count++;
          }
        }

        cursor = result.response_metadata?.next_cursor || undefined;
      } while (cursor);

      logger.info({ count }, 'Slack channel metadata synced');
    } catch (err) {
      logger.error({ err }, 'Failed to sync Slack channel metadata');
    }
  }

  /**
   * Get the Slack team (workspace) ID discovered during connect().
   * Returns undefined if not yet connected.
   */
  getTeamId(): string | undefined {
    return this.teamId;
  }

  // ── Private: event handlers ─────────────────────────────────────

  private setupEventHandlers(): void {
    // Use app.event('message') instead of app.message() to capture all
    // message subtypes including bot_message (needed to track our own output)
    this.app.event('message', async ({ event }) => {
      // Bolt's event type is the full MessageEvent union (17+ subtypes).
      // We filter on subtype first, then narrow to the two types we handle.
      const subtype = (event as { subtype?: string }).subtype;
      if (subtype && subtype !== 'bot_message') return;

      // After filtering, event is either GenericMessageEvent or BotMessageEvent
      const msg = event as HandledMessageEvent;

      if (!msg.text) return;

      const jid = this.buildJid(msg.channel);
      const timestamp = new Date(parseFloat(msg.ts) * 1000).toISOString();
      const isGroup = msg.channel_type !== 'im';

      // Always report metadata for group/channel discovery
      this.opts.onChatMetadata(jid, timestamp, undefined, 'slack', isGroup);

      // Only deliver full messages for registered groups
      const groups = this.opts.registeredGroups();
      if (!groups[jid]) return;

      const isBotMessage =
        !!msg.bot_id || msg.user === this.botUserId;

      let senderName: string;
      if (isBotMessage) {
        senderName = ASSISTANT_NAME;
      } else {
        senderName =
          (await this.resolveUserName(msg.user ?? '')) ||
          msg.user ||
          'unknown';
      }

      // Translate Slack <@UBOTID> mentions into TRIGGER_PATTERN format.
      // Slack encodes @mentions as <@U12345>, which won't match TRIGGER_PATTERN
      // (e.g., ^@<ASSISTANT_NAME>\b), so we prepend the trigger when the bot is @mentioned.
      let content = msg.text;
      if (this.botUserId && !isBotMessage) {
        const mentionPattern = `<@${this.botUserId}>`;
        if (content.includes(mentionPattern) && !TRIGGER_PATTERN.test(content)) {
          content = `@${ASSISTANT_NAME} ${content}`;
        }
      }

      // Detect slash command patterns in message text (e.g., "/pipeline-risk")
      // and annotate the message so downstream routing can identify skill invocations.
      const slashCommand = detectSlashCommand(content);

      this.opts.onMessage(jid, {
        id: msg.ts,
        chat_jid: jid,
        sender: msg.user || msg.bot_id || '',
        sender_name: senderName,
        content: slashCommand
          ? `@${ASSISTANT_NAME} ${content}`
          : content,
        timestamp,
        is_from_me: isBotMessage,
        is_bot_message: isBotMessage,
      });
    });
  }

  // ── Private: JID helpers ────────────────────────────────────────

  /**
   * Build a Play New JID from a Slack channel ID.
   * Format: slack:{team_id}:{channel_id}
   *
   * If team_id is not yet known (pre-connect), falls back to slack:{channel_id}
   * for backwards compatibility with the nanoclaw skill's simpler format.
   */
  private buildJid(channelId: string): string {
    if (this.teamId) {
      return `slack:${this.teamId}:${channelId}`;
    }
    return `slack:${channelId}`;
  }

  /**
   * Extract the Slack channel ID from a Play New JID.
   * Handles both formats:
   *   slack:{team_id}:{channel_id}  ->  {channel_id}
   *   slack:{channel_id}            ->  {channel_id}
   */
  private extractChannelId(jid: string): string {
    const parts = jid.split(':');
    // Always return the last segment (channel_id)
    return parts[parts.length - 1];
  }

  // ── Private: user resolution ────────────────────────────────────

  private async resolveUserName(
    userId: string,
  ): Promise<string | undefined> {
    if (!userId) return undefined;

    const cached = this.userNameCache.get(userId);
    if (cached) return cached;

    try {
      const result = await this.app.client.users.info({ user: userId });
      const name = result.user?.real_name || result.user?.name;
      if (name) this.userNameCache.set(userId, name);
      return name;
    } catch (err) {
      logger.debug({ userId, err }, 'Failed to resolve Slack user name');
      return undefined;
    }
  }

  // ── Private: outgoing queue ─────────────────────────────────────

  private async flushOutgoingQueue(): Promise<void> {
    if (this.flushing || this.outgoingQueue.length === 0) return;
    this.flushing = true;
    try {
      logger.info(
        { count: this.outgoingQueue.length },
        'Flushing Slack outgoing queue',
      );
      while (this.outgoingQueue.length > 0) {
        const item = this.outgoingQueue.shift()!;
        const channelId = this.extractChannelId(item.jid);
        await this.app.client.chat.postMessage({
          channel: channelId,
          text: item.text,
        });
        logger.info(
          { jid: item.jid, length: item.text.length },
          'Queued Slack message sent',
        );
      }
    } finally {
      this.flushing = false;
    }
  }
}

// ── Exported utilities (for testing) ──────────────────────────────

/**
 * Split a plain text string into chunks that fit within Slack's message limit.
 * Tries to split at paragraph boundaries (\n\n) first, then at line boundaries
 * (\n), and falls back to hard splitting at the character limit.
 */
export function splitText(text: string, maxLength: number = MAX_MESSAGE_LENGTH): string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Try to find a paragraph break within the limit
    let splitIdx = remaining.lastIndexOf('\n\n', maxLength);
    if (splitIdx > 0) {
      chunks.push(remaining.slice(0, splitIdx).trimEnd());
      remaining = remaining.slice(splitIdx + 2).trimStart();
      continue;
    }

    // Try to find a line break within the limit
    splitIdx = remaining.lastIndexOf('\n', maxLength);
    if (splitIdx > 0) {
      chunks.push(remaining.slice(0, splitIdx).trimEnd());
      remaining = remaining.slice(splitIdx + 1).trimStart();
      continue;
    }

    // Hard split at the limit
    chunks.push(remaining.slice(0, maxLength));
    remaining = remaining.slice(maxLength);
  }

  return chunks;
}

/**
 * Split a RichMessage into Slack-safe chunks.
 * Respects Slack's 4000-char text limit and 50-block limit.
 */
export function splitRichMessage(message: RichMessage): RichMessage[] {
  const textFits = message.text.length <= SAFE_MESSAGE_LENGTH;
  const blocksFit = !message.blocks || message.blocks.length <= MAX_BLOCKS_PER_MESSAGE;

  if (textFits && blocksFit) {
    return [message];
  }

  const chunks: RichMessage[] = [];

  if (!textFits) {
    // Split text by paragraphs
    const paragraphs = message.text.split('\n\n');
    let currentText = '';

    for (const para of paragraphs) {
      if (currentText && (currentText + '\n\n' + para).length > SAFE_MESSAGE_LENGTH) {
        chunks.push({ text: currentText.trim() });
        currentText = para;
      } else {
        currentText = currentText ? currentText + '\n\n' + para : para;
      }
    }

    if (currentText) {
      // Attach blocks to the last text chunk
      chunks.push({
        text: currentText.trim(),
        blocks: message.blocks?.slice(0, MAX_BLOCKS_PER_MESSAGE),
      });
    }
  } else if (message.blocks && message.blocks.length > MAX_BLOCKS_PER_MESSAGE) {
    // Text fits but blocks overflow -- split blocks across messages
    for (let i = 0; i < message.blocks.length; i += MAX_BLOCKS_PER_MESSAGE) {
      chunks.push({
        text: i === 0 ? message.text : '(continued)',
        blocks: message.blocks.slice(i, i + MAX_BLOCKS_PER_MESSAGE),
      });
    }
  }

  return chunks.length > 0 ? chunks : [message];
}

/**
 * Detect slash command patterns in message text.
 * Returns the command name if found, or null.
 */
export function detectSlashCommand(text: string): string | null {
  const match = text.match(/^\/([a-z][a-z0-9-]*)\b/i);
  return match ? `/${match[1]}` : null;
}

/**
 * Convert Play New RichBlocks to Slack Block Kit format.
 */
export function convertToSlackBlocks(blocks: RichBlock[]): unknown[] {
  return blocks.map((block) => {
    switch (block.type) {
      case 'header':
        return {
          type: 'header',
          text: { type: 'plain_text', text: block.text || '', emoji: true },
        };

      case 'section':
        if (block.fields && block.fields.length > 0) {
          return {
            type: 'section',
            fields: block.fields.map((f) => ({
              type: 'mrkdwn',
              text: `*${f}*`,
            })),
          };
        }
        return {
          type: 'section',
          text: { type: 'mrkdwn', text: block.text || '' },
        };

      case 'divider':
        return { type: 'divider' };

      case 'actions':
        return {
          type: 'actions',
          elements: [],
        };

      default:
        return {
          type: 'section',
          text: { type: 'mrkdwn', text: block.text || '' },
        };
    }
  });
}
