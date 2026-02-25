import { describe, it, expect, beforeEach } from 'vitest';

import {
  _initPlayNewTestDatabase,
  createOrg,
  createTeam,
  createUserInstance,
  updateInstanceStatus,
  getMemory,
} from './db.js';

import {
  storeMemory,
  recallMemories,
  getMemoriesByType,
  updateMemory,
  forgetMemory,
  forgetAllForUser,
  getMemoryStatsForUser,
  pruneExpiredMemories,
  extractMemories,
  buildMemoryPrompt,
  extractKeywords,
} from './memory-store.js';

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
// Store and recall
// ===================================================================

describe('storeMemory', () => {
  it('stores a memory and returns it', () => {
    const memory = storeMemory(instanceId, 'fact', 'The sky is blue');

    expect(memory.memory_id).toBeTruthy();
    expect(memory.instance_id).toBe(instanceId);
    expect(memory.memory_type).toBe('fact');
    expect(memory.content).toBe('The sky is blue');
    expect(memory.confidence).toBe(1.0);
    expect(memory.access_count).toBe(0);
    expect(memory.is_deleted).toBe(0);
  });

  it('stores a memory with options', () => {
    const memory = storeMemory(instanceId, 'preference', 'I prefer bullet points', {
      sourceChannel: 'slack',
      confidence: 0.8,
    });

    expect(memory.memory_type).toBe('preference');
    expect(memory.source_channel).toBe('slack');
    expect(memory.confidence).toBeCloseTo(0.8);
  });

  it('stores different memory types', () => {
    storeMemory(instanceId, 'fact', 'Fact content');
    storeMemory(instanceId, 'preference', 'Preference content');
    storeMemory(instanceId, 'pattern', 'Pattern content');
    storeMemory(instanceId, 'relationship', 'Relationship content');
    storeMemory(instanceId, 'decision', 'Decision content');
    storeMemory(instanceId, 'context', 'Context content');

    const stats = getMemoryStatsForUser(instanceId);
    expect(stats.total).toBe(6);
    expect(Object.keys(stats.by_type)).toHaveLength(6);
  });
});

describe('recallMemories', () => {
  it('recalls memories by keyword', () => {
    storeMemory(instanceId, 'fact', 'The quarterly sales report shows growth');
    storeMemory(instanceId, 'fact', 'Team meeting scheduled for Friday');
    storeMemory(instanceId, 'preference', 'I prefer detailed reports');

    const results = recallMemories(instanceId, 'quarterly report');
    expect(results.length).toBeGreaterThan(0);
    // Should match memories containing "quarterly" or "report"
    const contents = results.map((r) => r.content);
    expect(
      contents.some((c) => c.includes('quarterly') || c.includes('report')),
    ).toBe(true);
  });

  it('returns recent memories when query has no keywords', () => {
    storeMemory(instanceId, 'fact', 'Some fact');
    storeMemory(instanceId, 'preference', 'Some preference');

    const results = recallMemories(instanceId, '');
    expect(results.length).toBe(2);
  });

  it('filters by memory type', () => {
    storeMemory(instanceId, 'fact', 'Project deadline is March 15');
    storeMemory(instanceId, 'preference', 'I prefer concise summaries about projects');

    const results = recallMemories(instanceId, 'project', {
      types: ['fact'],
    });

    for (const r of results) {
      expect(r.memory_type).toBe('fact');
    }
  });

  it('respects limit', () => {
    for (let i = 0; i < 20; i++) {
      storeMemory(instanceId, 'fact', `Fact number ${i} about testing`);
    }

    const results = recallMemories(instanceId, 'testing', { limit: 5 });
    expect(results.length).toBeLessThanOrEqual(5);
  });

  it('increments access count on recall', () => {
    const mem = storeMemory(instanceId, 'fact', 'Important test data');
    expect(mem.access_count).toBe(0);

    recallMemories(instanceId, 'test data');

    const updated = getMemory(mem.memory_id);
    expect(updated!.access_count).toBeGreaterThan(0);
  });

  it('filters by minimum confidence', () => {
    storeMemory(instanceId, 'fact', 'High confidence fact about testing', { confidence: 0.9 });
    storeMemory(instanceId, 'fact', 'Low confidence fact about testing', { confidence: 0.3 });

    const results = recallMemories(instanceId, 'testing', { minConfidence: 0.5 });
    for (const r of results) {
      expect(r.confidence).toBeGreaterThanOrEqual(0.5);
    }
  });
});

// ===================================================================
// Memory types
// ===================================================================

