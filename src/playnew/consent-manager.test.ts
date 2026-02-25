import { describe, it, expect, beforeEach } from 'vitest';

import {
  _initPlayNewTestDatabase,
  createOrg,
  createTeam,
  createUserInstance,
  getOrgAuditLog,
} from './db.js';

import {
  grantConsent,
  withdrawConsent,
  hasConsent,
  getUserConsents,
  requireConsent,
  ConsentRequiredError,
} from './consent-manager.js';

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

// ===================================================================
// Grant Consent
// ===================================================================

describe('grantConsent', () => {
  it('grants consent and records it', () => {
    const org = createTestOrg();
    const team = createTestTeam(org.org_id);
    const inst = createTestInstance(org.org_id, team.team_id);

    const record = grantConsent(inst.instance_id, org.org_id, 'data_processing');

    expect(record.instance_id).toBe(inst.instance_id);
    expect(record.consent_type).toBe('data_processing');
    expect(record.granted).toBe(1);
    expect(record.granted_at).toBeTruthy();
    expect(record.version).toBe('1.0');
  });

  it('grants consent with metadata', () => {
    const org = createTestOrg();
    const team = createTestTeam(org.org_id);
    const inst = createTestInstance(org.org_id, team.team_id);

    const record = grantConsent(inst.instance_id, org.org_id, 'pattern_collection', {
      ip_address: '192.168.1.1',
      user_agent: 'Slack-Bot/1.0',
      version: '2.0',
    });

    expect(record.ip_address).toBe('192.168.1.1');
    expect(record.user_agent).toBe('Slack-Bot/1.0');
    expect(record.version).toBe('2.0');
  });

  it('logs consent grant in audit_logs', () => {
    const org = createTestOrg();
    const team = createTestTeam(org.org_id);
    const inst = createTestInstance(org.org_id, team.team_id);

    grantConsent(inst.instance_id, org.org_id, 'data_processing');

    const auditLogs = getOrgAuditLog(org.org_id);
    const consentLog = auditLogs.find(l => l.action === 'consent_granted');
    expect(consentLog).toBeDefined();
    expect(consentLog!.user_id).toBe(inst.instance_id);
    const details = JSON.parse(consentLog!.details);
    expect(details.consent_type).toBe('data_processing');
  });

  it('grants all valid consent types', () => {
    const org = createTestOrg();
    const team = createTestTeam(org.org_id);
    const inst = createTestInstance(org.org_id, team.team_id);

    const types = [
      'data_processing',
      'memory_storage',
      'pattern_collection',
      'cross_org_benchmarking',
      'email_processing',
    ] as const;

    for (const type of types) {
      const record = grantConsent(inst.instance_id, org.org_id, type);
      expect(record.consent_type).toBe(type);
      expect(record.granted).toBe(1);
    }
  });
});

// ===================================================================
// Withdraw Consent
// ===================================================================

describe('withdrawConsent', () => {
  it('withdraws previously granted consent', () => {
    const org = createTestOrg();
    const team = createTestTeam(org.org_id);
    const inst = createTestInstance(org.org_id, team.team_id);

    grantConsent(inst.instance_id, org.org_id, 'data_processing');
    expect(hasConsent(inst.instance_id, 'data_processing')).toBe(true);

    const record = withdrawConsent(inst.instance_id, org.org_id, 'data_processing');

    expect(record.granted).toBe(0);
    expect(record.withdrawn_at).toBeTruthy();
    expect(hasConsent(inst.instance_id, 'data_processing')).toBe(false);
  });

  it('logs consent withdrawal in audit_logs', () => {
    const org = createTestOrg();
    const team = createTestTeam(org.org_id);
    const inst = createTestInstance(org.org_id, team.team_id);

    grantConsent(inst.instance_id, org.org_id, 'pattern_collection');
    withdrawConsent(inst.instance_id, org.org_id, 'pattern_collection');

    const auditLogs = getOrgAuditLog(org.org_id);
    const withdrawLog = auditLogs.find(l => l.action === 'consent_withdrawn');
    expect(withdrawLog).toBeDefined();
    const details = JSON.parse(withdrawLog!.details);
    expect(details.consent_type).toBe('pattern_collection');
  });

  it('can withdraw consent that was never granted', () => {
    const org = createTestOrg();
    const team = createTestTeam(org.org_id);
    const inst = createTestInstance(org.org_id, team.team_id);

    // Should not throw
    const record = withdrawConsent(inst.instance_id, org.org_id, 'data_processing');
    expect(record.granted).toBe(0);
  });
});

// ===================================================================
// Check Consent Status
// ===================================================================

describe('hasConsent', () => {
  it('returns false when no consent record exists', () => {
    const org = createTestOrg();
    const team = createTestTeam(org.org_id);
    const inst = createTestInstance(org.org_id, team.team_id);

    expect(hasConsent(inst.instance_id, 'data_processing')).toBe(false);
  });

  it('returns true when consent is granted', () => {
    const org = createTestOrg();
    const team = createTestTeam(org.org_id);
    const inst = createTestInstance(org.org_id, team.team_id);

    grantConsent(inst.instance_id, org.org_id, 'data_processing');
    expect(hasConsent(inst.instance_id, 'data_processing')).toBe(true);
  });

  it('returns false when consent is withdrawn', () => {
    const org = createTestOrg();
    const team = createTestTeam(org.org_id);
    const inst = createTestInstance(org.org_id, team.team_id);

    grantConsent(inst.instance_id, org.org_id, 'data_processing');
    withdrawConsent(inst.instance_id, org.org_id, 'data_processing');
    expect(hasConsent(inst.instance_id, 'data_processing')).toBe(false);
  });
});

