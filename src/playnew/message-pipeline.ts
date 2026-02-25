/**
 * Message Pipeline — Play New's main orchestrator.
 *
 * Connects all Play New components into a working message flow:
 *
 *   Inbound message (from Slack / any channel)
 *     -> Tenant resolution (channel user -> UserInstance)
 *     -> Context assembly (load org context)
 *     -> Skill matching (check if message is a slash command)
 *     -> System prompt construction (org context + active skill)
 *     -> Agent execution (delegate to nanoclaw's agent runner via IPC)
 *     -> Pattern logging (categorize the interaction)
 *     -> Response delivery (send back through the channel)
 *
 * This module wraps nanoclaw's router pattern and adds Play New's
 * multi-tenant, skill-aware, intelligence-collecting layer.
 */

import { logger } from '../logger.js';
import type { Channel, NewMessage } from '../types.js';

import { assembleOrgContext, buildContextPrompt, type AssembledContext } from './context-engine.js';
import { hasConsent, ConsentRequiredError } from './consent-manager.js';
import {
  extractMemories,
  storeMemory,
  buildMemoryPrompt,
} from './memory-store.js';
import {
  buildPatternRecord,
  emitPattern,
  getCurrentPeriod,
  CATEGORY_L1,
} from './pattern-collector.js';
import {
  getOrCreateSession,
  addMessage,
  buildSessionPrompt,
  needsCompaction,
  compactSession,
} from './session-manager.js';
import { parseJid, resolveUserInstance } from './tenant-resolver.js';
import { buildSkillPrompt, type ParsedSkill } from './skill-runtime.js';
import { findSkillBySlashCommand } from './skill-registry.js';
import type { UserInstance } from './types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Dependencies injected into the pipeline.
 * This decouples the pipeline from concrete implementations
 * (channels, agent runner) for testability.
 */
export interface PipelineDeps {
  /** Send a message back through the channel */
  sendMessage: (jid: string, text: string) => Promise<void>;
  /** Execute the agent and return its response text */
  executeAgent: (systemPrompt: string, userMessage: string, instance: UserInstance) => Promise<string>;
}

/**
 * Result of processing a single inbound message.
 */
export interface PipelineResult {
  success: boolean;
  response?: string;
  error?: string;
  instanceId?: string;
  skillId?: string;
  category?: string;
  durationMs?: number;
}

// ---------------------------------------------------------------------------
// L1 Category Classification
// ---------------------------------------------------------------------------

/** Keyword patterns for L1 category classification */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  communication: [
    'email', 'message', 'reply', 'respond', 'write', 'draft', 'send',
    'forward', 'summarize', 'summary', 'meeting', 'notes', 'update',
    'announce', 'notification', 'slack', 'teams',
  ],
  analysis: [
    'analyze', 'analysis', 'data', 'report', 'dashboard', 'metric',
    'trend', 'compare', 'benchmark', 'insight', 'chart', 'graph',
    'spreadsheet', 'calculate', 'forecast', 'predict', 'statistics',
  ],
  creation: [
    'create', 'build', 'design', 'generate', 'write', 'produce',
    'develop', 'prototype', 'mockup', 'template', 'document', 'blog',
    'article', 'presentation', 'slide', 'content',
  ],
  coordination: [
    'schedule', 'plan', 'organize', 'assign', 'delegate', 'track',
    'project', 'task', 'deadline', 'timeline', 'status', 'progress',
    'workflow', 'process', 'manage', 'coordinate', 'review', 'approve',
  ],
  strategy: [
    'strategy', 'strategic', 'decision', 'prioritize', 'roadmap',
    'vision', 'goal', 'objective', 'initiative', 'opportunity',
    'risk', 'competitive', 'market', 'growth', 'innovation',
  ],
};

/**
 * Classify an interaction into an L1 category using keyword matching.
 * Returns the best-matching category or 'communication' as default.
 */
