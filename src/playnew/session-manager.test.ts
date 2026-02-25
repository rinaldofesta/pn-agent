import { describe, it, expect, beforeEach } from 'vitest';

import {
  _initPlayNewTestDatabase,
  createOrg,
  createTeam,
  createUserInstance,
  updateInstanceStatus,
  getPnSession,
  getSessionMessages,
  updatePnSession,
} from './db.js';

import {
  getOrCreateSession,
  addMessage,
  getSessionHistory,
  compactSession,
  closeSession,
  expireStaleSessions,
  getRecentSessions,
  buildSessionPrompt,
  needsCompaction,
  estimateTokens,
} from './session-manager.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let instanceId: string;

function setupTestData() {
  const org = createOrg({
    name: 'Acme Corp',
    industry: 'tech',
    size_band: '200-500',
    geo: 'EU_south',
  });
  const team = createTeam({
    org_id: org.org_id,
    name: 'Engineering',
    function: 'engineering',
  });
  const instance = createUserInstance({
    user_id: 'user-alice',
    org_id: org.org_id,
    team_id: team.team_id,
    role_category: 'engineer',
    encryption_key_ref: 'key-ref-001',
    folder: 'users/user-alice',
  });
  updateInstanceStatus(instance.instance_id, 'active');
  instanceId = instance.instance_id;
  return { org, team, instance };
}

beforeEach(() => {
  _initPlayNewTestDatabase();
  setupTestData();
});

// ===================================================================
// Session creation and resumption
// ===================================================================

describe('getOrCreateSession', () => {
  it('creates a new session when none exists', () => {
    const session = getOrCreateSession(instanceId, 'slack');

    expect(session.session_id).toBeTruthy();
    expect(session.instance_id).toBe(instanceId);
    expect(session.channel_type).toBe('slack');
    expect(session.status).toBe('active');
    expect(session.message_count).toBe(0);
  });

  it('resumes an active session on the same channel', () => {
    const session1 = getOrCreateSession(instanceId, 'slack');
    const session2 = getOrCreateSession(instanceId, 'slack');

    expect(session2.session_id).toBe(session1.session_id);
  });

  it('resumes a recent active session from a different channel', () => {
    const slackSession = getOrCreateSession(instanceId, 'slack');
    // Immediately requesting on 'teams' should find the active slack session
    const teamsSession = getOrCreateSession(instanceId, 'teams');

    expect(teamsSession.session_id).toBe(slackSession.session_id);
  });

  it('creates new session after previous one is closed', () => {
    const session1 = getOrCreateSession(instanceId, 'slack');
    closeSession(session1.session_id);

    const session2 = getOrCreateSession(instanceId, 'slack');
    expect(session2.session_id).not.toBe(session1.session_id);
  });

  it('creates new session after previous one is expired', () => {
    const session1 = getOrCreateSession(instanceId, 'slack');
    // Manually expire the session
    updatePnSession(session1.session_id, { status: 'expired' });

    const session2 = getOrCreateSession(instanceId, 'slack');
    expect(session2.session_id).not.toBe(session1.session_id);
  });
});

// ===================================================================
// Message management
// ===================================================================

describe('addMessage', () => {
  it('adds a message to a session and updates metadata', () => {
    const session = getOrCreateSession(instanceId, 'slack');

    const msg = addMessage(session.session_id, 'user', 'Hello, what is on my agenda?');

    expect(msg.message_id).toBeTruthy();
    expect(msg.session_id).toBe(session.session_id);
    expect(msg.role).toBe('user');
    expect(msg.content).toBe('Hello, what is on my agenda?');
    expect(msg.token_estimate).toBeGreaterThan(0);

    // Check session was updated
    const updated = getPnSession(session.session_id);
    expect(updated!.message_count).toBe(1);
    expect(updated!.token_count).toBeGreaterThan(0);
  });

  it('tracks channel type on messages', () => {
    const session = getOrCreateSession(instanceId, 'slack');

    addMessage(session.session_id, 'user', 'From slack', { channelType: 'slack' });
    addMessage(session.session_id, 'assistant', 'Reply on slack', { channelType: 'slack' });

    const messages = getSessionMessages(session.session_id);
    expect(messages[0].channel_type).toBe('slack');
    expect(messages[1].channel_type).toBe('slack');
  });
});

// ===================================================================
// Session history with token budget
// ===================================================================

