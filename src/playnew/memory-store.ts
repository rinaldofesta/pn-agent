/**
 * Personal Memory Store — Per-user memory system for Play New.
 *
 * Stores and retrieves contextual information about users:
 * preferences, relationships, decisions, facts, and patterns.
 *
 * Phase 0: Keyword-based recall with recency weighting.
 * Phase 1: Vector similarity search via embeddings.
 *
 * See: docs/specs/memory/personal-memory-spec.md
 */

import { logger } from '../logger.js';
import {
  insertMemory,
  getMemory,
  getMemoriesByInstance,
  searchMemories,
  updateMemoryRow,
  incrementMemoryAccess,
  softDeleteMemory,
  softDeleteAllMemories,
  deleteExpiredMemories,
  getMemoryStats as dbGetMemoryStats,
  type UserMemoryRow,
} from './db.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MemoryType = 'fact' | 'preference' | 'pattern' | 'relationship' | 'decision' | 'context';

export interface StoreMemoryOptions {
  sourceChannel?: string;
  sourceMessageId?: string;
  confidence?: number;
  expiresAt?: string;
}

export interface RecallOptions {
  types?: MemoryType[];
  limit?: number;
  minConfidence?: number;
}

export interface MemoryStats {
  total: number;
  by_type: Record<string, number>;
  oldest: string | null;
  newest: string | null;
}

