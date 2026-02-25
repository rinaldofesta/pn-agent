/**
 * Retention Manager — Manages data retention policies and automated cleanup.
 *
 * Each organization can define retention policies for different data categories.
 * The enforcement function runs cleanup for all orgs, deleting records older
 * than the configured retention period.
 *
 * Data categories:
 * - personal_memory: User memory entries (user_memories table)
 * - session_history: Conversation sessions and messages (pn_sessions, session_messages)
 * - pattern_logs: Anonymized pattern records (pattern_logs table)
 * - audit_logs: Audit trail entries (audit_logs table)
 * - channel_bindings: Channel binding records (channel_bindings table)
 *
 * See: docs/specs/security/gdpr-compliance-spec.md
 * See: docs/specs/security/audit-logging-spec.md (retention section)
 */

import { logger } from '../logger.js';
import {
  upsertRetentionPolicy,
  getRetentionPolicy as getRetentionPolicyDb,
  listRetentionPolicies,
  logAudit,
  listOrgs,
  deleteOldPatternLogs,
  deleteOldAuditLogs,
  deleteOldUserMemories,
  deleteOldSessions,
  deleteOldChannelBindings,
  countDataByCategory,
} from './db.js';
import type { RetentionPolicyRow } from './db.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DataCategory =
  | 'personal_memory'
  | 'session_history'
  | 'pattern_logs'
  | 'audit_logs'
  | 'channel_bindings';

const VALID_DATA_CATEGORIES: ReadonlySet<string> = new Set<DataCategory>([
  'personal_memory',
  'session_history',
  'pattern_logs',
  'audit_logs',
  'channel_bindings',
]);

export interface RetentionEnforcementResult {
  org_id: string;
  category: string;
  records_deleted: number;
  cutoff_date: string;
}

export interface RetentionReport {
  org_id: string;
  categories: Array<{
    category: string;
    policy: RetentionPolicyRow | null;
    total_records: number;
    oldest_record: string | null;
    retention_days: number | null;
    auto_delete: boolean | null;
  }>;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateDataCategory(category: string): asserts category is DataCategory {
  if (!VALID_DATA_CATEGORIES.has(category)) {
    throw new Error(
      `Invalid data category '${category}'. Valid categories: ${[...VALID_DATA_CATEGORIES].join(', ')}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Policy Management
// ---------------------------------------------------------------------------

/**
 * Set or update a retention policy for an organization and data category.
 * If a policy already exists for this org+category, it will be updated.
 *
 * @param orgId - Organization ID
 * @param dataCategory - Data category to set policy for
 * @param retentionDays - Number of days to retain data (0 = indefinite)
 * @param autoDelete - Whether to auto-delete after retention period (default: true)
 */
export function setRetentionPolicy(
  orgId: string,
  dataCategory: DataCategory,
  retentionDays: number,
  autoDelete: boolean = true,
): RetentionPolicyRow {
  validateDataCategory(dataCategory);

  if (retentionDays < 0) {
    throw new Error('retention_days must be >= 0 (0 means indefinite)');
  }

  const policy = upsertRetentionPolicy({
    org_id: orgId,
    data_category: dataCategory,
    retention_days: retentionDays,
    auto_delete: autoDelete ? 1 : 0,
  });

  logger.info(
    { orgId, dataCategory, retentionDays, autoDelete },
    'Retention policy set',
  );

  return policy;
}

/**
 * Get the retention policy for a specific org and data category.
 * Returns undefined if no policy is set.
 */
export function getRetentionPolicy(
  orgId: string,
  dataCategory: DataCategory,
): RetentionPolicyRow | undefined {
  validateDataCategory(dataCategory);
  return getRetentionPolicyDb(orgId, dataCategory);
}

/**
 * Get all retention policies for an organization.
 */
export function getOrgPolicies(orgId: string): RetentionPolicyRow[] {
  return listRetentionPolicies(orgId);
}

// ---------------------------------------------------------------------------
// Enforcement
// ---------------------------------------------------------------------------

/**
 * Compute the cutoff date given a retention period in days from now.
 */
function computeCutoffDate(retentionDays: number): string {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  return cutoff.toISOString();
}

/**
 * Delete records older than the cutoff date for a specific org and category.
 */
function deleteOldRecords(
  orgId: string,
  category: DataCategory,
  cutoffDate: string,
): number {
  switch (category) {
    case 'personal_memory':
      return deleteOldUserMemories(orgId, cutoffDate);
    case 'session_history':
      return deleteOldSessions(orgId, cutoffDate);
    case 'pattern_logs':
      return deleteOldPatternLogs(orgId, cutoffDate);
    case 'audit_logs':
      return deleteOldAuditLogs(orgId, cutoffDate);
    case 'channel_bindings':
      return deleteOldChannelBindings(orgId, cutoffDate);
    default:
      return 0;
  }
}

/**
 * Enforce retention policies for all organizations.
 * For each policy where auto_delete=1 and retention_days > 0:
 *   - Delete records older than retention_days
 *   - Log deletions in audit_logs
 *   - Return summary of what was cleaned up
 *
 * Policies with retention_days=0 (indefinite) or auto_delete=0 are skipped.
 */
export function enforceRetentionPolicies(): RetentionEnforcementResult[] {
  const results: RetentionEnforcementResult[] = [];
  const orgs = listOrgs();

  for (const org of orgs) {
    const policies = listRetentionPolicies(org.org_id);

    for (const policy of policies) {
      // Skip policies that don't auto-delete or have indefinite retention
      if (policy.auto_delete !== 1 || policy.retention_days <= 0) {
        continue;
      }

      const cutoffDate = computeCutoffDate(policy.retention_days);
      const category = policy.data_category as DataCategory;
      const deletedCount = deleteOldRecords(org.org_id, category, cutoffDate);

      if (deletedCount > 0) {
        results.push({
          org_id: org.org_id,
          category: policy.data_category,
          records_deleted: deletedCount,
          cutoff_date: cutoffDate,
        });

        logAudit({
          org_id: org.org_id,
          action: 'retention_enforced',
          target: `retention:${policy.data_category}`,
          details: {
            data_category: policy.data_category,
            retention_days: policy.retention_days,
            records_deleted: deletedCount,
            cutoff_date: cutoffDate,
          },
        });

        logger.info(
          {
            orgId: org.org_id,
            category: policy.data_category,
            deletedCount,
            cutoffDate,
          },
          'Retention enforced',
        );
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

/**
 * Generate a retention report for an organization.
 * Shows what data exists and what's approaching expiry for each category.
 */
export function getRetentionReport(orgId: string): RetentionReport {
  const allCategories: DataCategory[] = [
    'personal_memory',
    'session_history',
    'pattern_logs',
    'audit_logs',
    'channel_bindings',
  ];

  const categories = allCategories.map((category) => {
    const policy = getRetentionPolicyDb(orgId, category) ?? null;
    const { total, oldest } = countDataByCategory(orgId, category);

    return {
      category,
      policy,
      total_records: total,
      oldest_record: oldest,
      retention_days: policy ? policy.retention_days : null,
      auto_delete: policy ? policy.auto_delete === 1 : null,
    };
  });

  return {
    org_id: orgId,
    categories,
  };
}
