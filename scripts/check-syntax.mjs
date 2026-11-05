import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// `node --check` is the only syntax gate that needs no installed dependency.
const ROOT = path.resolve(import.meta.dirname, '..');
const SOURCES = ['src', 'test', 'scripts'];
const EXTENSIONS = new Set(['.js', '.mjs']);

function collect(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...collect(full));
    } else if (EXTENSIONS.has(path.extname(entry))) {
      found.push(full);
    }
  }
  return found;
}

const files = SOURCES.flatMap((dir) => collect(path.join(ROOT, dir))).sort();
let failed = 0;

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  const label = path.relative(ROOT, file);
  if (result.status === 0) {
    process.stdout.write(`ok   ${label}\n`);
  } else {
    failed += 1;
    process.stdout.write(`FAIL ${label}\n${result.stderr}`);
  }
}

process.stdout.write(`\n${files.length - failed}/${files.length} files parse cleanly.\n`);
process.exit(failed === 0 ? 0 : 1);
