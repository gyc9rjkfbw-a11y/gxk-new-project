import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, it } from 'node:test';

import { main } from '../src/cli.js';

const CLI = path.resolve(import.meta.dirname, '../src/cli.js');

describe('main', () => {
  it('reports a passing pair with exit code 0', () => {
    const { code, output } = main(['#767676', '#ffffff']);
    assert.equal(code, 0);
    assert.match(output, /^#767676 on #ffffff$/m);
    assert.match(output, /4\.54:1 required for normal text \(16px \/ 400\) at level AA: 4\.50:1/);
    assert.match(output, /^PASS$/m);
  });

  it('reports a failing pair with exit code 1', () => {
    const { code, output } = main(['#777777', '#ffffff']);
    assert.equal(code, 1);
    assert.match(output, /^FAIL$/m);
  });

  it('honours --size, --weight and --level', () => {
    const large = main(['#777777', '#ffffff', '--size', '30']);
    assert.equal(large.code, 0);
    assert.match(large.output, /large text \(30px/);

    const bold = main(['#777777', '#ffffff', '--size', '19', '--weight', '700']);
    assert.equal(bold.code, 0);

    const aaa = main(['#767676', '#ffffff', '--level', 'AAA']);
    assert.equal(aaa.code, 1);
    assert.match(aaa.output, /at level AAA: 7\.00:1/);

    const inline = main(['#767676', '#ffffff', '--level=aaa']);
    assert.equal(inline.code, 1);
    assert.match(inline.output, /at level AAA: 7\.00:1/);
  });

  it('switches to the 1.4.11 threshold with --non-text', () => {
    const { code, output } = main(['#777777', '#ffffff', '--non-text']);
    assert.equal(code, 0);
    assert.match(output, /required for non-text contrast at level AA: 3\.00:1/);
  });

  it('emits parsable JSON with --json', () => {
    const { code, output } = main(['#767676', '#ffffff', '--json']);
    assert.equal(code, 0);
    const payload = JSON.parse(output);
    assert.deepEqual(payload, {
      foreground: '#767676',
      background: '#ffffff',
      ratio: 4.54,
      required: 4.5,
      level: 'AA',
      passes: true,
      mode: 'text',
      textSize: 'normal',
    });
  });

  it('prints usage for --help and for missing operands', () => {
    const help = main(['--help']);
    assert.equal(help.code, 0);
    assert.match(help.output, /Usage:/);

    const missing = main([]);
    assert.equal(missing.code, 2);
    assert.match(missing.output, /expected a foreground and a background color/);
  });

  it('rejects bad options and bad colors with exit code 2', () => {
    assert.equal(main(['--nope']).code, 2);
    assert.equal(main(['#000', '--size']).code, 2);
    assert.equal(main(['#000', '#fff', '--size', 'big']).code, 2);
    assert.equal(main(['#000', '#fff', '--level', 'AAAA']).code, 2);

    const badColor = main(['blurple', '#fff']);
    assert.equal(badColor.code, 2);
    assert.match(badColor.output, /^error: Unsupported color "blurple"/m);
  });

  it('composites alpha before reporting hex colors', () => {
    const { code, output } = main(['rgb(0 0 0 / 50%)', '#ffffff', '--json']);
    assert.equal(code, 1);
    assert.equal(JSON.parse(output).foreground, '#808080');
  });
});

describe('direct invocation', () => {
  it('runs as an executable script and propagates the exit code', (t) => {
    const pass = spawnSync(process.execPath, [CLI, '#000', '#fff'], { encoding: 'utf8' });
    if (pass.error !== undefined) {
      // Sandboxed runners may forbid nested spawns; CI always gets the real check.
      t.skip(`cannot spawn a child process: ${pass.error.code ?? pass.error.message}`);
      return;
    }
    assert.equal(pass.status, 0);
    assert.match(pass.stdout, /^21\.00:1/m);

    const fail = spawnSync(process.execPath, [CLI, '#777777', '#ffffff', '--size', '12'], { encoding: 'utf8' });
    assert.equal(fail.status, 1);
    assert.match(fail.stdout, /^FAIL$/m);
  });
});
