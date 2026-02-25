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

import fs from 'fs';
import path from 'path';

import { GROUPS_DIR } from '../config.js';
import { logger } from '../logger.js';
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
  // Phase 0: Load static context files from groups/{orgId}/context/
  // These are markdown files created by Play New advisors during onboarding

  const contextDir = path.join(GROUPS_DIR, orgId, 'context');

  const coreParts: string[] = [];
  const relevantParts: string[] = [];
  let totalChars = 0;

  // Core context files that are always injected (strategy, team_structure)
  const coreFiles = ['strategy.md', 'team_structure.md', 'team-structure.md'];
  // Additional context files injected as relevant context
  const supplementalFiles = ['competitive.md', 'industry.md', 'framework.md', 'frameworks.md'];

  try {
    if (!fs.existsSync(contextDir)) {
      logger.debug({ orgId, contextDir }, 'No context directory found for org');
      return {
        coreContext: '',
        relevantContext: '',
        estimatedTokens: 0,
      };
    }

    const files = fs.readdirSync(contextDir).filter((f) => f.endsWith('.md'));

    for (const file of files) {
      const filePath = path.join(contextDir, file);
      try {
        const content = fs.readFileSync(filePath, 'utf-8').trim();
        if (!content) continue;

        const charCount = content.length;
        // Rough token estimate: ~4 chars per token
        if (totalChars + charCount > MAX_CONTEXT_TOKENS * 4) {
          logger.debug(
            { orgId, file, totalChars },
            'Skipping context file — would exceed token budget',
          );
          continue;
        }

        totalChars += charCount;

        if (coreFiles.includes(file)) {
          coreParts.push(content);
        } else {
          relevantParts.push(content);
        }
      } catch (err) {
        logger.warn({ orgId, file, err }, 'Failed to read context file');
      }
    }
  } catch (err) {
    logger.warn({ orgId, contextDir, err }, 'Failed to read context directory');
  }

  const estimatedTokens = Math.ceil(totalChars / 4);

  return {
    coreContext: coreParts.join('\n\n'),
    relevantContext: relevantParts.join('\n\n'),
    estimatedTokens,
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