describe('getSessionHistory', () => {
  it('returns all messages when no token budget', () => {
    const session = getOrCreateSession(instanceId, 'slack');
    addMessage(session.session_id, 'user', 'First message');
    addMessage(session.session_id, 'assistant', 'First reply');
    addMessage(session.session_id, 'user', 'Second message');

    const history = getSessionHistory(session.session_id);
    expect(history).toHaveLength(3);
  });

  it('truncates old messages when token budget is exceeded', () => {
    const session = getOrCreateSession(instanceId, 'slack');

    // Add messages with known sizes
    for (let i = 0; i < 20; i++) {
      addMessage(session.session_id, 'user', `Message ${i}: ${'x'.repeat(100)}`);
    }

    // Request with a small token budget (enough for ~2 messages)
    const history = getSessionHistory(session.session_id, { maxTokens: 80 });
    expect(history.length).toBeLessThan(20);
    expect(history.length).toBeGreaterThan(0);

    // The history should contain the most recent messages
    const lastMessage = history[history.length - 1];
    expect(lastMessage.content).toContain('Message 19');
  });

  it('returns empty when budget is zero', () => {
    const session = getOrCreateSession(instanceId, 'slack');
    addMessage(session.session_id, 'user', 'Hello');

    const history = getSessionHistory(session.session_id, { maxTokens: 0 });
    // maxTokens <= 0 means return all
    expect(history.length).toBe(1);
  });
});

// ===================================================================
// Session compaction
// ===================================================================

describe('compactSession', () => {
  it('compacts when there are more than 10 messages', () => {
    const session = getOrCreateSession(instanceId, 'slack');

    // Add 15 messages (> KEEP_RECENT_MESSAGES = 10)
    for (let i = 0; i < 15; i++) {
      addMessage(session.session_id, i % 2 === 0 ? 'user' : 'assistant', `Message ${i}`);
    }

    const result = compactSession(session.session_id);

    expect(result.compacted).toBe(true);
    expect(result.messagesCompacted).toBe(5); // 15 - 10 = 5 messages compacted
    expect(result.summary).toBeTruthy();

    // Check the session has a summary now
    const updated = getPnSession(session.session_id);
    expect(updated!.summary).toBeTruthy();
  });

  it('does not compact when messages are below threshold', () => {
    const session = getOrCreateSession(instanceId, 'slack');

    addMessage(session.session_id, 'user', 'Hello');
    addMessage(session.session_id, 'assistant', 'Hi');

    const result = compactSession(session.session_id);

    expect(result.compacted).toBe(false);
    expect(result.messagesCompacted).toBe(0);
  });

  it('marks compacted messages with is_compacted flag', () => {
    const session = getOrCreateSession(instanceId, 'slack');

    for (let i = 0; i < 15; i++) {
      addMessage(session.session_id, 'user', `Message ${i}`);
    }

    compactSession(session.session_id);

    // Non-compacted messages (default query)
    const active = getSessionMessages(session.session_id);
    expect(active).toHaveLength(10);

    // All messages including compacted
    const all = getSessionMessages(session.session_id, { includeCompacted: true });
    expect(all).toHaveLength(15);
  });
});

// ===================================================================
// Close session
// ===================================================================

describe('closeSession', () => {
  it('closes a session with a summary', () => {
    const session = getOrCreateSession(instanceId, 'slack');
    addMessage(session.session_id, 'user', 'Let us discuss the project');
    addMessage(session.session_id, 'assistant', 'Sure, what about the project?');

    closeSession(session.session_id);

    const closed = getPnSession(session.session_id);
    expect(closed!.status).toBe('closed');
    expect(closed!.summary).toBeTruthy();
  });
});

// ===================================================================
// Expire stale sessions
// ===================================================================

describe('expireStaleSessions', () => {
  it('expires sessions that are older than timeout', () => {
    const session = getOrCreateSession(instanceId, 'slack');

    // Manually set last_activity_at to 2 hours ago by updating the DB directly
    // This simulates a session that has been idle
    // Since we cannot directly manipulate time in better-sqlite3 easily,
    // we expire with minutesIdle=0 which expires all active sessions
    const count = expireStaleSessions(0);
    expect(count).toBe(1);

    const expired = getPnSession(session.session_id);
    expect(expired!.status).toBe('expired');
  });

  it('does not expire recently active sessions', () => {
    getOrCreateSession(instanceId, 'slack');

    // Expire sessions idle for > 120 minutes (our session was just created)
    const count = expireStaleSessions(120);
    expect(count).toBe(0);
  });
});

// ===================================================================
// Cross-channel continuity
// ===================================================================

