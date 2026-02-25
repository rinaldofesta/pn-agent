import { describe, it, expect, beforeEach } from 'vitest';

import {
  _initPlayNewTestDatabase,
  _getTestDatabase,
  createOrg,
  createTeam,
  createUserInstance,
  insertPattern,
  logAudit,
  getOrgAuditLog,
} from './db.js';

import {
  setRetentionPolicy,
  getRetentionPolicy,
  getOrgPolicies,
  enforceRetentionPolicies,
  getRetentionReport,
} from './retention-manager.js';

// ---------------------------------------------------------------------------
// Fresh database before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  _initPlayNewTestDatabase();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestOrg(name = 'Acme Corp') {
  return createOrg({
    name,
    industry: 'tech',
    size_band: '200-500',
    geo: 'EU_south',
  });
}

function createTestTeam(orgId: string) {
  return createTeam({
    org_id: orgId,
    name: 'Engineering',
    function: 'engineering',
  });
}

function createTestInstance(orgId: string, teamId: string, userId = 'user-1') {
  return createUserInstance({
    user_id: userId,
    org_id: orgId,
    team_id: teamId,
    role_category: 'engineer',
    encryption_key_ref: 'key-ref-001',
    folder: `users/${userId}`,
  });
}

// ===================================================================
// Set Retention Policy
// ===================================================================

describe('setRetentionPolicy', () => {
  it('creates a retention policy', () => {
    const org = createTestOrg();

    const policy = setRetentionPolicy(org.org_id, 'pattern_logs', 90);

    expect(policy.org_id).toBe(org.org_id);
    expect(policy.data_category).toBe('pattern_logs');
    expect(policy.retention_days).toBe(90);
    expect(policy.auto_delete).toBe(1);
    expect(policy.policy_id).toBeTruthy();
  });

  it('creates a policy with auto_delete=false', () => {
    const org = createTestOrg();

    const policy = setRetentionPolicy(org.org_id, 'audit_logs', 365, false);

    expect(policy.retention_days).toBe(365);
    expect(policy.auto_delete).toBe(0);
  });

  it('rejects negative retention_days', () => {
    const org = createTestOrg();

    expect(() => setRetentionPolicy(org.org_id, 'pattern_logs', -1)).toThrow(
      'retention_days must be >= 0',
    );
  });

  it('rejects invalid data category', () => {
    const org = createTestOrg();

    expect(() => setRetentionPolicy(org.org_id, 'invalid' as any, 90)).toThrow(
      'Invalid data category',
    );
  });

  it('allows retention_days=0 (indefinite)', () => {
    const org = createTestOrg();

    const policy = setRetentionPolicy(org.org_id, 'pattern_logs', 0);
    expect(policy.retention_days).toBe(0);
  });
});

// ===================================================================
// Get Retention Policy
// ===================================================================

describe('getRetentionPolicy', () => {
  it('retrieves a set policy', () => {
    const org = createTestOrg();
    setRetentionPolicy(org.org_id, 'pattern_logs', 90);

    const policy = getRetentionPolicy(org.org_id, 'pattern_logs');

    expect(policy).toBeDefined();
    expect(policy!.retention_days).toBe(90);
  });

  it('returns undefined when no policy exists', () => {
    const org = createTestOrg();

    const policy = getRetentionPolicy(org.org_id, 'pattern_logs');

    expect(policy).toBeUndefined();
  });
});

// ===================================================================
// Update Existing Policy
// ===================================================================

describe('update existing policy', () => {
  it('updates retention_days for existing policy', () => {
    const org = createTestOrg();

    setRetentionPolicy(org.org_id, 'pattern_logs', 90);
    const updated = setRetentionPolicy(org.org_id, 'pattern_logs', 180);

    expect(updated.retention_days).toBe(180);

    // Should still be only one policy
    const policies = getOrgPolicies(org.org_id);
    const patternPolicies = policies.filter(p => p.data_category === 'pattern_logs');
    expect(patternPolicies).toHaveLength(1);
    expect(patternPolicies[0].retention_days).toBe(180);
  });

  it('updates auto_delete flag', () => {
    const org = createTestOrg();

    setRetentionPolicy(org.org_id, 'audit_logs', 365, true);
    const updated = setRetentionPolicy(org.org_id, 'audit_logs', 365, false);

    expect(updated.auto_delete).toBe(0);
  });
});

// ===================================================================
// Get Org Policies
// ===================================================================

