/**
 * Play New database extension.
 *
 * This module EXTENDS nanoclaw's db.ts — it does NOT replace it.
 * It uses the same better-sqlite3 approach and coding style,
 * adding Play New tables alongside nanoclaw's existing tables.
 *
 * All functions are synchronous (better-sqlite3 is sync).
 * JSON fields are stored as TEXT, parsed with JSON.parse/JSON.stringify.
 * IDs use randomUUID() from node:crypto.
 */

import { randomUUID } from 'node:crypto';

import Database from 'better-sqlite3';

// ---------------------------------------------------------------------------
// Module-level database handle
// ---------------------------------------------------------------------------

let db: Database.Database;

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

function createPlayNewSchema(database: Database.Database): void {
  // Enable foreign keys
  database.pragma('foreign_keys = ON');

  database.exec(`
    -- Organizations
    CREATE TABLE IF NOT EXISTS organizations (
      org_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      industry TEXT NOT NULL,
      size_band TEXT NOT NULL CHECK(size_band IN ('50-200','200-500','500-2000','2000+')),
      geo TEXT NOT NULL,
      plan TEXT NOT NULL DEFAULT 'design_partner',
      status TEXT NOT NULL DEFAULT 'onboarding',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(status);
    CREATE INDEX IF NOT EXISTS idx_organizations_industry ON organizations(industry);

    -- Teams
    CREATE TABLE IF NOT EXISTS teams (
      team_id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES organizations(org_id),
      name TEXT NOT NULL,
      function TEXT NOT NULL,
      size INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_teams_org_id ON teams(org_id);
    CREATE INDEX IF NOT EXISTS idx_teams_function ON teams(function);

    -- User Instances
    CREATE TABLE IF NOT EXISTS user_instances (
      instance_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      org_id TEXT NOT NULL REFERENCES organizations(org_id),
      team_id TEXT NOT NULL REFERENCES teams(team_id),
      role_category TEXT NOT NULL,
      access_mode TEXT NOT NULL DEFAULT 'forward' CHECK(access_mode IN ('forward','full')),
      status TEXT NOT NULL DEFAULT 'provisioning' CHECK(status IN ('provisioning','active','suspended','deleting','deleted')),
      encryption_key_ref TEXT NOT NULL,
      folder TEXT NOT NULL,
      trigger_pattern TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(org_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_user_instances_org_id ON user_instances(org_id);
    CREATE INDEX IF NOT EXISTS idx_user_instances_team_id ON user_instances(team_id);
    CREATE INDEX IF NOT EXISTS idx_user_instances_user_id ON user_instances(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_instances_status ON user_instances(status);

    -- Skill definitions
    CREATE TABLE IF NOT EXISTS skill_definitions (
      skill_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      version TEXT NOT NULL DEFAULT '1.0.0',
      source TEXT NOT NULL DEFAULT 'pre_built',
      quality_score REAL,
      status TEXT NOT NULL DEFAULT 'active',
      usage_count INTEGER NOT NULL DEFAULT 0,
      org_id TEXT,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_skill_definitions_category ON skill_definitions(category);
    CREATE INDEX IF NOT EXISTS idx_skill_definitions_org_id ON skill_definitions(org_id);
    CREATE INDEX IF NOT EXISTS idx_skill_definitions_status ON skill_definitions(status);

    -- User skill assignments
    CREATE TABLE IF NOT EXISTS user_skills (
      user_id TEXT NOT NULL,
      skill_id TEXT NOT NULL REFERENCES skill_definitions(skill_id),
      status TEXT NOT NULL DEFAULT 'assigned' CHECK(status IN ('assigned','active','deactivated')),
      assigned_by TEXT NOT NULL,
      assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_used TEXT,
      feedback_score REAL,
      PRIMARY KEY (user_id, skill_id)
    );
    CREATE INDEX IF NOT EXISTS idx_user_skills_skill_id ON user_skills(skill_id);
    CREATE INDEX IF NOT EXISTS idx_user_skills_status ON user_skills(status);

    -- Pattern logs
    CREATE TABLE IF NOT EXISTS pattern_logs (
      pattern_id TEXT PRIMARY KEY,
      user_id_hash TEXT NOT NULL,
      org_id TEXT NOT NULL REFERENCES organizations(org_id),
      team_id TEXT NOT NULL,
      pattern_type TEXT NOT NULL CHECK(pattern_type IN ('time_allocation','skill_usage','content_type','tool_usage')),
      category_l1 TEXT NOT NULL,
      category_l2 TEXT NOT NULL DEFAULT '',
      category_l3 TEXT NOT NULL DEFAULT '',
      metric_type TEXT NOT NULL CHECK(metric_type IN ('count','duration','frequency','percentage')),
      metric_value REAL NOT NULL,
      tools_involved TEXT NOT NULL DEFAULT '[]',
      timestamp TEXT NOT NULL,
      period TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_pattern_logs_org_id ON pattern_logs(org_id);
    CREATE INDEX IF NOT EXISTS idx_pattern_logs_team_id ON pattern_logs(team_id);
    CREATE INDEX IF NOT EXISTS idx_pattern_logs_pattern_type ON pattern_logs(pattern_type);
    CREATE INDEX IF NOT EXISTS idx_pattern_logs_category_l1 ON pattern_logs(category_l1);
    CREATE INDEX IF NOT EXISTS idx_pattern_logs_period ON pattern_logs(period);
    CREATE INDEX IF NOT EXISTS idx_pattern_logs_timestamp ON pattern_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_pattern_logs_org_period ON pattern_logs(org_id, period);

    -- Intelligence insights
    CREATE TABLE IF NOT EXISTS insights (
      insight_id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES organizations(org_id),
      stream TEXT NOT NULL CHECK(stream IN ('automate','differentiate','innovate')),
      title TEXT NOT NULL,
      evidence TEXT NOT NULL DEFAULT '[]',
      confidence REAL NOT NULL DEFAULT 0.0,
      impact_estimate TEXT,
      recommended_actions TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','reviewed','published','actioned','archived')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      published_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_insights_org_id ON insights(org_id);
    CREATE INDEX IF NOT EXISTS idx_insights_stream ON insights(stream);
    CREATE INDEX IF NOT EXISTS idx_insights_status ON insights(status);
    CREATE INDEX IF NOT EXISTS idx_insights_org_stream ON insights(org_id, stream);

    -- Org context documents
    CREATE TABLE IF NOT EXISTS org_context_docs (
      doc_id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES organizations(org_id),
      doc_type TEXT NOT NULL CHECK(doc_type IN ('strategy','competitive','team_structure','industry','framework')),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      updated_by TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_org_context_docs_org_id ON org_context_docs(org_id);
    CREATE INDEX IF NOT EXISTS idx_org_context_docs_doc_type ON org_context_docs(doc_type);

    -- Audit logs (append-only)
    CREATE TABLE IF NOT EXISTS audit_logs (
      log_id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      user_id TEXT,
      action TEXT NOT NULL,
      target TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '{}',
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_audit_logs_org_id ON audit_logs(org_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_org_timestamp ON audit_logs(org_id, timestamp);

    -- Work category taxonomy (reference data)
    CREATE TABLE IF NOT EXISTS work_category_taxonomy (
      category_id TEXT PRIMARY KEY,
      level INTEGER NOT NULL CHECK(level IN (1,2,3)),
      parent_id TEXT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_taxonomy_level ON work_category_taxonomy(level);
    CREATE INDEX IF NOT EXISTS idx_taxonomy_parent_id ON work_category_taxonomy(parent_id);

    -- Channel bindings
    CREATE TABLE IF NOT EXISTS channel_bindings (
      channel_type TEXT NOT NULL CHECK(channel_type IN ('slack','teams','email')),
      channel_org_id TEXT NOT NULL,
      channel_user_id TEXT NOT NULL,
      org_id TEXT NOT NULL REFERENCES organizations(org_id),
      instance_id TEXT NOT NULL REFERENCES user_instances(instance_id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (channel_type, channel_org_id, channel_user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_channel_bindings_instance ON channel_bindings(instance_id);

    -- Anonymized views
    CREATE VIEW IF NOT EXISTS v_team_patterns AS
    SELECT org_id, team_id, category_l1, category_l2, category_l3,
           metric_type, period,
           AVG(metric_value) as avg_value,
           SUM(metric_value) as total_value,
           COUNT(DISTINCT user_id_hash) as user_count
    FROM pattern_logs
    GROUP BY org_id, team_id, category_l1, category_l2, category_l3, metric_type, period
    HAVING COUNT(DISTINCT user_id_hash) >= 5;

    CREATE VIEW IF NOT EXISTS v_org_patterns AS
    SELECT org_id, category_l1, category_l2, category_l3,
           metric_type, period,
           AVG(metric_value) as avg_value,
           SUM(metric_value) as total_value,
           COUNT(DISTINCT user_id_hash) as user_count
    FROM pattern_logs
    GROUP BY org_id, category_l1, category_l2, category_l3, metric_type, period
    HAVING COUNT(DISTINCT user_id_hash) >= 5;

    CREATE VIEW IF NOT EXISTS v_skill_usage AS
    SELECT pl.org_id, pl.team_id, pl.category_l2 as skill_name, pl.period,
           SUM(pl.metric_value) as activation_count,
           COUNT(DISTINCT pl.user_id_hash) as user_count
    FROM pattern_logs pl
    WHERE pl.pattern_type = 'skill_usage'
    GROUP BY pl.org_id, pl.team_id, pl.category_l2, pl.period
    HAVING COUNT(DISTINCT pl.user_id_hash) >= 5;

    -- Per-user memory entries
    CREATE TABLE IF NOT EXISTS user_memories (
      memory_id TEXT PRIMARY KEY,
      instance_id TEXT NOT NULL REFERENCES user_instances(instance_id),
      memory_type TEXT NOT NULL CHECK(memory_type IN ('fact', 'preference', 'pattern', 'relationship', 'decision', 'context')),
      content TEXT NOT NULL,
      content_embedding BLOB,
      source_channel TEXT,
      source_message_id TEXT,
      confidence REAL DEFAULT 1.0,
      access_count INTEGER DEFAULT 0,
      last_accessed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT,
      is_deleted INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_user_memories_instance ON user_memories(instance_id);
    CREATE INDEX IF NOT EXISTS idx_user_memories_type ON user_memories(instance_id, memory_type);
    CREATE INDEX IF NOT EXISTS idx_user_memories_updated ON user_memories(updated_at);

    -- Conversation sessions
    CREATE TABLE IF NOT EXISTS pn_sessions (
      session_id TEXT PRIMARY KEY,
      instance_id TEXT NOT NULL REFERENCES user_instances(instance_id),
      channel_type TEXT NOT NULL,
      channel_id TEXT,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_activity_at TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'idle', 'closed', 'expired')),
      topic TEXT,
      summary TEXT,
      message_count INTEGER DEFAULT 0,
      token_count INTEGER DEFAULT 0,
      metadata TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_pn_sessions_instance ON pn_sessions(instance_id);
    CREATE INDEX IF NOT EXISTS idx_pn_sessions_activity ON pn_sessions(last_activity_at);
    CREATE INDEX IF NOT EXISTS idx_pn_sessions_status ON pn_sessions(instance_id, status);

    -- Session messages
    CREATE TABLE IF NOT EXISTS session_messages (
      message_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES pn_sessions(session_id),
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      channel_type TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      token_estimate INTEGER DEFAULT 0,
      is_compacted INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_session_messages_session ON session_messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_session_messages_time ON session_messages(timestamp);

    -- GDPR data subject requests
    CREATE TABLE IF NOT EXISTS gdpr_requests (
      request_id TEXT PRIMARY KEY,
      instance_id TEXT NOT NULL REFERENCES user_instances(instance_id),
      org_id TEXT NOT NULL REFERENCES organizations(org_id),
      request_type TEXT NOT NULL CHECK(request_type IN ('export', 'delete', 'rectify', 'restrict', 'portability', 'object')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
      requested_at TEXT NOT NULL DEFAULT (datetime('now')),
      requested_by TEXT NOT NULL,
      processed_at TEXT,
      completed_at TEXT,
      processor_notes TEXT,
      data_scope TEXT DEFAULT 'all',
      export_path TEXT,
      error_message TEXT,
      metadata TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_gdpr_requests_instance ON gdpr_requests(instance_id);
    CREATE INDEX IF NOT EXISTS idx_gdpr_requests_org ON gdpr_requests(org_id);
    CREATE INDEX IF NOT EXISTS idx_gdpr_requests_status ON gdpr_requests(status);

    -- Data retention policies per org
    CREATE TABLE IF NOT EXISTS retention_policies (
      policy_id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES organizations(org_id),
      data_category TEXT NOT NULL CHECK(data_category IN ('personal_memory', 'session_history', 'pattern_logs', 'audit_logs', 'channel_bindings')),
      retention_days INTEGER NOT NULL,
      auto_delete INTEGER DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(org_id, data_category)
    );

    -- Consent records
    CREATE TABLE IF NOT EXISTS consent_records (
      consent_id TEXT PRIMARY KEY,
      instance_id TEXT NOT NULL REFERENCES user_instances(instance_id),
      consent_type TEXT NOT NULL CHECK(consent_type IN ('data_processing', 'memory_storage', 'pattern_collection', 'cross_org_benchmarking', 'email_processing')),
      granted INTEGER NOT NULL DEFAULT 0,
      granted_at TEXT,
      withdrawn_at TEXT,
      ip_address TEXT,
      user_agent TEXT,
      version TEXT NOT NULL DEFAULT '1.0',
      UNIQUE(instance_id, consent_type)
    );
    CREATE INDEX IF NOT EXISTS idx_consent_instance ON consent_records(instance_id);
  `);
}

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

