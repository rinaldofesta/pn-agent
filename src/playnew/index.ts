/**
 * Play New extension module.
 *
 * This is the entry point for all Play New-specific functionality
 * layered on top of nanoclaw's core.
 */

export type {
  Organization,
  Team,
  UserInstance,
  PlayNewChannel,
  RichMessage,
  SkillDefinition,
  UserSkillAssignment,
  PatternRecord,
  IntelligenceInsight,
  OrgContextDocument,
  AuditLogEntry,
} from './types.js';

// Message pipeline — main orchestrator
export {
  handleInboundMessage,
  buildSystemPrompt,
  classifyInteraction,
  logInteraction,
} from './message-pipeline.js';
export type { PipelineDeps, PipelineResult } from './message-pipeline.js';

// Skill registry
export {
  loadSkillsFromDisk,
  getSkillRegistry,
  findSkillBySlashCommand,
  findSkillById,
  reloadSkills,
} from './skill-registry.js';

// Re-export wired modules
export { assembleOrgContext, buildContextPrompt } from './context-engine.js';
export { resolveUserInstance, parseJid } from './tenant-resolver.js';
export { emitPattern, buildPatternRecord } from './pattern-collector.js';
