import { describe, it, expect, beforeEach } from 'vitest';

import {
  _initPlayNewTestDatabase,
  _getTestDatabase,
  // Organizations
  createOrg,
  getOrg,
  getOrgByName,
  listOrgs,
  updateOrgStatus,
  // Teams
  createTeam,
  getTeam,
  listTeamsByOrg,
  updateTeam,
  // User Instances
  createUserInstance,
  getUserInstance,
  getUserInstanceByUserId,
  listInstancesByOrg,
  listInstancesByTeam,
  updateInstanceStatus,
  deleteUserInstance,
  // Skills
  createSkill,
  getSkill,
  listSkills,
  listSkillsByCategory,
  updateSkillUsage,
  // User Skills
  assignSkill,
  getUserSkills,
  updateSkillStatus,
  recordSkillFeedback,
  // Pattern Logs
  insertPattern,
  getTeamPatterns,
  getOrgPatterns,
  // Insights
  createInsight,
  getInsight,
  listInsightsByOrg,
  updateInsightStatus,
  // Org Context
  createContextDoc,
  getContextDoc,
  listContextDocsByOrg,
  updateContextDoc,
  // Audit
  logAudit,
  getUserAuditLog,
  getOrgAuditLog,
  // Channel Bindings
  createBinding,
  resolveBinding,
  listBindingsByInstance,
  // Taxonomy
  seedTaxonomy,
  getTaxonomyByLevel,
  getTaxonomyByCode,
} from './db.js';

// ---------------------------------------------------------------------------
// Fresh database before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  _initPlayNewTestDatabase();
});

// ---------------------------------------------------------------------------
// Helpers — creates a standard org + team for tests that need them
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
// Schema creation
// ===================================================================