export interface ExtractedMemory {
  type: MemoryType;
  content: string;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Memory Operations
// ---------------------------------------------------------------------------

/**
 * Store a new memory for a user instance.
 */
export function storeMemory(
  instanceId: string,
  type: MemoryType,
  content: string,
  opts?: StoreMemoryOptions,
): UserMemoryRow {
  logger.debug({ instanceId, type, contentLength: content.length }, 'Storing memory');

  return insertMemory({
    instance_id: instanceId,
    memory_type: type,
    content,
    source_channel: opts?.sourceChannel,
    source_message_id: opts?.sourceMessageId,
    confidence: opts?.confidence,
    expires_at: opts?.expiresAt,
  });
}

/**
 * Recall relevant memories for a user instance given a query.
 *
 * Phase 0: keyword matching + recency weighting.
 * Extracts keywords from the query, searches memory content,
 * then ranks by relevance (keyword match count) and recency.
 */
export function recallMemories(
  instanceId: string,
  query: string,
  opts?: RecallOptions,
): UserMemoryRow[] {
  const limit = opts?.limit ?? 10;
  const minConfidence = opts?.minConfidence ?? 0.0;

  // Extract keywords from query: split on whitespace, filter short words and stop words
  const keywords = extractKeywords(query);

  if (keywords.length === 0) {
    // Fall back to most recent memories
    return getMemoriesByInstance(instanceId, { limit });
  }

  // Search by keywords
  let results = searchMemories(instanceId, keywords, { limit: limit * 3 });

  // Filter by type if specified
  if (opts?.types && opts.types.length > 0) {
    const typeSet = new Set(opts.types as string[]);
    results = results.filter((m) => typeSet.has(m.memory_type));
  }

  // Filter by minimum confidence
  if (minConfidence > 0) {
    results = results.filter((m) => m.confidence >= minConfidence);
  }

  // Score and sort: keyword match count + recency bonus
  const scored = results.map((memory) => {
    const contentLower = memory.content.toLowerCase();
    let keywordScore = 0;
    for (const kw of keywords) {
      if (contentLower.includes(kw.toLowerCase())) {
        keywordScore++;
      }
    }

    // Recency bonus: memories from the last 24h get a boost
    const ageMs = Date.now() - new Date(memory.updated_at).getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    const recencyBonus = ageHours < 24 ? 0.5 : ageHours < 168 ? 0.2 : 0;

    const score = keywordScore + recencyBonus + (memory.confidence * 0.1);
    return { memory, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const topResults = scored.slice(0, limit).map((s) => s.memory);

  // Increment access counts for recalled memories
  for (const memory of topResults) {
    try {
      incrementMemoryAccess(memory.memory_id);
    } catch {
      // Non-fatal — access count is a nice-to-have
    }
  }

  return topResults;
}

/**
 * Get memories of a specific type.
 */
export function getMemoriesByType(
  instanceId: string,
  type: MemoryType,
  limit?: number,
): UserMemoryRow[] {
  return getMemoriesByInstance(instanceId, { type, limit });
}

/**
 * Update a memory's content or metadata.
 */
export function updateMemory(
  memoryId: string,
  updates: { content?: string; confidence?: number; expiresAt?: string },
): void {
  updateMemoryRow(memoryId, {
    content: updates.content,
    confidence: updates.confidence,
    expires_at: updates.expiresAt,
  });
}

/**
 * Soft delete a single memory (GDPR-friendly).
 */
export function forgetMemory(memoryId: string): void {
  softDeleteMemory(memoryId);
  logger.info({ memoryId }, 'Memory soft-deleted');
}

/**
 * Soft delete all memories for a user (GDPR: right to erasure).
 */
export function forgetAllForUser(instanceId: string): void {
  softDeleteAllMemories(instanceId);
  logger.info({ instanceId }, 'All memories soft-deleted for user');
}

/**
 * Get memory statistics for a user.
 */
export function getMemoryStatsForUser(instanceId: string): MemoryStats {
  return dbGetMemoryStats(instanceId);
}

/**
 * Prune expired memories from the database.
 * Call this periodically (e.g., daily).
 */
export function pruneExpiredMemories(): number {
  const count = deleteExpiredMemories();
  if (count > 0) {
    logger.info({ count }, 'Pruned expired memories');
  }
  return count;
}

// ---------------------------------------------------------------------------
// Memory Extraction (Lightweight heuristics — Phase 0)
// ---------------------------------------------------------------------------

/** Patterns for detecting memory-worthy content in messages */
const EXTRACTION_PATTERNS: Array<{
  type: MemoryType;
  patterns: RegExp[];
  confidence: number;
}> = [
  {
    type: 'preference',
    patterns: [
      /\bi (?:prefer|like|always|usually|tend to|want|love|hate|dislike|never)\b/i,
      /\bmy preference is\b/i,
      /\bi'd rather\b/i,
      /\bi(?:'d| would) (?:prefer|like)\b/i,
    ],
    confidence: 0.8,
  },
  {
    type: 'relationship',
    patterns: [
      /\bmy (?:team|manager|boss|colleague|report|direct report|coworker)\b/i,
      /\bi work with\b/i,
      /\b(\w+) is my\b/i,
      /\bmy (?:team|department|group) (?:is|includes|has)\b/i,
    ],
    confidence: 0.7,
  },
  {
    type: 'decision',
    patterns: [
      /\bwe decided\b/i,
      /\bthe decision (?:was|is)\b/i,
      /\bwe(?:'ve| have) agreed\b/i,
      /\bit was decided\b/i,
      /\bour decision\b/i,
    ],
    confidence: 0.8,
  },
  {
    type: 'fact',
    patterns: [
      /\bremember that\b/i,
      /\bkeep in mind\b/i,
      /\bfor (?:your|the) record\b/i,
      /\bfyi\b/i,
      /\bnote that\b/i,
    ],
    confidence: 0.7,
  },
];

/** Explicit memory pattern: "Remember: <content>" */
const EXPLICIT_REMEMBER_PATTERN = /^remember:\s*(.+)$/im;

/**
 * Extract potential memories from a user message and assistant response.
 *
 * Uses lightweight heuristic patterns — intentionally conservative.
 * Better to miss a memory than to store incorrect information.
 */
export function extractMemories(
  userMessage: string,
  _assistantResponse: string,
): ExtractedMemory[] {
  const extracted: ExtractedMemory[] = [];

  // 1. Check for explicit "Remember: <content>" directive
  const explicitMatch = userMessage.match(EXPLICIT_REMEMBER_PATTERN);
  if (explicitMatch) {
    extracted.push({
      type: 'fact',
      content: explicitMatch[1].trim(),
      confidence: 1.0,
    });
  }

  // 2. Scan user message for heuristic patterns
  for (const { type, patterns, confidence } of EXTRACTION_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(userMessage)) {
        // Extract a meaningful snippet around the match
        const snippet = extractSnippet(userMessage, pattern);
        if (snippet && snippet.length > 10) {
          // Avoid duplicate extractions for the same content
          const isDuplicate = extracted.some(
            (e) => e.content.toLowerCase() === snippet.toLowerCase(),
          );
          if (!isDuplicate) {
            extracted.push({ type, content: snippet, confidence });
          }
        }
        break; // Only extract one memory per pattern group
      }
    }
  }

  return extracted;
}

// ---------------------------------------------------------------------------
// Memory Prompt Building
// ---------------------------------------------------------------------------

/**
 * Build a system prompt section from the user's memories.
 *
 * Retrieves relevant memories for the current query and formats them
 * into a system prompt section.
 */
export function buildMemoryPrompt(
  instanceId: string,
  currentQuery?: string,
): string {
  const parts: string[] = [];

  // Get recent preferences (always include)
  const preferences = getMemoriesByType(instanceId, 'preference', 5);
  // Get recent relationships
  const relationships = getMemoriesByType(instanceId, 'relationship', 3);
  // Get recent facts
  const facts = getMemoriesByType(instanceId, 'fact', 5);

  // If there is a query, also recall relevant memories
  let relevant: UserMemoryRow[] = [];
  if (currentQuery) {
    relevant = recallMemories(instanceId, currentQuery, { limit: 5 });
    // Remove duplicates with the type-specific fetches
    const seenIds = new Set([
      ...preferences.map((m) => m.memory_id),
      ...relationships.map((m) => m.memory_id),
      ...facts.map((m) => m.memory_id),
    ]);
    relevant = relevant.filter((m) => !seenIds.has(m.memory_id));
  }

  const hasMemories =
    preferences.length > 0 ||
    relationships.length > 0 ||
    facts.length > 0 ||
    relevant.length > 0;

  if (!hasMemories) {
    return '';
  }

  parts.push('## Personal Memory');
  parts.push('');
  parts.push('You have learned the following about this user from previous interactions:');
  parts.push('');

  if (preferences.length > 0) {
    parts.push('### Preferences');
    for (const pref of preferences) {
      parts.push(`- ${pref.content}`);
    }
    parts.push('');
  }

  if (relationships.length > 0) {
    parts.push('### Relationships');
    for (const rel of relationships) {
      parts.push(`- ${rel.content}`);
    }
    parts.push('');
  }

  if (facts.length > 0) {
    parts.push('### Known Facts');
    for (const fact of facts) {
      parts.push(`- ${fact.content}`);
    }
    parts.push('');
  }

  if (relevant.length > 0) {
    parts.push('### Relevant Context');
    for (const mem of relevant) {
      parts.push(`- [${mem.memory_type}] ${mem.content}`);
    }
    parts.push('');
  }

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

/** Stop words to filter out from keyword extraction */
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall',
  'should', 'may', 'might', 'must', 'can', 'could', 'of', 'at', 'by',
  'for', 'with', 'about', 'between', 'to', 'from', 'in', 'on', 'up',
  'out', 'if', 'or', 'and', 'but', 'not', 'no', 'so', 'as', 'it',
  'its', 'that', 'this', 'these', 'those', 'i', 'me', 'my', 'we',
  'our', 'you', 'your', 'he', 'she', 'they', 'them', 'what', 'which',
  'who', 'when', 'where', 'how', 'why', 'all', 'each', 'every', 'both',
  'few', 'more', 'most', 'other', 'some', 'such', 'than', 'too', 'very',
  'just', 'also',
]);

/**
 * Extract meaningful keywords from a query string.
 */
export function extractKeywords(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
}

/**
 * Extract a meaningful snippet around a regex match in text.
 * Returns the sentence containing the match.
 */
function extractSnippet(text: string, pattern: RegExp): string {
  const match = text.match(pattern);
  if (!match) return '';

  // Find the sentence containing the match
  const matchIndex = match.index ?? 0;

  // Find sentence boundaries
  let start = matchIndex;
  while (start > 0 && text[start - 1] !== '.' && text[start - 1] !== '!' && text[start - 1] !== '?') {
    start--;
  }

  let end = matchIndex + match[0].length;
  while (end < text.length && text[end] !== '.' && text[end] !== '!' && text[end] !== '?') {
    end++;
  }
  // Include the punctuation
  if (end < text.length) end++;

  return text.slice(start, end).trim();
}
