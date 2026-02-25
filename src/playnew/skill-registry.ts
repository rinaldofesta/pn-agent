/**
 * Skill Registry — Loads, caches, and manages SKILL.md definitions.
 *
 * Scans the skills/ directory recursively for SKILL.md files,
 * parses them via skill-runtime's parseSkillMd, and provides
 * lookup by ID, slash command, and full registry access.
 *
 * Skills are cached in memory with a manual reload function.
 */

import fs from 'fs';
import path from 'path';

import { logger } from '../logger.js';
import { parseSkillMd, matchSlashCommand, type ParsedSkill } from './skill-runtime.js';

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let registry: ParsedSkill[] = [];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load all SKILL.md files from a directory tree.
 * Scans recursively, parses each file, and replaces the in-memory registry.
 *
 * @param skillsDir - Root directory to scan (e.g., `skills/`)
 * @returns The number of skills successfully loaded
 */
export function loadSkillsFromDisk(skillsDir: string): number {
  const loaded: ParsedSkill[] = [];

  try {
    if (!fs.existsSync(skillsDir)) {
      logger.warn({ skillsDir }, 'Skills directory does not exist');
      registry = [];
      return 0;
    }

    const files = findSkillFiles(skillsDir);

    for (const filePath of files) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = parseSkillMd(content);
        if (parsed) {
          loaded.push(parsed);
          logger.debug(
            { skill: parsed.name, id: parsed.metadata.id, path: filePath },
            'Loaded skill',
          );
        } else {
          logger.warn({ path: filePath }, 'Failed to parse SKILL.md — missing required fields');
        }
      } catch (err) {
        logger.warn({ path: filePath, err }, 'Error reading SKILL.md file');
      }
    }
  } catch (err) {
    logger.error({ skillsDir, err }, 'Error scanning skills directory');
  }

  registry = loaded;
  logger.info({ count: loaded.length, skillsDir }, 'Skill registry loaded');
  return loaded.length;
}

/**
 * Get all loaded skills.
 */
export function getSkillRegistry(): ParsedSkill[] {
  return [...registry];
}

/**
 * Find a skill that matches a slash command in the given message.
 * Returns null if no skill matches.
 */
export function findSkillBySlashCommand(message: string): ParsedSkill | null {
  return matchSlashCommand(message, registry);
}

/**
 * Find a skill by its metadata ID.
 * Returns undefined if not found.
 */
export function findSkillById(skillId: string): ParsedSkill | undefined {
  return registry.find((s) => s.metadata.id === skillId);
}

/**
 * Reload skills from disk. Convenience wrapper around loadSkillsFromDisk
 * that reloads from the same directory used in the last load.
 */
export function reloadSkills(skillsDir: string): number {
  return loadSkillsFromDisk(skillsDir);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Recursively find all SKILL.md files under a directory.
 */
function findSkillFiles(dir: string): string[] {
  const results: string[] = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...findSkillFiles(fullPath));
      } else if (entry.name === 'SKILL.md') {
        results.push(fullPath);
      }
    }
  } catch (err) {
    logger.debug({ dir, err }, 'Error reading directory in skill scan');
  }

  return results;
}
