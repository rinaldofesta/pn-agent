/**
 * GDPR Service — Central GDPR compliance service for Play New.
 *
 * Implements all data subject rights as defined by the GDPR:
 * - Right to Access (Article 15) — Data export
 * - Right to Erasure (Article 17) — Data deletion
 * - Right to Rectification (Article 16) — Data correction
 * - Right to Restriction (Article 18) — Processing suspension
 * - Right to Data Portability (Article 20) — Portable export
 * - Right to Object (Article 21) — Object to processing
 *
 * Every action is logged in the audit trail. Audit logs themselves are
 * never deleted as part of GDPR operations (legal requirement per Article 30).
 *
 * See: docs/specs/security/gdpr-compliance-spec.md
 * See: docs/specs/data/data-classification.md
 */

import { randomUUID } from 'node:crypto';
import { logger } from '../logger.js';
import { hashUserId } from './pattern-collector.js';
import { withdrawConsent } from './consent-manager.js';
import type { ConsentType } from './consent-manager.js';
import {
  createGdprRequest,
  getGdprRequest,
  listGdprRequestsByInstance,
  listGdprRequestsByOrg,
  listGdprRequestsByStatus,
  updateGdprRequestStatus,
  getUserInstance,
  listBindingsByInstance,
  getUserSkills,
  getUserAuditLog,
  getUserPatternLogs,
  logAudit,
  anonymizePatternLogs,
  deleteChannelBindingsByInstance,
  deleteUserSkillsByUserId,
  softDeleteUserInstance,
  updateInstanceStatus,
  updateUserInstanceFields,
  getUserMemoriesByInstance,
  getSessionsByInstance,
  deleteUserMemoriesByInstance,
  deleteSessionsByInstance,
  deleteConsentsByInstance,
  listConsents,
  upsertConsent,
} from './db.js';
import type {
  GdprRequestRow,
  UserInstanceRow,
  ChannelBindingRow,
  UserSkillRow,
  PatternLogRow,
  AuditLogRow,
  ConsentRecordRow,
} from './db.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GdprRequestType = 'export' | 'delete' | 'rectify' | 'restrict' | 'portability' | 'object';
export type GdprRequestStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type DataScope = 'all' | 'memories' | 'sessions' | 'patterns' | 'bindings';

export interface UserDataExport {
  export_metadata: {
    instance_id: string;
    org_id: string;
    exported_at: string;
    format_version: string;
    scope: string;
  };
  user_instance: Partial<UserInstanceRow> | null;
  channel_bindings: ChannelBindingRow[];
  skills: UserSkillRow[];
  memories: Array<{
    memory_id: string;
    instance_id: string;
    memory_type: string;
    content: string;
    created_at: string;
    updated_at: string;
  }>;
  sessions: Array<{
    session_id: string;
    instance_id: string;
    channel_type: string;
    started_at: string;
    last_activity_at: string;
    status: string;
    topic: string | null;
    message_count: number;
  }>;
  pattern_logs: PatternLogRow[];
  audit_log: AuditLogRow[];
  consents: ConsentRecordRow[];
}

export interface PortableDataExport extends UserDataExport {
  schema_version: string;
  portable_format: 'play-new-gdpr-export-v1';
}

export interface RectificationUpdate {
  role_category?: string;
  access_mode?: string;
}

export type ObjectionProcessingType =
  | 'pattern_collection'
  | 'cross_org_benchmarking'
  | 'memory_storage';

// ---------------------------------------------------------------------------
// GDPR Request Lifecycle
// ---------------------------------------------------------------------------

/**
 * Create a GDPR data subject request and begin processing.
 */
export function createRequest(params: {
  instanceId: string;
  orgId: string;
  requestType: GdprRequestType;
  requestedBy: string;
  dataScope?: DataScope;
  metadata?: Record<string, unknown>;
}): GdprRequestRow {
  const request = createGdprRequest({
    instance_id: params.instanceId,
    org_id: params.orgId,
    request_type: params.requestType,
    requested_by: params.requestedBy,
    data_scope: params.dataScope,
    metadata: params.metadata,
  });

  logger.info(
    {
      requestId: request.request_id,
      instanceId: params.instanceId,
      type: params.requestType,
    },
    'GDPR request created',
  );

  return request;
}

/**
 * Get a GDPR request by ID.
 */
export function getRequest(requestId: string): GdprRequestRow | undefined {
  return getGdprRequest(requestId);
}

/**
 * List all GDPR requests for a user instance.
 */
