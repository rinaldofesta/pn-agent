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

import type { UserInstance } from './types.js';

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
 * Placeholder: resolve a channel binding to a UserInstance.
 * Will be backed by PostgreSQL + Redis cache in production.
 */
export async function resolveUserInstance(
  _channelType: string,
  _channelOrgId: string,
  _channelUserId: string,
): Promise<UserInstance | null> {
  // TODO: Implement with database lookup + Redis cache
  // See docs/architecture/02-multi-tenant-architecture.md for routing design
  return null;
}
