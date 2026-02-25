/**
 * Pattern Collector — Categorical logging for organizational intelligence.
 *
 * Collects anonymized, categorical metadata about user interactions.
 * NEVER stores content — only categories, types, and metrics.
 *
 * This feeds the anonymization boundary (PostgreSQL views with
 * min 5-user threshold) which advisors query for intelligence briefs.
 *
 * See: docs/specs/intelligence/pattern-collection-spec.md
 * See: PRD Section FR-005
 */

import type { PatternRecord, PatternType, MetricType } from './types.js';
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';

/**
 * Interaction categories from the Work Category Taxonomy.
 * L1 categories — see docs/specs/intelligence/cross-org-schema-spec.md for full L2/L3.
 */
export const CATEGORY_L1 = [
  'communication',
  'analysis',
  'creation',
  'coordination',
  'strategy',
] as const;

/**
 * Tool generalization mapping.
 * Specific tools → generic categories (privacy: never store specific tool names).
 */
const TOOL_GENERALIZATION: Record<string, string> = {
  // Spreadsheet tools
  excel: 'spreadsheet_tools',
  'google sheets': 'spreadsheet_tools',
  sheets: 'spreadsheet_tools',
  // CRM
  salesforce: 'crm',
  hubspot: 'crm',
  pipedrive: 'crm',
  // Communication
  slack: 'communication',
  teams: 'communication',
  email: 'communication',
  gmail: 'communication',
  outlook: 'communication',
  // Project management
  jira: 'project_management',
  asana: 'project_management',
  linear: 'project_management',
  trello: 'project_management',
  // Document tools
  'google docs': 'document_tools',
  word: 'document_tools',
  notion: 'document_tools',
  confluence: 'document_tools',
  // Calendar
  'google calendar': 'calendar',
  'outlook calendar': 'calendar',
  // Design
  figma: 'design_tools',
  canva: 'design_tools',
  // Analytics
  'google analytics': 'analytics',
  tableau: 'analytics',
  'power bi': 'analytics',
};

/**
 * Hash a user ID for pattern storage.
 * Pattern logs store hashed user IDs — never plaintext.
 */
export function hashUserId(userId: string, salt: string): string {
  return createHash('sha256').update(`${userId}:${salt}`).digest('hex').slice(0, 16);
}

/**
 * Generalize a specific tool name to its category.
 */
export function generalizeTool(toolName: string): string {
  const normalized = toolName.toLowerCase().trim();
  return TOOL_GENERALIZATION[normalized] ?? 'other';
}

/**
 * Get the current ISO week string for temporal blurring.
 * Patterns are stored at weekly granularity, never daily.
 */
export function getCurrentPeriod(): string {
  const now = new Date();
  const year = now.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86400000);
  const week = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/**
 * Build a pattern record from an interaction.
 * Call this after each user interaction to emit categorical metadata.
 */
export function buildPatternRecord(params: {
  userId: string;
  orgId: string;
  teamId: string;
  patternType: PatternType;
  categoryL1: string;
  categoryL2: string;
  categoryL3: string;
  metricType: MetricType;
  metricValue: number;
  toolsInvolved: string[];
  userIdSalt: string;
}): PatternRecord {
  return {
    pattern_id: randomUUID(),
    user_id: hashUserId(params.userId, params.userIdSalt),
    org_id: params.orgId,
    team_id: params.teamId,
    pattern_type: params.patternType,
    category_L1: params.categoryL1,
    category_L2: params.categoryL2,
    category_L3: params.categoryL3,
    metric_type: params.metricType,
    metric_value: params.metricValue,
    tools_involved: params.toolsInvolved.map(generalizeTool),
    timestamp: new Date().toISOString(),
    period: getCurrentPeriod(),
  };
}

/**
 * Placeholder: persist a pattern record to the database.
 * Will write to the pattern_logs table.
 */
export async function emitPattern(_record: PatternRecord): Promise<void> {
  // TODO: Insert into pattern_logs table
  // See docs/specs/data/database-schema.md for schema
}
