import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// --- Mocks ---

// Mock config
vi.mock('../config.js', () => ({
  ASSISTANT_NAME: 'Jonesy',
  TRIGGER_PATTERN: /^@Jonesy\b/i,
}));

// Mock logger
vi.mock('../logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock db
vi.mock('../db.js', () => ({
  updateChatName: vi.fn(),
}));

// --- @slack/bolt mock ---

type Handler = (...args: any[]) => any;

const appRef = vi.hoisted(() => ({ current: null as any }));

vi.mock('@slack/bolt', () => ({
  App: class MockApp {
    eventHandlers = new Map<string, Handler>();
    token: string;
    appToken: string;

    client = {
      auth: {
        test: vi.fn().mockResolvedValue({
          user_id: 'U_BOT_123',
          team_id: 'T_TEAM_789',
        }),
      },
      chat: {
        postMessage: vi.fn().mockResolvedValue(undefined),
      },
      conversations: {
        list: vi.fn().mockResolvedValue({
          channels: [],
          response_metadata: {},
        }),
      },
      users: {
        info: vi.fn().mockResolvedValue({
          user: { real_name: 'Alice Smith', name: 'alice' },
        }),
      },
      files: {
        uploadV2: vi.fn().mockResolvedValue(undefined),
      },
    };

    constructor(opts: any) {
      this.token = opts.token;
      this.appToken = opts.appToken;
      appRef.current = this;
    }

    event(name: string, handler: Handler) {
      this.eventHandlers.set(name, handler);
    }

    async start() {}
    async stop() {}
  },
  LogLevel: { ERROR: 'error' },
}));

// Mock env
vi.mock('../env.js', () => ({
  readEnvFile: vi.fn().mockReturnValue({
    SLACK_BOT_TOKEN: 'xoxb-test-token',
    SLACK_APP_TOKEN: 'xapp-test-token',
  }),
}));

import {
  SlackChannel,
  SlackChannelOpts,
  splitText,
  splitRichMessage,
  detectSlashCommand,
  convertToSlackBlocks,
} from './slack.js';
import { updateChatName } from '../db.js';
import { readEnvFile } from '../env.js';
import type { RichMessage, RichBlock } from '../playnew/types.js';

// --- Test helpers ---

function createTestOpts(
  overrides?: Partial<SlackChannelOpts>,
): SlackChannelOpts {
  return {
    onMessage: vi.fn(),
    onChatMetadata: vi.fn(),
    registeredGroups: vi.fn(() => ({
      'slack:T_TEAM_789:C0123456789': {
        name: 'Test Channel',
        folder: 'test-channel',
        trigger: '@Jonesy',
        added_at: '2024-01-01T00:00:00.000Z',
      },
    })),
    ...overrides,
  };
}

function createMessageEvent(overrides: {
  channel?: string;
  channelType?: string;
  user?: string;
  text?: string;
  ts?: string;
  threadTs?: string;
  subtype?: string;
  botId?: string;
}) {
  return {
    channel: overrides.channel ?? 'C0123456789',
    channel_type: overrides.channelType ?? 'channel',
    user: overrides.user ?? 'U_USER_456',
    text: 'text' in overrides ? overrides.text : 'Hello everyone',
    ts: overrides.ts ?? '1704067200.000000',
    thread_ts: overrides.threadTs,
    subtype: overrides.subtype,
    bot_id: overrides.botId,
  };
}

function currentApp() {
  return appRef.current;
}

async function triggerMessageEvent(event: ReturnType<typeof createMessageEvent>) {
  const handler = currentApp().eventHandlers.get('message');
  if (handler) await handler({ event });
}

// --- Tests ---

describe('SlackChannel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- Connection lifecycle ---

  describe('connection lifecycle', () => {
    it('resolves connect() when app starts', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);

      await channel.connect();

      expect(channel.isConnected()).toBe(true);
    });

    it('registers message event handler on construction', () => {
      const opts = createTestOpts();
      new SlackChannel(opts);

      expect(currentApp().eventHandlers.has('message')).toBe(true);
    });

    it('gets bot user ID and team ID on connect', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);

      await channel.connect();

      expect(currentApp().client.auth.test).toHaveBeenCalled();
      expect(channel.getTeamId()).toBe('T_TEAM_789');
    });

    it('disconnects cleanly', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);

      await channel.connect();
      expect(channel.isConnected()).toBe(true);

      await channel.disconnect();
      expect(channel.isConnected()).toBe(false);
    });

    it('isConnected() returns false before connect', () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);

      expect(channel.isConnected()).toBe(false);
    });
  });

  // --- JID format ---

  describe('JID format', () => {
    it('builds JIDs with team_id after connect', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      // Trigger a message and check the JID format in the callback
      const event = createMessageEvent({ text: 'Hello' });
      await triggerMessageEvent(event);

      expect(opts.onChatMetadata).toHaveBeenCalledWith(
        'slack:T_TEAM_789:C0123456789',
        expect.any(String),
        undefined,
        'slack',
        true,
      );
    });

    it('extracts channel ID from team-scoped JID', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      await channel.sendMessage('slack:T_TEAM_789:C0123456789', 'Hello');

      expect(currentApp().client.chat.postMessage).toHaveBeenCalledWith({
        channel: 'C0123456789',
        text: 'Hello',
      });
    });

    it('extracts channel ID from simple JID (pre-connect fallback)', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      await channel.sendMessage('slack:D9876543210', 'DM message');

      expect(currentApp().client.chat.postMessage).toHaveBeenCalledWith({
        channel: 'D9876543210',
        text: 'DM message',
      });
    });
  });

  // --- Message handling ---

  describe('message handling', () => {
    it('delivers message for registered channel', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      const event = createMessageEvent({ text: 'Hello everyone' });
      await triggerMessageEvent(event);

      expect(opts.onChatMetadata).toHaveBeenCalledWith(
        'slack:T_TEAM_789:C0123456789',
        expect.any(String),
        undefined,
        'slack',
        true,
      );
      expect(opts.onMessage).toHaveBeenCalledWith(
        'slack:T_TEAM_789:C0123456789',
        expect.objectContaining({
          id: '1704067200.000000',
          chat_jid: 'slack:T_TEAM_789:C0123456789',
          sender: 'U_USER_456',
          content: 'Hello everyone',
          is_from_me: false,
        }),
      );
    });

    it('only emits metadata for unregistered channels', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      const event = createMessageEvent({ channel: 'C9999999999' });
      await triggerMessageEvent(event);

      expect(opts.onChatMetadata).toHaveBeenCalledWith(
        'slack:T_TEAM_789:C9999999999',
        expect.any(String),
        undefined,
        'slack',
        true,
      );
      expect(opts.onMessage).not.toHaveBeenCalled();
    });

    it('skips non-text subtypes (channel_join, etc.)', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      const event = createMessageEvent({ subtype: 'channel_join' });
      await triggerMessageEvent(event);

      expect(opts.onMessage).not.toHaveBeenCalled();
      expect(opts.onChatMetadata).not.toHaveBeenCalled();
    });

    it('allows bot_message subtype through', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      const event = createMessageEvent({
        subtype: 'bot_message',
        botId: 'B_OTHER_BOT',
        text: 'Bot message',
      });
      await triggerMessageEvent(event);

      expect(opts.onChatMetadata).toHaveBeenCalled();
    });

    it('skips messages with no text', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      const event = createMessageEvent({ text: undefined as any });
      await triggerMessageEvent(event);

      expect(opts.onMessage).not.toHaveBeenCalled();
    });

    it('detects bot messages by bot_id', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      const event = createMessageEvent({
        subtype: 'bot_message',
        botId: 'B_MY_BOT',
        text: 'Bot response',
      });
      await triggerMessageEvent(event);

      expect(opts.onMessage).toHaveBeenCalledWith(
        'slack:T_TEAM_789:C0123456789',
        expect.objectContaining({
          is_from_me: true,
          is_bot_message: true,
          sender_name: 'Jonesy',
        }),
      );
    });

    it('detects bot messages by matching bot user ID', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      const event = createMessageEvent({ user: 'U_BOT_123', text: 'Self message' });
      await triggerMessageEvent(event);

      expect(opts.onMessage).toHaveBeenCalledWith(
        'slack:T_TEAM_789:C0123456789',
        expect.objectContaining({
          is_from_me: true,
          is_bot_message: true,
        }),
      );
    });

    it('identifies IM channel type as non-group', async () => {
      const opts = createTestOpts({
        registeredGroups: vi.fn(() => ({
          'slack:T_TEAM_789:D0123456789': {
            name: 'DM',
            folder: 'dm',
            trigger: '@Jonesy',
            added_at: '2024-01-01T00:00:00.000Z',
          },
        })),
      });
      const channel = new SlackChannel(opts);
      await channel.connect();

      const event = createMessageEvent({
        channel: 'D0123456789',
        channelType: 'im',
      });
      await triggerMessageEvent(event);

      expect(opts.onChatMetadata).toHaveBeenCalledWith(
        'slack:T_TEAM_789:D0123456789',
        expect.any(String),
        undefined,
        'slack',
        false, // IM is not a group
      );
    });

    it('converts ts to ISO timestamp', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      const event = createMessageEvent({ ts: '1704067200.000000' });
      await triggerMessageEvent(event);

      expect(opts.onMessage).toHaveBeenCalledWith(
        'slack:T_TEAM_789:C0123456789',
        expect.objectContaining({
          timestamp: '2024-01-01T00:00:00.000Z',
        }),
      );
    });

    it('resolves user name from Slack API', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      const event = createMessageEvent({ user: 'U_USER_456', text: 'Hello' });
      await triggerMessageEvent(event);

      expect(currentApp().client.users.info).toHaveBeenCalledWith({
        user: 'U_USER_456',
      });
      expect(opts.onMessage).toHaveBeenCalledWith(
        'slack:T_TEAM_789:C0123456789',
        expect.objectContaining({
          sender_name: 'Alice Smith',
        }),
      );
    });

    it('caches user names to avoid repeated API calls', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      // First message -- API call
      await triggerMessageEvent(createMessageEvent({ user: 'U_USER_456', text: 'First' }));
      // Second message -- should use cache
      await triggerMessageEvent(createMessageEvent({
        user: 'U_USER_456',
        text: 'Second',
        ts: '1704067201.000000',
      }));

      expect(currentApp().client.users.info).toHaveBeenCalledTimes(1);
    });

    it('falls back to user ID when API fails', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      currentApp().client.users.info.mockRejectedValueOnce(new Error('API error'));

      const event = createMessageEvent({ user: 'U_UNKNOWN', text: 'Hi' });
      await triggerMessageEvent(event);

      expect(opts.onMessage).toHaveBeenCalledWith(
        'slack:T_TEAM_789:C0123456789',
        expect.objectContaining({
          sender_name: 'U_UNKNOWN',
        }),
      );
    });

    it('flattens threaded replies into channel messages', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      const event = createMessageEvent({
        ts: '1704067201.000000',
        threadTs: '1704067200.000000',
        text: 'Thread reply',
      });
      await triggerMessageEvent(event);

      expect(opts.onMessage).toHaveBeenCalledWith(
        'slack:T_TEAM_789:C0123456789',
        expect.objectContaining({
          content: 'Thread reply',
        }),
      );
    });
  });

  // --- @mention translation ---

  describe('@mention translation', () => {
    it('prepends trigger when bot is @mentioned via Slack format', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      const event = createMessageEvent({
        text: 'Hey <@U_BOT_123> what do you think?',
        user: 'U_USER_456',
      });
      await triggerMessageEvent(event);

      expect(opts.onMessage).toHaveBeenCalledWith(
        'slack:T_TEAM_789:C0123456789',
        expect.objectContaining({
          content: '@Jonesy Hey <@U_BOT_123> what do you think?',
        }),
      );
    });

    it('does not prepend trigger when trigger pattern already matches', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      const event = createMessageEvent({
        text: '@Jonesy <@U_BOT_123> hello',
        user: 'U_USER_456',
      });
      await triggerMessageEvent(event);

      expect(opts.onMessage).toHaveBeenCalledWith(
        'slack:T_TEAM_789:C0123456789',
        expect.objectContaining({
          content: '@Jonesy <@U_BOT_123> hello',
        }),
      );
    });

    it('does not translate mentions in bot messages', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      const event = createMessageEvent({
        text: 'Echo: <@U_BOT_123>',
        subtype: 'bot_message',
        botId: 'B_MY_BOT',
      });
      await triggerMessageEvent(event);

      expect(opts.onMessage).toHaveBeenCalledWith(
        'slack:T_TEAM_789:C0123456789',
        expect.objectContaining({
          content: 'Echo: <@U_BOT_123>',
        }),
      );
    });

    it('does not translate mentions for other users', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      const event = createMessageEvent({
        text: 'Hey <@U_OTHER_USER> look at this',
        user: 'U_USER_456',
      });
      await triggerMessageEvent(event);

      expect(opts.onMessage).toHaveBeenCalledWith(
        'slack:T_TEAM_789:C0123456789',
        expect.objectContaining({
          content: 'Hey <@U_OTHER_USER> look at this',
        }),
      );
    });
  });

  // --- Slash command detection ---

  describe('slash command detection', () => {
    it('prepends trigger for slash command messages', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      const event = createMessageEvent({
        text: '/pipeline-risk check all deals',
        user: 'U_USER_456',
      });
      await triggerMessageEvent(event);

      expect(opts.onMessage).toHaveBeenCalledWith(
        'slack:T_TEAM_789:C0123456789',
        expect.objectContaining({
          content: '@Jonesy /pipeline-risk check all deals',
        }),
      );
    });

    it('does not modify non-command messages starting with /', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      // A "/" in the middle of text is not a command
      const event = createMessageEvent({
        text: 'the ratio is 1/2',
        user: 'U_USER_456',
      });
      await triggerMessageEvent(event);

      expect(opts.onMessage).toHaveBeenCalledWith(
        'slack:T_TEAM_789:C0123456789',
        expect.objectContaining({
          content: 'the ratio is 1/2',
        }),
      );
    });
  });

  // --- sendMessage ---

  describe('sendMessage', () => {
    it('sends message via Slack client', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      await channel.sendMessage('slack:T_TEAM_789:C0123456789', 'Hello');

      expect(currentApp().client.chat.postMessage).toHaveBeenCalledWith({
        channel: 'C0123456789',
        text: 'Hello',
      });
    });

    it('queues message when disconnected', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);

      // Don't connect -- should queue
      await channel.sendMessage('slack:T_TEAM_789:C0123456789', 'Queued message');

      expect(currentApp().client.chat.postMessage).not.toHaveBeenCalled();
    });

    it('queues message on send failure', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      currentApp().client.chat.postMessage.mockRejectedValueOnce(
        new Error('Network error'),
      );

      // Should not throw
      await expect(
        channel.sendMessage('slack:T_TEAM_789:C0123456789', 'Will fail'),
      ).resolves.toBeUndefined();
    });

    it('splits long messages at natural boundaries', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      // Create a message longer than 4000 chars
      const longText = 'A'.repeat(4500);
      await channel.sendMessage('slack:T_TEAM_789:C0123456789', longText);

      // Should be split into 2 messages: 4000 + 500
      expect(currentApp().client.chat.postMessage).toHaveBeenCalledTimes(2);
    });

    it('sends exactly-4000-char messages as a single message', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      const text = 'B'.repeat(4000);
      await channel.sendMessage('slack:T_TEAM_789:C0123456789', text);

      expect(currentApp().client.chat.postMessage).toHaveBeenCalledTimes(1);
    });

    it('flushes queued messages on connect', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);

      // Queue messages while disconnected
      await channel.sendMessage('slack:T_TEAM_789:C0123456789', 'First queued');
      await channel.sendMessage('slack:T_TEAM_789:C0123456789', 'Second queued');

      expect(currentApp().client.chat.postMessage).not.toHaveBeenCalled();

      // Connect triggers flush
      await channel.connect();

      expect(currentApp().client.chat.postMessage).toHaveBeenCalledWith({
        channel: 'C0123456789',
        text: 'First queued',
      });
      expect(currentApp().client.chat.postMessage).toHaveBeenCalledWith({
        channel: 'C0123456789',
        text: 'Second queued',
      });
    });
  });

  // --- ownsJid ---

  describe('ownsJid', () => {
    it('owns slack: prefixed JIDs', () => {
      const channel = new SlackChannel(createTestOpts());
      expect(channel.ownsJid('slack:T_TEAM_789:C0123456789')).toBe(true);
    });

    it('owns slack: DM JIDs', () => {
      const channel = new SlackChannel(createTestOpts());
      expect(channel.ownsJid('slack:T_TEAM_789:D0123456789')).toBe(true);
    });

    it('owns simple slack: JIDs (legacy format)', () => {
      const channel = new SlackChannel(createTestOpts());
      expect(channel.ownsJid('slack:C0123456789')).toBe(true);
    });

    it('does not own WhatsApp group JIDs', () => {
      const channel = new SlackChannel(createTestOpts());
      expect(channel.ownsJid('12345@g.us')).toBe(false);
    });

    it('does not own WhatsApp DM JIDs', () => {
      const channel = new SlackChannel(createTestOpts());
      expect(channel.ownsJid('12345@s.whatsapp.net')).toBe(false);
    });

    it('does not own Telegram JIDs', () => {
      const channel = new SlackChannel(createTestOpts());
      expect(channel.ownsJid('tg:123456')).toBe(false);
    });

    it('does not own unknown JID formats', () => {
      const channel = new SlackChannel(createTestOpts());
      expect(channel.ownsJid('random-string')).toBe(false);
    });
  });

  // --- PlayNewChannel: resolveUser ---

  describe('resolveUser', () => {
    it('returns null when no resolver is configured', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);

      const result = await channel.resolveUser('U_USER_456');
      expect(result).toBeNull();
    });

    it('delegates to the injected resolver', async () => {
      const mockInstance = {
        instance_id: 'inst-1',
        user_id: 'user-1',
        org_id: 'org-1',
        team_id: 'team-1',
        role_category: 'sales',
        access_mode: 'full' as const,
        status: 'active' as const,
        encryption_key_ref: 'key-ref',
        created_at: '2024-01-01',
        folder: 'user-1',
        trigger: '@Jonesy',
      };

      const opts = createTestOpts({
        resolveUserInstance: vi.fn().mockResolvedValue(mockInstance),
      });
      const channel = new SlackChannel(opts);

      const result = await channel.resolveUser('U_USER_456');
      expect(result).toEqual(mockInstance);
      expect(opts.resolveUserInstance).toHaveBeenCalledWith('U_USER_456');
    });

    it('returns null when resolver returns null', async () => {
      const opts = createTestOpts({
        resolveUserInstance: vi.fn().mockResolvedValue(null),
      });
      const channel = new SlackChannel(opts);

      const result = await channel.resolveUser('U_UNKNOWN');
      expect(result).toBeNull();
    });
  });

  // --- PlayNewChannel: sendRichMessage ---

  describe('sendRichMessage', () => {
    it('sends plain text with blocks', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      const message: RichMessage = {
        text: 'Pipeline Risk Scan results',
        blocks: [
          { type: 'header', text: 'Pipeline Risk Scan' },
          { type: 'divider' },
          { type: 'section', text: '3 deals flagged' },
        ],
      };

      await channel.sendRichMessage('slack:T_TEAM_789:C0123456789', message);

      expect(currentApp().client.chat.postMessage).toHaveBeenCalledWith({
        channel: 'C0123456789',
        text: 'Pipeline Risk Scan results',
        blocks: [
          { type: 'header', text: { type: 'plain_text', text: 'Pipeline Risk Scan', emoji: true } },
          { type: 'divider' },
          { type: 'section', text: { type: 'mrkdwn', text: '3 deals flagged' } },
        ],
      });
    });

    it('sends attachments via files.uploadV2', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      const fileContent = Buffer.from('report data');
      const message: RichMessage = {
        text: 'Here is your report',
        attachments: [
          { filename: 'report.csv', content: fileContent, mimetype: 'text/csv' },
        ],
      };

      await channel.sendRichMessage('slack:T_TEAM_789:C0123456789', message);

      expect(currentApp().client.files.uploadV2).toHaveBeenCalledWith({
        channel_id: 'C0123456789',
        file: fileContent,
        filename: 'report.csv',
      });
    });

    it('queues as plain text when disconnected', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);

      const message: RichMessage = {
        text: 'Queued rich message',
        blocks: [{ type: 'section', text: 'Details' }],
      };

      await channel.sendRichMessage('slack:T_TEAM_789:C0123456789', message);

      // Should not have called the API
      expect(currentApp().client.chat.postMessage).not.toHaveBeenCalled();
    });

    it('falls back to plain text on API failure', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      // First call (rich) fails, second call (plain) succeeds
      currentApp().client.chat.postMessage
        .mockRejectedValueOnce(new Error('Block Kit error'))
        .mockResolvedValueOnce(undefined);

      const message: RichMessage = {
        text: 'Fallback text',
        blocks: [{ type: 'section', text: 'Will fail' }],
      };

      await channel.sendRichMessage('slack:T_TEAM_789:C0123456789', message);

      // Should have attempted rich, then fallen back to plain
      expect(currentApp().client.chat.postMessage).toHaveBeenCalledTimes(2);
    });
  });

  // --- syncChannelMetadata ---

  describe('syncChannelMetadata', () => {
    it('calls conversations.list and updates chat names with team-scoped JIDs', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);

      currentApp().client.conversations.list.mockResolvedValue({
        channels: [
          { id: 'C001', name: 'general', is_member: true },
          { id: 'C002', name: 'random', is_member: true },
          { id: 'C003', name: 'external', is_member: false },
        ],
        response_metadata: {},
      });

      await channel.connect();

      expect(updateChatName).toHaveBeenCalledWith('slack:T_TEAM_789:C001', 'general');
      expect(updateChatName).toHaveBeenCalledWith('slack:T_TEAM_789:C002', 'random');
      expect(updateChatName).not.toHaveBeenCalledWith(
        expect.stringContaining('C003'),
        'external',
      );
    });

    it('paginates through multiple pages of channels', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);

      currentApp().client.conversations.list
        .mockResolvedValueOnce({
          channels: [
            { id: 'C001', name: 'general', is_member: true },
          ],
          response_metadata: { next_cursor: 'cursor_page2' },
        })
        .mockResolvedValueOnce({
          channels: [
            { id: 'C002', name: 'random', is_member: true },
          ],
          response_metadata: {},
        });

      await channel.connect();

      expect(currentApp().client.conversations.list).toHaveBeenCalledTimes(2);
      expect(currentApp().client.conversations.list).toHaveBeenNthCalledWith(2,
        expect.objectContaining({ cursor: 'cursor_page2' }),
      );

      expect(updateChatName).toHaveBeenCalledWith('slack:T_TEAM_789:C001', 'general');
      expect(updateChatName).toHaveBeenCalledWith('slack:T_TEAM_789:C002', 'random');
    });

    it('handles API errors gracefully', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);

      currentApp().client.conversations.list.mockRejectedValue(
        new Error('API error'),
      );

      // Should not throw
      await expect(channel.connect()).resolves.toBeUndefined();
    });
  });

  // --- setTyping ---

  describe('setTyping', () => {
    it('resolves without error (no-op)', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);

      await expect(
        channel.setTyping('slack:T_TEAM_789:C0123456789', true),
      ).resolves.toBeUndefined();
    });

    it('accepts false without error', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);

      await expect(
        channel.setTyping('slack:T_TEAM_789:C0123456789', false),
      ).resolves.toBeUndefined();
    });
  });

  // --- Constructor error handling ---

  describe('constructor', () => {
    it('throws when SLACK_BOT_TOKEN is missing', () => {
      vi.mocked(readEnvFile).mockReturnValueOnce({
        SLACK_BOT_TOKEN: '',
        SLACK_APP_TOKEN: 'xapp-test-token',
      });

      expect(() => new SlackChannel(createTestOpts())).toThrow(
        'SLACK_BOT_TOKEN and SLACK_APP_TOKEN must be set in .env',
      );
    });

    it('throws when SLACK_APP_TOKEN is missing', () => {
      vi.mocked(readEnvFile).mockReturnValueOnce({
        SLACK_BOT_TOKEN: 'xoxb-test-token',
        SLACK_APP_TOKEN: '',
      });

      expect(() => new SlackChannel(createTestOpts())).toThrow(
        'SLACK_BOT_TOKEN and SLACK_APP_TOKEN must be set in .env',
      );
    });
  });

  // --- Channel properties ---

  describe('channel properties', () => {
    it('has name "slack"', () => {
      const channel = new SlackChannel(createTestOpts());
      expect(channel.name).toBe('slack');
    });
  });
});