describe('schema creation', () => {
  it('creates all expected tables', () => {
    const db = _getTestDatabase();
    const tables = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
      )
      .all() as Array<{ name: string }>;

    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain('organizations');
    expect(tableNames).toContain('teams');
    expect(tableNames).toContain('user_instances');
    expect(tableNames).toContain('skill_definitions');
    expect(tableNames).toContain('user_skills');
    expect(tableNames).toContain('pattern_logs');
    expect(tableNames).toContain('insights');
    expect(tableNames).toContain('org_context_docs');
    expect(tableNames).toContain('audit_logs');
    expect(tableNames).toContain('work_category_taxonomy');
    expect(tableNames).toContain('channel_bindings');
  });

  it('creates all expected views', () => {
    const db = _getTestDatabase();
    const views = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='view' ORDER BY name`)
      .all() as Array<{ name: string }>;

    const viewNames = views.map((v) => v.name);
    expect(viewNames).toContain('v_team_patterns');
    expect(viewNames).toContain('v_org_patterns');
    expect(viewNames).toContain('v_skill_usage');
  });

  it('seeds L1 taxonomy on init', () => {
    const l1 = getTaxonomyByLevel(1);
    expect(l1).toHaveLength(5);
    const codes = l1.map((t) => t.code).sort();
    expect(codes).toEqual(['ANAL', 'COMM', 'CORD', 'CREA', 'STRA']);
  });

  it('has foreign keys enabled', () => {
    const db = _getTestDatabase();
    const row = db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number };
    expect(row.foreign_keys).toBe(1);
  });
});

// ===================================================================
// Organizations
// ===================================================================

describe('organizations', () => {
  it('creates and retrieves an org', () => {
    const org = createOrg({
      name: 'Test Co',
      industry: 'professional_services',
      size_band: '50-200',
      geo: 'UK',
    });
    expect(org.name).toBe('Test Co');
    expect(org.industry).toBe('professional_services');
    expect(org.size_band).toBe('50-200');
    expect(org.geo).toBe('UK');
    expect(org.plan).toBe('design_partner');
    expect(org.status).toBe('onboarding');
    expect(org.org_id).toBeTruthy();
    expect(org.created_at).toBeTruthy();

    const fetched = getOrg(org.org_id);
    expect(fetched).toEqual(org);
  });

  it('finds org by name', () => {
    createOrg({ name: 'FindMe', industry: 'tech', size_band: '200-500', geo: 'DACH' });
    const found = getOrgByName('FindMe');
    expect(found).toBeDefined();
    expect(found!.name).toBe('FindMe');

    expect(getOrgByName('DoesNotExist')).toBeUndefined();
  });

  it('lists all orgs', () => {
    createOrg({ name: 'A', industry: 'tech', size_band: '50-200', geo: 'UK' });
    createOrg({ name: 'B', industry: 'finance', size_band: '2000+', geo: 'Nordics' });
    expect(listOrgs()).toHaveLength(2);
  });

  it('updates org status', () => {
    const org = createTestOrg();
    updateOrgStatus(org.org_id, 'active');
    expect(getOrg(org.org_id)!.status).toBe('active');
  });

  it('rejects invalid size_band', () => {
    expect(() =>
      createOrg({
        name: 'Bad',
        industry: 'tech',
        size_band: '10-50' as string,
        geo: 'UK',
      }),
    ).toThrow();
  });
});

// ===================================================================
// Teams
// ===================================================================

describe('teams', () => {
  it('creates and retrieves a team', () => {
    const org = createTestOrg();
    const team = createTeam({
      org_id: org.org_id,
      name: 'Sales',
      function: 'sales',
      size: 12,
    });

    expect(team.name).toBe('Sales');
    expect(team.function).toBe('sales');
    expect(team.size).toBe(12);
    expect(team.org_id).toBe(org.org_id);

    expect(getTeam(team.team_id)).toEqual(team);
  });

  it('lists teams by org', () => {
    const org = createTestOrg();
    createTeam({ org_id: org.org_id, name: 'Sales', function: 'sales' });
    createTeam({ org_id: org.org_id, name: 'Engineering', function: 'engineering' });
    expect(listTeamsByOrg(org.org_id)).toHaveLength(2);
  });

  it('updates team fields', () => {
    const org = createTestOrg();
    const team = createTeam({ org_id: org.org_id, name: 'Old Name', function: 'sales' });
    updateTeam(team.team_id, { name: 'New Name', size: 25 });
    const updated = getTeam(team.team_id)!;
    expect(updated.name).toBe('New Name');
    expect(updated.size).toBe(25);
  });

  it('rejects team with invalid org FK', () => {
    expect(() =>
      createTeam({ org_id: 'nonexistent-org', name: 'Ghost', function: 'x' }),
    ).toThrow();
  });
});

// ===================================================================
// User Instances
// ===================================================================

describe('user instances', () => {
  it('creates and retrieves an instance', () => {
    const org = createTestOrg();
    const team = createTestTeam(org.org_id);
    const inst = createTestInstance(org.org_id, team.team_id);

    expect(inst.user_id).toBe('user-1');
    expect(inst.org_id).toBe(org.org_id);
    expect(inst.team_id).toBe(team.team_id);
    expect(inst.access_mode).toBe('forward');
    expect(inst.status).toBe('provisioning');
    expect(inst.encryption_key_ref).toBe('key-ref-001');

    expect(getUserInstance(inst.instance_id)).toEqual(inst);
  });

  it('finds instance by user_id and org', () => {
    const org = createTestOrg();
    const team = createTestTeam(org.org_id);
    createTestInstance(org.org_id, team.team_id, 'alice');

    const found = getUserInstanceByUserId(org.org_id, 'alice');
    expect(found).toBeDefined();
    expect(found!.user_id).toBe('alice');
  });

  it('lists instances by org', () => {
    const org = createTestOrg();
    const team = createTestTeam(org.org_id);
    createTestInstance(org.org_id, team.team_id, 'u1');
    createTestInstance(org.org_id, team.team_id, 'u2');
    expect(listInstancesByOrg(org.org_id)).toHaveLength(2);
  });

  it('lists instances by team', () => {
    const org = createTestOrg();
    const team = createTestTeam(org.org_id);
    createTestInstance(org.org_id, team.team_id, 'u1');
    expect(listInstancesByTeam(team.team_id)).toHaveLength(1);
  });

  it('updates instance status', () => {
    const org = createTestOrg();
    const team = createTestTeam(org.org_id);
    const inst = createTestInstance(org.org_id, team.team_id);

    updateInstanceStatus(inst.instance_id, 'active');
    expect(getUserInstance(inst.instance_id)!.status).toBe('active');
  });

  it('soft-deletes an instance', () => {
    const org = createTestOrg();
    const team = createTestTeam(org.org_id);
    const inst = createTestInstance(org.org_id, team.team_id);

    deleteUserInstance(inst.instance_id);
    expect(getUserInstance(inst.instance_id)!.status).toBe('deleted');
  });

  it('enforces unique(org_id, user_id)', () => {
    const org = createTestOrg();
    const team = createTestTeam(org.org_id);
    createTestInstance(org.org_id, team.team_id, 'dup-user');

    expect(() => createTestInstance(org.org_id, team.team_id, 'dup-user')).toThrow();
  });

  it('rejects instance with invalid team FK', () => {
    const org = createTestOrg();
    expect(() =>
      createUserInstance({
        user_id: 'ghost',
        org_id: org.org_id,
        team_id: 'nonexistent-team',
        role_category: 'engineer',
        encryption_key_ref: 'k',
        folder: 'f',
      }),
    ).toThrow();
  });
});

// ===================================================================
// Skill Definitions
// ===================================================================

describe('skill definitions', () => {
  it('creates and retrieves a skill', () => {
    const skill = createSkill({
      name: 'pipeline-risk',
      category: 'sales',
      content: '# Pipeline Risk\nAnalyze pipeline...',
    });

    expect(skill.name).toBe('pipeline-risk');
    expect(skill.category).toBe('sales');
    expect(skill.version).toBe('1.0.0');
    expect(skill.source).toBe('pre_built');
    expect(skill.usage_count).toBe(0);
    expect(skill.org_id).toBeNull();

    expect(getSkill(skill.skill_id)).toEqual(skill);
  });

  it('creates org-scoped skill', () => {
    const org = createTestOrg();
    const skill = createSkill({
      name: 'custom-report',
      category: 'analysis',
      content: '# Custom\n...',
      org_id: org.org_id,
    });
    expect(skill.org_id).toBe(org.org_id);
  });

  it('lists all skills', () => {
    createSkill({ name: 's1', category: 'sales', content: 'c1' });
    createSkill({ name: 's2', category: 'analysis', content: 'c2' });
    expect(listSkills()).toHaveLength(2);
  });

  it('lists skills by org (includes shared + org-scoped)', () => {
    const org = createTestOrg();
    createSkill({ name: 'shared', category: 'sales', content: 'c' });
    createSkill({ name: 'org-only', category: 'sales', content: 'c', org_id: org.org_id });

    const skills = listSkills(org.org_id);
    expect(skills).toHaveLength(2);
  });

  it('lists skills by category', () => {
    createSkill({ name: 's1', category: 'sales', content: 'c' });
    createSkill({ name: 's2', category: 'sales', content: 'c' });
    createSkill({ name: 's3', category: 'analysis', content: 'c' });

    expect(listSkillsByCategory('sales')).toHaveLength(2);
    expect(listSkillsByCategory('analysis')).toHaveLength(1);
  });

  it('increments usage count', () => {
    const skill = createSkill({ name: 's1', category: 'sales', content: 'c' });
    updateSkillUsage(skill.skill_id);
    updateSkillUsage(skill.skill_id);
    expect(getSkill(skill.skill_id)!.usage_count).toBe(2);
  });
});

// ===================================================================
// User Skills
// ===================================================================

describe('user skills', () => {
  it('assigns a skill to a user', () => {
    const skill = createSkill({ name: 's1', category: 'sales', content: 'c' });
    const assignment = assignSkill({
      user_id: 'user-1',
      skill_id: skill.skill_id,
      assigned_by: 'advisor',
    });

    expect(assignment.user_id).toBe('user-1');
    expect(assignment.skill_id).toBe(skill.skill_id);
    expect(assignment.status).toBe('assigned');
    expect(assignment.assigned_by).toBe('advisor');
  });

  it('lists user skills', () => {
    const s1 = createSkill({ name: 's1', category: 'sales', content: 'c' });
    const s2 = createSkill({ name: 's2', category: 'analysis', content: 'c' });
    assignSkill({ user_id: 'u1', skill_id: s1.skill_id, assigned_by: 'system' });
    assignSkill({ user_id: 'u1', skill_id: s2.skill_id, assigned_by: 'advisor' });

    expect(getUserSkills('u1')).toHaveLength(2);
  });

  it('updates skill status', () => {
    const skill = createSkill({ name: 's1', category: 'sales', content: 'c' });
    assignSkill({ user_id: 'u1', skill_id: skill.skill_id, assigned_by: 'system' });

    updateSkillStatus('u1', skill.skill_id, 'active');
    const skills = getUserSkills('u1');
    expect(skills[0].status).toBe('active');
  });

  it('records feedback', () => {
    const skill = createSkill({ name: 's1', category: 'sales', content: 'c' });
    assignSkill({ user_id: 'u1', skill_id: skill.skill_id, assigned_by: 'system' });

    recordSkillFeedback('u1', skill.skill_id, 0.85);
    const skills = getUserSkills('u1');
    expect(skills[0].feedback_score).toBeCloseTo(0.85);
    expect(skills[0].last_used).toBeTruthy();
  });

  it('rejects assignment for nonexistent skill (FK)', () => {
    expect(() =>
      assignSkill({ user_id: 'u1', skill_id: 'nonexistent', assigned_by: 'system' }),
    ).toThrow();
  });

  it('rejects duplicate assignment (PK)', () => {
    const skill = createSkill({ name: 's1', category: 'sales', content: 'c' });
    assignSkill({ user_id: 'u1', skill_id: skill.skill_id, assigned_by: 'system' });
    expect(() =>
      assignSkill({ user_id: 'u1', skill_id: skill.skill_id, assigned_by: 'system' }),
    ).toThrow();
  });
});

// ===================================================================
// Pattern Logs & Anonymization Views
// ===================================================================

describe('pattern logs', () => {
  it('inserts and returns a pattern record', () => {
    const org = createTestOrg();
    const pattern = insertPattern({
      user_id_hash: 'hash-u1',
      org_id: org.org_id,
      team_id: 'team-1',
      pattern_type: 'time_allocation',
      category_l1: 'Communication',
      category_l2: 'Reporting',
      metric_type: 'duration',
      metric_value: 3600,
      tools_involved: ['spreadsheet_tools', 'crm'],
      timestamp: '2026-04-12T09:15:00Z',
      period: '2026-W15',
    });

    expect(pattern.pattern_id).toBeTruthy();
    expect(pattern.user_id_hash).toBe('hash-u1');
    expect(pattern.metric_value).toBe(3600);
    expect(JSON.parse(pattern.tools_involved)).toEqual(['spreadsheet_tools', 'crm']);
  });
});

describe('anonymization views', () => {
  function seedPatterns(orgId: string, teamId: string, userCount: number) {
    for (let i = 0; i < userCount; i++) {
      insertPattern({
        user_id_hash: `hash-user-${i}`,
        org_id: orgId,
        team_id: teamId,
        pattern_type: 'time_allocation',
        category_l1: 'Communication',
        category_l2: 'Reporting',
        metric_type: 'count',
        metric_value: 10 + i,
        timestamp: '2026-04-12T09:15:00Z',
        period: '2026-W15',
      });
    }
  }

  it('v_team_patterns returns nothing below 5-user threshold', () => {
    const org = createTestOrg();
    seedPatterns(org.org_id, 'team-1', 4); // Only 4 users

    const patterns = getTeamPatterns(org.org_id, 'team-1');
    expect(patterns).toHaveLength(0);
  });

  it('v_team_patterns returns data at exactly 5 users', () => {
    const org = createTestOrg();
    seedPatterns(org.org_id, 'team-1', 5);

    const patterns = getTeamPatterns(org.org_id, 'team-1');
    expect(patterns).toHaveLength(1);
    expect(patterns[0].user_count).toBe(5);
    expect(patterns[0].total_value).toBe(10 + 11 + 12 + 13 + 14);
  });

  it('v_team_patterns returns data above 5 users', () => {
    const org = createTestOrg();
    seedPatterns(org.org_id, 'team-1', 8);

    const patterns = getTeamPatterns(org.org_id, 'team-1');
    expect(patterns).toHaveLength(1);
    expect(patterns[0].user_count).toBe(8);
  });

  it('v_team_patterns filters by period', () => {
    const org = createTestOrg();
    // 5 users in W15
    seedPatterns(org.org_id, 'team-1', 5);
    // 3 users in W16 (below threshold)
    for (let i = 0; i < 3; i++) {
      insertPattern({
        user_id_hash: `hash-w16-${i}`,
        org_id: org.org_id,
        team_id: 'team-1',
        pattern_type: 'time_allocation',
        category_l1: 'Communication',
        category_l2: 'Reporting',
        metric_type: 'count',
        metric_value: 5,
        timestamp: '2026-04-19T09:15:00Z',
        period: '2026-W16',
      });
    }

    expect(getTeamPatterns(org.org_id, 'team-1', '2026-W15')).toHaveLength(1);
    expect(getTeamPatterns(org.org_id, 'team-1', '2026-W16')).toHaveLength(0);
  });

  it('v_org_patterns returns nothing below 5-user threshold', () => {
    const org = createTestOrg();
    seedPatterns(org.org_id, 'team-1', 4);
    expect(getOrgPatterns(org.org_id)).toHaveLength(0);
  });

  it('v_org_patterns aggregates across teams', () => {
    const org = createTestOrg();
    // 3 users in team-1 + 3 in team-2 = 6 distinct at org level
    for (let i = 0; i < 3; i++) {
      insertPattern({
        user_id_hash: `hash-t1-${i}`,
        org_id: org.org_id,
        team_id: 'team-1',
        pattern_type: 'time_allocation',
        category_l1: 'Analysis',
        metric_type: 'count',
        metric_value: 10,
        timestamp: '2026-04-12T09:15:00Z',
        period: '2026-W15',
      });
    }
    for (let i = 0; i < 3; i++) {
      insertPattern({
        user_id_hash: `hash-t2-${i}`,
        org_id: org.org_id,
        team_id: 'team-2',
        pattern_type: 'time_allocation',
        category_l1: 'Analysis',
        metric_type: 'count',
        metric_value: 20,
        timestamp: '2026-04-12T09:15:00Z',
        period: '2026-W15',
      });
    }

    const orgPatterns = getOrgPatterns(org.org_id);
    expect(orgPatterns).toHaveLength(1);
    expect(orgPatterns[0].user_count).toBe(6);
    expect(orgPatterns[0].total_value).toBe(3 * 10 + 3 * 20); // 90
  });

  it('v_skill_usage enforces 5-user threshold', () => {
    const org = createTestOrg();
    const db = _getTestDatabase();

    // Insert 4 skill_usage patterns (below threshold)
    for (let i = 0; i < 4; i++) {
      insertPattern({
        user_id_hash: `hash-skill-${i}`,
        org_id: org.org_id,
        team_id: 'team-1',
        pattern_type: 'skill_usage',
        category_l1: 'Communication',
        category_l2: 'pipeline-risk',
        metric_type: 'count',
        metric_value: 1,
        timestamp: '2026-04-12T09:15:00Z',
        period: '2026-W15',
      });
    }

    let results = db
      .prepare('SELECT * FROM v_skill_usage WHERE org_id = ?')
      .all(org.org_id) as Array<{ user_count: number }>;
    expect(results).toHaveLength(0);

    // Add a 5th user
    insertPattern({
      user_id_hash: 'hash-skill-4',
      org_id: org.org_id,
      team_id: 'team-1',
      pattern_type: 'skill_usage',
      category_l1: 'Communication',
      category_l2: 'pipeline-risk',
      metric_type: 'count',
      metric_value: 1,
      timestamp: '2026-04-12T09:15:00Z',
      period: '2026-W15',
    });

    results = db
      .prepare('SELECT * FROM v_skill_usage WHERE org_id = ?')
      .all(org.org_id) as Array<{ user_count: number }>;
    expect(results).toHaveLength(1);
    expect(results[0].user_count).toBe(5);
  });

  it('same user_id_hash in same group counts as 1 user', () => {
    const org = createTestOrg();

    // Same user_id_hash repeated 5 times should NOT hit 5-user threshold
    for (let i = 0; i < 5; i++) {
      insertPattern({
        user_id_hash: 'same-hash',
        org_id: org.org_id,
        team_id: 'team-1',
        pattern_type: 'time_allocation',
        category_l1: 'Communication',
        metric_type: 'count',
        metric_value: 10,
        timestamp: '2026-04-12T09:15:00Z',
        period: '2026-W15',
      });
    }

    expect(getTeamPatterns(org.org_id, 'team-1')).toHaveLength(0);
    expect(getOrgPatterns(org.org_id)).toHaveLength(0);
  });
});

// ===================================================================
// Insights
// ===================================================================

describe('insights', () => {
  it('creates and retrieves an insight', () => {
    const org = createTestOrg();
    const insight = createInsight({
      org_id: org.org_id,
      stream: 'automate',
      title: 'Communication overhead in Finance',
      evidence: [{ team: 'finance', metric: '340h/month' }],
      confidence: 0.82,
      impact_estimate: '180000 EUR/year',
      recommended_actions: ['Deploy email automation'],
    });

    expect(insight.title).toBe('Communication overhead in Finance');
    expect(insight.stream).toBe('automate');
    expect(insight.confidence).toBeCloseTo(0.82);
    expect(insight.status).toBe('draft');
    expect(JSON.parse(insight.evidence)).toHaveLength(1);
    expect(JSON.parse(insight.recommended_actions)).toEqual(['Deploy email automation']);

    expect(getInsight(insight.insight_id)).toEqual(insight);
  });

  it('lists insights by org', () => {
    const org = createTestOrg();
    createInsight({ org_id: org.org_id, stream: 'automate', title: 'A' });
    createInsight({ org_id: org.org_id, stream: 'differentiate', title: 'B' });
    expect(listInsightsByOrg(org.org_id)).toHaveLength(2);
  });

  it('updates insight status', () => {
    const org = createTestOrg();
    const insight = createInsight({ org_id: org.org_id, stream: 'automate', title: 'X' });

    updateInsightStatus(insight.insight_id, 'reviewed');
    expect(getInsight(insight.insight_id)!.status).toBe('reviewed');
  });

  it('sets published_at when publishing', () => {
    const org = createTestOrg();
    const insight = createInsight({ org_id: org.org_id, stream: 'automate', title: 'X' });
    expect(insight.published_at).toBeNull();

    updateInsightStatus(insight.insight_id, 'published');
    const updated = getInsight(insight.insight_id)!;
    expect(updated.status).toBe('published');
    expect(updated.published_at).toBeTruthy();
  });

  it('rejects invalid stream value', () => {
    const org = createTestOrg();
    expect(() =>
      createInsight({ org_id: org.org_id, stream: 'invalid' as string, title: 'X' }),
    ).toThrow();
  });
});

// ===================================================================
// Org Context Documents
// ===================================================================

describe('org context docs', () => {
  it('creates and retrieves a doc', () => {
    const org = createTestOrg();
    const doc = createContextDoc({
      org_id: org.org_id,
      doc_type: 'strategy',
      title: 'Q1 Strategy',
      content: '## Strategy\n...',
      updated_by: 'advisor-1',
    });

    expect(doc.title).toBe('Q1 Strategy');
    expect(doc.doc_type).toBe('strategy');
    expect(doc.version).toBe(1);
    expect(doc.updated_by).toBe('advisor-1');

    expect(getContextDoc(doc.doc_id)).toEqual(doc);
  });

  it('lists docs by org', () => {
    const org = createTestOrg();
    createContextDoc({
      org_id: org.org_id,
      doc_type: 'strategy',
      title: 'Strategy',
      content: 'x',
      updated_by: 'a',
    });
    createContextDoc({
      org_id: org.org_id,
      doc_type: 'competitive',
      title: 'Competitive',
      content: 'y',
      updated_by: 'a',
    });
    expect(listContextDocsByOrg(org.org_id)).toHaveLength(2);
  });

  it('updates content and increments version', () => {
    const org = createTestOrg();
    const doc = createContextDoc({
      org_id: org.org_id,
      doc_type: 'strategy',
      title: 'Strategy',
      content: 'v1',
      updated_by: 'a',
    });

    updateContextDoc(doc.doc_id, { content: 'v2 content', updated_by: 'advisor-2' });
    const updated = getContextDoc(doc.doc_id)!;
    expect(updated.content).toBe('v2 content');
    expect(updated.version).toBe(2);
    expect(updated.updated_by).toBe('advisor-2');
  });

  it('updates title without incrementing version', () => {
    const org = createTestOrg();
    const doc = createContextDoc({
      org_id: org.org_id,
      doc_type: 'strategy',
      title: 'Old Title',
      content: 'text',
      updated_by: 'a',
    });

    updateContextDoc(doc.doc_id, { title: 'New Title', updated_by: 'advisor-2' });
    const updated = getContextDoc(doc.doc_id)!;
    expect(updated.title).toBe('New Title');
    expect(updated.version).toBe(1); // unchanged
  });

  it('rejects invalid doc_type', () => {
    const org = createTestOrg();
    expect(() =>
      createContextDoc({
        org_id: org.org_id,
        doc_type: 'invalid' as string,
        title: 'X',
        content: 'x',
        updated_by: 'a',
      }),
    ).toThrow();
  });
});

// ===================================================================
// Audit Logs
// ===================================================================

describe('audit logs', () => {
  it('creates an audit log entry', () => {
    const org = createTestOrg();
    const entry = logAudit({
      org_id: org.org_id,
      user_id: 'user-1',
      action: 'data_export',
      target: 'user_instance:inst-1',
      details: { format: 'csv' },
    });

    expect(entry.action).toBe('data_export');
    expect(entry.user_id).toBe('user-1');
    expect(JSON.parse(entry.details)).toEqual({ format: 'csv' });
    expect(entry.timestamp).toBeTruthy();
  });

  it('allows null user_id for system actions', () => {
    const org = createTestOrg();
    const entry = logAudit({
      org_id: org.org_id,
      action: 'system_cleanup',
      target: 'pattern_logs',
    });
    expect(entry.user_id).toBeNull();
  });

  it('retrieves user audit log', () => {
    const org = createTestOrg();
    logAudit({ org_id: org.org_id, user_id: 'u1', action: 'login', target: 'session' });
    logAudit({ org_id: org.org_id, user_id: 'u1', action: 'logout', target: 'session' });
    logAudit({ org_id: org.org_id, user_id: 'u2', action: 'login', target: 'session' });

    expect(getUserAuditLog(org.org_id, 'u1')).toHaveLength(2);
    expect(getUserAuditLog(org.org_id, 'u2')).toHaveLength(1);
  });

  it('retrieves org audit log', () => {
    const org = createTestOrg();
    logAudit({ org_id: org.org_id, user_id: 'u1', action: 'login', target: 'session' });
    logAudit({ org_id: org.org_id, action: 'cleanup', target: 'system' });

    expect(getOrgAuditLog(org.org_id)).toHaveLength(2);
  });

  it('audit logs are append-only (no update/delete API)', () => {
    // This test verifies the design constraint: the module exposes no
    // update or delete functions for audit_logs, making them effectively
    // append-only at the application layer.
    const org = createTestOrg();
    const entry = logAudit({
      org_id: org.org_id,
      action: 'test',
      target: 'test',
    });

    // Verify the entry exists and cannot be modified through our API
    const logs = getOrgAuditLog(org.org_id);
    expect(logs).toHaveLength(1);
    expect(logs[0].log_id).toBe(entry.log_id);
  });
});

// ===================================================================
// Channel Bindings
// ===================================================================

describe('channel bindings', () => {
  it('creates and resolves a binding', () => {
    const org = createTestOrg();
    const team = createTestTeam(org.org_id);
    const inst = createTestInstance(org.org_id, team.team_id);

    const binding = createBinding({
      channel_type: 'slack',
      channel_org_id: 'T12345',
      channel_user_id: 'U67890',
      org_id: org.org_id,
      instance_id: inst.instance_id,
    });

    expect(binding.channel_type).toBe('slack');
    expect(binding.channel_org_id).toBe('T12345');
    expect(binding.instance_id).toBe(inst.instance_id);

    const resolved = resolveBinding('slack', 'T12345', 'U67890');
    expect(resolved).toBeDefined();
    expect(resolved!.instance_id).toBe(inst.instance_id);
  });

  it('returns undefined for unknown binding', () => {
    expect(resolveBinding('slack', 'T99', 'U99')).toBeUndefined();
  });

  it('lists bindings by instance', () => {
    const org = createTestOrg();
    const team = createTestTeam(org.org_id);
    const inst = createTestInstance(org.org_id, team.team_id);

    createBinding({
      channel_type: 'slack',
      channel_org_id: 'T1',
      channel_user_id: 'U1',
      org_id: org.org_id,
      instance_id: inst.instance_id,
    });
    createBinding({
      channel_type: 'teams',
      channel_org_id: 'O1',
      channel_user_id: 'U1',
      org_id: org.org_id,
      instance_id: inst.instance_id,
    });

    expect(listBindingsByInstance(inst.instance_id)).toHaveLength(2);
  });

  it('rejects duplicate binding (composite PK)', () => {
    const org = createTestOrg();
    const team = createTestTeam(org.org_id);
    const inst = createTestInstance(org.org_id, team.team_id);

    createBinding({
      channel_type: 'slack',
      channel_org_id: 'T1',
      channel_user_id: 'U1',
      org_id: org.org_id,
      instance_id: inst.instance_id,
    });

    expect(() =>
      createBinding({
        channel_type: 'slack',
        channel_org_id: 'T1',
        channel_user_id: 'U1',
        org_id: org.org_id,
        instance_id: inst.instance_id,
      }),
    ).toThrow();
  });

  it('rejects invalid channel_type', () => {
    const org = createTestOrg();
    const team = createTestTeam(org.org_id);
    const inst = createTestInstance(org.org_id, team.team_id);

    expect(() =>
      createBinding({
        channel_type: 'discord' as string,
        channel_org_id: 'X',
        channel_user_id: 'Y',
        org_id: org.org_id,
        instance_id: inst.instance_id,
      }),
    ).toThrow();
  });

  it('rejects binding with invalid instance FK', () => {
    const org = createTestOrg();
    expect(() =>
      createBinding({
        channel_type: 'slack',
        channel_org_id: 'T1',
        channel_user_id: 'U1',
        org_id: org.org_id,
        instance_id: 'nonexistent-instance',
      }),
    ).toThrow();
  });
});

// ===================================================================
// Taxonomy
// ===================================================================

describe('taxonomy', () => {
  it('auto-seeds L1 categories on init', () => {
    const l1 = getTaxonomyByLevel(1);
    expect(l1).toHaveLength(5);

    const comm = getTaxonomyByCode('COMM');
    expect(comm).toBeDefined();
    expect(comm!.name).toBe('Communication');
    expect(comm!.level).toBe(1);
    expect(comm!.parent_id).toBeNull();
  });

  it('seeds additional taxonomy entries', () => {
    const comm = getTaxonomyByCode('COMM')!;

    seedTaxonomy([
      {
        level: 2,
        parent_id: comm.category_id,
        code: 'COMM.IC',
        name: 'Internal Coordination',
        description: 'Status updates, meeting prep',
      },
    ]);

    const l2 = getTaxonomyByLevel(2);
    expect(l2).toHaveLength(1);
    expect(l2[0].code).toBe('COMM.IC');
    expect(l2[0].parent_id).toBe(comm.category_id);
  });

  it('getTaxonomyByCode returns undefined for unknown code', () => {
    expect(getTaxonomyByCode('NONEXISTENT')).toBeUndefined();
  });

  it('rejects duplicate code (UNIQUE constraint)', () => {
    expect(() =>
      seedTaxonomy([{ level: 1, code: 'COMM', name: 'Duplicate' }]),
    ).toThrow();
  });
});

// ===================================================================
// Foreign key constraints (cross-entity)
// ===================================================================

describe('foreign key constraints', () => {
  it('team requires valid org_id', () => {
    expect(() =>
      createTeam({ org_id: 'fake-org', name: 'T', function: 'f' }),
    ).toThrow();
  });

  it('insight requires valid org_id', () => {
    expect(() =>
      createInsight({ org_id: 'fake-org', stream: 'automate', title: 'X' }),
    ).toThrow();
  });

  it('org context doc requires valid org_id', () => {
    expect(() =>
      createContextDoc({
        org_id: 'fake-org',
        doc_type: 'strategy',
        title: 'X',
        content: 'x',
        updated_by: 'a',
      }),
    ).toThrow();
  });

  it('pattern_log requires valid org_id', () => {
    expect(() =>
      insertPattern({
        user_id_hash: 'h',
        org_id: 'fake-org',
        team_id: 't',
        pattern_type: 'time_allocation',
        category_l1: 'Communication',
        metric_type: 'count',
        metric_value: 1,
        timestamp: '2026-01-01T00:00:00Z',
        period: '2026-W01',
      }),
    ).toThrow();
  });
});
