/**
 * Consent Manager — Manages user consent for data processing activities.
 *
 * GDPR requires explicit, informed, freely given consent for each processing
 * activity. This module tracks consent grants and withdrawals, and provides
 * guard functions that can be used to gate processing pipelines.
 *
 * Consent types:
 * - data_processing: Core assistant functionality (messages, responses)
 * - memory_storage: Storing personal memories for future context
 * - pattern_collection: Anonymized pattern extraction for org intelligence
 * - cross_org_benchmarking: Anonymized cross-org benchmark contributions
 * - email_processing: Processing forwarded email content
 *
 * See: docs/specs/security/gdpr-compliance-spec.md
 */

import { logger } from '../logger.js';
import {
  upsertConsent,
  getConsent,
  listConsents,
  logAudit,
} from './db.js';
import type { ConsentRecordRow } from './db.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConsentType =
  | 'data_processing'
  | 'memory_storage'
  | 'pattern_collection'
  | 'cross_org_benchmarking'
  | 'email_processing';

const VALID_CONSENT_TYPES: ReadonlySet<string> = new Set<ConsentType>([
  'data_processing',
  'memory_storage',
  'pattern_collection',
  'cross_org_benchmarking',
  'email_processing',
]);

export interface ConsentMetadata {
  ip_address?: string;
  user_agent?: string;
  version?: string;
}

export class ConsentRequiredError extends Error {
  public readonly consentType: ConsentType;
  public readonly instanceId: string;

  constructor(instanceId: string, consentType: ConsentType) {
    super(
      `Consent required: user instance ${instanceId} has not granted '${consentType}' consent`,
    );
    this.name = 'ConsentRequiredError';
    this.consentType = consentType;
    this.instanceId = instanceId;
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateConsentType(consentType: string): asserts consentType is ConsentType {
  if (!VALID_CONSENT_TYPES.has(consentType)) {
    throw new Error(
      `Invalid consent type '${consentType}'. Valid types: ${[...VALID_CONSENT_TYPES].join(', ')}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Consent Operations
// ---------------------------------------------------------------------------

/**
 * Record that a user has granted consent for a specific processing activity.
 * If consent was previously withdrawn, this re-grants it with updated timestamps.
 */
export function grantConsent(
  instanceId: string,
  orgId: string,
  consentType: ConsentType,
  metadata?: ConsentMetadata,
): ConsentRecordRow {
  validateConsentType(consentType);

  const record = upsertConsent({
    instance_id: instanceId,
    consent_type: consentType,
    granted: true,
    ip_address: metadata?.ip_address,
    user_agent: metadata?.user_agent,
    version: metadata?.version,
  });

  logAudit({
    org_id: orgId,
    user_id: instanceId,
    action: 'consent_granted',
    target: `consent:${consentType}`,
    details: {
      consent_type: consentType,
      version: metadata?.version ?? '1.0',
    },
  });

  logger.info(
    { instanceId, consentType },
    'Consent granted',
  );

  return record;
}

/**
 * Record that a user has withdrawn consent for a specific processing activity.
 * The consent record is preserved (for audit purposes) but marked as not granted.
 */
export function withdrawConsent(
  instanceId: string,
  orgId: string,
  consentType: ConsentType,
): ConsentRecordRow {
  validateConsentType(consentType);

  const record = upsertConsent({
    instance_id: instanceId,
    consent_type: consentType,
    granted: false,
  });

  logAudit({
    org_id: orgId,
    user_id: instanceId,
    action: 'consent_withdrawn',
    target: `consent:${consentType}`,
    details: {
      consent_type: consentType,
    },
  });

  logger.info(
    { instanceId, consentType },
    'Consent withdrawn',
  );

  return record;
}

/**
 * Check whether a user has active consent for a specific processing activity.
 * Returns true if consent is granted, false otherwise (including if no record exists).
 */
export function hasConsent(
  instanceId: string,
  consentType: ConsentType,
): boolean {
  validateConsentType(consentType);

  const record = getConsent(instanceId, consentType);
  return record !== undefined && record.granted === 1;
}

/**
 * Get all consent records for a user instance.
 * Returns an array of consent records showing the current state of each consent type.
 */
export function getUserConsents(instanceId: string): ConsentRecordRow[] {
  return listConsents(instanceId);
}

/**
 * Guard function: throws ConsentRequiredError if the specified consent is not granted.
 * Use this at the start of processing pipelines to enforce consent requirements.
 *
 * @throws {ConsentRequiredError} if consent is not granted
 */
export function requireConsent(
  instanceId: string,
  consentType: ConsentType,
): void {
  if (!hasConsent(instanceId, consentType)) {
    throw new ConsentRequiredError(instanceId, consentType);
  }
}