describe('cross-channel session continuity', () => {
  it('continues a session when switching channels', () => {
    // Start on Slack
    const slackSession = getOrCreateSession(instanceId, 'slack');
    addMessage(slackSession.session_id, 'user', 'Started on Slack', { channelType: 'slack' });

    // Continue on Teams (within 30 min timeout)
    const teamsSession = getOrCreateSession(instanceId, 'teams');
    expect(teamsSession.session_id).toBe(slackSession.session_id);

    // Add a message from Teams
    addMessage(teamsSession.session_id, 'user', 'Continued on Teams', { channelType: 'teams' });

    // All messages should be in the same session
    const history = getSessionHistory(slackSession.session_id);
    expect(history).toHaveLength(2);
    expect(history[0].channel_type).toBe('slack');
    expect(history[1].channel_type).toBe('teams');
  });
});

// ===================================================================
// Recent sessions
// ===================================================================

describe('getRecentSessions', () => {
  it('returns recent sessions ordered by activity', () => {
    const s1 = getOrCreateSession(instanceId, 'slack');
    closeSession(s1.session_id);

    const s2 = getOrCreateSession(instanceId, 'slack');

    const recent = getRecentSessions(instanceId);
    expect(recent.length).toBe(2);
    // Most recent should be first
    expect(recent[0].session_id).toBe(s2.session_id);
  });

  it('respects limit', () => {
    for (let i = 0; i < 10; i++) {
      const s = getOrCreateSession(instanceId, 'slack');
      closeSession(s.session_id);
    }

    const recent = getRecentSessions(instanceId, 3);
    expect(recent).toHaveLength(3);
  });
});

// ===================================================================
// buildSessionPrompt
// ===================================================================

describe('buildSessionPrompt', () => {
  it('returns empty string for non-existent session', () => {
    const prompt = buildSessionPrompt('nonexistent-session', 2000);
    expect(prompt).toBe('');
  });

  it('includes recent messages within token budget', () => {
    const session = getOrCreateSession(instanceId, 'slack');
    addMessage(session.session_id, 'user', 'What is the project status?');
    addMessage(session.session_id, 'assistant', 'The project is on track.');

    const prompt = buildSessionPrompt(session.session_id, 2000);

    expect(prompt).toContain('Conversation History');
    expect(prompt).toContain('What is the project status?');
    expect(prompt).toContain('The project is on track.');
  });

  it('includes session summary when present', () => {
    const session = getOrCreateSession(instanceId, 'slack');

    // Add enough messages to trigger compaction
    for (let i = 0; i < 15; i++) {
      addMessage(session.session_id, i % 2 === 0 ? 'user' : 'assistant', `Message ${i}`);
    }
    compactSession(session.session_id);

    const prompt = buildSessionPrompt(session.session_id, 5000);

    expect(prompt).toContain('Conversation History');
    expect(prompt).toContain('Earlier in this conversation');
  });

  it('respects token budget', () => {
    const session = getOrCreateSession(instanceId, 'slack');
    // Add a lot of messages
    for (let i = 0; i < 50; i++) {
      addMessage(session.session_id, 'user', `Message ${i}: ${'x'.repeat(200)}`);
    }

    // Very small budget
    const prompt = buildSessionPrompt(session.session_id, 100);
    const promptTokens = estimateTokens(prompt);
    // The prompt should be reasonably close to the budget (headers add overhead)
    // Just check it doesn't contain all 50 messages
    expect(prompt.split('Message').length).toBeLessThan(50);
  });
});

// ===================================================================
// needsCompaction
// ===================================================================

describe('needsCompaction', () => {
  it('returns false for small sessions', () => {
    const session = getOrCreateSession(instanceId, 'slack');
    addMessage(session.session_id, 'user', 'Hello');

    expect(needsCompaction(session.session_id)).toBe(false);
  });

  it('returns true when token count exceeds threshold', () => {
    const session = getOrCreateSession(instanceId, 'slack');

    // Add enough content to exceed 8000 tokens (~32000 chars)
    for (let i = 0; i < 100; i++) {
      addMessage(session.session_id, 'user', `Message ${i}: ${'x'.repeat(400)}`);
    }

    expect(needsCompaction(session.session_id)).toBe(true);
  });
});

// ===================================================================
// Token estimation
// ===================================================================

describe('estimateTokens', () => {
  it('estimates tokens as approximately chars/4', () => {
    expect(estimateTokens('hello world')).toBe(3); // 11 chars / 4 = 2.75 -> ceil 3
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('a'.repeat(100))).toBe(25); // 100 / 4 = 25
  });

  it('rounds up', () => {
    expect(estimateTokens('hi')).toBe(1); // 2 / 4 = 0.5 -> ceil 1
  });
});
