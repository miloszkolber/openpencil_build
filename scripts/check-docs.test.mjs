import { test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkDocumentation } from './check-docs.mjs';

const spec = '# Example\n\n## Purpose\nA concrete capability contract for this validation fixture.\n\n## Requirements\n\n### Requirement: Valid result\nThe fixture SHALL produce a valid result.\n\n#### Scenario: Success\n- **WHEN** a request arrives\n- **THEN** the result is valid\n';

function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'openpencil-docs-test-'));
  try {
    mkdirSync(join(root, 'openspec/specs/example'), { recursive: true });
    mkdirSync(join(root, 'openspec/changes/review'), { recursive: true });
    writeFileSync(join(root, 'openspec/specs/example/spec.md'), spec);
    writeFileSync(join(root, 'openspec/README.md'), '[Example](specs/example/spec.md#purpose)\n');
    writeFileSync(join(root, 'openspec/changes/review/proposal.md'), '# Review\n');
    writeFileSync(join(root, 'openspec/changes/review/tasks.md'), '- [ ] 1.1 Review result and record evidence\n');
    writeFileSync(join(root, 'openspec/changes/review/.openspec.yaml'), 'schema: spec-driven\nskip_specs: true\n');
    run(root);
  } finally { rmSync(root, { recursive: true, force: true }); }
}

test('valid spec and explicit no-delta change pass', () => fixture(root => {
  expect(checkDocumentation(root).failures).toEqual([]);
}));

test('broken paths and anchors are reported', () => fixture(root => {
  writeFileSync(join(root, 'openspec/README.md'), '[Missing](missing.md)\n[Wrong](specs/example/spec.md#absent)\n');
  const failures = checkDocumentation(root).failures;
  expect(failures.some(item => item.includes('missing link'))).toBe(true);
  expect(failures.some(item => item.includes('missing anchor'))).toBe(true);
}));

test('every requirement needs its own valid scenario', () => fixture(root => {
  writeFileSync(join(root, 'openspec/specs/example/spec.md'), spec + '\n### Requirement: Missing case\nThe fixture SHALL reject this.\n');
  expect(checkDocumentation(root).failures.some(item => item.includes('Missing case has no scenarios'))).toBe(true);
}));

test('implicit no-delta change and unnumbered tasks fail', () => fixture(root => {
  writeFileSync(join(root, 'openspec/changes/review/.openspec.yaml'), 'schema: spec-driven\n');
  writeFileSync(join(root, 'openspec/changes/review/tasks.md'), '- [ ] Review result\n');
  const failures = checkDocumentation(root).failures;
  expect(failures.some(item => item.includes('requires deltas'))).toBe(true);
  expect(failures.some(item => item.includes('unnumbered/invalid task'))).toBe(true);
}));

test('REMOVED deltas do not invent new requirements or scenarios', () => fixture(root => {
  mkdirSync(join(root, 'openspec/changes/review/specs/example'), { recursive: true });
  writeFileSync(join(root, 'openspec/changes/review/.openspec.yaml'), 'schema: spec-driven\n');
  writeFileSync(join(root, 'openspec/changes/review/specs/example/spec.md'),
    '# Delta\n\n## REMOVED Requirements\n\n### Requirement: Valid result\nReason: capability retired.\n');
  expect(checkDocumentation(root).failures).toEqual([]);
}));

test('a duplicate documentation tree fails', () => fixture(root => {
  mkdirSync(join(root, 'docs'));
  expect(checkDocumentation(root).failures.some(item => item.includes('only documentation tree'))).toBe(true);
}));

test('a planning alias fails', () => fixture(root => {
  rmSync(join(root, 'openspec'), { recursive: true });
  mkdirSync(join(root, 'docs'));
  symlinkSync('docs', join(root, 'openspec'));
  expect(checkDocumentation(root).failures).toEqual(['openspec must be a real directory, not an alias']);
}));

test('a missing planning directory fails clearly', () => fixture(root => {
  rmSync(join(root, 'openspec'), { recursive: true });
  expect(checkDocumentation(root).failures).toEqual(['missing openspec directory']);
}));