export function listRequestsByInstance(instanceId: string): GdprRequestRow[] {
  return listGdprRequestsByInstance(instanceId);
}

/**
 * List all GDPR requests for an organization.
 */
export function listRequestsByOrg(orgId: string): GdprRequestRow[] {
  return listGdprRequestsByOrg(orgId);
}

/**
 * List all GDPR requests by status.
 */
export function listRequestsByStatus(status: GdprRequestStatus): GdprRequestRow[] {
  return listGdprRequestsByStatus(status);
}

// ---------------------------------------------------------------------------
// Right to Access (Article 15) — Data Export
// ---------------------------------------------------------------------------

/**
 * Export all personal data for a user instance.
 * Collects data from all relevant tables into a structured JSON object.
 *
 * @param instanceId - The user instance to export data for
 * @param scope - Scope of data to export (default: 'all')
 * @returns Structured JSON export of all user data
 */
export function exportUserData(
  instanceId: string,
  scope: DataScope = 'all',
): UserDataExport {
  const instance = getUserInstance(instanceId);
  if (!instance) {
    throw new Error(`User instance not found: ${instanceId}`);
  }

  // Create the GDPR request record
  const request = createGdprRequest({
    instance_id: instanceId,
    org_id: instance.org_id,
    request_type: 'export',
    requested_by: instanceId,
    data_scope: scope,
  });

  updateGdprRequestStatus(request.request_id, 'processing');

  try {
    const exportData: UserDataExport = {
      export_metadata: {
        instance_id: instanceId,
        org_id: instance.org_id,
        exported_at: new Date().toISOString(),
        format_version: '1.0',
        scope,
      },
      user_instance: null,
      channel_bindings: [],
      skills: [],
      memories: [],
      sessions: [],
      pattern_logs: [],
      audit_log: [],
      consents: [],
    };

    // Always include the user instance record (with sensitive fields preserved)
    if (scope === 'all') {
      exportData.user_instance = {
        instance_id: instance.instance_id,
        user_id: instance.user_id,
        org_id: instance.org_id,
        team_id: instance.team_id,
        role_category: instance.role_category,
        access_mode: instance.access_mode,
        status: instance.status,
        created_at: instance.created_at,
      };
    }

    // Channel bindings
    if (scope === 'all' || scope === 'bindings') {
      exportData.channel_bindings = listBindingsByInstance(instanceId);
    }

    // Skills
    if (scope === 'all') {
      exportData.skills = getUserSkills(instance.user_id);
    }

    // Memories
    if (scope === 'all' || scope === 'memories') {
      exportData.memories = getUserMemoriesByInstance(instanceId);
    }

    // Sessions
    if (scope === 'all' || scope === 'sessions') {
      exportData.sessions = getSessionsByInstance(instanceId);
    }

    // Pattern logs (user's own)
    if (scope === 'all' || scope === 'patterns') {
      const userIdHash = hashUserId(instance.user_id, instance.org_id);
      exportData.pattern_logs = getUserPatternLogs(userIdHash, instance.org_id);
    }

    // Audit log entries involving this user
    if (scope === 'all') {
      exportData.audit_log = getUserAuditLog(instance.org_id, instanceId);
    }

    // Consent records
    if (scope === 'all') {
      exportData.consents = listConsents(instanceId);
    }

    // Mark request as completed
    updateGdprRequestStatus(request.request_id, 'completed');

    // Log the export in audit
    logAudit({
      org_id: instance.org_id,
      user_id: instanceId,
      action: 'gdpr_export',
      target: `user_instance:${instanceId}`,
      details: {
        request_id: request.request_id,
        scope,
        format: 'json',
      },
    });

    logger.info(
      { instanceId, scope, requestId: request.request_id },
      'User data exported',
    );

    return exportData;
  } catch (err) {
    updateGdprRequestStatus(request.request_id, 'failed', {
      error_message: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Right to Erasure (Article 17) — Delete
// ---------------------------------------------------------------------------

/**
 * Delete all personal data for a user instance.
 *
 * - Soft-deletes the user_instances record (sets status='deleted', redacts personal fields)
 * - Deletes channel_bindings
 * - Deletes user_skills
 * - Deletes user_memories
 * - Deletes pn_sessions and session_messages
 * - Deletes consent_records
 * - Anonymizes pattern_logs (makes user_id_hash unlinkable)
 * - Does NOT delete audit_logs (legal requirement)
 * - Does NOT delete org-level data (insights, context docs)
 *
 * @param instanceId - The user instance to delete data for
 * @param scope - Scope of deletion (default: 'all')
 */
export function deleteUserData(
  instanceId: string,
  scope: DataScope = 'all',
): { request_id: string; deleted: Record<string, number> } {
  const instance = getUserInstance(instanceId);
  if (!instance) {
    throw new Error(`User instance not found: ${instanceId}`);
  }

  // Create the GDPR request record
  const request = createGdprRequest({
    instance_id: instanceId,
    org_id: instance.org_id,
    request_type: 'delete',
    requested_by: instanceId,
    data_scope: scope,
  });

  updateGdprRequestStatus(request.request_id, 'processing');

  try {
    const deleted: Record<string, number> = {};

    // Delete channel bindings
    if (scope === 'all' || scope === 'bindings') {
      deleted.channel_bindings = deleteChannelBindingsByInstance(instanceId);
    }

    // Delete user skills
    if (scope === 'all') {
      deleted.user_skills = deleteUserSkillsByUserId(instance.user_id);
    }

    // Delete user memories
    if (scope === 'all' || scope === 'memories') {
      deleted.user_memories = deleteUserMemoriesByInstance(instanceId);
    }

    // Delete sessions and session messages
    if (scope === 'all' || scope === 'sessions') {
      deleted.sessions = deleteSessionsByInstance(instanceId);
    }

    // Delete consent records
    if (scope === 'all') {
      deleted.consent_records = deleteConsentsByInstance(instanceId);
    }

    // Anonymize pattern logs (make user_id_hash unlinkable)
    if (scope === 'all' || scope === 'patterns') {
      const userIdHash = hashUserId(instance.user_id, instance.org_id);
      deleted.pattern_logs_anonymized = anonymizePatternLogs(userIdHash, instance.org_id);
    }

    // Soft-delete the user instance (redact personal fields)
    if (scope === 'all') {
      softDeleteUserInstance(instanceId);
      deleted.user_instance = 1;
    }

    // Mark request as completed
    updateGdprRequestStatus(request.request_id, 'completed', {
      processor_notes: `Deleted data: ${JSON.stringify(deleted)}`,
    });

    // Log the deletion in audit (audit logs are NEVER deleted)
    logAudit({
      org_id: instance.org_id,
      user_id: instanceId,
      action: 'gdpr_delete',
      target: `user_instance:${instanceId}`,
      details: {
        request_id: request.request_id,
        scope,
        deleted,
      },
    });

    logger.info(
      { instanceId, scope, requestId: request.request_id, deleted },
      'User data deleted',
    );

    return { request_id: request.request_id, deleted };
  } catch (err) {
    updateGdprRequestStatus(request.request_id, 'failed', {
      error_message: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Right to Rectification (Article 16)
// ---------------------------------------------------------------------------

/**
 * Rectify (correct) personal data for a user instance.
 * Only user_instances fields that are user-controllable can be rectified.
 *
 * @param instanceId - The user instance to rectify
 * @param corrections - Fields to correct
 */
export function rectifyUserData(
  instanceId: string,
  corrections: RectificationUpdate,
): { request_id: string; updated_fields: string[] } {
  const instance = getUserInstance(instanceId);
  if (!instance) {
    throw new Error(`User instance not found: ${instanceId}`);
  }

  const request = createGdprRequest({
    instance_id: instanceId,
    org_id: instance.org_id,
    request_type: 'rectify',
    requested_by: instanceId,
    metadata: { corrections },
  });

  updateGdprRequestStatus(request.request_id, 'processing');

  try {
    const updatedFields: string[] = [];
    const updates: Partial<Pick<UserInstanceRow, 'role_category' | 'access_mode'>> = {};

    if (corrections.role_category !== undefined) {
      updates.role_category = corrections.role_category;
      updatedFields.push('role_category');
    }
    if (corrections.access_mode !== undefined) {
      updates.access_mode = corrections.access_mode;
      updatedFields.push('access_mode');
    }

    if (updatedFields.length > 0) {
      updateUserInstanceFields(instanceId, updates);
    }

    updateGdprRequestStatus(request.request_id, 'completed', {
      processor_notes: `Updated fields: ${updatedFields.join(', ')}`,
    });

    logAudit({
      org_id: instance.org_id,
      user_id: instanceId,
      action: 'gdpr_rectify',
      target: `user_instance:${instanceId}`,
      details: {
        request_id: request.request_id,
        updated_fields: updatedFields,
        corrections,
      },
    });

    logger.info(
      { instanceId, updatedFields, requestId: request.request_id },
      'User data rectified',
    );

    return { request_id: request.request_id, updated_fields: updatedFields };
  } catch (err) {
    updateGdprRequestStatus(request.request_id, 'failed', {
      error_message: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Right to Restriction (Article 18)
// ---------------------------------------------------------------------------

/**
 * Restrict processing for a user instance.
 * Sets the user instance status to 'suspended'. Existing data is preserved
 * but not processed. The user can resume processing later.
 *
 * @param instanceId - The user instance to restrict
 */
export function restrictProcessing(
  instanceId: string,
): { request_id: string } {
  const instance = getUserInstance(instanceId);
  if (!instance) {
    throw new Error(`User instance not found: ${instanceId}`);
  }

  const request = createGdprRequest({
    instance_id: instanceId,
    org_id: instance.org_id,
    request_type: 'restrict',
    requested_by: instanceId,
  });

  updateGdprRequestStatus(request.request_id, 'processing');

  try {
    updateInstanceStatus(instanceId, 'suspended');

    updateGdprRequestStatus(request.request_id, 'completed');

    logAudit({
      org_id: instance.org_id,
      user_id: instanceId,
      action: 'gdpr_restrict',
      target: `user_instance:${instanceId}`,
      details: {
        request_id: request.request_id,
        previous_status: instance.status,
        new_status: 'suspended',
      },
    });

    logger.info(
      { instanceId, requestId: request.request_id },
      'Processing restricted',
    );

    return { request_id: request.request_id };
  } catch (err) {
    updateGdprRequestStatus(request.request_id, 'failed', {
      error_message: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Right to Data Portability (Article 20)
// ---------------------------------------------------------------------------

/**
 * Export user data in a standardized, machine-readable portable format.
 * Similar to exportUserData but includes a schema version and portable format marker.
 *
 * @param instanceId - The user instance to export data for
 */
export function exportPortableData(instanceId: string): PortableDataExport {
  const baseExport = exportUserData(instanceId, 'all');

  const portableExport: PortableDataExport = {
    ...baseExport,
    schema_version: '1.0.0',
    portable_format: 'play-new-gdpr-export-v1',
  };

  // Log portability-specific action
  const instance = getUserInstance(instanceId);
  if (instance) {
    logAudit({
      org_id: instance.org_id,
      user_id: instanceId,
      action: 'gdpr_portability',
      target: `user_instance:${instanceId}`,
      details: {
        schema_version: '1.0.0',
        portable_format: 'play-new-gdpr-export-v1',
      },
    });
  }

  return portableExport;
}

// ---------------------------------------------------------------------------
// Right to Object (Article 21)
// ---------------------------------------------------------------------------

/**
 * Object to specific data processing activities.
 * Updates consent records to withdraw consent for the specified processing type.
 *
 * @param instanceId - The user instance objecting
 * @param processingType - Type of processing to object to
 */
export function objectToProcessing(
  instanceId: string,
  processingType: ObjectionProcessingType,
): { request_id: string } {
  const instance = getUserInstance(instanceId);
  if (!instance) {
    throw new Error(`User instance not found: ${instanceId}`);
  }

  const request = createGdprRequest({
    instance_id: instanceId,
    org_id: instance.org_id,
    request_type: 'object',
    requested_by: instanceId,
    metadata: { processing_type: processingType },
  });

  updateGdprRequestStatus(request.request_id, 'processing');

  try {
    // Withdraw consent for the specified processing type
    withdrawConsent(instanceId, instance.org_id, processingType as ConsentType);

    updateGdprRequestStatus(request.request_id, 'completed');

    logAudit({
      org_id: instance.org_id,
      user_id: instanceId,
      action: 'gdpr_object',
      target: `user_instance:${instanceId}`,
      details: {
        request_id: request.request_id,
        processing_type: processingType,
      },
    });

    logger.info(
      { instanceId, processingType, requestId: request.request_id },
      'Objection to processing recorded',
    );

    return { request_id: request.request_id };
  } catch (err) {
    updateGdprRequestStatus(request.request_id, 'failed', {
      error_message: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Audit Trail Convenience
// ---------------------------------------------------------------------------

/**
 * Convenience wrapper for logging GDPR actions in the audit trail.
 */
export function logGdprAction(
  action: string,
  instanceId: string,
  orgId: string,
  details: Record<string, unknown> = {},
): void {
  logAudit({
    org_id: orgId,
    user_id: instanceId,
    action,
    target: `user_instance:${instanceId}`,
    details,
  });
}
