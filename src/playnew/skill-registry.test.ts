import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  loadSkillsFromDisk,
  getSkillRegistry,
  findSkillBySlashCommand,
  findSkillById,
  reloadSkills,
} from './skill-registry.js';

// ---------------------------------------------------------------------------
// Temp directory management
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-registry-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function writeSkillMd(relPath: string, content: string): void {
  const fullPath = path.join(tmpDir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf-8');
}

const VALID_SKILL = `# SKILL: Email Summarizer

## Metadata
- ID: skill_email_summarizer_001
- Version: 1.0.0
- Category: communication
- Generated: 2026-02-25
- Source: pre_built
- Status: active

## Trigger
User invokes \`/email-summary\` OR forwards an email.

## Context Required
- Organizational context

## Instructions
Summarize the forwarded email content.

## Output Format
Concise bullet points.
`;

const SECOND_SKILL = `# SKILL: Pipeline Risk

## Metadata
- ID: skill_pipeline_risk_001
- Version: 2.0.0
- Category: sales
- Source: pre_built
- Status: active

## Trigger
User invokes \`/pipeline-risk\`

## Context Required
- CRM data

## Instructions
Analyze the sales pipeline for at-risk deals.

## Output Format
Risk assessment table.
`;

const MALFORMED_SKILL = `# Not a SKILL file
Just some random markdown content.
`;

const INCOMPLETE_SKILL = `# SKILL: Incomplete

## Metadata
- ID: skill_incomplete_001
`;

// ===================================================================
// loadSkillsFromDisk
// ===================================================================

describe('loadSkillsFromDisk', () => {
  it('loads a single SKILL.md from a nested directory', () => {
    writeSkillMd('communication/email-summarizer/SKILL.md', VALID_SKILL);

    const count = loadSkillsFromDisk(tmpDir);

    expect(count).toBe(1);
    const registry = getSkillRegistry();
    expect(registry).toHaveLength(1);
    expect(registry[0].name).toBe('Email Summarizer');
    expect(registry[0].metadata.id).toBe('skill_email_summarizer_001');
    expect(registry[0].metadata.category).toBe('communication');
  });

  it('loads multiple skills from different directories', () => {
    writeSkillMd('communication/email-summarizer/SKILL.md', VALID_SKILL);
    writeSkillMd('sales/pipeline-risk/SKILL.md', SECOND_SKILL);

    const count = loadSkillsFromDisk(tmpDir);

    expect(count).toBe(2);
    const registry = getSkillRegistry();
    expect(registry).toHaveLength(2);
    const names = registry.map((s) => s.name).sort();
    expect(names).toEqual(['Email Summarizer', 'Pipeline Risk']);
  });

  it('skips malformed SKILL.md files gracefully', () => {
    writeSkillMd('good/SKILL.md', VALID_SKILL);
    writeSkillMd('bad/SKILL.md', MALFORMED_SKILL);

    const count = loadSkillsFromDisk(tmpDir);

    expect(count).toBe(1);
    const registry = getSkillRegistry();
    expect(registry).toHaveLength(1);
    expect(registry[0].name).toBe('Email Summarizer');
  });

  it('skips SKILL.md files with missing required metadata', () => {
    writeSkillMd('good/SKILL.md', VALID_SKILL);
    writeSkillMd('incomplete/SKILL.md', INCOMPLETE_SKILL);

    const count = loadSkillsFromDisk(tmpDir);

    expect(count).toBe(1);
  });

  it('returns 0 for a nonexistent directory', () => {
    const count = loadSkillsFromDisk('/nonexistent/path/to/skills');

    expect(count).toBe(0);
    expect(getSkillRegistry()).toHaveLength(0);
  });

  it('returns 0 for an empty directory', () => {
    const count = loadSkillsFromDisk(tmpDir);

    expect(count).toBe(0);
    expect(getSkillRegistry()).toHaveLength(0);
  });

  it('ignores non-SKILL.md files', () => {
    writeSkillMd('communication/email-summarizer/SKILL.md', VALID_SKILL);
    writeSkillMd('communication/email-summarizer/README.md', '# Readme');
    writeSkillMd('communication/email-summarizer/notes.txt', 'Some notes');

    const count = loadSkillsFromDisk(tmpDir);

    expect(count).toBe(1);
  });

  it('replaces the registry on reload', () => {
    writeSkillMd('a/SKILL.md', VALID_SKILL);
    loadSkillsFromDisk(tmpDir);
    expect(getSkillRegistry()).toHaveLength(1);

    // Add another skill and reload
    writeSkillMd('b/SKILL.md', SECOND_SKILL);
    const count = reloadSkills(tmpDir);
    expect(count).toBe(2);
    expect(getSkillRegistry()).toHaveLength(2);
  });
});

// ===================================================================
// findSkillBySlashCommand
// ===================================================================

describe('findSkillBySlashCommand', () => {
  beforeEach(() => {
    writeSkillMd('communication/email-summarizer/SKILL.md', VALID_SKILL);
    writeSkillMd('sales/pipeline-risk/SKILL.md', SECOND_SKILL);
    loadSkillsFromDisk(tmpDir);
  });

  it('finds a skill by slash command', () => {
    const skill = findSkillBySlashCommand('/email-summary please summarize this');
    expect(skill).not.toBeNull();
    expect(skill!.name).toBe('Email Summarizer');
  });

  it('finds a different skill by slash command', () => {
    const skill = findSkillBySlashCommand('/pipeline-risk');
    expect(skill).not.toBeNull();
    expect(skill!.name).toBe('Pipeline Risk');
  });

  it('returns null for no matching command', () => {
    const skill = findSkillBySlashCommand('/unknown-command');
    expect(skill).toBeNull();
  });

  it('returns null for regular messages', () => {
    const skill = findSkillBySlashCommand('just a regular message');
    expect(skill).toBeNull();
  });

  it('matches case-insensitively', () => {
    const skill = findSkillBySlashCommand('/Email-Summary please');
    expect(skill).not.toBeNull();
    expect(skill!.name).toBe('Email Summarizer');
  });
});

// ===================================================================
// findSkillById
// ===================================================================

describe('findSkillById', () => {
  beforeEach(() => {
    writeSkillMd('communication/email-summarizer/SKILL.md', VALID_SKILL);
    writeSkillMd('sales/pipeline-risk/SKILL.md', SECOND_SKILL);
    loadSkillsFromDisk(tmpDir);
  });

  it('finds a skill by ID', () => {
    const skill = findSkillById('skill_email_summarizer_001');
    expect(skill).toBeDefined();
    expect(skill!.name).toBe('Email Summarizer');
  });

  it('finds a different skill by ID', () => {
    const skill = findSkillById('skill_pipeline_risk_001');
    expect(skill).toBeDefined();
    expect(skill!.name).toBe('Pipeline Risk');
  });

  it('returns undefined for unknown ID', () => {
    const skill = findSkillById('skill_nonexistent_999');
    expect(skill).toBeUndefined();
  });
});

// ===================================================================
// getSkillRegistry
// ===================================================================

describe('getSkillRegistry', () => {
  it('returns a copy of the registry (mutations do not affect internal state)', () => {
    writeSkillMd('a/SKILL.md', VALID_SKILL);
    loadSkillsFromDisk(tmpDir);

    const registry = getSkillRegistry();
    expect(registry).toHaveLength(1);

    // Mutate the returned array
    registry.pop();

    // Internal state should be unchanged
    expect(getSkillRegistry()).toHaveLength(1);
  });
});
