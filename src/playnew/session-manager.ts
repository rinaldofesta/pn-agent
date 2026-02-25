/**
 * Session Manager — Conversation session management for Play New.
 *
 * Manages conversation sessions across channels with continuity:
 * - Session creation and resumption
 * - Message history within sessions
 * - Token-budget-aware history retrieval
 * - Session compaction when context window grows too large
 * - Cross-channel session continuity
 *
 * See: docs/specs/memory/session-management-spec.md
 */

import { logger } from '../logger.js';
import {
  insertPnSession,
  getPnSession,
  getActivePnSession,
  getRecentActivePnSession,
  updatePnSession,
  expireOldPnSessions,
  listRecentPnSessions,
  insertSessionMessage,
  getSessionMessages,
  getSessionMessageCount,
  getSessionTokenTotal,
  markMessagesByIdsCompacted,
  type PnSessionRow,
  type SessionMessageRow,
} from './db.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default session inactivity timeout in minutes */
const SESSION_TIMEOUT_MINUTES = 30;

/** Token threshold at which session compaction is triggered */
const COMPACTION_THRESHOLD_TOKENS = 8000;

/** Number of recent messages to keep verbatim after compaction */
const KEEP_RECENT_MESSAGES = 10;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AddMessageOptions {
  channelType?: string;
  tokenEstimate?: number;
}

export interface SessionHistoryOptions {
  maxTokens?: number;
  includeCompacted?: boolean;
}

export interface SessionPromptOptions {
  tokenBudget: number;
}

// ---------------------------------------------------------------------------
// Session Operations
// ---------------------------------------------------------------------------

/**
 * Get or create a session for a user instance.
 *
 * Resolution order:
 * 1. Check for an active session on the same channel
 * 2. Check for any recent active session (cross-channel continuity)
 * 3. Create a new session
 *
 * Sessions expire after SESSION_TIMEOUT_MINUTES of inactivity.
 */
export function getOrCreateSession(
  instanceId: string,
  channelType: string,
  channelId?: string,
): PnSessionRow {
  // 1. Check for active session on same channel
  const activeOnChannel = getActivePnSession(instanceId, channelType);
  if (activeOnChannel) {
    logger.debug(
      { sessionId: activeOnChannel.session_id, instanceId, channelType },
      'Resuming active session on same channel',
    );
    // Touch the session (update last_activity_at)
    updatePnSession(activeOnChannel.session_id, {});
    return getPnSession(activeOnChannel.session_id)!;
  }

  // 2. Check for any recent active session (cross-channel continuity)
  const recentActive = getRecentActivePnSession(instanceId, SESSION_TIMEOUT_MINUTES);
  if (recentActive) {
    logger.debug(
      {
        sessionId: recentActive.session_id,
        instanceId,
        fromChannel: recentActive.channel_type,
        toChannel: channelType,
      },
      'Continuing session from different channel',
    );
    // Touch the session
    updatePnSession(recentActive.session_id, {});
    return getPnSession(recentActive.session_id)!;
  }

  // 3. Create a new session
  const session = insertPnSession({
    instance_id: instanceId,
    channel_type: channelType,
    channel_id: channelId,
  });

  logger.info(
    { sessionId: session.session_id, instanceId, channelType },
    'Created new session',
  );

  return session;
}

/**
 * Add a message to a session's history.
 * Updates session metadata (message count, token count, last activity).
 */
export function addMessage(
  sessionId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  opts?: AddMessageOptions,
): SessionMessageRow {
  const message = insertSessionMessage({
    session_id: sessionId,
    role,
    content,
    channel_type: opts?.channelType,
    token_estimate: opts?.tokenEstimate,
  });

  // Update session metadata
  const messageCount = getSessionMessageCount(sessionId);
  const tokenTotal = getSessionTokenTotal(sessionId);

  updatePnSession(sessionId, {
    message_count: messageCount,
    token_count: tokenTotal,
  });

  return message;
}

/**
 * Get conversation history for a session.
 *
 * If maxTokens is specified, returns the most recent messages that fit
 * within the token budget (starting from the newest and working backwards).
 */
export function getSessionHistory(
  sessionId: string,
  opts?: SessionHistoryOptions,
): SessionMessageRow[] {
  const messages = getSessionMessages(sessionId, {
    includeCompacted: opts?.includeCompacted,
  });

  if (!opts?.maxTokens || opts.maxTokens <= 0) {
    return messages;
  }

  // Fit messages within the token budget, keeping the most recent
  let tokenBudget = opts.maxTokens;
  const fitted: SessionMessageRow[] = [];

  // Iterate from newest to oldest
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.token_estimate <= tokenBudget) {
      fitted.unshift(msg);
      tokenBudget -= msg.token_estimate;
    } else {
      break; // Stop when we can't fit more messages
    }
  }

  return fitted;
}

/**
 * Compact a session when it grows too large.
 *
 * Strategy:
 * - Keep the last KEEP_RECENT_MESSAGES messages verbatim
 * - Mark older messages as compacted
 * - Store a summary in the session's summary field
 *
 * Note: The actual summarization would be done by the LLM at runtime.
 * This function prepares the data structures and marks messages.
 * For Phase 0, we generate a simple extractive summary.
 */
