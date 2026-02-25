/**
 * Play New core type definitions.
 *
 * These extend nanoclaw's types (../types.ts) for multi-tenant,
 * per-user assistant instances with organizational intelligence.
 *
 * Key mapping: nanoclaw RegisteredGroup → Play New UserInstance
 */

import type { Channel, ContainerConfig, NewMessage } from '../types.js';

// ─── Organizations ──────────────────────────────────────────

export interface Organization {
  org_id: string;
  name: string;
  industry: string;
  size_band: '50-200' | '200-500' | '500-2000' | '2000+';
  geo: 'EU_south' | 'EU_north' | 'EU_west' | 'UK' | 'DACH' | 'Nordics';
  plan: 'design_partner' | 'essential' | 'pro' | 'enterprise';
  status: 'onboarding' | 'active' | 'suspended' | 'offboarded';
  created_at: string;
}

export interface Team {
  team_id: string;
  org_id: string;
  name: string;
  function: string; // From work category taxonomy L1
  size: number;
  created_at: string;
}

// ─── User Instances (extends nanoclaw RegisteredGroup) ──────

export type AccessMode = 'forward' | 'full';
export type InstanceStatus = 'provisioning' | 'active' | 'suspended' | 'deleting' | 'deleted';

export interface UserInstance {
  instance_id: string;
  user_id: string;
  org_id: string;
  team_id: string;
  role_category: string;
  access_mode: AccessMode;
  status: InstanceStatus;
  encryption_key_ref: string;
  created_at: string;

  // Nanoclaw compatibility — maps to RegisteredGroup fields
  folder: string; // Per-user data folder path
  trigger: string; // Channel-specific trigger pattern
  containerConfig?: ContainerConfig;
}

// ─── Channels (extends nanoclaw Channel) ────────────────────

/**
 * Extended Channel interface for Play New multi-tenant support.
 * Nanoclaw's Channel interface is preserved; this adds Play New-specific methods.
 */
export interface PlayNewChannel extends Channel {
  /**
   * Resolve a channel-specific user ID to a Play New user instance.
   * e.g., Slack user ID → UserInstance
   */
  resolveUser(channelUserId: string): Promise<UserInstance | null>;

  /**
   * Send a rich message with formatting (Slack blocks, Teams cards).
   */
  sendRichMessage?(jid: string, message: RichMessage): Promise<void>;
}

export interface RichMessage {
  text: string; // Fallback plain text
  blocks?: RichBlock[];
  attachments?: RichAttachment[];
}

export interface RichBlock {
  type: 'section' | 'header' | 'divider' | 'actions';
  text?: string;
  fields?: string[];
  accessory?: unknown;
}

export interface RichAttachment {
  filename: string;
  content: Buffer;
  mimetype: string;
}

// ─── Skills ─────────────────────────────────────────────────

export type SkillStatus = 'observed' | 'proposed' | 'approved' | 'active' | 'refined' | 'retired';
export type SkillSource = 'pre_built' | 'advisor_created' | 'auto_generated' | 'community';

export interface SkillDefinition {
  skill_id: string;
  name: string;
  category: SkillCategory;
  version: string;
  source: SkillSource;
  quality_score: number | null;
  status: SkillStatus;
  usage_count: number;
  org_id: string | null; // null = shared across orgs
  content: string; // Raw SKILL.md content
  created_at: string;
  updated_at: string;
}

export type SkillCategory =
  | 'communication'
  | 'analysis'
  | 'sales'
  | 'operations'
  | 'strategy'
  | 'management'
  | 'creative';

export interface UserSkillAssignment {
  user_id: string;
  skill_id: string;
  status: 'assigned' | 'active' | 'deactivated';
  assigned_by: string; // advisor or system
  assigned_at: string;
  last_used: string | null;
  feedback_score: number | null;
}

export interface SkillMetadata {
  id: string;
  version: string;
  category: SkillCategory;
  generated: string;
  source: SkillSource;
  status: SkillStatus;
  quality_score: number | null;
  usage: string;
}

export interface SkillTrigger {
  slash_command?: string; // e.g., /pipeline-risk
  schedule?: string; // cron expression
  event?: string; // e.g., 'monday_morning'
  pattern?: string; // regex match on user input
}

// ─── Pattern Collection ─────────────────────────────────────

export type PatternType = 'time_allocation' | 'skill_usage' | 'content_type' | 'tool_usage';
export type MetricType = 'count' | 'duration' | 'frequency' | 'percentage';

export interface PatternRecord {
  pattern_id: string;
  user_id: string; // Hashed — never stored in plain text in pattern_logs
  org_id: string;
  team_id: string;
  pattern_type: PatternType;
  category_L1: string;
  category_L2: string;
  category_L3: string;
  metric_type: MetricType;
  metric_value: number;
  tools_involved: string[]; // Generalized tool categories, never specific tool names
  timestamp: string;
  period: string; // ISO week or month — temporal blurring
}

// ─── Intelligence ───────────────────────────────────────────

export type IntelligenceStream = 'automate' | 'differentiate' | 'innovate';
export type InsightStatus = 'draft' | 'reviewed' | 'published' | 'actioned' | 'archived';

export interface IntelligenceInsight {
  insight_id: string;
  org_id: string;
  stream: IntelligenceStream;
  title: string;
  evidence: PatternEvidence[];
  confidence: number; // 0.0 - 1.0
  impact_estimate: string;
  recommended_actions: string[];
  status: InsightStatus;
  created_at: string;
  published_at: string | null;
}

export interface PatternEvidence {
  team: string;
  category: string;
  metric: string;
  value: number;
  user_count: number;
  period: string;
}

// ─── Org Context ────────────────────────────────────────────

export type ContextDocType = 'strategy' | 'competitive' | 'team_structure' | 'industry' | 'framework';

export interface OrgContextDocument {
  doc_id: string;
  org_id: string;
  doc_type: ContextDocType;
  title: string;
  content: string;
  version: number;
  updated_by: string;
  updated_at: string;
}

// ─── Audit ──────────────────────────────────────────────────

export interface AuditLogEntry {
  log_id: string;
  org_id: string;
  user_id: string | null; // null for system actions
  action: string;
  target: string;
  details: Record<string, unknown>;
  timestamp: string;
}
