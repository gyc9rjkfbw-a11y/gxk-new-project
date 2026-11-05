import assert from 'node:assert/strict';

import { main } from '../src/cli.js';

// Pins the documented machine-readable contract, not just the parsed value.
const { code, output } = main(['#767676', '#ffffff', '--json']);
assert.equal(code, 0);
assert.deepEqual(JSON.parse(output), {
  foreground: '#767676',
  background: '#ffffff',
  ratio: 4.54,
  required: 4.5,
  level: 'AA',
  passes: true,
  mode: 'text',
  textSize: 'normal',
});
console.log('JSON payload contract OK');