export function compactSession(sessionId: string): {
  compacted: boolean;
  messagesCompacted: number;
  summary: string;
} {
  const session = getPnSession(sessionId);
  if (!session) {
    return { compacted: false, messagesCompacted: 0, summary: '' };
  }

  const messages = getSessionMessages(sessionId, { includeCompacted: false });

  if (messages.length <= KEEP_RECENT_MESSAGES) {
    return { compacted: false, messagesCompacted: 0, summary: '' };
  }

  // Determine the cutoff: keep the last KEEP_RECENT_MESSAGES messages
  const cutoffIndex = messages.length - KEEP_RECENT_MESSAGES;
  const toCompact = messages.slice(0, cutoffIndex);

  // Generate a simple extractive summary of the compacted messages
  const summary = generateSimpleSummary(toCompact);

  // Mark old messages as compacted by their IDs
  const idsToCompact = toCompact.map((m) => m.message_id);
  const compactedCount = markMessagesByIdsCompacted(idsToCompact);

  // Update session with summary and new token count
  const newTokenTotal = getSessionTokenTotal(sessionId);
  updatePnSession(sessionId, {
    summary: session.summary
      ? `${session.summary}\n\n---\n\n${summary}`
      : summary,
    token_count: newTokenTotal,
  });

  logger.info(
    {
      sessionId,
      messagesCompacted: compactedCount,
      summaryLength: summary.length,
    },
    'Session compacted',
  );

  return {
    compacted: true,
    messagesCompacted: compactedCount,
    summary,
  };
}

/**
 * Close a session, generating a final summary.
 */
export function closeSession(sessionId: string): void {
  const messages = getSessionMessages(sessionId, { includeCompacted: false });

  // Generate final summary
  const summary = messages.length > 0
    ? generateSimpleSummary(messages)
    : 'Empty session';

  updatePnSession(sessionId, {
    status: 'closed',
    summary,
  });

  logger.info({ sessionId }, 'Session closed');
}

/**
 * Expire stale sessions (idle for longer than the timeout).
 * Returns the number of sessions expired.
 */
export function expireStaleSessions(minutesIdle?: number): number {
  const count = expireOldPnSessions(minutesIdle ?? SESSION_TIMEOUT_MINUTES);
  if (count > 0) {
    logger.info({ count, minutesIdle: minutesIdle ?? SESSION_TIMEOUT_MINUTES }, 'Expired stale sessions');
  }
  return count;
}

/**
 * Get recent sessions for a user instance.
 * Useful for providing cross-session context.
 */
export function getRecentSessions(
  instanceId: string,
  limit?: number,
): PnSessionRow[] {
  return listRecentPnSessions(instanceId, limit);
}

/**
 * Build a session prompt section for inclusion in the system prompt.
 *
 * Assembles session history within a token budget:
 * - If there is a compacted summary, include it first
 * - Then include recent verbatim messages within the remaining budget
 */
export function buildSessionPrompt(
  sessionId: string,
  tokenBudget: number,
): string {
  const session = getPnSession(sessionId);
  if (!session) return '';

  const parts: string[] = [];
  let remainingBudget = tokenBudget;

  // Include session summary if available
  if (session.summary) {
    const summaryTokens = estimateTokens(session.summary);
    if (summaryTokens <= remainingBudget) {
      parts.push('### Earlier in this conversation (summary)');
      parts.push(session.summary);
      parts.push('');
      remainingBudget -= summaryTokens;
    }
  }

  // Include recent messages within remaining budget
  const messages = getSessionHistory(sessionId, { maxTokens: remainingBudget });

  if (messages.length > 0) {
    parts.push('### Recent messages');
    for (const msg of messages) {
      const channelTag = msg.channel_type ? ` [${msg.channel_type}]` : '';
      parts.push(`${msg.role}${channelTag}: ${msg.content}`);
    }
    parts.push('');
  }

  if (parts.length === 0) return '';

  return ['## Conversation History', '', ...parts].join('\n');
}

/**
 * Check if a session needs compaction based on its token count.
 */
export function needsCompaction(sessionId: string): boolean {
  const tokenTotal = getSessionTokenTotal(sessionId);
  return tokenTotal > COMPACTION_THRESHOLD_TOKENS;
}

/**
 * Estimate the number of tokens in a text string.
 * Simple heuristic: approximately 4 characters per token.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a simple extractive summary from a list of messages.
 *
 * Phase 0: Creates a condensed overview by extracting the first line
 * of each message pair (user + assistant). Full LLM summarization
 * will be added in Phase 1.
 */
function generateSimpleSummary(messages: SessionMessageRow[]): string {
  const lines: string[] = [];

  // Group messages into exchanges and extract key points
  for (const msg of messages) {
    if (msg.role === 'user') {
      // Truncate long messages for the summary
      const truncated = msg.content.length > 120
        ? msg.content.slice(0, 120) + '...'
        : msg.content;
      lines.push(`- User asked: "${truncated}"`);
    } else if (msg.role === 'assistant' && lines.length > 0) {
      // Only add a brief note about the response
      const truncated = msg.content.length > 80
        ? msg.content.slice(0, 80) + '...'
        : msg.content;
      lines.push(`  Assistant: "${truncated}"`);
    }
  }

  // Limit summary length
  const maxLines = 20;
  if (lines.length > maxLines) {
    return [
      `Summary of ${messages.length} messages:`,
      ...lines.slice(0, maxLines),
      `... and ${lines.length - maxLines} more exchanges`,
    ].join('\n');
  }

  return [`Summary of ${messages.length} messages:`, ...lines].join('\n');
}
