import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ColorError,
  formatHex,
  namedColors,
  parseColor,
  toColor,
} from '../src/parse-color.js';

describe('parseColor', () => {
  it('reads 3, 4, 6 and 8 digit hex forms', () => {
    assert.deepEqual(parseColor('#fff'), { r: 255, g: 255, b: 255, a: 1 });
    assert.deepEqual(parseColor('#ffff'), { r: 255, g: 255, b: 255, a: 1 });
    assert.deepEqual(parseColor('#0a141e'), { r: 10, g: 20, b: 30, a: 1 });
    assert.deepEqual(parseColor('#0a141e80'), { r: 10, g: 20, b: 30, a: 128 / 255 });
  });

  it('accepts hex without the leading hash and ignores case', () => {
    assert.deepEqual(parseColor('0A141E'), { r: 10, g: 20, b: 30, a: 1 });
  });

  it('supports the documented named subset', () => {
    assert.deepEqual(parseColor('WHITE'), { r: 255, g: 255, b: 255, a: 1 });
    assert.equal(parseColor('green').g, 128, 'CSS green is #008000, not #00ff00');
    assert.deepEqual(Object.keys(namedColors()), ['black', 'white', 'red', 'green', 'blue']);
  });

  it('reads legacy comma syntax', () => {
    assert.deepEqual(parseColor('rgb(10, 20, 30)'), { r: 10, g: 20, b: 30, a: 1 });
    assert.deepEqual(parseColor('rgba(10, 20, 30, 0.5)'), { r: 10, g: 20, b: 30, a: 0.5 });
    assert.deepEqual(parseColor('rgba(10, 20, 30, 100%)'), { r: 10, g: 20, b: 30, a: 1 });
    assert.deepEqual(parseColor('RGBA(10, 20, 30, .25)'), { r: 10, g: 20, b: 30, a: 0.25 });
  });

  it('reads modern space syntax with slash alpha', () => {
    assert.deepEqual(parseColor('rgb(10 20 30)'), { r: 10, g: 20, b: 30, a: 1 });
    assert.deepEqual(parseColor('rgb(10 20 30 / 25%)'), { r: 10, g: 20, b: 30, a: 0.25 });
    assert.deepEqual(parseColor('  rgba( 10 20 30 / 1 )  '), { r: 10, g: 20, b: 30, a: 1 });
  });

  it('converts percentage channels', () => {
    assert.deepEqual(parseColor('rgb(100% 0% 50%)'), { r: 255, g: 0, b: 128, a: 1 });
  });

  it('clamps out-of-range channels the way a browser does', () => {
    assert.deepEqual(parseColor('rgb(300 -20 40)'), { r: 255, g: 0, b: 40, a: 1 });
  });

  it('rejects malformed input with ColorError', () => {
    assert.throws(() => parseColor(''), ColorError);
    assert.throws(() => parseColor('rebeccapurple'), ColorError);
    assert.throws(() => parseColor('#ff'), ColorError);
    assert.throws(() => parseColor('rgb(1 2 3 / 50% / 20%)'), ColorError);
    assert.throws(() => parseColor('rgb(1, 2)'), ColorError);
    assert.throws(() => parseColor('rgba(1, 2, 3)'), ColorError);
    assert.throws(() => parseColor('rgba(1, 2, 3, 0.5, 0.5)'), ColorError);
    assert.throws(() => parseColor('rgb(10, 20 30)'), ColorError);
    assert.throws(() => parseColor('rgb(10 20 30 /)'), ColorError);
    assert.throws(() => parseColor('rgb(10 20 abc)'), ColorError);
    assert.throws(() => parseColor('rgb(10 20 30 / 2)'), ColorError);
    assert.throws(() => parseColor(42), ColorError);
    assert.throws(() => parseColor(null), ColorError);
  });
});

describe('formatHex', () => {
  it('rounds and pads to six digits', () => {
    assert.equal(formatHex({ r: 10, g: 20, b: 30 }), '#0a141e');
    assert.equal(formatHex({ r: 254.6, g: -3, b: 300 }), '#ff00ff');
  });
});

describe('toColor', () => {
  it('passes parsed objects through and defaults alpha to opaque', () => {
    assert.deepEqual(toColor({ r: 1, g: 2, b: 3 }), { r: 1, g: 2, b: 3, a: 1 });
    assert.deepEqual(toColor('rgb(1 2 3)'), { r: 1, g: 2, b: 3, a: 1 });
  });

  it('validates channel ranges', () => {
    assert.throws(() => toColor({ r: 300, g: 0, b: 0 }), ColorError);
    assert.throws(() => toColor({ r: 0, g: 0, b: 0, a: 1.5 }), ColorError);
    assert.throws(() => toColor({ r: 'x', g: 0, b: 0 }), ColorError);
    assert.throws(() => toColor(['red']), ColorError);
  });

  it('rejects values that are neither a string nor an object', () => {
    assert.throws(() => toColor(null), /Expected a color string/);
    assert.throws(() => toColor(42), /Expected a color string/);
    assert.throws(() => toColor(undefined), /Expected a color string/);
  });
});
