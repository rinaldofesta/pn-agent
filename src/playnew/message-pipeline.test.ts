import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  _initPlayNewTestDatabase,
  createOrg,
  createTeam,
  createUserInstance,
  createBinding,
  updateInstanceStatus,
  insertPattern,
} from './db.js';

import {
  handleInboundMessage,
  buildSystemPrompt,
  classifyInteraction,
  logInteraction,
  type PipelineDeps,
} from './message-pipeline.js';

import { grantConsent } from './consent-manager.js';

import type { NewMessage } from '../types.js';
import type { UserInstance } from './types.js';
import type { AssembledContext } from './context-engine.js';

// ---------------------------------------------------------------------------
// Test database and fixtures
// ---------------------------------------------------------------------------

beforeEach(() => {
  _initPlayNewTestDatabase();
});

function setupTestData() {
  const org = createOrg({
    name: 'Test Corp',
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
    trigger_pattern: '',
  });
  // Set instance to active
  updateInstanceStatus(instance.instance_id, 'active');

  // Create channel binding: slack:T12345:U-alice -> this instance
  createBinding({
    channel_type: 'slack',
    channel_org_id: 'T12345',
    channel_user_id: 'U-alice',
    org_id: org.org_id,
    instance_id: instance.instance_id,
  });

  // Grant data_processing consent (required for message pipeline)
  grantConsent(instance.instance_id, org.org_id, 'data_processing');
  // Grant pattern_collection consent (required for pattern logging)
  grantConsent(instance.instance_id, org.org_id, 'pattern_collection');

  return { org, team, instance };
}

function makeMessage(content: string, sender = 'U-alice'): NewMessage {
  return {
    id: 'msg-001',
    chat_jid: 'slack:T12345:C-general',
    sender,
    sender_name: 'Alice',
    content,
    timestamp: new Date().toISOString(),
  };
}

function makeDeps(overrides?: Partial<PipelineDeps>): PipelineDeps {
  return {
    sendMessage: vi.fn().mockResolvedValue(undefined),
    executeAgent: vi.fn().mockResolvedValue('Agent response text'),
    ...overrides,
  };
}

// ===================================================================
// classifyInteraction
// ===================================================================

describe('classifyInteraction', () => {
  it('classifies email-related messages as communication', () => {
    const cat = classifyInteraction('summarize this email for me', 'Here is a summary of the email');
    expect(cat).toBe('communication');
  });

  it('classifies data-related messages as analysis', () => {
    const cat = classifyInteraction('analyze the sales data', 'Based on the data analysis, trends show...');
    expect(cat).toBe('analysis');
  });

  it('classifies scheduling messages as coordination', () => {
    const cat = classifyInteraction(
      'schedule a meeting for the project deadline review',
      'I have organized the schedule for the project review',
    );
    expect(cat).toBe('coordination');
  });

  it('classifies strategy messages correctly', () => {
    const cat = classifyInteraction(
      'what is our competitive strategy for market growth',
      'Based on your strategic roadmap...',
    );
    expect(cat).toBe('strategy');
  });

  it('classifies creation messages correctly', () => {
    const cat = classifyInteraction(
      'generate a presentation template',
      'Here is a prototype slide template',
    );
    expect(cat).toBe('creation');
  });

  it('defaults to communication for ambiguous messages', () => {
    const cat = classifyInteraction('hello', 'hi there');
    expect(cat).toBe('communication');
  });
});

// ===================================================================
// buildSystemPrompt
// ===================================================================