describe('getOrgPolicies', () => {
  it('returns all policies for an org', () => {
    const org = createTestOrg();

    setRetentionPolicy(org.org_id, 'pattern_logs', 90);
    setRetentionPolicy(org.org_id, 'audit_logs', 365);
    setRetentionPolicy(org.org_id, 'session_history', 30);

    const policies = getOrgPolicies(org.org_id);
    expect(policies).toHaveLength(3);
  });

  it('returns empty array when no policies set', () => {
    const org = createTestOrg();
    expect(getOrgPolicies(org.org_id)).toHaveLength(0);
  });
});

// ===================================================================
// Enforce Retention Policies
// ===================================================================

describe('enforceRetentionPolicies', () => {
  it('deletes old pattern logs', () => {
    const org = createTestOrg();
    const db = _getTestDatabase();

    // Insert old pattern logs (60 days ago)
    const oldTimestamp = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    insertPattern({
      user_id_hash: 'hash-1',
      org_id: org.org_id,
      team_id: 'team-1',
      pattern_type: 'time_allocation',
      category_l1: 'Communication',
      metric_type: 'count',
      metric_value: 10,
      timestamp: oldTimestamp,
      period: '2025-W01',
    });

    // Insert recent pattern logs (today)
    insertPattern({
      user_id_hash: 'hash-2',
      org_id: org.org_id,
      team_id: 'team-1',
      pattern_type: 'time_allocation',
      category_l1: 'Communication',
      metric_type: 'count',
      metric_value: 10,
      timestamp: new Date().toISOString(),
      period: '2026-W08',
    });

    // Set 30-day retention policy
    setRetentionPolicy(org.org_id, 'pattern_logs', 30);

    const results = enforceRetentionPolicies();

    expect(results).toHaveLength(1);
    expect(results[0].org_id).toBe(org.org_id);
    expect(results[0].category).toBe('pattern_logs');
    expect(results[0].records_deleted).toBe(1);

    // Verify only recent pattern remains
    const remaining = db
      .prepare('SELECT COUNT(*) as cnt FROM pattern_logs WHERE org_id = ?')
      .get(org.org_id) as { cnt: number };
    expect(remaining.cnt).toBe(1);
  });

  it('skips policies with auto_delete=0', () => {
    const org = createTestOrg();

    // Insert old pattern log
    const oldTimestamp = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    insertPattern({
      user_id_hash: 'hash-1',
      org_id: org.org_id,
      team_id: 'team-1',
      pattern_type: 'time_allocation',
      category_l1: 'Communication',
      metric_type: 'count',
      metric_value: 10,
      timestamp: oldTimestamp,
      period: '2025-W01',
    });

    // Set policy with auto_delete=false
    setRetentionPolicy(org.org_id, 'pattern_logs', 30, false);

    const results = enforceRetentionPolicies();

    expect(results).toHaveLength(0);

    // Data should still be there
    const remaining = _getTestDatabase()
      .prepare('SELECT COUNT(*) as cnt FROM pattern_logs WHERE org_id = ?')
      .get(org.org_id) as { cnt: number };
    expect(remaining.cnt).toBe(1);
  });

  it('skips policies with retention_days=0 (indefinite)', () => {
    const org = createTestOrg();

    const oldTimestamp = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    insertPattern({
      user_id_hash: 'hash-1',
      org_id: org.org_id,
      team_id: 'team-1',
      pattern_type: 'time_allocation',
      category_l1: 'Communication',
      metric_type: 'count',
      metric_value: 10,
      timestamp: oldTimestamp,
      period: '2025-W01',
    });

    setRetentionPolicy(org.org_id, 'pattern_logs', 0);

    const results = enforceRetentionPolicies();
    expect(results).toHaveLength(0);
  });

  it('logs retention enforcement in audit_logs', () => {
    const org = createTestOrg();

    const oldTimestamp = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    insertPattern({
      user_id_hash: 'hash-1',
      org_id: org.org_id,
      team_id: 'team-1',
      pattern_type: 'time_allocation',
      category_l1: 'Communication',
      metric_type: 'count',
      metric_value: 10,
      timestamp: oldTimestamp,
      period: '2025-W01',
    });

    setRetentionPolicy(org.org_id, 'pattern_logs', 30);
    enforceRetentionPolicies();

    const auditLogs = getOrgAuditLog(org.org_id);
    const retentionLog = auditLogs.find(l => l.action === 'retention_enforced');
    expect(retentionLog).toBeDefined();
    const details = JSON.parse(retentionLog!.details);
    expect(details.data_category).toBe('pattern_logs');
    expect(details.records_deleted).toBe(1);
  });

  it('deletes old audit logs', () => {
    const org = createTestOrg();
    const db = _getTestDatabase();

    // Insert an old audit log by directly manipulating the DB
    db.prepare(
      `INSERT INTO audit_logs (log_id, org_id, user_id, action, target, details, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'old-log-1',
      org.org_id,
      'user-1',
      'user.login',
      'session',
      '{}',
      new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString(),
    );

    setRetentionPolicy(org.org_id, 'audit_logs', 365);

    const results = enforceRetentionPolicies();
    const auditResult = results.find(r => r.category === 'audit_logs');
    expect(auditResult).toBeDefined();
    expect(auditResult!.records_deleted).toBe(1);
  });
});

// ===================================================================
// Multiple Org Policies Don't Interfere
// ===================================================================

describe('multi-org isolation', () => {
  it('policies from different orgs do not interfere', () => {
    const org1 = createTestOrg('Org One');
    const org2 = createTestOrg('Org Two');

    // Set different policies for each org
    setRetentionPolicy(org1.org_id, 'pattern_logs', 30);
    setRetentionPolicy(org2.org_id, 'pattern_logs', 365);

    // Insert old data for org1 (60 days old)
    const oldTimestamp = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    insertPattern({
      user_id_hash: 'hash-1',
      org_id: org1.org_id,
      team_id: 'team-1',
      pattern_type: 'time_allocation',
      category_l1: 'Communication',
      metric_type: 'count',
      metric_value: 10,
      timestamp: oldTimestamp,
      period: '2025-W50',
    });

    // Insert old data for org2 (same age)
    insertPattern({
      user_id_hash: 'hash-2',
      org_id: org2.org_id,
      team_id: 'team-2',
      pattern_type: 'time_allocation',
      category_l1: 'Communication',
      metric_type: 'count',
      metric_value: 10,
      timestamp: oldTimestamp,
      period: '2025-W50',
    });

    const results = enforceRetentionPolicies();

    // Only org1 should have data deleted (30-day policy, data is 60 days old)
    // org2 has 365-day policy so 60-day-old data is within retention
    const org1Result = results.find(r => r.org_id === org1.org_id);
    const org2Result = results.find(r => r.org_id === org2.org_id);

    expect(org1Result).toBeDefined();
    expect(org1Result!.records_deleted).toBe(1);
    expect(org2Result).toBeUndefined();

    // Verify org2 data is still there
    const db = _getTestDatabase();
    const org2Patterns = db
      .prepare('SELECT COUNT(*) as cnt FROM pattern_logs WHERE org_id = ?')
      .get(org2.org_id) as { cnt: number };
    expect(org2Patterns.cnt).toBe(1);
  });
});

// ===================================================================
// Retention Report
// ===================================================================

describe('getRetentionReport', () => {
  it('shows correct counts for each category', () => {
    const org = createTestOrg();

    // Insert some pattern logs
    insertPattern({
      user_id_hash: 'hash-1',
      org_id: org.org_id,
      team_id: 'team-1',
      pattern_type: 'time_allocation',
      category_l1: 'Communication',
      metric_type: 'count',
      metric_value: 10,
      timestamp: new Date().toISOString(),
      period: '2026-W08',
    });
    insertPattern({
      user_id_hash: 'hash-2',
      org_id: org.org_id,
      team_id: 'team-1',
      pattern_type: 'time_allocation',
      category_l1: 'Analysis',
      metric_type: 'count',
      metric_value: 20,
      timestamp: new Date().toISOString(),
      period: '2026-W08',
    });

    // Set a retention policy
    setRetentionPolicy(org.org_id, 'pattern_logs', 90);

    const report = getRetentionReport(org.org_id);

    expect(report.org_id).toBe(org.org_id);
    expect(report.categories).toHaveLength(5); // All categories

    const patternCategory = report.categories.find(c => c.category === 'pattern_logs');
    expect(patternCategory).toBeDefined();
    expect(patternCategory!.total_records).toBe(2);
    expect(patternCategory!.retention_days).toBe(90);
    expect(patternCategory!.auto_delete).toBe(true);

    // Categories without policies should have null policy
    const memoryCategory = report.categories.find(c => c.category === 'personal_memory');
    expect(memoryCategory).toBeDefined();
    expect(memoryCategory!.policy).toBeNull();
    expect(memoryCategory!.retention_days).toBeNull();
  });

  it('shows zero counts for empty categories', () => {
    const org = createTestOrg();

    const report = getRetentionReport(org.org_id);

    for (const category of report.categories) {
      expect(category.total_records).toBe(0);
    }
  });
});