// --- Pure function unit tests ---

describe('splitText', () => {
  it('returns single chunk for short text', () => {
    expect(splitText('Hello world')).toEqual(['Hello world']);
  });

  it('returns single chunk for exactly MAX_MESSAGE_LENGTH text', () => {
    const text = 'A'.repeat(4000);
    expect(splitText(text)).toEqual([text]);
  });

  it('splits at paragraph boundaries', () => {
    const para1 = 'A'.repeat(3000);
    const para2 = 'B'.repeat(2000);
    const text = `${para1}\n\n${para2}`;

    const result = splitText(text);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(para1);
    expect(result[1]).toBe(para2);
  });

  it('splits at line boundaries when no paragraph break available', () => {
    const line1 = 'A'.repeat(3000);
    const line2 = 'B'.repeat(2000);
    const text = `${line1}\n${line2}`;

    const result = splitText(text);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(line1);
    expect(result[1]).toBe(line2);
  });

  it('hard splits when no natural boundaries exist', () => {
    const text = 'A'.repeat(8500);
    const result = splitText(text);
    expect(result).toHaveLength(3);
    expect(result[0]).toBe('A'.repeat(4000));
    expect(result[1]).toBe('A'.repeat(4000));
    expect(result[2]).toBe('A'.repeat(500));
  });

  it('respects custom maxLength parameter', () => {
    const text = 'A'.repeat(30);
    const result = splitText(text, 10);
    expect(result).toHaveLength(3);
    expect(result[0]).toBe('A'.repeat(10));
    expect(result[1]).toBe('A'.repeat(10));
    expect(result[2]).toBe('A'.repeat(10));
  });
});