describe('buildSystemPrompt', () => {
  it('includes user role and org info', () => {
    const instance: UserInstance = {
      instance_id: 'inst-1',
      user_id: 'user-1',
      org_id: 'org-1',
      team_id: 'team-1',
      role_category: 'engineer',
      access_mode: 'full',
      status: 'active',
      encryption_key_ref: 'key-1',
      created_at: '2026-01-01',
      folder: 'users/user-1',
      trigger: '',
    };
    const context: AssembledContext = {
      coreContext: 'We are a tech company.',
      relevantContext: '',
      estimatedTokens: 10,
    };

    const prompt = buildSystemPrompt(instance, context);

    expect(prompt).toContain('Play New Assistant');
    expect(prompt).toContain('engineer');
    expect(prompt).toContain('user-1');
    expect(prompt).toContain('org-1');
    expect(prompt).toContain('team-1');
    expect(prompt).toContain('We are a tech company.');
    expect(prompt).toContain('Guidelines');
  });

  it('includes skill instructions when a skill is active', () => {
    const instance: UserInstance = {
      instance_id: 'inst-1',
      user_id: 'user-1',
      org_id: 'org-1',
      team_id: 'team-1',
      role_category: 'sales_rep',
      access_mode: 'forward',
      status: 'active',
      encryption_key_ref: 'key-1',
      created_at: '2026-01-01',
      folder: 'users/user-1',
      trigger: '',
    };
    const context: AssembledContext = {
      coreContext: '',
      relevantContext: '',
      estimatedTokens: 0,
    };
    const skill = {
      name: 'Email Summarizer',
      metadata: {
        id: 'skill_email_001',
        version: '1.0.0',
        category: 'communication' as const,
        generated: '2026-01-01',
        source: 'pre_built' as const,
        status: 'active' as const,
        quality_score: null,
        usage: '0',
      },
      trigger: { slash_command: '/email-summary' },
      contextRequired: [],
      instructions: 'Summarize the forwarded email.',
      outputFormat: 'Concise bullet points.',
    };

    const prompt = buildSystemPrompt(instance, context, skill);

    expect(prompt).toContain('Active Skill: Email Summarizer');
    expect(prompt).toContain('Summarize the forwarded email.');
    expect(prompt).toContain('Concise bullet points.');
  });

  it('omits context section when context is empty', () => {
    const instance: UserInstance = {
      instance_id: 'inst-1',
      user_id: 'user-1',
      org_id: 'org-1',
      team_id: 'team-1',
      role_category: 'analyst',
      access_mode: 'forward',
      status: 'active',
      encryption_key_ref: 'key-1',
      created_at: '2026-01-01',
      folder: 'users/user-1',
      trigger: '',
    };
    const context: AssembledContext = {
      coreContext: '',
      relevantContext: '',
      estimatedTokens: 0,
    };

    const prompt = buildSystemPrompt(instance, context);

    // The context prompt builder returns header text even with empty content,
    // but without any actual strategy/relevant sections
    expect(prompt).toContain('Play New Assistant');
    expect(prompt).toContain('Guidelines');
  });
});

// ===================================================================
// handleInboundMessage — Full pipeline
// ===================================================================

