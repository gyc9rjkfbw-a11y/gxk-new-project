#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { formatHex } from './parse-color.js';
import { checkNonTextContrast, checkTextContrast } from './contrast.js';

const USAGE = `Usage: gxk-contrast <foreground> <background> [options]

Options:
  --size <px>       font size in CSS pixels (default: 16)
  --weight <n>      font weight (default: 400)
  --level <AA|AAA>  conformance level (default: AA)
  --non-text        apply WCAG 1.4.11 instead of the text criteria
  --json            emit machine-readable output
  -h, --help        show this help

Exit codes: 0 pass, 1 fail, 2 bad usage or unparseable color.`;

const NUMERIC = new Set(['--size', '--weight']);

class UsageError extends Error {}

function parseArgs(argv) {
  const positionals = [];
  const flags = { level: 'AA', json: false, nonText: false, size: 16, weight: 400 };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') {
      return { help: true, positionals, flags };
    }
    if (arg === '--json') {
      flags.json = true;
      continue;
    }
    if (arg === '--non-text') {
      flags.nonText = true;
      continue;
    }
    if (NUMERIC.has(arg)) {
      const raw = argv[i + 1];
      if (raw === undefined) throw new UsageError(`${arg} needs a value.`);
      const value = Number(raw);
      if (!Number.isFinite(value)) throw new UsageError(`${arg} expects a number, got "${raw}".`);
      flags[arg === '--size' ? 'size' : 'weight'] = value;
      i += 1;
      continue;
    }
    if (arg.startsWith('--level=')) {
      flags.level = arg.slice('--level='.length);
      continue;
    }
    if (arg === '--level') {
      const raw = argv[i + 1];
      if (raw === undefined) throw new UsageError('--level needs a value.');
      flags.level = raw;
      i += 1;
      continue;
    }
    if (arg.startsWith('-') && arg !== '-') {
      throw new UsageError(`Unknown option "${arg}".`);
    }
    positionals.push(arg);
  }

  return { help: false, positionals, flags };
}

function report(result, flags) {
  const foreground = formatHex(result.foreground);
  const background = formatHex(result.background);

  if (flags.json) {
    return JSON.stringify(
      {
        foreground,
        background,
        ratio: result.ratio,
        required: result.required,
        level: result.level,
        passes: result.passes,
        mode: flags.nonText ? 'non-text' : 'text',
        ...(flags.nonText ? {} : { textSize: result.textSize }),
      },
      null,
      2,
    );
  }

  const subject = flags.nonText
    ? 'non-text contrast'
    : `${result.textSize} text (${flags.size}px / ${flags.weight})`;
  const verdict = result.passes ? 'PASS' : 'FAIL';
  return [
    `${foreground} on ${background}`,
    `${result.ratio.toFixed(2)}:1 required for ${subject} at level ${result.level}: ${result.required.toFixed(2)}:1`,
    verdict,
  ].join('\n');
}

export function main(argv) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (error) {
    return { code: 2, output: `error: ${error.message}\n\n${USAGE}` };
  }

  if (parsed.help || parsed.positionals.length !== 2) {
    return { code: parsed.help ? 0 : 2, output: parsed.help ? USAGE : `error: expected a foreground and a background color.\n\n${USAGE}` };
  }

  const [foreground, background] = parsed.positionals;
  const options = { foreground, background, level: parsed.flags.level };

  try {
    const result = parsed.flags.nonText
      ? checkNonTextContrast(options)
      : checkTextContrast({ ...options, fontSize: parsed.flags.size, fontWeight: parsed.flags.weight });
    return { code: result.passes ? 0 : 1, output: report(result, parsed.flags) };
  } catch (error) {
    return { code: 2, output: `error: ${error.message}` };
  }
}

// Resolved paths keep direct invocation working on Windows as well as POSIX.
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === path.resolve(fileURLToPath(import.meta.url))) {
  const { code, output } = main(process.argv.slice(2));
  if (output) process.stdout.write(`${output}\n`);
  process.exit(code);
}