function seedTaxonomyData(database: Database.Database): void {
  const existing = database
    .prepare('SELECT COUNT(*) as cnt FROM work_category_taxonomy')
    .get() as { cnt: number };
  if (existing.cnt > 0) return;

  const insert = database.prepare(
    `INSERT INTO work_category_taxonomy (category_id, level, parent_id, code, name, description)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );

  const txn = database.transaction(() => {
    // L1 categories
    const commId = randomUUID();
    const analId = randomUUID();
    const creaId = randomUUID();
    const cordId = randomUUID();
    const straId = randomUUID();

    insert.run(commId, 1, null, 'COMM', 'Communication', 'All forms of information exchange');
    insert.run(analId, 1, null, 'ANAL', 'Analysis', 'Data examination, research, and decision support');
    insert.run(creaId, 1, null, 'CREA', 'Creation', 'Producing new artifacts -- content, code, designs');
    insert.run(cordId, 1, null, 'CORD', 'Coordination', 'Managing people, projects, and processes');
    insert.run(straId, 1, null, 'STRA', 'Strategy', 'Planning, decision-making, and innovation');
  });

  txn();
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Initialize the Play New database. Call this after nanoclaw's initDatabase().
 * Uses the same STORE_DIR to place the DB file alongside nanoclaw's.
 */
export function initPlayNewDatabase(dbPath: string): void {
  db = new Database(dbPath);
  createPlayNewSchema(db);
  seedTaxonomyData(db);
}

/** @internal - for tests only. Creates a fresh in-memory database. */
export function _initPlayNewTestDatabase(): void {
  db = new Database(':memory:');
  createPlayNewSchema(db);
  seedTaxonomyData(db);
}

/** @internal - for tests only. Returns the raw database instance. */
export function _getTestDatabase(): Database.Database {
  return db;
}

// ---------------------------------------------------------------------------
// Types (row shapes returned from DB)
// ---------------------------------------------------------------------------

export interface OrgRow {
  org_id: string;
  name: string;
  industry: string;
  size_band: string;
  geo: string;
  plan: string;
  status: string;
  created_at: string;
}

export interface TeamRow {
  team_id: string;
  org_id: string;
  name: string;
  function: string;
  size: number;
  created_at: string;
}

export interface UserInstanceRow {
  instance_id: string;
  user_id: string;
  org_id: string;
  team_id: string;
  role_category: string;
  access_mode: string;
  status: string;
  encryption_key_ref: string;
  folder: string;
  trigger_pattern: string;
  created_at: string;
}

export interface SkillDefinitionRow {
  skill_id: string;
  name: string;
  category: string;
  version: string;
  source: string;
  quality_score: number | null;
  status: string;
  usage_count: number;
  org_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface UserSkillRow {
  user_id: string;
  skill_id: string;
  status: string;
  assigned_by: string;
  assigned_at: string;
  last_used: string | null;
  feedback_score: number | null;
}

export interface PatternLogRow {
  pattern_id: string;
  user_id_hash: string;
  org_id: string;
  team_id: string;
  pattern_type: string;
  category_l1: string;
  category_l2: string;
  category_l3: string;
  metric_type: string;
  metric_value: number;
  tools_involved: string;
  timestamp: string;
  period: string;
}

export interface InsightRow {
  insight_id: string;
  org_id: string;
  stream: string;
  title: string;
  evidence: string;
  confidence: number;
  impact_estimate: string | null;
  recommended_actions: string;
  status: string;
  created_at: string;
  published_at: string | null;
}

export interface OrgContextDocRow {
  doc_id: string;
  org_id: string;
  doc_type: string;
  title: string;
  content: string;
  version: number;
  updated_by: string;
  updated_at: string;
}

export interface AuditLogRow {
  log_id: string;
  org_id: string;
  user_id: string | null;
  action: string;
  target: string;
  details: string;
  timestamp: string;
}

export interface TaxonomyRow {
  category_id: string;
  level: number;
  parent_id: string | null;
  code: string;
  name: string;
  description: string | null;
}

export interface ChannelBindingRow {
  channel_type: string;
  channel_org_id: string;
  channel_user_id: string;
  org_id: string;
  instance_id: string;
  created_at: string;
}

export interface UserMemoryRow {
  memory_id: string;
  instance_id: string;
  memory_type: string;
  content: string;
  content_embedding: Buffer | null;
  source_channel: string | null;
  source_message_id: string | null;
  confidence: number;
  access_count: number;
  last_accessed_at: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  is_deleted: number;
}

export interface PnSessionRow {
  session_id: string;
  instance_id: string;
  channel_type: string;
  channel_id: string | null;
  started_at: string;
  last_activity_at: string;
  status: string;
  topic: string | null;
  summary: string | null;
  message_count: number;
  token_count: number;
  metadata: string | null;
}

export interface SessionMessageRow {
  message_id: string;
  session_id: string;
  role: string;
  content: string;
  channel_type: string | null;
  timestamp: string;
  token_estimate: number;
  is_compacted: number;
}

export interface AggregatedPatternRow {
  org_id: string;
  team_id?: string;
  category_l1: string;
  category_l2: string;
  category_l3: string;
  metric_type: string;
  period: string;
  avg_value: number;
  total_value: number;
  user_count: number;
}

export interface SkillUsageRow {
  org_id: string;
  team_id: string;
  skill_name: string;
  period: string;
  activation_count: number;
  user_count: number;
}

export interface GdprRequestRow {
  request_id: string;
  instance_id: string;
  org_id: string;
  request_type: string;
  status: string;
  requested_at: string;
  requested_by: string;
  processed_at: string | null;
  completed_at: string | null;
  processor_notes: string | null;
  data_scope: string;
  export_path: string | null;
  error_message: string | null;
  metadata: string | null;
}

export interface RetentionPolicyRow {
  policy_id: string;
  org_id: string;
  data_category: string;
  retention_days: number;
  auto_delete: number;
  created_at: string;
  updated_at: string;
}

export interface ConsentRecordRow {
  consent_id: string;
  instance_id: string;
  consent_type: string;
  granted: number;
  granted_at: string | null;
  withdrawn_at: string | null;
  ip_address: string | null;
  user_agent: string | null;
  version: string;
}

// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------

export function createOrg(params: {
  name: string;
  industry: string;
  size_band: string;
  geo: string;
  plan?: string;
  status?: string;
}): OrgRow {
  const org_id = randomUUID();
  db.prepare(
    `INSERT INTO organizations (org_id, name, industry, size_band, geo, plan, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    org_id,
    params.name,
    params.industry,
    params.size_band,
    params.geo,
    params.plan ?? 'design_partner',
    params.status ?? 'onboarding',
  );
  return getOrg(org_id)!;
}

export function getOrg(orgId: string): OrgRow | undefined {
  return db.prepare('SELECT * FROM organizations WHERE org_id = ?').get(orgId) as
    | OrgRow
    | undefined;
}

export function getOrgByName(name: string): OrgRow | undefined {
  return db.prepare('SELECT * FROM organizations WHERE name = ?').get(name) as
    | OrgRow
    | undefined;
}

export function listOrgs(): OrgRow[] {
  return db.prepare('SELECT * FROM organizations ORDER BY created_at DESC').all() as OrgRow[];
}

export function updateOrgStatus(orgId: string, status: string): void {
  db.prepare('UPDATE organizations SET status = ? WHERE org_id = ?').run(status, orgId);
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

export function createTeam(params: {
  org_id: string;
  name: string;
  function: string;
  size?: number;
}): TeamRow {
  const team_id = randomUUID();
  db.prepare(
    `INSERT INTO teams (team_id, org_id, name, function, size)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(team_id, params.org_id, params.name, params.function, params.size ?? 0);
  return getTeam(team_id)!;
}

export function getTeam(teamId: string): TeamRow | undefined {
  return db.prepare('SELECT * FROM teams WHERE team_id = ?').get(teamId) as
    | TeamRow
    | undefined;
}

export function listTeamsByOrg(orgId: string): TeamRow[] {
  return db
    .prepare('SELECT * FROM teams WHERE org_id = ? ORDER BY created_at DESC')
    .all(orgId) as TeamRow[];
}

export function updateTeam(
  teamId: string,
  updates: Partial<Pick<TeamRow, 'name' | 'function' | 'size'>>,
): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.function !== undefined) {
    fields.push('"function" = ?');
    values.push(updates.function);
  }
  if (updates.size !== undefined) {
    fields.push('size = ?');
    values.push(updates.size);
  }

  if (fields.length === 0) return;

  values.push(teamId);
  db.prepare(`UPDATE teams SET ${fields.join(', ')} WHERE team_id = ?`).run(...values);
}

// ---------------------------------------------------------------------------
// User Instances
// ---------------------------------------------------------------------------

export function createUserInstance(params: {
  user_id: string;
  org_id: string;
  team_id: string;
  role_category: string;
  access_mode?: string;
  encryption_key_ref: string;
  folder: string;
  trigger_pattern?: string;
}): UserInstanceRow {
  const instance_id = randomUUID();
  db.prepare(
    `INSERT INTO user_instances
       (instance_id, user_id, org_id, team_id, role_category, access_mode,
        encryption_key_ref, folder, trigger_pattern)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    instance_id,
    params.user_id,
    params.org_id,
    params.team_id,
    params.role_category,
    params.access_mode ?? 'forward',
    params.encryption_key_ref,
    params.folder,
    params.trigger_pattern ?? '',
  );
  return getUserInstance(instance_id)!;
}

export function getUserInstance(instanceId: string): UserInstanceRow | undefined {
  return db
    .prepare('SELECT * FROM user_instances WHERE instance_id = ?')
    .get(instanceId) as UserInstanceRow | undefined;
}

export function getUserInstanceByUserId(
  orgId: string,
  userId: string,
): UserInstanceRow | undefined {
  return db
    .prepare('SELECT * FROM user_instances WHERE org_id = ? AND user_id = ?')
    .get(orgId, userId) as UserInstanceRow | undefined;
}

export function listInstancesByOrg(orgId: string): UserInstanceRow[] {
  return db
    .prepare('SELECT * FROM user_instances WHERE org_id = ? ORDER BY created_at DESC')
    .all(orgId) as UserInstanceRow[];
}

export function listInstancesByTeam(teamId: string): UserInstanceRow[] {
  return db
    .prepare('SELECT * FROM user_instances WHERE team_id = ? ORDER BY created_at DESC')
    .all(teamId) as UserInstanceRow[];
}

export function updateInstanceStatus(instanceId: string, status: string): void {
  db.prepare('UPDATE user_instances SET status = ? WHERE instance_id = ?').run(
    status,
    instanceId,
  );
}

export function deleteUserInstance(instanceId: string): void {
  // Soft-delete: set status to 'deleted'
  db.prepare(
    `UPDATE user_instances SET status = 'deleted' WHERE instance_id = ?`,
  ).run(instanceId);
}

// ---------------------------------------------------------------------------
// Skill Definitions
// ---------------------------------------------------------------------------

export function createSkill(params: {
  name: string;
  category: string;
  content: string;
  version?: string;
  source?: string;
  org_id?: string | null;
}): SkillDefinitionRow {
  const skill_id = randomUUID();
  db.prepare(
    `INSERT INTO skill_definitions (skill_id, name, category, content, version, source, org_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    skill_id,
    params.name,
    params.category,
    params.content,
    params.version ?? '1.0.0',
    params.source ?? 'pre_built',
    params.org_id ?? null,
  );
  return getSkill(skill_id)!;
}

export function getSkill(skillId: string): SkillDefinitionRow | undefined {
  return db
    .prepare('SELECT * FROM skill_definitions WHERE skill_id = ?')
    .get(skillId) as SkillDefinitionRow | undefined;
}

export function listSkills(orgId?: string): SkillDefinitionRow[] {
  if (orgId) {
    return db
      .prepare(
        `SELECT * FROM skill_definitions
         WHERE org_id IS NULL OR org_id = ?
         ORDER BY created_at DESC`,
      )
      .all(orgId) as SkillDefinitionRow[];
  }
  return db
    .prepare('SELECT * FROM skill_definitions ORDER BY created_at DESC')
    .all() as SkillDefinitionRow[];
}

export function listSkillsByCategory(category: string): SkillDefinitionRow[] {
  return db
    .prepare('SELECT * FROM skill_definitions WHERE category = ? ORDER BY created_at DESC')
    .all(category) as SkillDefinitionRow[];
}

export function updateSkillUsage(skillId: string): void {
  db.prepare(
    `UPDATE skill_definitions
     SET usage_count = usage_count + 1, updated_at = datetime('now')
     WHERE skill_id = ?`,
  ).run(skillId);
}

// ---------------------------------------------------------------------------
// User Skills
// ---------------------------------------------------------------------------

export function assignSkill(params: {
  user_id: string;
  skill_id: string;
  assigned_by: string;
}): UserSkillRow {
  db.prepare(
    `INSERT INTO user_skills (user_id, skill_id, assigned_by)
     VALUES (?, ?, ?)`,
  ).run(params.user_id, params.skill_id, params.assigned_by);
  return db
    .prepare('SELECT * FROM user_skills WHERE user_id = ? AND skill_id = ?')
    .get(params.user_id, params.skill_id) as UserSkillRow;
}

export function getUserSkills(userId: string): UserSkillRow[] {
  return db
    .prepare('SELECT * FROM user_skills WHERE user_id = ? ORDER BY assigned_at DESC')
    .all(userId) as UserSkillRow[];
}

export function updateSkillStatus(
  userId: string,
  skillId: string,
  status: string,
): void {
  db.prepare(
    'UPDATE user_skills SET status = ? WHERE user_id = ? AND skill_id = ?',
  ).run(status, userId, skillId);
}

export function recordSkillFeedback(
  userId: string,
  skillId: string,
  score: number,
): void {
  db.prepare(
    `UPDATE user_skills
     SET feedback_score = ?, last_used = datetime('now')
     WHERE user_id = ? AND skill_id = ?`,
  ).run(score, userId, skillId);
}

// ---------------------------------------------------------------------------
// Pattern Logs
// ---------------------------------------------------------------------------

export function insertPattern(params: {
  user_id_hash: string;
  org_id: string;
  team_id: string;
  pattern_type: string;
  category_l1: string;
  category_l2?: string;
  category_l3?: string;
  metric_type: string;
  metric_value: number;
  tools_involved?: string[];
  timestamp: string;
  period: string;
}): PatternLogRow {
  const pattern_id = randomUUID();
  db.prepare(
    `INSERT INTO pattern_logs
       (pattern_id, user_id_hash, org_id, team_id, pattern_type,
        category_l1, category_l2, category_l3,
        metric_type, metric_value, tools_involved, timestamp, period)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    pattern_id,
    params.user_id_hash,
    params.org_id,
    params.team_id,
    params.pattern_type,
    params.category_l1,
    params.category_l2 ?? '',
    params.category_l3 ?? '',
    params.metric_type,
    params.metric_value,
    JSON.stringify(params.tools_involved ?? []),
    params.timestamp,
    params.period,
  );
  return db
    .prepare('SELECT * FROM pattern_logs WHERE pattern_id = ?')
    .get(pattern_id) as PatternLogRow;
}

export function getTeamPatterns(
  orgId: string,
  teamId: string,
  period?: string,
): AggregatedPatternRow[] {
  if (period) {
    return db
      .prepare(
        'SELECT * FROM v_team_patterns WHERE org_id = ? AND team_id = ? AND period = ?',
      )
      .all(orgId, teamId, period) as AggregatedPatternRow[];
  }
  return db
    .prepare('SELECT * FROM v_team_patterns WHERE org_id = ? AND team_id = ?')
    .all(orgId, teamId) as AggregatedPatternRow[];
}

export function getOrgPatterns(
  orgId: string,
  period?: string,
): AggregatedPatternRow[] {
  if (period) {
    return db
      .prepare('SELECT * FROM v_org_patterns WHERE org_id = ? AND period = ?')
      .all(orgId, period) as AggregatedPatternRow[];
  }
  return db
    .prepare('SELECT * FROM v_org_patterns WHERE org_id = ?')
    .all(orgId) as AggregatedPatternRow[];
}

// ---------------------------------------------------------------------------
// Insights
// ---------------------------------------------------------------------------

export function createInsight(params: {
  org_id: string;
  stream: string;
  title: string;
  evidence?: unknown[];
  confidence?: number;
  impact_estimate?: string;
  recommended_actions?: string[];
}): InsightRow {
  const insight_id = randomUUID();
  db.prepare(
    `INSERT INTO insights
       (insight_id, org_id, stream, title, evidence, confidence,
        impact_estimate, recommended_actions)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    insight_id,
    params.org_id,
    params.stream,
    params.title,
    JSON.stringify(params.evidence ?? []),
    params.confidence ?? 0.0,
    params.impact_estimate ?? null,
    JSON.stringify(params.recommended_actions ?? []),
  );
  return getInsight(insight_id)!;
}

export function getInsight(insightId: string): InsightRow | undefined {
  return db
    .prepare('SELECT * FROM insights WHERE insight_id = ?')
    .get(insightId) as InsightRow | undefined;
}

export function listInsightsByOrg(orgId: string): InsightRow[] {
  return db
    .prepare('SELECT * FROM insights WHERE org_id = ? ORDER BY created_at DESC')
    .all(orgId) as InsightRow[];
}

export function updateInsightStatus(insightId: string, status: string): void {
  if (status === 'published') {
    db.prepare(
      `UPDATE insights SET status = ?, published_at = datetime('now') WHERE insight_id = ?`,
    ).run(status, insightId);
  } else {
    db.prepare('UPDATE insights SET status = ? WHERE insight_id = ?').run(
      status,
      insightId,
    );
  }
}

// ---------------------------------------------------------------------------
// Org Context Documents
// ---------------------------------------------------------------------------

export function createContextDoc(params: {
  org_id: string;
  doc_type: string;
  title: string;
  content: string;
  updated_by: string;
}): OrgContextDocRow {
  const doc_id = randomUUID();
  db.prepare(
    `INSERT INTO org_context_docs (doc_id, org_id, doc_type, title, content, updated_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(doc_id, params.org_id, params.doc_type, params.title, params.content, params.updated_by);
  return getContextDoc(doc_id)!;
}

export function getContextDoc(docId: string): OrgContextDocRow | undefined {
  return db
    .prepare('SELECT * FROM org_context_docs WHERE doc_id = ?')
    .get(docId) as OrgContextDocRow | undefined;
}

export function listContextDocsByOrg(orgId: string): OrgContextDocRow[] {
  return db
    .prepare('SELECT * FROM org_context_docs WHERE org_id = ? ORDER BY updated_at DESC')
    .all(orgId) as OrgContextDocRow[];
}

export function updateContextDoc(
  docId: string,
  params: { title?: string; content?: string; updated_by: string },
): void {
  const fields: string[] = ["updated_at = datetime('now')", 'updated_by = ?'];
  const values: unknown[] = [params.updated_by];

  if (params.title !== undefined) {
    fields.push('title = ?');
    values.push(params.title);
  }
  if (params.content !== undefined) {
    fields.push('content = ?');
    values.push(params.content);
    // Increment version when content changes
    fields.push('version = version + 1');
  }

  values.push(docId);
  db.prepare(`UPDATE org_context_docs SET ${fields.join(', ')} WHERE doc_id = ?`).run(
    ...values,
  );
}

// ---------------------------------------------------------------------------
// Audit Logs
// ---------------------------------------------------------------------------

export function logAudit(params: {
  org_id: string;
  user_id?: string | null;
  action: string;
  target: string;
  details?: Record<string, unknown>;
}): AuditLogRow {
  const log_id = randomUUID();
  db.prepare(
    `INSERT INTO audit_logs (log_id, org_id, user_id, action, target, details)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    log_id,
    params.org_id,
    params.user_id ?? null,
    params.action,
    params.target,
    JSON.stringify(params.details ?? {}),
  );
  return db.prepare('SELECT * FROM audit_logs WHERE log_id = ?').get(log_id) as AuditLogRow;
}

export function getUserAuditLog(orgId: string, userId: string): AuditLogRow[] {
  return db
    .prepare(
      'SELECT * FROM audit_logs WHERE org_id = ? AND user_id = ? ORDER BY timestamp DESC',
    )
    .all(orgId, userId) as AuditLogRow[];
}

export function getOrgAuditLog(orgId: string): AuditLogRow[] {
  return db
    .prepare('SELECT * FROM audit_logs WHERE org_id = ? ORDER BY timestamp DESC')
    .all(orgId) as AuditLogRow[];
}

// ---------------------------------------------------------------------------
// Channel Bindings
// ---------------------------------------------------------------------------

export function createBinding(params: {
  channel_type: string;
  channel_org_id: string;
  channel_user_id: string;
  org_id: string;
  instance_id: string;
}): ChannelBindingRow {
  db.prepare(
    `INSERT INTO channel_bindings
       (channel_type, channel_org_id, channel_user_id, org_id, instance_id)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(
    params.channel_type,
    params.channel_org_id,
    params.channel_user_id,
    params.org_id,
    params.instance_id,
  );
  return db
    .prepare(
      `SELECT * FROM channel_bindings
       WHERE channel_type = ? AND channel_org_id = ? AND channel_user_id = ?`,
    )
    .get(params.channel_type, params.channel_org_id, params.channel_user_id) as ChannelBindingRow;
}

export function resolveBinding(
  channelType: string,
  channelOrgId: string,
  channelUserId: string,
): ChannelBindingRow | undefined {
  return db
    .prepare(
      `SELECT * FROM channel_bindings
       WHERE channel_type = ? AND channel_org_id = ? AND channel_user_id = ?`,
    )
    .get(channelType, channelOrgId, channelUserId) as ChannelBindingRow | undefined;
}

export function listBindingsByInstance(instanceId: string): ChannelBindingRow[] {
  return db
    .prepare('SELECT * FROM channel_bindings WHERE instance_id = ? ORDER BY created_at DESC')
    .all(instanceId) as ChannelBindingRow[];
}

// ---------------------------------------------------------------------------
// Taxonomy
// ---------------------------------------------------------------------------

export function seedTaxonomy(
  entries: Array<{
    level: number;
    parent_id?: string | null;
    code: string;
    name: string;
    description?: string | null;
  }>,
): void {
  const insert = db.prepare(
    `INSERT INTO work_category_taxonomy (category_id, level, parent_id, code, name, description)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );

  const txn = db.transaction(() => {
    for (const entry of entries) {
      insert.run(
        randomUUID(),
        entry.level,
        entry.parent_id ?? null,
        entry.code,
        entry.name,
        entry.description ?? null,
      );
    }
  });

  txn();
}

export function getTaxonomyByLevel(level: number): TaxonomyRow[] {
  return db
    .prepare('SELECT * FROM work_category_taxonomy WHERE level = ? ORDER BY code')
    .all(level) as TaxonomyRow[];
}

export function getTaxonomyByCode(code: string): TaxonomyRow | undefined {
  return db
    .prepare('SELECT * FROM work_category_taxonomy WHERE code = ?')
    .get(code) as TaxonomyRow | undefined;
}

// ---------------------------------------------------------------------------
// User Memories
// ---------------------------------------------------------------------------

export function insertMemory(params: {
  instance_id: string;
  memory_type: string;
  content: string;
  source_channel?: string | null;
  source_message_id?: string | null;
  confidence?: number;
  expires_at?: string | null;
}): UserMemoryRow {
  const memory_id = randomUUID();
  db.prepare(
    `INSERT INTO user_memories
       (memory_id, instance_id, memory_type, content, source_channel,
        source_message_id, confidence, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    memory_id,
    params.instance_id,
    params.memory_type,
    params.content,
    params.source_channel ?? null,
    params.source_message_id ?? null,
    params.confidence ?? 1.0,
    params.expires_at ?? null,
  );
  return getMemory(memory_id)!;
}

export function getMemory(memoryId: string): UserMemoryRow | undefined {
  return db
    .prepare('SELECT * FROM user_memories WHERE memory_id = ?')
    .get(memoryId) as UserMemoryRow | undefined;
}

export function getMemoriesByInstance(
  instanceId: string,
  opts?: { type?: string; limit?: number; includeDeleted?: boolean },
): UserMemoryRow[] {
  const conditions = ['instance_id = ?'];
  const values: unknown[] = [instanceId];

  if (!opts?.includeDeleted) {
    conditions.push('is_deleted = 0');
  }
  if (opts?.type) {
    conditions.push('memory_type = ?');
    values.push(opts.type);
  }

  const where = conditions.join(' AND ');
  const limit = opts?.limit ? `LIMIT ${opts.limit}` : '';

  return db
    .prepare(
      `SELECT * FROM user_memories WHERE ${where} ORDER BY updated_at DESC ${limit}`,
    )
    .all(...values) as UserMemoryRow[];
}

export function searchMemories(
  instanceId: string,
  keywords: string[],
  opts?: { limit?: number },
): UserMemoryRow[] {
  if (keywords.length === 0) return [];

  const conditions = keywords.map(() => 'content LIKE ?');
  const values: unknown[] = [instanceId, ...keywords.map((k) => `%${k}%`)];

  const limit = opts?.limit ?? 10;

  return db
    .prepare(
      `SELECT * FROM user_memories
       WHERE instance_id = ? AND is_deleted = 0
         AND (${conditions.join(' OR ')})
       ORDER BY updated_at DESC
       LIMIT ?`,
    )
    .all(...values, limit) as UserMemoryRow[];
}

export function updateMemoryRow(
  memoryId: string,
  updates: Partial<Pick<UserMemoryRow, 'content' | 'confidence' | 'expires_at' | 'memory_type'>>,
): void {
  const fields: string[] = ["updated_at = datetime('now')"];
  const values: unknown[] = [];

  if (updates.content !== undefined) {
    fields.push('content = ?');
    values.push(updates.content);
  }
  if (updates.confidence !== undefined) {
    fields.push('confidence = ?');
    values.push(updates.confidence);
  }
  if (updates.expires_at !== undefined) {
    fields.push('expires_at = ?');
    values.push(updates.expires_at);
  }
  if (updates.memory_type !== undefined) {
    fields.push('memory_type = ?');
    values.push(updates.memory_type);
  }

  values.push(memoryId);
  db.prepare(`UPDATE user_memories SET ${fields.join(', ')} WHERE memory_id = ?`).run(
    ...values,
  );
}

export function incrementMemoryAccess(memoryId: string): void {
  db.prepare(
    `UPDATE user_memories
     SET access_count = access_count + 1, last_accessed_at = datetime('now')
     WHERE memory_id = ?`,
  ).run(memoryId);
}

export function softDeleteMemory(memoryId: string): void {
  db.prepare(
    `UPDATE user_memories SET is_deleted = 1, updated_at = datetime('now') WHERE memory_id = ?`,
  ).run(memoryId);
}

export function softDeleteAllMemories(instanceId: string): void {
  db.prepare(
    `UPDATE user_memories SET is_deleted = 1, updated_at = datetime('now') WHERE instance_id = ?`,
  ).run(instanceId);
}

export function deleteExpiredMemories(): number {
  const result = db.prepare(
    `DELETE FROM user_memories WHERE expires_at IS NOT NULL AND expires_at < datetime('now')`,
  ).run();
  return result.changes;
}

export function getMemoryStats(instanceId: string): {
  total: number;
  by_type: Record<string, number>;
  oldest: string | null;
  newest: string | null;
} {
  const counts = db
    .prepare(
      `SELECT memory_type, COUNT(*) as cnt
       FROM user_memories
       WHERE instance_id = ? AND is_deleted = 0
       GROUP BY memory_type`,
    )
    .all(instanceId) as Array<{ memory_type: string; cnt: number }>;

  const by_type: Record<string, number> = {};
  let total = 0;
  for (const row of counts) {
    by_type[row.memory_type] = row.cnt;
    total += row.cnt;
  }

  const oldest = db
    .prepare(
      `SELECT MIN(created_at) as val FROM user_memories WHERE instance_id = ? AND is_deleted = 0`,
    )
    .get(instanceId) as { val: string | null };

  const newest = db
    .prepare(
      `SELECT MAX(created_at) as val FROM user_memories WHERE instance_id = ? AND is_deleted = 0`,
    )
    .get(instanceId) as { val: string | null };

  return {
    total,
    by_type,
    oldest: oldest.val,
    newest: newest.val,
  };
}

// ---------------------------------------------------------------------------
// Play New Sessions
// ---------------------------------------------------------------------------

export function insertPnSession(params: {
  instance_id: string;
  channel_type: string;
  channel_id?: string | null;
  metadata?: string | null;
}): PnSessionRow {
  const session_id = randomUUID();
  db.prepare(
    `INSERT INTO pn_sessions (session_id, instance_id, channel_type, channel_id, metadata)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(
    session_id,
    params.instance_id,
    params.channel_type,
    params.channel_id ?? null,
    params.metadata ?? null,
  );
  return getPnSession(session_id)!;
}

export function getPnSession(sessionId: string): PnSessionRow | undefined {
  return db
    .prepare('SELECT * FROM pn_sessions WHERE session_id = ?')
    .get(sessionId) as PnSessionRow | undefined;
}

export function getActivePnSession(
  instanceId: string,
  channelType?: string,
): PnSessionRow | undefined {
  if (channelType) {
    return db
      .prepare(
        `SELECT * FROM pn_sessions
         WHERE instance_id = ? AND channel_type = ? AND status = 'active'
         ORDER BY last_activity_at DESC LIMIT 1`,
      )
      .get(instanceId, channelType) as PnSessionRow | undefined;
  }
  return db
    .prepare(
      `SELECT * FROM pn_sessions
       WHERE instance_id = ? AND status = 'active'
       ORDER BY last_activity_at DESC LIMIT 1`,
    )
    .get(instanceId) as PnSessionRow | undefined;
}

export function getRecentActivePnSession(
  instanceId: string,
  sinceMinutes: number = 30,
): PnSessionRow | undefined {
  return db
    .prepare(
      `SELECT * FROM pn_sessions
       WHERE instance_id = ? AND status = 'active'
         AND last_activity_at > datetime('now', ?)
       ORDER BY last_activity_at DESC LIMIT 1`,
    )
    .get(instanceId, `-${sinceMinutes} minutes`) as PnSessionRow | undefined;
}

export function updatePnSession(
  sessionId: string,
  updates: Partial<
    Pick<PnSessionRow, 'status' | 'topic' | 'summary' | 'message_count' | 'token_count' | 'metadata'>
  >,
): void {
  const fields: string[] = ["last_activity_at = datetime('now')"];
  const values: unknown[] = [];

  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  if (updates.topic !== undefined) {
    fields.push('topic = ?');
    values.push(updates.topic);
  }
  if (updates.summary !== undefined) {
    fields.push('summary = ?');
    values.push(updates.summary);
  }
  if (updates.message_count !== undefined) {
    fields.push('message_count = ?');
    values.push(updates.message_count);
  }
  if (updates.token_count !== undefined) {
    fields.push('token_count = ?');
    values.push(updates.token_count);
  }
  if (updates.metadata !== undefined) {
    fields.push('metadata = ?');
    values.push(updates.metadata);
  }

  values.push(sessionId);
  db.prepare(`UPDATE pn_sessions SET ${fields.join(', ')} WHERE session_id = ?`).run(
    ...values,
  );
}

export function expireOldPnSessions(minutesIdle: number = 30): number {
  const op = minutesIdle <= 0 ? '<=' : '<';
  const result = db.prepare(
    `UPDATE pn_sessions
     SET status = 'expired'
     WHERE status = 'active'
       AND last_activity_at ${op} datetime('now', ?)`,
  ).run(`-${minutesIdle} minutes`);
  return result.changes;
}

export function listRecentPnSessions(
  instanceId: string,
  limit: number = 5,
): PnSessionRow[] {
  return db
    .prepare(
      `SELECT * FROM pn_sessions
       WHERE instance_id = ?
       ORDER BY last_activity_at DESC, started_at DESC, ROWID DESC
       LIMIT ?`,
    )
    .all(instanceId, limit) as PnSessionRow[];
}

// ---------------------------------------------------------------------------
// Session Messages
// ---------------------------------------------------------------------------

export function insertSessionMessage(params: {
  session_id: string;
  role: string;
  content: string;
  channel_type?: string | null;
  token_estimate?: number;
}): SessionMessageRow {
  const message_id = randomUUID();
  const tokenEstimate = params.token_estimate ?? Math.ceil(params.content.length / 4);
  db.prepare(
    `INSERT INTO session_messages (message_id, session_id, role, content, channel_type, token_estimate)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    message_id,
    params.session_id,
    params.role,
    params.content,
    params.channel_type ?? null,
    tokenEstimate,
  );
  return getSessionMessage(message_id)!;
}

export function getSessionMessage(messageId: string): SessionMessageRow | undefined {
  return db
    .prepare('SELECT * FROM session_messages WHERE message_id = ?')
    .get(messageId) as SessionMessageRow | undefined;
}

export function getSessionMessages(
  sessionId: string,
  opts?: { includeCompacted?: boolean; limit?: number },
): SessionMessageRow[] {
  const conditions = ['session_id = ?'];
  const values: unknown[] = [sessionId];

  if (!opts?.includeCompacted) {
    conditions.push('is_compacted = 0');
  }

  const where = conditions.join(' AND ');
  const limit = opts?.limit ? `LIMIT ${opts.limit}` : '';

  return db
    .prepare(
      `SELECT * FROM session_messages WHERE ${where} ORDER BY timestamp ASC ${limit}`,
    )
    .all(...values) as SessionMessageRow[];
}

export function getSessionMessageCount(sessionId: string): number {
  const row = db
    .prepare('SELECT COUNT(*) as cnt FROM session_messages WHERE session_id = ?')
    .get(sessionId) as { cnt: number };
  return row.cnt;
}

export function getSessionTokenTotal(sessionId: string): number {
  const row = db
    .prepare(
      'SELECT COALESCE(SUM(token_estimate), 0) as total FROM session_messages WHERE session_id = ? AND is_compacted = 0',
    )
    .get(sessionId) as { total: number };
  return row.total;
}

export function markMessagesCompacted(sessionId: string, beforeTimestamp: string): number {
  const result = db.prepare(
    `UPDATE session_messages
     SET is_compacted = 1
     WHERE session_id = ? AND timestamp < ? AND is_compacted = 0`,
  ).run(sessionId, beforeTimestamp);
  return result.changes;
}

/**
 * Mark specific messages as compacted by their IDs.
 */
export function markMessagesByIdsCompacted(messageIds: string[]): number {
  if (messageIds.length === 0) return 0;
  const placeholders = messageIds.map(() => '?').join(', ');
  const result = db.prepare(
    `UPDATE session_messages
     SET is_compacted = 1
     WHERE message_id IN (${placeholders}) AND is_compacted = 0`,
  ).run(...messageIds);
  return result.changes;
}

// ---------------------------------------------------------------------------
// GDPR Requests
// ---------------------------------------------------------------------------

export function createGdprRequest(params: {
  instance_id: string;
  org_id: string;
  request_type: string;
  requested_by: string;
  data_scope?: string;
  metadata?: Record<string, unknown>;
}): GdprRequestRow {
  const request_id = randomUUID();
  db.prepare(
    `INSERT INTO gdpr_requests
       (request_id, instance_id, org_id, request_type, requested_by, data_scope, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    request_id,
    params.instance_id,
    params.org_id,
    params.request_type,
    params.requested_by,
    params.data_scope ?? 'all',
    params.metadata ? JSON.stringify(params.metadata) : null,
  );
  return getGdprRequest(request_id)!;
}

export function getGdprRequest(requestId: string): GdprRequestRow | undefined {
  return db
    .prepare('SELECT * FROM gdpr_requests WHERE request_id = ?')
    .get(requestId) as GdprRequestRow | undefined;
}

export function listGdprRequestsByInstance(instanceId: string): GdprRequestRow[] {
  return db
    .prepare('SELECT * FROM gdpr_requests WHERE instance_id = ? ORDER BY requested_at DESC')
    .all(instanceId) as GdprRequestRow[];
}

export function listGdprRequestsByOrg(orgId: string): GdprRequestRow[] {
  return db
    .prepare('SELECT * FROM gdpr_requests WHERE org_id = ? ORDER BY requested_at DESC')
    .all(orgId) as GdprRequestRow[];
}

export function listGdprRequestsByStatus(status: string): GdprRequestRow[] {
  return db
    .prepare('SELECT * FROM gdpr_requests WHERE status = ? ORDER BY requested_at DESC')
    .all(status) as GdprRequestRow[];
}

export function updateGdprRequestStatus(
  requestId: string,
  status: string,
  extra?: { processor_notes?: string; export_path?: string; error_message?: string },
): void {
  const fields: string[] = ['status = ?'];
  const values: unknown[] = [status];

  if (status === 'processing') {
    fields.push("processed_at = datetime('now')");
  }
  if (status === 'completed' || status === 'failed' || status === 'cancelled') {
    fields.push("completed_at = datetime('now')");
  }
  if (extra?.processor_notes !== undefined) {
    fields.push('processor_notes = ?');
    values.push(extra.processor_notes);
  }
  if (extra?.export_path !== undefined) {
    fields.push('export_path = ?');
    values.push(extra.export_path);
  }
  if (extra?.error_message !== undefined) {
    fields.push('error_message = ?');
    values.push(extra.error_message);
  }

  values.push(requestId);
  db.prepare(`UPDATE gdpr_requests SET ${fields.join(', ')} WHERE request_id = ?`).run(
    ...values,
  );
}

// ---------------------------------------------------------------------------
// Retention Policies
// ---------------------------------------------------------------------------

export function upsertRetentionPolicy(params: {
  org_id: string;
  data_category: string;
  retention_days: number;
  auto_delete?: number;
}): RetentionPolicyRow {
  const policy_id = randomUUID();
  db.prepare(
    `INSERT INTO retention_policies (policy_id, org_id, data_category, retention_days, auto_delete)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(org_id, data_category) DO UPDATE SET
       retention_days = excluded.retention_days,
       auto_delete = excluded.auto_delete,
       updated_at = datetime('now')`,
  ).run(
    policy_id,
    params.org_id,
    params.data_category,
    params.retention_days,
    params.auto_delete ?? 1,
  );
  return db
    .prepare('SELECT * FROM retention_policies WHERE org_id = ? AND data_category = ?')
    .get(params.org_id, params.data_category) as RetentionPolicyRow;
}

export function getRetentionPolicy(
  orgId: string,
  dataCategory: string,
): RetentionPolicyRow | undefined {
  return db
    .prepare('SELECT * FROM retention_policies WHERE org_id = ? AND data_category = ?')
    .get(orgId, dataCategory) as RetentionPolicyRow | undefined;
}

export function listRetentionPolicies(orgId: string): RetentionPolicyRow[] {
  return db
    .prepare('SELECT * FROM retention_policies WHERE org_id = ? ORDER BY data_category')
    .all(orgId) as RetentionPolicyRow[];
}

// ---------------------------------------------------------------------------
// Consent Records
// ---------------------------------------------------------------------------

export function upsertConsent(params: {
  instance_id: string;
  consent_type: string;
  granted: boolean;
  ip_address?: string;
  user_agent?: string;
  version?: string;
}): ConsentRecordRow {
  const consent_id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO consent_records
       (consent_id, instance_id, consent_type, granted, granted_at, withdrawn_at, ip_address, user_agent, version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(instance_id, consent_type) DO UPDATE SET
       granted = excluded.granted,
       granted_at = CASE WHEN excluded.granted = 1 THEN excluded.granted_at ELSE granted_at END,
       withdrawn_at = CASE WHEN excluded.granted = 0 THEN excluded.withdrawn_at ELSE withdrawn_at END,
       ip_address = excluded.ip_address,
       user_agent = excluded.user_agent,
       version = excluded.version`,
  ).run(
    consent_id,
    params.instance_id,
    params.consent_type,
    params.granted ? 1 : 0,
    params.granted ? now : null,
    params.granted ? null : now,
    params.ip_address ?? null,
    params.user_agent ?? null,
    params.version ?? '1.0',
  );
  return db
    .prepare('SELECT * FROM consent_records WHERE instance_id = ? AND consent_type = ?')
    .get(params.instance_id, params.consent_type) as ConsentRecordRow;
}

export function getConsent(
  instanceId: string,
  consentType: string,
): ConsentRecordRow | undefined {
  return db
    .prepare('SELECT * FROM consent_records WHERE instance_id = ? AND consent_type = ?')
    .get(instanceId, consentType) as ConsentRecordRow | undefined;
}

export function listConsents(instanceId: string): ConsentRecordRow[] {
  return db
    .prepare('SELECT * FROM consent_records WHERE instance_id = ? ORDER BY consent_type')
    .all(instanceId) as ConsentRecordRow[];
}

// ---------------------------------------------------------------------------
// GDPR Data Access Helpers (for export/delete operations)
// ---------------------------------------------------------------------------

export function getUserPatternLogs(userIdHash: string, orgId: string): PatternLogRow[] {
  return db
    .prepare('SELECT * FROM pattern_logs WHERE user_id_hash = ? AND org_id = ? ORDER BY timestamp DESC')
    .all(userIdHash, orgId) as PatternLogRow[];
}

export function anonymizePatternLogs(userIdHash: string, orgId: string): number {
  const result = db
    .prepare(
      `UPDATE pattern_logs SET user_id_hash = 'ANONYMIZED_' || pattern_id
       WHERE user_id_hash = ? AND org_id = ?`,
    )
    .run(userIdHash, orgId);
  return result.changes;
}

export function deleteChannelBindingsByInstance(instanceId: string): number {
  const result = db
    .prepare('DELETE FROM channel_bindings WHERE instance_id = ?')
    .run(instanceId);
  return result.changes;
}

export function deleteUserSkillsByUserId(userId: string): number {
  const result = db
    .prepare('DELETE FROM user_skills WHERE user_id = ?')
    .run(userId);
  return result.changes;
}

export function softDeleteUserInstance(instanceId: string): void {
  db.prepare(
    `UPDATE user_instances
     SET status = 'deleted', user_id = '[REDACTED]', role_category = '[REDACTED]',
         encryption_key_ref = '[REDACTED]', folder = '[REDACTED]', trigger_pattern = ''
     WHERE instance_id = ?`,
  ).run(instanceId);
}

export function updateUserInstanceFields(
  instanceId: string,
  updates: Partial<Pick<UserInstanceRow, 'role_category' | 'access_mode' | 'folder' | 'trigger_pattern'>>,
): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.role_category !== undefined) {
    fields.push('role_category = ?');
    values.push(updates.role_category);
  }
  if (updates.access_mode !== undefined) {
    fields.push('access_mode = ?');
    values.push(updates.access_mode);
  }
  if (updates.folder !== undefined) {
    fields.push('folder = ?');
    values.push(updates.folder);
  }
  if (updates.trigger_pattern !== undefined) {
    fields.push('trigger_pattern = ?');
    values.push(updates.trigger_pattern);
  }

  if (fields.length === 0) return;

  values.push(instanceId);
  db.prepare(`UPDATE user_instances SET ${fields.join(', ')} WHERE instance_id = ?`).run(
    ...values,
  );
}

export function deleteUserMemoriesByInstance(instanceId: string): number {
  const result = db
    .prepare('DELETE FROM user_memories WHERE instance_id = ?')
    .run(instanceId);
  return result.changes;
}

export function deleteSessionsByInstance(instanceId: string): number {
  // Delete session messages first (FK constraint)
  db.prepare(
    `DELETE FROM session_messages WHERE session_id IN
     (SELECT session_id FROM pn_sessions WHERE instance_id = ?)`,
  ).run(instanceId);
  const result = db
    .prepare('DELETE FROM pn_sessions WHERE instance_id = ?')
    .run(instanceId);
  return result.changes;
}

export function deleteConsentsByInstance(instanceId: string): number {
  const result = db
    .prepare('DELETE FROM consent_records WHERE instance_id = ?')
    .run(instanceId);
  return result.changes;
}

export function getUserMemoriesByInstance(instanceId: string): Array<{
  memory_id: string;
  instance_id: string;
  memory_type: string;
  content: string;
  created_at: string;
  updated_at: string;
}> {
  return db
    .prepare(
      `SELECT memory_id, instance_id, memory_type, content, created_at, updated_at
       FROM user_memories WHERE instance_id = ? AND is_deleted = 0 ORDER BY updated_at DESC`,
    )
    .all(instanceId) as Array<{
    memory_id: string;
    instance_id: string;
    memory_type: string;
    content: string;
    created_at: string;
    updated_at: string;
  }>;
}

export function getSessionsByInstance(instanceId: string): Array<{
  session_id: string;
  instance_id: string;
  channel_type: string;
  started_at: string;
  last_activity_at: string;
  status: string;
  topic: string | null;
  message_count: number;
}> {
  return db
    .prepare(
      `SELECT session_id, instance_id, channel_type, started_at, last_activity_at,
              status, topic, message_count
       FROM pn_sessions WHERE instance_id = ? ORDER BY last_activity_at DESC`,
    )
    .all(instanceId) as Array<{
    session_id: string;
    instance_id: string;
    channel_type: string;
    started_at: string;
    last_activity_at: string;
    status: string;
    topic: string | null;
    message_count: number;
  }>;
}

// ---------------------------------------------------------------------------
// Retention enforcement helpers
// ---------------------------------------------------------------------------

export function deleteOldPatternLogs(orgId: string, beforeDate: string): number {
  const result = db
    .prepare('DELETE FROM pattern_logs WHERE org_id = ? AND timestamp < ?')
    .run(orgId, beforeDate);
  return result.changes;
}

export function deleteOldAuditLogs(orgId: string, beforeDate: string): number {
  const result = db
    .prepare('DELETE FROM audit_logs WHERE org_id = ? AND timestamp < ?')
    .run(orgId, beforeDate);
  return result.changes;
}

export function deleteOldUserMemories(orgId: string, beforeDate: string): number {
  const result = db
    .prepare(
      `DELETE FROM user_memories WHERE instance_id IN
       (SELECT instance_id FROM user_instances WHERE org_id = ?)
       AND updated_at < ?`,
    )
    .run(orgId, beforeDate);
  return result.changes;
}

export function deleteOldSessions(orgId: string, beforeDate: string): number {
  // Delete session messages first (FK constraint)
  db.prepare(
    `DELETE FROM session_messages WHERE session_id IN
     (SELECT session_id FROM pn_sessions WHERE instance_id IN
       (SELECT instance_id FROM user_instances WHERE org_id = ?)
       AND last_activity_at < ?)`,
  ).run(orgId, beforeDate);
  const result = db
    .prepare(
      `DELETE FROM pn_sessions WHERE instance_id IN
       (SELECT instance_id FROM user_instances WHERE org_id = ?)
       AND last_activity_at < ?`,
    )
    .run(orgId, beforeDate);
  return result.changes;
}

export function deleteOldChannelBindings(orgId: string, beforeDate: string): number {
  const result = db
    .prepare('DELETE FROM channel_bindings WHERE org_id = ? AND created_at < ?')
    .run(orgId, beforeDate);
  return result.changes;
}

export function countDataByCategory(
  orgId: string,
  category: string,
): { total: number; oldest: string | null } {
  let row: { total: number; oldest: string | null };
  switch (category) {
    case 'personal_memory':
      row = db
        .prepare(
          `SELECT COUNT(*) as total, MIN(updated_at) as oldest FROM user_memories
           WHERE instance_id IN (SELECT instance_id FROM user_instances WHERE org_id = ?)
           AND is_deleted = 0`,
        )
        .get(orgId) as { total: number; oldest: string | null };
      break;
    case 'session_history':
      row = db
        .prepare(
          `SELECT COUNT(*) as total, MIN(last_activity_at) as oldest FROM pn_sessions
           WHERE instance_id IN (SELECT instance_id FROM user_instances WHERE org_id = ?)`,
        )
        .get(orgId) as { total: number; oldest: string | null };
      break;
    case 'pattern_logs':
      row = db
        .prepare(
          'SELECT COUNT(*) as total, MIN(timestamp) as oldest FROM pattern_logs WHERE org_id = ?',
        )
        .get(orgId) as { total: number; oldest: string | null };
      break;
    case 'audit_logs':
      row = db
        .prepare(
          'SELECT COUNT(*) as total, MIN(timestamp) as oldest FROM audit_logs WHERE org_id = ?',
        )
        .get(orgId) as { total: number; oldest: string | null };
      break;
    case 'channel_bindings':
      row = db
        .prepare(
          'SELECT COUNT(*) as total, MIN(created_at) as oldest FROM channel_bindings WHERE org_id = ?',
        )
        .get(orgId) as { total: number; oldest: string | null };
      break;
    default:
      row = { total: 0, oldest: null };
  }
  return row;
}