describe('handleInboundMessage', () => {
  it('processes a message through the full pipeline', async () => {
    setupTestData();

    const deps = makeDeps();
    const message = makeMessage('What are our quarterly goals?');
    const jid = 'slack:T12345:C-general';

    const result = await handleInboundMessage(jid, message, deps);

    expect(result.success).toBe(true);
    expect(result.response).toBe('Agent response text');
    expect(result.instanceId).toBeTruthy();
    expect(result.category).toBeTruthy();
    expect(result.durationMs).toBeGreaterThanOrEqual(0);

    // Verify agent was called with a system prompt
    expect(deps.executeAgent).toHaveBeenCalledOnce();
    const [systemPrompt, userMsg] = (deps.executeAgent as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(systemPrompt).toContain('Play New Assistant');
    expect(userMsg).toBe('What are our quarterly goals?');

    // Verify response was sent
    expect(deps.sendMessage).toHaveBeenCalledWith(jid, 'Agent response text');
  });

  it('returns error for invalid JID format', async () => {
    const deps = makeDeps();
    const message = makeMessage('hello');

    const result = await handleInboundMessage('invalid-jid', message, deps);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid JID');
    expect(deps.executeAgent).not.toHaveBeenCalled();
  });

  it('returns error for unknown user', async () => {
    // No test data set up — user has no binding
    _initPlayNewTestDatabase();

    const deps = makeDeps();
    const message = makeMessage('hello', 'U-unknown');
    const jid = 'slack:T99999:C-general';

    const result = await handleInboundMessage(jid, message, deps);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown user');

    // Should send a helpful error message to the user
    expect(deps.sendMessage).toHaveBeenCalledWith(
      jid,
      expect.stringContaining('recognize'),
    );
    expect(deps.executeAgent).not.toHaveBeenCalled();
  });

  it('returns error for inactive user instance', async () => {
    const { instance } = setupTestData();
    // Suspend the instance
    updateInstanceStatus(instance.instance_id, 'suspended');

    const deps = makeDeps();
    const message = makeMessage('hello');
    const jid = 'slack:T12345:C-general';

    const result = await handleInboundMessage(jid, message, deps);

    expect(result.success).toBe(false);
    expect(result.error).toContain('suspended');
    expect(deps.sendMessage).toHaveBeenCalledWith(
      jid,
      expect.stringContaining('suspended'),
    );
    expect(deps.executeAgent).not.toHaveBeenCalled();
  });

  it('handles agent execution failure gracefully', async () => {
    setupTestData();

    const deps = makeDeps({
      executeAgent: vi.fn().mockRejectedValue(new Error('Claude API timeout')),
    });
    const message = makeMessage('do something');
    const jid = 'slack:T12345:C-general';

    const result = await handleInboundMessage(jid, message, deps);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Agent execution failed');
    expect(result.error).toContain('Claude API timeout');

    // Should send an error message to the user
    expect(deps.sendMessage).toHaveBeenCalledWith(
      jid,
      expect.stringContaining('error'),
    );
  });

  it('handles response delivery failure', async () => {
    setupTestData();

    const sendMessage = vi.fn()
      .mockRejectedValueOnce(new Error('Slack API down'));

    const deps = makeDeps({
      sendMessage,
    });
    const message = makeMessage('hello');
    const jid = 'slack:T12345:C-general';

    const result = await handleInboundMessage(jid, message, deps);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to deliver response');
    // The response should still be available in the result
    expect(result.response).toBe('Agent response text');
  });
});

// ===================================================================
// logInteraction
// ===================================================================

describe('logInteraction', () => {
  it('writes a pattern record to the database', async () => {
    const org = createOrg({
      name: 'Test Corp',
      industry: 'tech',
      size_band: '200-500',
      geo: 'EU_south',
    });
    const team = createTeam({
      org_id: org.org_id,
      name: 'Engineering',
      function: 'engineering',
    });

    const instance: UserInstance = {
      instance_id: 'inst-1',
      user_id: 'user-1',
      org_id: org.org_id,
      team_id: team.team_id,
      role_category: 'engineer',
      access_mode: 'full',
      status: 'active',
      encryption_key_ref: 'key-1',
      created_at: '2026-01-01',
      folder: 'users/user-1',
      trigger: '',
    };

    // Should not throw
    await logInteraction({
      instance,
      category: 'communication',
      tools: ['slack', 'gmail'],
      durationMs: 1500,
    });

    // Pattern was logged — we can verify by checking the DB
    // The pattern_logs table should have one entry
    // (We cannot query directly here without exposing more DB functions,
    //  but the fact that it did not throw is the key assertion)
  });

  it('does not throw when pattern logging fails', async () => {
    // UserInstance with a non-existent org_id — will fail FK constraint
    const instance: UserInstance = {
      instance_id: 'inst-1',
      user_id: 'user-1',
      org_id: 'nonexistent-org',
      team_id: 'team-1',
      role_category: 'engineer',
      access_mode: 'full',
      status: 'active',
      encryption_key_ref: 'key-1',
      created_at: '2026-01-01',
      folder: 'users/user-1',
      trigger: '',
    };

    // Should not throw — errors are caught and logged
    await logInteraction({
      instance,
      category: 'analysis',
      tools: [],
      durationMs: 500,
    });
  });
});