describe('getMemoriesByType', () => {
  it('returns memories of a specific type', () => {
    storeMemory(instanceId, 'fact', 'A fact');
    storeMemory(instanceId, 'fact', 'Another fact');
    storeMemory(instanceId, 'preference', 'A preference');

    const facts = getMemoriesByType(instanceId, 'fact');
    expect(facts).toHaveLength(2);
    for (const f of facts) {
      expect(f.memory_type).toBe('fact');
    }
  });

  it('respects limit', () => {
    for (let i = 0; i < 10; i++) {
      storeMemory(instanceId, 'fact', `Fact ${i}`);
    }

    const facts = getMemoriesByType(instanceId, 'fact', 3);
    expect(facts).toHaveLength(3);
  });
});

// ===================================================================
// Memory extraction
// ===================================================================

describe('extractMemories', () => {
  it('extracts preferences from "I prefer..." statements', () => {
    const memories = extractMemories(
      'I prefer bullet points over long paragraphs when reading reports.',
      'Noted, I will format responses with bullet points.',
    );

    expect(memories.length).toBeGreaterThan(0);
    const prefs = memories.filter((m) => m.type === 'preference');
    expect(prefs.length).toBeGreaterThan(0);
  });

  it('extracts relationships from "my team..." statements', () => {
    const memories = extractMemories(
      'My team includes Sarah, John, and Maria.',
      'Got it, your team has three members.',
    );

    expect(memories.length).toBeGreaterThan(0);
    const rels = memories.filter((m) => m.type === 'relationship');
    expect(rels.length).toBeGreaterThan(0);
  });

  it('extracts decisions from "we decided..." statements', () => {
    const memories = extractMemories(
      'We decided to postpone the launch to Q3.',
      'Understood, the launch is now scheduled for Q3.',
    );

    expect(memories.length).toBeGreaterThan(0);
    const decisions = memories.filter((m) => m.type === 'decision');
    expect(decisions.length).toBeGreaterThan(0);
  });

  it('extracts facts from "remember that..." statements', () => {
    const memories = extractMemories(
      'Remember that the budget is capped at 50K.',
      'I will keep in mind the 50K budget cap.',
    );

    expect(memories.length).toBeGreaterThan(0);
    const facts = memories.filter((m) => m.type === 'fact');
    expect(facts.length).toBeGreaterThan(0);
  });

  it('extracts explicit "Remember: <content>" directives', () => {
    const memories = extractMemories(
      'Remember: The office closes at 6pm on Fridays.',
      'Got it, I will remember that.',
    );

    expect(memories.length).toBeGreaterThan(0);
    const explicit = memories.find(
      (m) => m.type === 'fact' && m.confidence === 1.0,
    );
    expect(explicit).toBeDefined();
    expect(explicit!.content).toContain('The office closes at 6pm on Fridays');
  });

  it('returns empty array for messages with no extractable content', () => {
    const memories = extractMemories(
      'Hello, how are you?',
      'I am doing well, thank you!',
    );

    expect(memories).toHaveLength(0);
  });

  it('does not duplicate extractions for the same content', () => {
    const memories = extractMemories(
      'I prefer and I always like concise formats.',
      'Noted.',
    );

    // Should not have two preference memories with the same content
    const contents = memories.map((m) => m.content.toLowerCase());
    const unique = new Set(contents);
    expect(unique.size).toBe(contents.length);
  });
});

// ===================================================================
// Soft delete (forget)
// ===================================================================

describe('forgetMemory', () => {
  it('soft deletes a single memory', () => {
    const mem = storeMemory(instanceId, 'fact', 'Delete me');

    forgetMemory(mem.memory_id);

    const deleted = getMemory(mem.memory_id);
    expect(deleted!.is_deleted).toBe(1);

    // Should not appear in normal queries
    const results = getMemoriesByType(instanceId, 'fact');
    expect(results).toHaveLength(0);
  });
});

describe('forgetAllForUser', () => {
  it('soft deletes all memories for a user instance', () => {
    storeMemory(instanceId, 'fact', 'Fact 1');
    storeMemory(instanceId, 'preference', 'Pref 1');
    storeMemory(instanceId, 'relationship', 'Rel 1');

    forgetAllForUser(instanceId);

    const stats = getMemoryStatsForUser(instanceId);
    expect(stats.total).toBe(0);
  });
});

// ===================================================================
// Expired memory pruning
// ===================================================================

describe('pruneExpiredMemories', () => {
  it('removes memories with expired TTL', () => {
    // Store a memory with an already-past expiration
    storeMemory(instanceId, 'fact', 'Temporary fact', {
      expiresAt: '2020-01-01T00:00:00Z',
    });
    storeMemory(instanceId, 'fact', 'Permanent fact');

    const pruned = pruneExpiredMemories();
    expect(pruned).toBe(1);

    // Only the permanent memory should remain
    const remaining = getMemoriesByType(instanceId, 'fact');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].content).toBe('Permanent fact');
  });

  it('does not remove non-expired memories', () => {
    storeMemory(instanceId, 'fact', 'Future expiry', {
      expiresAt: '2099-01-01T00:00:00Z',
    });

    const pruned = pruneExpiredMemories();
    expect(pruned).toBe(0);

    const remaining = getMemoriesByType(instanceId, 'fact');
    expect(remaining).toHaveLength(1);
  });
});