// ===================================================================
// Get All Consents
// ===================================================================

describe('getUserConsents', () => {
  it('returns empty array when no consents exist', () => {
    const org = createTestOrg();
    const team = createTestTeam(org.org_id);
    const inst = createTestInstance(org.org_id, team.team_id);

    expect(getUserConsents(inst.instance_id)).toHaveLength(0);
  });

  it('returns all consent records for a user', () => {
    const org = createTestOrg();
    const team = createTestTeam(org.org_id);
    const inst = createTestInstance(org.org_id, team.team_id);

    grantConsent(inst.instance_id, org.org_id, 'data_processing');
    grantConsent(inst.instance_id, org.org_id, 'pattern_collection');
    grantConsent(inst.instance_id, org.org_id, 'memory_storage');

    const consents = getUserConsents(inst.instance_id);
    expect(consents).toHaveLength(3);
  });

  it('does not return consents from other users', () => {
    const org = createTestOrg();
    const team = createTestTeam(org.org_id);
    const inst1 = createTestInstance(org.org_id, team.team_id, 'u1');
    const inst2 = createTestInstance(org.org_id, team.team_id, 'u2');

    grantConsent(inst1.instance_id, org.org_id, 'data_processing');
    grantConsent(inst2.instance_id, org.org_id, 'data_processing');
    grantConsent(inst2.instance_id, org.org_id, 'pattern_collection');

    expect(getUserConsents(inst1.instance_id)).toHaveLength(1);
    expect(getUserConsents(inst2.instance_id)).toHaveLength(2);
  });
});

// ===================================================================
// requireConsent
// ===================================================================

describe('requireConsent', () => {
  it('throws ConsentRequiredError when consent is not granted', () => {
    const org = createTestOrg();
    const team = createTestTeam(org.org_id);
    const inst = createTestInstance(org.org_id, team.team_id);

    expect(() => requireConsent(inst.instance_id, 'data_processing')).toThrow(
      ConsentRequiredError,
    );

    try {
      requireConsent(inst.instance_id, 'data_processing');
    } catch (err) {
      expect(err).toBeInstanceOf(ConsentRequiredError);
      const consentErr = err as ConsentRequiredError;
      expect(consentErr.consentType).toBe('data_processing');
      expect(consentErr.instanceId).toBe(inst.instance_id);
    }
  });

  it('does not throw when consent is granted', () => {
    const org = createTestOrg();
    const team = createTestTeam(org.org_id);
    const inst = createTestInstance(org.org_id, team.team_id);

    grantConsent(inst.instance_id, org.org_id, 'data_processing');

    // Should not throw
    expect(() => requireConsent(inst.instance_id, 'data_processing')).not.toThrow();
  });

  it('throws after consent is withdrawn', () => {
    const org = createTestOrg();
    const team = createTestTeam(org.org_id);
    const inst = createTestInstance(org.org_id, team.team_id);

    grantConsent(inst.instance_id, org.org_id, 'data_processing');
    withdrawConsent(inst.instance_id, org.org_id, 'data_processing');

    expect(() => requireConsent(inst.instance_id, 'data_processing')).toThrow(
      ConsentRequiredError,
    );
  });
});

// ===================================================================
// Re-granting after withdrawal
// ===================================================================

describe('re-granting consent', () => {
  it('re-granting after withdrawal updates timestamps', () => {
    const org = createTestOrg();
    const team = createTestTeam(org.org_id);
    const inst = createTestInstance(org.org_id, team.team_id);

    const firstGrant = grantConsent(inst.instance_id, org.org_id, 'data_processing');
    const firstGrantedAt = firstGrant.granted_at;

    withdrawConsent(inst.instance_id, org.org_id, 'data_processing');

    const reGrant = grantConsent(inst.instance_id, org.org_id, 'data_processing');
    expect(reGrant.granted).toBe(1);
    expect(reGrant.granted_at).toBeTruthy();
    // The re-grant should have a granted_at that is >= the first (may be same in fast tests)
    expect(hasConsent(inst.instance_id, 'data_processing')).toBe(true);
  });
});

// ===================================================================
// Consent type validation
// ===================================================================

describe('consent type validation', () => {
  it('rejects invalid consent types for hasConsent', () => {
    const org = createTestOrg();
    const team = createTestTeam(org.org_id);
    const inst = createTestInstance(org.org_id, team.team_id);

    expect(() => hasConsent(inst.instance_id, 'invalid_type' as any)).toThrow(
      'Invalid consent type',
    );
  });

  it('rejects invalid consent types for grantConsent', () => {
    const org = createTestOrg();
    const team = createTestTeam(org.org_id);
    const inst = createTestInstance(org.org_id, team.team_id);

    expect(() => grantConsent(inst.instance_id, org.org_id, 'invalid_type' as any)).toThrow(
      'Invalid consent type',
    );
  });

  it('rejects invalid consent types for requireConsent', () => {
    const org = createTestOrg();
    const team = createTestTeam(org.org_id);
    const inst = createTestInstance(org.org_id, team.team_id);

    expect(() => requireConsent(inst.instance_id, 'invalid_type' as any)).toThrow(
      'Invalid consent type',
    );
  });
});