describe('splitRichMessage', () => {
  it('returns single chunk when message fits', () => {
    const message: RichMessage = {
      text: 'Short message',
      blocks: [{ type: 'section', text: 'Details' }],
    };

    expect(splitRichMessage(message)).toEqual([message]);
  });

  it('splits long text into multiple chunks', () => {
    const message: RichMessage = {
      text: Array(50).fill('A'.repeat(100)).join('\n\n'),
      blocks: [{ type: 'section', text: 'Details' }],
    };

    const result = splitRichMessage(message);
    expect(result.length).toBeGreaterThan(1);
    // Last chunk should have the blocks attached
    expect(result[result.length - 1].blocks).toBeDefined();
  });

  it('splits excess blocks across messages', () => {
    const blocks: RichBlock[] = Array(75).fill(null).map((_, i) => ({
      type: 'section' as const,
      text: `Block ${i}`,
    }));

    const message: RichMessage = {
      text: 'Short text',
      blocks,
    };

    const result = splitRichMessage(message);
    expect(result).toHaveLength(2);
    expect(result[0].blocks).toHaveLength(50);
    expect(result[1].blocks).toHaveLength(25);
    expect(result[1].text).toBe('(continued)');
  });

  it('returns original message when text and blocks are absent', () => {
    const message: RichMessage = { text: 'Just text' };
    expect(splitRichMessage(message)).toEqual([message]);
  });
});