// ===================================================================
// Memory stats
// ===================================================================

describe('getMemoryStatsForUser', () => {
  it('returns correct counts by type', () => {
    storeMemory(instanceId, 'fact', 'F1');
    storeMemory(instanceId, 'fact', 'F2');
    storeMemory(instanceId, 'preference', 'P1');

    const stats = getMemoryStatsForUser(instanceId);
    expect(stats.total).toBe(3);
    expect(stats.by_type.fact).toBe(2);
    expect(stats.by_type.preference).toBe(1);
  });

  it('excludes soft-deleted memories', () => {
    const mem = storeMemory(instanceId, 'fact', 'Will be deleted');
    storeMemory(instanceId, 'fact', 'Still here');
    forgetMemory(mem.memory_id);

    const stats = getMemoryStatsForUser(instanceId);
    expect(stats.total).toBe(1);
  });

  it('returns null oldest/newest when no memories', () => {
    const stats = getMemoryStatsForUser(instanceId);
    expect(stats.total).toBe(0);
    expect(stats.oldest).toBeNull();
    expect(stats.newest).toBeNull();
  });

  it('returns oldest and newest timestamps', () => {
    storeMemory(instanceId, 'fact', 'First');
    storeMemory(instanceId, 'fact', 'Last');

    const stats = getMemoryStatsForUser(instanceId);
    expect(stats.oldest).toBeTruthy();
    expect(stats.newest).toBeTruthy();
  });
});

// ===================================================================
// Update memory
// ===================================================================

describe('updateMemory', () => {
  it('updates memory content', () => {
    const mem = storeMemory(instanceId, 'fact', 'Original content');
    updateMemory(mem.memory_id, { content: 'Updated content' });

    const updated = getMemory(mem.memory_id);
    expect(updated!.content).toBe('Updated content');
  });

  it('updates memory confidence', () => {
    const mem = storeMemory(instanceId, 'fact', 'Some fact', { confidence: 0.5 });
    updateMemory(mem.memory_id, { confidence: 0.9 });

    const updated = getMemory(mem.memory_id);
    expect(updated!.confidence).toBeCloseTo(0.9);
  });
});

// ===================================================================
// buildMemoryPrompt
// ===================================================================

describe('buildMemoryPrompt', () => {
  it('returns empty string when no memories', () => {
    const prompt = buildMemoryPrompt(instanceId);
    expect(prompt).toBe('');
  });

  it('includes relevant memories in the prompt', () => {
    storeMemory(instanceId, 'preference', 'User prefers bullet points');
    storeMemory(instanceId, 'relationship', 'Alice works with Bob');
    storeMemory(instanceId, 'fact', 'Project deadline is March 15');

    const prompt = buildMemoryPrompt(instanceId);

    expect(prompt).toContain('Personal Memory');
    expect(prompt).toContain('User prefers bullet points');
    expect(prompt).toContain('Alice works with Bob');
    expect(prompt).toContain('Project deadline is March 15');
  });

  it('includes query-relevant memories', () => {
    storeMemory(instanceId, 'decision', 'We decided to use TypeScript for the project');
    storeMemory(instanceId, 'fact', 'The weather is sunny');

    const prompt = buildMemoryPrompt(instanceId, 'TypeScript project');

    expect(prompt).toContain('Personal Memory');
    // The TypeScript memory should be included due to query relevance
    expect(prompt).toContain('TypeScript');
  });
});

// ===================================================================
// extractKeywords
// ===================================================================

describe('extractKeywords', () => {
  it('extracts meaningful keywords from a query', () => {
    const keywords = extractKeywords('What is the quarterly sales report?');
    expect(keywords).toContain('quarterly');
    expect(keywords).toContain('sales');
    expect(keywords).toContain('report');
    // Stop words should be filtered out
    expect(keywords).not.toContain('the');
    expect(keywords).not.toContain('is');
    expect(keywords).not.toContain('what');
  });

  it('filters short words (< 3 chars)', () => {
    const keywords = extractKeywords('go to AI lab');
    expect(keywords).not.toContain('go');
    expect(keywords).not.toContain('to');
    expect(keywords).toContain('lab');
  });

  it('returns empty array for stop-words-only query', () => {
    const keywords = extractKeywords('the is a an');
    expect(keywords).toHaveLength(0);
  });
});
