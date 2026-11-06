import { readFileSync, readdirSync, existsSync, lstatSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export function checkDocumentation(root) {
  const failures = [];
  const fail = (file, message) => failures.push(`${relative(root, file)}: ${message}`);
  const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = resolve(dir, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
  const planning = resolve(root, 'openspec');
  try {
    if (!lstatSync(planning).isDirectory()) {
      return { files: 0, failures: ['openspec must be a real directory, not an alias'] };
    }
  } catch {
    return { files: 0, failures: ['missing openspec directory'] };
  }
  if (existsSync(resolve(root, 'docs'))) failures.push('openspec must be the only documentation tree (remove docs)');
  const files = walk(planning).filter(file => file.endsWith('.md'));
  for (const name of ['README.md', 'AGENTS.md']) {
    const file = resolve(root, name);
    if (existsSync(file)) files.push(file);
  }

  const heading = value => value.toLowerCase().replace(/[^\p{L}\p{N}_\- ]/gu, '').replace(/ /g, '-');
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const prose = text.replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm, '');
    for (const [, href] of prose.matchAll(/\[[^\]]*\]\(([^\s)]+)\)/g)) {
      if (/^[a-z][a-z0-9+.-]*:/i.test(href)) continue;
      const [target, anchor] = href.split('#');
      const destination = target ? resolve(dirname(file), decodeURIComponent(target)) : file;
      if (!existsSync(destination)) { fail(file, `missing link ${href}`); continue; }
      if (anchor && destination.endsWith('.md')) {
        const headings = [...readFileSync(destination, 'utf8').matchAll(/^#{1,6}\s+(.+)$/gm)].map(match => heading(match[1]));
        if (!headings.includes(decodeURIComponent(anchor))) fail(file, `missing anchor ${href}`);
      }
    }
    if (!file.endsWith('/spec.md')) continue;
    const isMain = relative(planning, file).startsWith('specs/');
    if (isMain && (!/^## Purpose\s*$/m.test(text) || !/^## Requirements\s*$/m.test(text))) {
      fail(file, 'main spec needs Purpose and Requirements');
    }
    const requirements = [...text.matchAll(/^### Requirement: (.+)$/gm)];
    if (!requirements.length && (isMain || !/^## RENAMED Requirements\s*$/m.test(text))) {
      fail(file, 'spec contains no requirements');
    }
    const names = new Set();
    for (let index = 0; index < requirements.length; index++) {
      const match = requirements[index];
      const name = match[1].trim();
      if (names.has(name)) fail(file, `duplicate requirement ${name}`);
      names.add(name);
      const section = [...text.slice(0, match.index).matchAll(/^## (.+)$/gm)].at(-1)?.[1];
      // OpenSpec removals need only a name. Rename/merge semantics are checked
      // by the upstream validator, not reimplemented here.
      if (!isMain && section === 'REMOVED Requirements') continue;
      const block = text.slice(match.index + match[0].length, requirements[index + 1]?.index);
      const [body, ...scenarios] = block.split(/^#### Scenario: /m);
      if (!/\b(?:SHALL|MUST)\b/.test(body)) fail(file, `${name} needs SHALL/MUST in its body`);
      if (!scenarios.length) fail(file, `${name} has no scenarios`);
      const seen = new Set();
      for (const scenario of scenarios) {
        const label = scenario.split('\n')[0].trim();
        if (seen.has(label)) fail(file, `${name} repeats scenario ${label}`);
        seen.add(label);
        if (!/^- \*\*WHEN\*\*/m.test(scenario) || !/^- \*\*THEN\*\*/m.test(scenario)) {
          fail(file, `${name}/${label} needs concrete WHEN/THEN steps`);
        }
      }
    }
  }
  for (const entry of readdirSync(resolve(planning, 'changes'), { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'archive') continue;
    const dir = resolve(planning, 'changes', entry.name);
    for (const name of ['proposal.md', 'tasks.md', '.openspec.yaml']) {
      if (!existsSync(resolve(dir, name))) fail(dir, `missing ${name}`);
    }
    const metadata = resolve(dir, '.openspec.yaml');
    if (existsSync(metadata) && !/^skip_specs: true\s*$/m.test(readFileSync(metadata, 'utf8'))) {
      const deltaDir = resolve(dir, 'specs');
      if (!existsSync(deltaDir) || !walk(deltaDir).some(file => file.endsWith('/spec.md'))) {
        fail(dir, 'requires deltas or explicit skip_specs: true');
      }
    }
    const tasks = resolve(dir, 'tasks.md');
    if (existsSync(tasks)) {
      for (const line of readFileSync(tasks, 'utf8').split('\n')) {
        if (/^- \[[^\]]*\]/.test(line) && !/^- \[(?: |x|X)\] \d+\.\d+ .+/.test(line)) {
          fail(tasks, `unnumbered/invalid task: ${line}`);
        }
      }
    }
  }
  return { files: files.length, failures };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const result = checkDocumentation(root);
  for (const failure of result.failures) console.error(failure);
  console.log(`${result.files} Markdown files checked, ${result.failures.length} failures`);
  if (result.failures.length) process.exitCode = 1;
}
