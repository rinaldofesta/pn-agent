/**
 * Context Engine — Organizational context injection for Play New.
 *
 * Retrieves relevant organizational context (strategy, team structure,
 * competitive position, frameworks) and injects it into every
 * Claude Agent SDK call via the system prompt.
 *
 * Phase 0: Static markdown documents per org, loaded from filesystem.
 * Phase 1+: RAG pipeline with pgvector similarity search.
 *
 * See: docs/specs/memory/org-context-engine-spec.md
 * See: PRD Section 6.3.5
 */

import type { OrgContextDocument } from './types.js';

/**
 * Context that gets injected into every assistant interaction.
 * Assembled from multiple org context documents.
 */
export interface AssembledContext {
  /** Always injected — org strategy and team structure */
  coreContext: string;
  /** Injected when relevant to the user's query */
  relevantContext: string;
  /** Total token estimate for budget management */
  estimatedTokens: number;
}

/** Maximum tokens allocated for org context in the system prompt */
const MAX_CONTEXT_TOKENS = 10_000;

/**
 * Assemble organizational context for a user instance.
 *
 * Phase 0: Loads static markdown from the org's context directory.
 * Phase 1+: Will use pgvector similarity search against the user's query.
 *
 * @param orgId - Organization identifier
 * @param _userQuery - The user's current query (used for relevance in Phase 1+)
 */
export async function assembleOrgContext(
  orgId: string,
  _userQuery?: string,
): Promise<AssembledContext> {
  // Phase 0: Load static context files
  // These are stored in groups/{org_id}/context/ as markdown files
  // created by Play New advisors during onboarding

  // TODO: Implement filesystem loading + future pgvector RAG
  // See docs/specs/memory/org-context-engine-spec.md for full design

  return {
    coreContext: `[Organizational context for ${orgId} — to be loaded from context documents]`,
    relevantContext: '',
    estimatedTokens: 0,
  };
}

/**
 * Build the system prompt section for organizational context.
 * This gets prepended to the agent's CLAUDE.md system prompt.
 */
export function buildContextPrompt(context: AssembledContext): string {
  const parts: string[] = [];

  parts.push('## Organizational Context');
  parts.push('');
  parts.push(
    'You are a personal AI assistant within this organization. Use the following context to provide strategically aware responses.',
  );
  parts.push('');

  if (context.coreContext) {
    parts.push('### Strategy & Structure');
    parts.push(context.coreContext);
    parts.push('');
  }

  if (context.relevantContext) {
    parts.push('### Relevant Context');
    parts.push(context.relevantContext);
    parts.push('');
  }

  return parts.join('\n');
}

/**
 * Placeholder: retrieve org context documents from storage.
 */
export async function getOrgContextDocs(
  _orgId: string,
  _docType?: string,
): Promise<OrgContextDocument[]> {
  // TODO: Query org_context_docs table
  return [];
}

/**
 * Placeholder: update an org context document.
 * Only Play New advisors can call this.
 */
export async function updateOrgContextDoc(
  _doc: Partial<OrgContextDocument> & { doc_id: string },
): Promise<void> {
  // TODO: Update org_context_docs table with version increment
}
