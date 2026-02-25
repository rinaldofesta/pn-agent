/**
 * Tenant Resolver — Multi-tenant routing for Play New.
 *
 * Resolves channel-specific identifiers (Slack workspace + user ID,
 * Teams tenant + conversation ID, email address) to the correct
 * Organization and UserInstance.
 *
 * This is the Play New equivalent of nanoclaw's group-based routing,
 * extended for multi-tenant, per-user isolation.
 */

import { logger } from '../logger.js';
import { resolveBinding, getUserInstance } from './db.js';
import type { UserInstance, AccessMode, InstanceStatus } from './types.js';

/**
 * Channel binding: maps a channel-specific identity to a Play New user instance.
 */
export interface ChannelBinding {
  channel_type: 'slack' | 'teams' | 'email';
  channel_org_id: string; // Slack workspace ID, Teams tenant ID, email domain
  channel_user_id: string; // Slack user ID, Teams AAD object ID, email address
  org_id: string;
  instance_id: string;
}

/**
 * Resolve a channel message to the target user instance.
 *
 * JID format conventions:
 *   slack:{workspace_id}:{channel_id}
 *   teams:{tenant_id}:{conversation_id}
 *   email:{sha256(assistant_email)}
 */
export function parseJid(jid: string): {
  channel: string;
  org_ref: string;
  user_ref: string;
} | null {
  const parts = jid.split(':');
  if (parts.length < 3) return null;

  return {
    channel: parts[0],
    org_ref: parts[1],
    user_ref: parts.slice(2).join(':'),
  };
}

/**
 * Resolve a channel binding to a UserInstance.
 * Looks up the channel_bindings table, then fetches the full UserInstance.
 */
export async function resolveUserInstance(
  channelType: string,
  channelOrgId: string,
  channelUserId: string,
): Promise<UserInstance | null> {
  try {
    const binding = resolveBinding(channelType, channelOrgId, channelUserId);
    if (!binding) {
      logger.debug(
        { channelType, channelOrgId, channelUserId },
        'No channel binding found',
      );
      return null;
    }

    const row = getUserInstance(binding.instance_id);
    if (!row) {
      logger.warn(
        { instanceId: binding.instance_id, channelType, channelUserId },
        'Channel binding references missing user instance',
      );
      return null;
    }

    // Map DB row to UserInstance type
    return {
      instance_id: row.instance_id,
      user_id: row.user_id,
      org_id: row.org_id,
      team_id: row.team_id,
      role_category: row.role_category,
      access_mode: row.access_mode as AccessMode,
      status: row.status as InstanceStatus,
      encryption_key_ref: row.encryption_key_ref,
      created_at: row.created_at,
      folder: row.folder,
      trigger: row.trigger_pattern,
    };
  } catch (err) {
    logger.error(
      { channelType, channelOrgId, channelUserId, err },
      'Error resolving user instance',
    );
    return null;
  }
}