export function classifyInteraction(
  userMessage: string,
  agentResponse: string,
): string {
  const combined = `${userMessage} ${agentResponse}`.toLowerCase();
  const scores: Record<string, number> = {};

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (combined.includes(keyword)) {
        score++;
      }
    }
    scores[category] = score;
  }

  // Find the category with the highest score
  let bestCategory = 'communication'; // default
  let bestScore = 0;

  for (const [category, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  return bestCategory;
}

// ---------------------------------------------------------------------------
// System Prompt Construction
// ---------------------------------------------------------------------------

/**
 * Build the full system prompt for the agent.
 * Combines organizational context, personal memory, session history,
 * and optional active skill instructions.
 */
export function buildSystemPrompt(
  instance: UserInstance,
  context: AssembledContext,
  activeSkill?: ParsedSkill,
  opts?: { memoryPrompt?: string; sessionPrompt?: string },
): string {
  const parts: string[] = [];

  // Play New identity header
  parts.push('# Play New Assistant');
  parts.push('');
  parts.push(
    `You are a personal AI assistant for a user in the ${instance.role_category} role.`,
  );
  parts.push(
    `User ID: ${instance.user_id} | Org: ${instance.org_id} | Team: ${instance.team_id}`,
  );
  parts.push('');

  // Organizational context
  const contextPrompt = buildContextPrompt(context);
  if (contextPrompt.trim()) {
    parts.push(contextPrompt);
  }

  // Personal memory
  if (opts?.memoryPrompt && opts.memoryPrompt.trim()) {
    parts.push(opts.memoryPrompt);
  }

  // Session history
  if (opts?.sessionPrompt && opts.sessionPrompt.trim()) {
    parts.push(opts.sessionPrompt);
  }

  // Active skill instructions
  if (activeSkill) {
    parts.push(buildSkillPrompt(activeSkill));
    parts.push('');
  }

  // General guidance
  parts.push('## Guidelines');
  parts.push('');
  parts.push('- Be concise and actionable.');
  parts.push('- Reference organizational context when relevant, but do not force it.');
  parts.push('- If you lack information to complete a task, say so clearly.');
  parts.push('- Never expose internal system details, user IDs, or org IDs to the user.');
  parts.push('');

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Pattern Logging
// ---------------------------------------------------------------------------

/**
 * Log an interaction as a pattern record in the database.
 * All data is anonymized (user_id is hashed, tools are generalized).
 */
export async function logInteraction(params: {
  instance: UserInstance;
  category: string;
  tools: string[];
  durationMs: number;
}): Promise<void> {
  try {
    const record = buildPatternRecord({
      userId: params.instance.user_id,
      orgId: params.instance.org_id,
      teamId: params.instance.team_id,
      patternType: 'time_allocation',
      categoryL1: params.category,
      categoryL2: '',
      categoryL3: '',
      metricType: 'duration',
      metricValue: params.durationMs,
      toolsInvolved: params.tools,
      userIdSalt: params.instance.org_id, // Use org_id as salt for now
    });

    await emitPattern(record);
    logger.debug(
      { instanceId: params.instance.instance_id, category: params.category },
      'Pattern logged',
    );
  } catch (err) {
    // Pattern logging failures should never break the message flow
    logger.warn(
      { err, instanceId: params.instance.instance_id },
      'Failed to log pattern (non-fatal)',
    );
  }
}

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

/**
 * Handle an inbound message through the full Play New pipeline.
 *
 * @param jid - The channel JID (e.g., slack:T12345:C67890)
 * @param message - The inbound message from the channel
 * @param deps - Injected dependencies (sendMessage, executeAgent)
 * @returns Pipeline result with success/failure info
 */
export async function handleInboundMessage(
  jid: string,
  message: NewMessage,
  deps: PipelineDeps,
): Promise<PipelineResult> {
  const startTime = Date.now();

  // Step 1: Parse the JID to extract channel info
  const parsed = parseJid(jid);
  if (!parsed) {
    logger.warn({ jid }, 'Invalid JID format — cannot route message');
    return { success: false, error: 'Invalid JID format' };
  }

  // Step 2: Resolve the sender to a UserInstance
  const instance = await resolveUserInstance(
    parsed.channel,
    parsed.org_ref,
    message.sender,
  );
  if (!instance) {
    logger.info(
      { jid, sender: message.sender, channel: parsed.channel },
      'Unknown user — no channel binding found',
    );
    try {
      await deps.sendMessage(
        jid,
        "I don't recognize your account yet. Please contact your Play New administrator to get set up.",
      );
    } catch (err) {
      logger.error({ jid, err }, 'Failed to send unknown-user message');
    }
    return { success: false, error: 'Unknown user' };
  }

  // Step 3: Check instance status
  if (instance.status !== 'active') {
    logger.info(
      { instanceId: instance.instance_id, status: instance.status },
      'User instance is not active',
    );
    try {
      await deps.sendMessage(
        jid,
        `Your account is currently ${instance.status}. Please contact your administrator.`,
      );
    } catch (err) {
      logger.error({ jid, err }, 'Failed to send inactive-user message');
    }
    return {
      success: false,
      error: `Instance status: ${instance.status}`,
      instanceId: instance.instance_id,
    };
  }

  // Step 3.5: Check consent for data processing
  if (!hasConsent(instance.instance_id, 'data_processing')) {
    logger.info(
      { instanceId: instance.instance_id },
      'User has not granted data_processing consent',
    );
    try {
      await deps.sendMessage(
        jid,
        'Before I can assist you, I need your consent to process your messages. ' +
        'Please grant data processing consent through your Play New settings or contact your administrator.',
      );
    } catch (err) {
      logger.error({ jid, err }, 'Failed to send consent request message');
    }
    return {
      success: false,
      error: 'Consent required: data_processing',
      instanceId: instance.instance_id,
    };
  }

  // Step 4: Get or create a session for this user
  let sessionId: string | undefined;
  let sessionPromptText = '';
  try {
    const session = getOrCreateSession(
      instance.instance_id,
      parsed.channel,
      parsed.user_ref,
    );
    sessionId = session.session_id;

    // Add the user message to the session
    addMessage(session.session_id, 'user', message.content, {
      channelType: parsed.channel,
    });

    // Build session prompt (allocate ~2000 tokens for session history)
    sessionPromptText = buildSessionPrompt(session.session_id, 2000);
  } catch (err) {
    logger.warn(
      { instanceId: instance.instance_id, err },
      'Session management failed — proceeding without session context',
    );
  }

  // Step 5: Recall relevant memories
  let memoryPromptText = '';
  try {
    memoryPromptText = buildMemoryPrompt(instance.instance_id, message.content);
  } catch (err) {
    logger.warn(
      { instanceId: instance.instance_id, err },
      'Memory recall failed — proceeding without memory context',
    );
  }

  // Step 6: Assemble organizational context
  let context: AssembledContext;
  try {
    context = await assembleOrgContext(instance.org_id, message.content);
  } catch (err) {
    logger.error(
      { orgId: instance.org_id, err },
      'Failed to assemble org context — proceeding without context',
    );
    context = { coreContext: '', relevantContext: '', estimatedTokens: 0 };
  }

  // Step 7: Check for skill invocation (slash command)
  let activeSkill: ParsedSkill | null = null;
  const skillMatch = findSkillBySlashCommand(message.content);
  if (skillMatch) {
    activeSkill = skillMatch;
    logger.info(
      {
        instanceId: instance.instance_id,
        skill: skillMatch.name,
        skillId: skillMatch.metadata.id,
      },
      'Skill matched for message',
    );
  }

  // Step 8: Build the system prompt (with memory + session context)
  const systemPrompt = buildSystemPrompt(
    instance,
    context,
    activeSkill ?? undefined,
    {
      memoryPrompt: memoryPromptText,
      sessionPrompt: sessionPromptText,
    },
  );

  // Step 9: Execute the agent
  let agentResponse: string;
  try {
    agentResponse = await deps.executeAgent(
      systemPrompt,
      message.content,
      instance,
    );
  } catch (err) {
    const durationMs = Date.now() - startTime;
    logger.error(
      { instanceId: instance.instance_id, err, durationMs },
      'Agent execution failed',
    );
    try {
      await deps.sendMessage(
        jid,
        'Sorry, I encountered an error processing your request. Please try again.',
      );
    } catch (sendErr) {
      logger.error({ jid, sendErr }, 'Failed to send error message');
    }
    return {
      success: false,
      error: `Agent execution failed: ${err instanceof Error ? err.message : String(err)}`,
      instanceId: instance.instance_id,
      skillId: activeSkill?.metadata.id,
    };
  }

  const durationMs = Date.now() - startTime;

  // Step 10: Send the response back through the channel
  try {
    await deps.sendMessage(jid, agentResponse);
  } catch (err) {
    logger.error(
      { jid, err, responseLength: agentResponse.length },
      'Failed to send agent response',
    );
    return {
      success: false,
      error: 'Failed to deliver response',
      instanceId: instance.instance_id,
      response: agentResponse,
    };
  }

  // Step 11: Post-response processing (fire-and-forget)
  // 11a: Add assistant response to session
  if (sessionId) {
    try {
      addMessage(sessionId, 'assistant', agentResponse, {
        channelType: parsed.channel,
      });

      // Check if session needs compaction
      if (needsCompaction(sessionId)) {
        compactSession(sessionId);
      }
    } catch (err) {
      logger.warn(
        { sessionId, err },
        'Failed to record assistant response in session (non-fatal)',
      );
    }
  }

  // 11b: Extract and store memories from the interaction
  try {
    const memories = extractMemories(message.content, agentResponse);
    for (const mem of memories) {
      storeMemory(instance.instance_id, mem.type, mem.content, {
        sourceChannel: parsed.channel,
        confidence: mem.confidence,
      });
    }
  } catch (err) {
    logger.warn(
      { instanceId: instance.instance_id, err },
      'Memory extraction failed (non-fatal)',
    );
  }

  // 11c: Classify and log the interaction pattern
  const category = classifyInteraction(message.content, agentResponse);
  if (hasConsent(instance.instance_id, 'pattern_collection')) {
    logInteraction({
      instance,
      category,
      tools: [],
      durationMs,
    }).catch(() => {
      // Already logged inside logInteraction — no further action needed
    });
  } else {
    logger.debug(
      { instanceId: instance.instance_id },
      'Skipping pattern logging — user has not granted pattern_collection consent',
    );
  }

  logger.info(
    {
      instanceId: instance.instance_id,
      sessionId,
      durationMs,
      category,
      skillId: activeSkill?.metadata.id,
    },
    'Message pipeline completed',
  );

  return {
    success: true,
    response: agentResponse,
    instanceId: instance.instance_id,
    skillId: activeSkill?.metadata.id,
    category,
    durationMs,
  };
}