describe('detectSlashCommand', () => {
  it('detects /pipeline-risk', () => {
    expect(detectSlashCommand('/pipeline-risk check all')).toBe('/pipeline-risk');
  });

  it('detects /weekly-prep', () => {
    expect(detectSlashCommand('/weekly-prep')).toBe('/weekly-prep');
  });

  it('detects /pn', () => {
    expect(detectSlashCommand('/pn help')).toBe('/pn');
  });

  it('returns null for non-command text', () => {
    expect(detectSlashCommand('Hello world')).toBeNull();
  });

  it('returns null for slash in middle of text', () => {
    expect(detectSlashCommand('the ratio is 1/2')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectSlashCommand('')).toBeNull();
  });

  it('returns null for slash followed by space', () => {
    expect(detectSlashCommand('/ something')).toBeNull();
  });

  it('returns null for slash followed by number', () => {
    expect(detectSlashCommand('/123')).toBeNull();
  });
});

describe('convertToSlackBlocks', () => {
  it('converts header block', () => {
    const blocks: RichBlock[] = [{ type: 'header', text: 'Title' }];
    const result = convertToSlackBlocks(blocks);

    expect(result).toEqual([
      { type: 'header', text: { type: 'plain_text', text: 'Title', emoji: true } },
    ]);
  });

  it('converts section block with text', () => {
    const blocks: RichBlock[] = [{ type: 'section', text: 'Content' }];
    const result = convertToSlackBlocks(blocks);

    expect(result).toEqual([
      { type: 'section', text: { type: 'mrkdwn', text: 'Content' } },
    ]);
  });

  it('converts section block with fields', () => {
    const blocks: RichBlock[] = [
      { type: 'section', fields: ['Field 1', 'Field 2'] },
    ];
    const result = convertToSlackBlocks(blocks);

    expect(result).toEqual([
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: '*Field 1*' },
          { type: 'mrkdwn', text: '*Field 2*' },
        ],
      },
    ]);
  });

  it('converts divider block', () => {
    const blocks: RichBlock[] = [{ type: 'divider' }];
    const result = convertToSlackBlocks(blocks);

    expect(result).toEqual([{ type: 'divider' }]);
  });

  it('converts actions block', () => {
    const blocks: RichBlock[] = [{ type: 'actions' }];
    const result = convertToSlackBlocks(blocks);

    expect(result).toEqual([{ type: 'actions', elements: [] }]);
  });

  it('falls back to section for unknown block types', () => {
    // Force an unknown type through the type system
    const blocks = [{ type: 'custom' as any, text: 'Custom content' }];
    const result = convertToSlackBlocks(blocks);

    expect(result).toEqual([
      { type: 'section', text: { type: 'mrkdwn', text: 'Custom content' } },
    ]);
  });

  it('handles empty text gracefully', () => {
    const blocks: RichBlock[] = [{ type: 'section' }];
    const result = convertToSlackBlocks(blocks);

    expect(result).toEqual([
      { type: 'section', text: { type: 'mrkdwn', text: '' } },
    ]);
  });
});
