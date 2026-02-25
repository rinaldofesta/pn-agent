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

// Personal memory
export {
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
export type {
  MemoryType,
  StoreMemoryOptions,
  RecallOptions,
  MemoryStats,
  ExtractedMemory,
} from './memory-store.js';

// Session management
export {
  getOrCreateSession,
  addMessage,
  getSessionHistory,
  compactSession,
  closeSession,
  expireStaleSessions,
  getRecentSessions,
  buildSessionPrompt,
  needsCompaction,
  estimateTokens,
} from './session-manager.js';
export type {
  AddMessageOptions,
  SessionHistoryOptions,
  SessionPromptOptions,
} from './session-manager.js';

// Re-export wired modules
export { assembleOrgContext, buildContextPrompt } from './context-engine.js';
export { resolveUserInstance, parseJid } from './tenant-resolver.js';
export { emitPattern, buildPatternRecord } from './pattern-collector.js';

// GDPR compliance
export {
  exportUserData,
  deleteUserData,
  rectifyUserData,
  restrictProcessing,
  exportPortableData,
  objectToProcessing,
  createRequest as createGdprRequest,
  getRequest as getGdprRequest,
  listRequestsByInstance as listGdprRequestsByInstance,
  listRequestsByOrg as listGdprRequestsByOrg,
  logGdprAction,
} from './gdpr-service.js';
export type {
  GdprRequestType,
  GdprRequestStatus,
  DataScope,
  UserDataExport,
  PortableDataExport,
  RectificationUpdate,
  ObjectionProcessingType,
} from './gdpr-service.js';

// Consent management
export {
  grantConsent,
  withdrawConsent,
  hasConsent,
  getUserConsents,
  requireConsent,
  ConsentRequiredError,
} from './consent-manager.js';
export type { ConsentType, ConsentMetadata } from './consent-manager.js';

// Retention management
export {
  setRetentionPolicy,
  getRetentionPolicy,
  getOrgPolicies,
  enforceRetentionPolicies,
  getRetentionReport,
} from './retention-manager.js';
export type {
  DataCategory,
  RetentionEnforcementResult,
  RetentionReport,
} from './retention-manager.js';
