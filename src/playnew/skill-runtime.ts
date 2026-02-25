/**
 * Skill Runtime — User skill (SKILL.md) execution engine.
 *
 * Parses and executes Play New's user-facing skills. These are
 * LLM instruction documents (NOT code-modification skills like nanoclaw's).
 *
 * Skill execution flow:
 * 1. User invokes via slash command or trigger condition
 * 2. Skill instructions loaded from registry
 * 3. Required context gathered (MCP connectors, org context)
 * 4. Instructions injected into Claude SDK system prompt
 * 5. LLM executes skill instructions
 * 6. Output formatted per channel
 * 7. Feedback collected
 *
 * See: docs/specs/skills/skill-engine-spec.md
 * See: docs/specs/skills/skill-md-format.md
 * See: PRD Section 12
 */

import type { SkillDefinition, SkillMetadata, SkillTrigger, SkillCategory } from './types.js';

/**
 * Parsed SKILL.md file content.
 */
export interface ParsedSkill {
  name: string;
  metadata: SkillMetadata;
  trigger: SkillTrigger;
  contextRequired: string[];
  instructions: string;
  outputFormat: string;
  qualityCriteria?: string;
  feedbackLoop?: string;
  dependencies?: string[];
  mcpConnectors?: string[];
}

/**
 * Parse a SKILL.md file into structured data.
 *
 * Expected format:
 *   # SKILL: {name}
 *   ## Metadata
 *   - ID: skill_{id}
 *   - Version: {semver}
 *   - Category: {category}
 *   ...
 *   ## Trigger
 *   ...
 *   ## Context Required
 *   ...
 *   ## Instructions
 *   ...
 *   ## Output Format
 *   ...
 */
export function parseSkillMd(content: string): ParsedSkill | null {
  const lines = content.split('\n');

  // Parse skill name from header
  const headerLine = lines.find((l) => l.startsWith('# SKILL:'));
  if (!headerLine) return null;
  const name = headerLine.replace('# SKILL:', '').trim();

  // Parse sections
  const sections = parseSections(lines);

  // Parse metadata
  const metadata = parseMetadata(sections['Metadata'] ?? '');
  if (!metadata) return null;

  // Parse trigger
  const trigger = parseTrigger(sections['Trigger'] ?? '');

  return {
    name,
    metadata,
    trigger,
    contextRequired: parseListSection(sections['Context Required'] ?? ''),
    instructions: sections['Instructions'] ?? '',
    outputFormat: sections['Output Format'] ?? '',
    qualityCriteria: sections['Quality Criteria'],
    feedbackLoop: sections['Feedback Loop'],
    dependencies: sections['Dependencies'] ? parseListSection(sections['Dependencies']) : undefined,
    mcpConnectors: sections['MCP Connectors Required']
      ? parseListSection(sections['MCP Connectors Required'])
      : undefined,
  };
}

/**
 * Build the prompt injection for a skill execution.
 * This gets appended to the system prompt when a skill is invoked.
 */
export function buildSkillPrompt(skill: ParsedSkill): string {
  const parts: string[] = [];

  parts.push(`## Active Skill: ${skill.name}`);
  parts.push('');
  parts.push(
    'The user has invoked a skill. Follow these instructions precisely.',
  );
  parts.push('');
  parts.push('### Instructions');
  parts.push(skill.instructions);
  parts.push('');
  parts.push('### Output Format');
  parts.push(skill.outputFormat);

  if (skill.qualityCriteria) {
    parts.push('');
    parts.push('### Quality Criteria');
    parts.push(skill.qualityCriteria);
  }

  return parts.join('\n');
}

/**
 * Check if a user message matches a skill's slash command trigger.
 */
export function matchSlashCommand(
  message: string,
  skills: ParsedSkill[],
): ParsedSkill | null {
  const trimmed = message.trim().toLowerCase();
  for (const skill of skills) {
    if (
      skill.trigger.slash_command &&
      trimmed.startsWith(skill.trigger.slash_command.toLowerCase())
    ) {
      return skill;
    }
  }
  return null;
}

// ─── Internal Parsers ───────────────────────────────────────

function parseSections(lines: string[]): Record<string, string> {
  const sections: Record<string, string> = {};
  let currentSection = '';
  let currentContent: string[] = [];

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (currentSection) {
        sections[currentSection] = currentContent.join('\n').trim();
      }
      currentSection = line.replace('## ', '').trim();
      currentContent = [];
    } else if (currentSection) {
      currentContent.push(line);
    }
  }

  if (currentSection) {
    sections[currentSection] = currentContent.join('\n').trim();
  }

  return sections;
}

function parseMetadata(content: string): SkillMetadata | null {
  const fields: Record<string, string> = {};

  for (const line of content.split('\n')) {
    const match = line.match(/^-\s+(\w[\w\s]*?):\s+(.+)$/);
    if (match) {
      fields[match[1].trim()] = match[2].trim();
    }
  }

  if (!fields['ID'] || !fields['Version'] || !fields['Category']) {
    return null;
  }

  return {
    id: fields['ID'],
    version: fields['Version'],
    category: fields['Category'] as SkillCategory,
    generated: fields['Generated'] ?? '',
    source: (fields['Source'] as SkillMetadata['source']) ?? 'pre_built',
    status: (fields['Status'] as SkillMetadata['status']) ?? 'active',
    quality_score: fields['Quality Score'] ? parseFloat(fields['Quality Score']) : null,
    usage: fields['Usage'] ?? '',
  };
}

function parseTrigger(content: string): SkillTrigger {
  const trigger: SkillTrigger = {};

  // Look for slash command
  const slashMatch = content.match(/`?(\/[\w-]+)`?/);
  if (slashMatch) {
    trigger.slash_command = slashMatch[1];
  }

  // Look for schedule keywords
  if (content.toLowerCase().includes('monday morning')) {
    trigger.event = 'monday_morning';
  }
  if (content.toLowerCase().includes('friday')) {
    trigger.event = 'friday_review';
  }

  return trigger;
}

function parseListSection(content: string): string[] {
  return content
    .split('\n')
    .filter((line) => line.startsWith('-'))
    .map((line) => line.replace(/^-\s*/, '').trim());
}
