import { describe, it, expect, beforeEach } from 'vitest';

import {
  _initPlayNewTestDatabase,
  _getTestDatabase,
  createOrg,
  createTeam,
  createUserInstance,
  createBinding,
  assignSkill,
  createSkill,
  insertPattern,
  getUserInstance,
  getOrgAuditLog,
  getUserAuditLog,
  getUserSkills,
  listBindingsByInstance,
  logAudit,
  createInsight,
  createContextDoc,
  listInsightsByOrg,
  listContextDocsByOrg,
} from './db.js';

import {
  exportUserData,
  deleteUserData,
  rectifyUserData,
  restrictProcessing,
  exportPortableData,
  objectToProcessing,
  createRequest,
  getRequest,
  listRequestsByInstance,
  listRequestsByOrg,
  listRequestsByStatus,
} from './gdpr-service.js';

import { grantConsent, hasConsent } from './consent-manager.js';
import { hashUserId } from './pattern-collector.js';

// ---------------------------------------------------------------------------
// Fresh database before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  _initPlayNewTestDatabase();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestOrg() {
  return createOrg({
    name: 'Acme Corp',
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

function setupFullUser() {
  const org = createTestOrg();
  const team = createTestTeam(org.org_id);
  const inst = createTestInstance(org.org_id, team.team_id);

  // Add channel binding
  createBinding({
    channel_type: 'slack',
    channel_org_id: 'T12345',
    channel_user_id: 'U67890',
    org_id: org.org_id,
    instance_id: inst.instance_id,
  });

  // Add skill
  const skill = createSkill({
    name: 'test-skill',
    category: 'analysis',
    content: '# Test Skill',
  });
  assignSkill({
    user_id: inst.user_id,
    skill_id: skill.skill_id,
    assigned_by: 'advisor',
  });

  // Add pattern logs (using the same hash the GDPR service will compute)
  const userIdHash = hashUserId(inst.user_id, org.org_id);
  insertPattern({
    user_id_hash: userIdHash,
    org_id: org.org_id,
    team_id: team.team_id,
    pattern_type: 'time_allocation',
    category_l1: 'Communication',
    metric_type: 'duration',
    metric_value: 3600,
    timestamp: '2026-02-20T09:00:00Z',
    period: '2026-W08',
  });

  // Add audit log entries
  logAudit({
    org_id: org.org_id,
    user_id: inst.instance_id,
    action: 'user.login',
    target: 'session',
  });

  // Add memories
  const db = _getTestDatabase();
  db.prepare(
    `INSERT INTO user_memories (memory_id, instance_id, memory_type, content, created_at, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
  ).run('mem-1', inst.instance_id, 'fact', 'User prefers morning meetings');

  // Add sessions
  db.prepare(
    `INSERT INTO pn_sessions (session_id, instance_id, channel_type, started_at, last_activity_at, message_count)
     VALUES (?, ?, ?, datetime('now'), datetime('now'), ?)`,
  ).run('sess-1', inst.instance_id, 'slack', 5);

  // Add consent
  grantConsent(inst.instance_id, org.org_id, 'data_processing');

  return { org, team, inst, skill };
}

// ===================================================================
// GDPR Request Lifecycle
// ===================================================================

describe('GDPR request lifecycle', () => {
  it('creates a GDPR request', () => {
    const org = createTestOrg();
    const team = createTestTeam(org.org_id);
    const inst = createTestInstance(org.org_id, team.team_id);

    const request = createRequest({
      instanceId: inst.instance_id,
      orgId: org.org_id,
      requestType: 'export',
      requestedBy: inst.instance_id,
    });

    expect(request.request_id).toBeTruthy();
    expect(request.instance_id).toBe(inst.instance_id);
    expect(request.org_id).toBe(org.org_id);
    expect(request.request_type).toBe('export');
    expect(request.status).toBe('pending');
    expect(request.requested_by).toBe(inst.instance_id);
    expect(request.data_scope).toBe('all');
  });

  it('retrieves a GDPR request by ID', () => {
    const org = createTestOrg();
    const team = createTestTeam(org.org_id);
    const inst = createTestInstance(org.org_id, team.team_id);

    const created = createRequest({
      instanceId: inst.instance_id,
      orgId: org.org_id,
      requestType: 'delete',
      requestedBy: 'dpo@acme.com',
      dataScope: 'memories',
    });

    const fetched = getRequest(created.request_id);
    expect(fetched).toBeDefined();
    expect(fetched!.request_type).toBe('delete');
    expect(fetched!.data_scope).toBe('memories');
  });

  it('lists requests by instance', () => {
    const org = createTestOrg();
    const team = createTestTeam(org.org_id);
    const inst = createTestInstance(org.org_id, team.team_id);

    createRequest({ instanceId: inst.instance_id, orgId: org.org_id, requestType: 'export', requestedBy: inst.instance_id });
    createRequest({ instanceId: inst.instance_id, orgId: org.org_id, requestType: 'delete', requestedBy: inst.instance_id });

    const requests = listRequestsByInstance(inst.instance_id);
    expect(requests).toHaveLength(2);
  });

  it('lists requests by org', () => {
    const org = createTestOrg();
    const team = createTestTeam(org.org_id);
    const inst1 = createTestInstance(org.org_id, team.team_id, 'u1');
    const inst2 = createTestInstance(org.org_id, team.team_id, 'u2');

    createRequest({ instanceId: inst1.instance_id, orgId: org.org_id, requestType: 'export', requestedBy: inst1.instance_id });
    createRequest({ instanceId: inst2.instance_id, orgId: org.org_id, requestType: 'delete', requestedBy: inst2.instance_id });

    const requests = listRequestsByOrg(org.org_id);
    expect(requests).toHaveLength(2);
  });

  it('creates all request types', () => {
    const org = createTestOrg();
    const team = createTestTeam(org.org_id);
    const inst = createTestInstance(org.org_id, team.team_id);

    const types = ['export', 'delete', 'rectify', 'restrict', 'portability', 'object'] as const;
    for (const type of types) {
      const req = createRequest({ instanceId: inst.instance_id, orgId: org.org_id, requestType: type, requestedBy: inst.instance_id });
      expect(req.request_type).toBe(type);
    }
  });

  it('tracks request lifecycle: pending -> processing -> completed', () => {
    const { inst, org } = setupFullUser();

    // exportUserData internally creates a request and moves it through lifecycle
    const exportData = exportUserData(inst.instance_id);

    // The request should be completed
    const requests = listRequestsByInstance(inst.instance_id);
    const exportRequests = requests.filter(r => r.request_type === 'export');
    expect(exportRequests.length).toBeGreaterThanOrEqual(1);
    // The most recent export request should be completed
    expect(exportRequests[0].status).toBe('completed');
    expect(exportRequests[0].completed_at).toBeTruthy();
  });
});

// ===================================================================
// Right to Access (Article 15) — Data Export
// ===================================================================

describe('exportUserData', () => {
  it('exports all user data', () => {
    const { inst, org, team, skill } = setupFullUser();

    const data = exportUserData(inst.instance_id);

    expect(data.export_metadata.instance_id).toBe(inst.instance_id);
    expect(data.export_metadata.org_id).toBe(org.org_id);
    expect(data.export_metadata.format_version).toBe('1.0');
    expect(data.export_metadata.scope).toBe('all');

    // User instance record
    expect(data.user_instance).toBeDefined();
    expect(data.user_instance!.instance_id).toBe(inst.instance_id);

    // Channel bindings
    expect(data.channel_bindings).toHaveLength(1);

    // Skills
    expect(data.skills).toHaveLength(1);

    // Memories
    expect(data.memories).toHaveLength(1);

    // Sessions
    expect(data.sessions).toHaveLength(1);

    // Consents
    expect(data.consents.length).toBeGreaterThanOrEqual(1);
  });

  it('exports only specified scope', () => {
    const { inst } = setupFullUser();

    const memoriesOnly = exportUserData(inst.instance_id, 'memories');
    expect(memoriesOnly.memories).toHaveLength(1);
    expect(memoriesOnly.channel_bindings).toHaveLength(0);
    expect(memoriesOnly.skills).toHaveLength(0);
    expect(memoriesOnly.user_instance).toBeNull();
  });

  it('logs the export in audit_logs', () => {
    const { inst, org } = setupFullUser();

    exportUserData(inst.instance_id);

    const auditLogs = getUserAuditLog(org.org_id, inst.instance_id);
    const exportLog = auditLogs.find(l => l.action === 'gdpr_export');
    expect(exportLog).toBeDefined();
    expect(JSON.parse(exportLog!.details).scope).toBe('all');
  });

  it('includes data from all relevant tables', () => {
    const { inst, org } = setupFullUser();

    const data = exportUserData(inst.instance_id);

    // Verify all fields present
    expect(data).toHaveProperty('user_instance');
    expect(data).toHaveProperty('channel_bindings');
    expect(data).toHaveProperty('skills');
    expect(data).toHaveProperty('memories');
    expect(data).toHaveProperty('sessions');
    expect(data).toHaveProperty('pattern_logs');
    expect(data).toHaveProperty('audit_log');
    expect(data).toHaveProperty('consents');
  });

  it('throws for nonexistent instance', () => {
    expect(() => exportUserData('nonexistent')).toThrow('User instance not found');
  });
});

// ===================================================================
// Right to Erasure (Article 17) — Delete
// ===================================================================

describe('deleteUserData', () => {
  it('soft-deletes user instance and removes personal data', () => {
    const { inst, org } = setupFullUser();

    const result = deleteUserData(inst.instance_id);

    expect(result.request_id).toBeTruthy();
    expect(result.deleted.channel_bindings).toBe(1);
    expect(result.deleted.user_skills).toBe(1);
    expect(result.deleted.user_memories).toBe(1);
    expect(result.deleted.sessions).toBe(1);
    expect(result.deleted.user_instance).toBe(1);

    // Verify user instance is soft-deleted with redacted fields
    const instance = getUserInstance(inst.instance_id);
    expect(instance!.status).toBe('deleted');
    expect(instance!.user_id).toBe('[REDACTED]');
    expect(instance!.role_category).toBe('[REDACTED]');
    expect(instance!.encryption_key_ref).toBe('[REDACTED]');
    expect(instance!.folder).toBe('[REDACTED]');
  });

  it('deletes channel bindings', () => {
    const { inst } = setupFullUser();

    deleteUserData(inst.instance_id);

    const bindings = listBindingsByInstance(inst.instance_id);
    expect(bindings).toHaveLength(0);
  });

  it('deletes user skills', () => {
    const { inst } = setupFullUser();
    const userId = inst.user_id;

    deleteUserData(inst.instance_id);

    const skills = getUserSkills(userId);
    expect(skills).toHaveLength(0);
  });

  it('anonymizes pattern logs', () => {
    const { inst, org } = setupFullUser();
    const db = _getTestDatabase();

    deleteUserData(inst.instance_id);

    // Pattern logs should still exist but with anonymized user_id_hash
    const patterns = db
      .prepare('SELECT * FROM pattern_logs WHERE org_id = ?')
      .all(org.org_id) as Array<{ user_id_hash: string }>;
    expect(patterns.length).toBeGreaterThan(0);
    for (const p of patterns) {
      expect(p.user_id_hash).toMatch(/^ANONYMIZED_/);
    }
  });

  it('preserves audit logs (legal requirement)', () => {
    const { inst, org } = setupFullUser();

    const auditLogsBefore = getOrgAuditLog(org.org_id);
    const countBefore = auditLogsBefore.length;

    deleteUserData(inst.instance_id);

    // Audit logs should only grow (never deleted)
    const auditLogsAfter = getOrgAuditLog(org.org_id);
    expect(auditLogsAfter.length).toBeGreaterThan(countBefore);

    // Should include the gdpr_delete action
    const deleteLog = auditLogsAfter.find(l => l.action === 'gdpr_delete');
    expect(deleteLog).toBeDefined();
  });

  it('does not delete org-level data (insights, context docs)', () => {
    const { inst, org } = setupFullUser();

    // Create org-level data
    createInsight({ org_id: org.org_id, stream: 'automate', title: 'Org Insight' });
    createContextDoc({
      org_id: org.org_id,
      doc_type: 'strategy',
      title: 'Strategy Doc',
      content: 'content',
      updated_by: 'advisor',
    });

    deleteUserData(inst.instance_id);

    // Org data should still exist
    expect(listInsightsByOrg(org.org_id)).toHaveLength(1);
    expect(listContextDocsByOrg(org.org_id)).toHaveLength(1);
  });

  it('handles scoped deletion (memories only)', () => {
    const { inst } = setupFullUser();

    const result = deleteUserData(inst.instance_id, 'memories');

    expect(result.deleted.user_memories).toBe(1);
    // Other data should still exist
    expect(listBindingsByInstance(inst.instance_id)).toHaveLength(1);
    expect(getUserInstance(inst.instance_id)!.status).not.toBe('deleted');
  });

  it('throws for nonexistent instance', () => {
    expect(() => deleteUserData('nonexistent')).toThrow('User instance not found');
  });
});

// ===================================================================
// Right to Rectification (Article 16)
// ===================================================================

describe('rectifyUserData', () => {
  it('updates role_category', () => {
    const { inst, org } = setupFullUser();

    const result = rectifyUserData(inst.instance_id, { role_category: 'manager' });

    expect(result.updated_fields).toContain('role_category');
    expect(getUserInstance(inst.instance_id)!.role_category).toBe('manager');
  });

  it('updates access_mode', () => {
    const { inst } = setupFullUser();

    const result = rectifyUserData(inst.instance_id, { access_mode: 'full' });

    expect(result.updated_fields).toContain('access_mode');
    expect(getUserInstance(inst.instance_id)!.access_mode).toBe('full');
  });

  it('logs rectification in audit_logs', () => {
    const { inst, org } = setupFullUser();

    rectifyUserData(inst.instance_id, { role_category: 'analyst' });

    const auditLogs = getUserAuditLog(org.org_id, inst.instance_id);
    const rectifyLog = auditLogs.find(l => l.action === 'gdpr_rectify');
    expect(rectifyLog).toBeDefined();
    const details = JSON.parse(rectifyLog!.details);
    expect(details.updated_fields).toContain('role_category');
    expect(details.corrections.role_category).toBe('analyst');
  });

  it('creates a GDPR request record', () => {
    const { inst, org } = setupFullUser();

    const result = rectifyUserData(inst.instance_id, { role_category: 'manager' });

    expect(result.request_id).toBeTruthy();
    const request = getRequest(result.request_id);
    expect(request).toBeDefined();
    expect(request!.request_type).toBe('rectify');
    expect(request!.status).toBe('completed');
  });

  it('throws for nonexistent instance', () => {
    expect(() => rectifyUserData('nonexistent', { role_category: 'test' })).toThrow(
      'User instance not found',
    );
  });
});

// ===================================================================
// Right to Restriction (Article 18)
// ===================================================================

describe('restrictProcessing', () => {
  it('sets user instance status to suspended', () => {
    const org = createTestOrg();
    const team = createTestTeam(org.org_id);
    const inst = createTestInstance(org.org_id, team.team_id);

    restrictProcessing(inst.instance_id);

    expect(getUserInstance(inst.instance_id)!.status).toBe('suspended');
  });

  it('logs restriction in audit_logs', () => {
    const org = createTestOrg();
    const team = createTestTeam(org.org_id);
    const inst = createTestInstance(org.org_id, team.team_id);

    restrictProcessing(inst.instance_id);

    const auditLogs = getUserAuditLog(org.org_id, inst.instance_id);
    const restrictLog = auditLogs.find(l => l.action === 'gdpr_restrict');
    expect(restrictLog).toBeDefined();
    const details = JSON.parse(restrictLog!.details);
    expect(details.new_status).toBe('suspended');
  });

  it('creates a GDPR request record', () => {
    const org = createTestOrg();
    const team = createTestTeam(org.org_id);
    const inst = createTestInstance(org.org_id, team.team_id);

    const result = restrictProcessing(inst.instance_id);

    const request = getRequest(result.request_id);
    expect(request).toBeDefined();
    expect(request!.request_type).toBe('restrict');
    expect(request!.status).toBe('completed');
  });

  it('throws for nonexistent instance', () => {
    expect(() => restrictProcessing('nonexistent')).toThrow('User instance not found');
  });
});

// ===================================================================
// Right to Data Portability (Article 20)
// ===================================================================

describe('exportPortableData', () => {
  it('exports data with portable format metadata', () => {
    const { inst } = setupFullUser();

    const data = exportPortableData(inst.instance_id);

    expect(data.schema_version).toBe('1.0.0');
    expect(data.portable_format).toBe('play-new-gdpr-export-v1');
    expect(data.export_metadata).toBeDefined();
    expect(data.user_instance).toBeDefined();
    expect(data.channel_bindings).toHaveLength(1);
  });

  it('includes all data from base export', () => {
    const { inst } = setupFullUser();

    const data = exportPortableData(inst.instance_id);

    // Should have all the same data as a regular export
    expect(data.skills).toHaveLength(1);
    expect(data.memories).toHaveLength(1);
    expect(data.sessions).toHaveLength(1);
  });

  it('logs portability-specific audit action', () => {
    const { inst, org } = setupFullUser();

    exportPortableData(inst.instance_id);

    const auditLogs = getUserAuditLog(org.org_id, inst.instance_id);
    const portabilityLog = auditLogs.find(l => l.action === 'gdpr_portability');
    expect(portabilityLog).toBeDefined();
    const details = JSON.parse(portabilityLog!.details);
    expect(details.schema_version).toBe('1.0.0');
  });
});

// ===================================================================
// Right to Object (Article 21)
// ===================================================================

describe('objectToProcessing', () => {
  it('withdraws consent for pattern_collection', () => {
    const { inst, org } = setupFullUser();
    grantConsent(inst.instance_id, org.org_id, 'pattern_collection');
    expect(hasConsent(inst.instance_id, 'pattern_collection')).toBe(true);

    objectToProcessing(inst.instance_id, 'pattern_collection');

    expect(hasConsent(inst.instance_id, 'pattern_collection')).toBe(false);
  });

  it('withdraws consent for cross_org_benchmarking', () => {
    const { inst, org } = setupFullUser();
    grantConsent(inst.instance_id, org.org_id, 'cross_org_benchmarking');

    objectToProcessing(inst.instance_id, 'cross_org_benchmarking');

    expect(hasConsent(inst.instance_id, 'cross_org_benchmarking')).toBe(false);
  });

  it('withdraws consent for memory_storage', () => {
    const { inst, org } = setupFullUser();
    grantConsent(inst.instance_id, org.org_id, 'memory_storage');

    objectToProcessing(inst.instance_id, 'memory_storage');

    expect(hasConsent(inst.instance_id, 'memory_storage')).toBe(false);
  });

  it('logs objection in audit_logs', () => {
    const { inst, org } = setupFullUser();
    grantConsent(inst.instance_id, org.org_id, 'pattern_collection');

    objectToProcessing(inst.instance_id, 'pattern_collection');

    const auditLogs = getUserAuditLog(org.org_id, inst.instance_id);
    const objectLog = auditLogs.find(l => l.action === 'gdpr_object');
    expect(objectLog).toBeDefined();
    const details = JSON.parse(objectLog!.details);
    expect(details.processing_type).toBe('pattern_collection');
  });

  it('creates a GDPR request record', () => {
    const { inst, org } = setupFullUser();
    grantConsent(inst.instance_id, org.org_id, 'pattern_collection');

    const result = objectToProcessing(inst.instance_id, 'pattern_collection');

    const request = getRequest(result.request_id);
    expect(request).toBeDefined();
    expect(request!.request_type).toBe('object');
    expect(request!.status).toBe('completed');
  });

  it('throws for nonexistent instance', () => {
    expect(() => objectToProcessing('nonexistent', 'pattern_collection')).toThrow(
      'User instance not found',
    );
  });
});

// ===================================================================
// Cannot delete audit logs
// ===================================================================

describe('audit log preservation', () => {
  it('audit logs are never deleted by GDPR delete operations', () => {
    const { inst, org } = setupFullUser();
    const db = _getTestDatabase();

    // Log several audit entries for this user
    logAudit({ org_id: org.org_id, user_id: inst.instance_id, action: 'user.login', target: 'session' });
    logAudit({ org_id: org.org_id, user_id: inst.instance_id, action: 'user.message_sent', target: 'message' });

    const auditCountBefore = (
      db.prepare('SELECT COUNT(*) as cnt FROM audit_logs WHERE org_id = ?').get(org.org_id) as { cnt: number }
    ).cnt;

    deleteUserData(inst.instance_id);

    const auditCountAfter = (
      db.prepare('SELECT COUNT(*) as cnt FROM audit_logs WHERE org_id = ?').get(org.org_id) as { cnt: number }
    ).cnt;

    // Audit count should have increased (gdpr actions logged) not decreased
    expect(auditCountAfter).toBeGreaterThan(auditCountBefore);
  });
});
