import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  THRESHOLDS,
  blend,
  checkNonTextContrast,
  checkTextContrast,
  contrastRatio,
  isLargeText,
  relativeLuminance,
  srgbToLinear,
} from '../src/contrast.js';

const close = (t) => assert.ok(Math.abs(t.actual - t.expected) < t.delta, `${t.actual} !~= ${t.expected}`);

describe('srgbToLinear', () => {
  it('uses the linear segment below the 0.03928 threshold', () => {
    close({ actual: srgbToLinear(0), expected: 0, delta: 1e-9 });
    close({ actual: srgbToLinear(10), expected: 10 / 255 / 12.92, delta: 1e-9 });
  });

  it('anchors the endpoints of the scale', () => {
    close({ actual: srgbToLinear(255), expected: 1, delta: 1e-9 });
    // Channel 1 is still under the 0.03928 breakpoint, so it uses the linear segment.
    close({ actual: srgbToLinear(1), expected: 1 / 255 / 12.92, delta: 1e-9 });
    close({ actual: srgbToLinear(128), expected: ((128 / 255 + 0.055) / 1.055) ** 2.4, delta: 1e-9 });
  });
});

describe('relativeLuminance', () => {
  it('matches the published values for pure black and pure white', () => {
    close({ actual: relativeLuminance({ r: 0, g: 0, b: 0 }), expected: 0, delta: 1e-9 });
    close({ actual: relativeLuminance({ r: 255, g: 255, b: 255 }), expected: 1, delta: 1e-9 });
  });

  it('weights green most heavily, per the Rec. 709 coefficients', () => {
    const red = relativeLuminance({ r: 255, g: 0, b: 0 });
    const green = relativeLuminance({ r: 0, g: 255, b: 0 });
    const blue = relativeLuminance({ r: 0, g: 0, b: 255 });
    assert.ok(green > red && red > blue, 'expected green > red > blue luminance');
  });
});

describe('contrastRatio', () => {
  it('reproduces the canonical 21:1 black-on-white pair', () => {
    close({
      actual: contrastRatio({ r: 255, g: 255, b: 255 }, { r: 0, g: 0, b: 0 }),
      expected: 21,
      delta: 1e-9,
    });
  });

  it('is symmetric', () => {
    const a = { r: 0x76, g: 0x76, b: 0x76 };
    const b = { r: 255, g: 255, b: 255 };
    close({ actual: contrastRatio(a, b), expected: contrastRatio(b, a), delta: 1e-12 });
  });

  it('matches the published 4.54:1 for #767676 on white', () => {
    close({
      actual: contrastRatio({ r: 0x76, g: 0x76, b: 0x76 }, { r: 255, g: 255, b: 255 }),
      expected: 4.54,
      delta: 0.01,
    });
  });
});

describe('blend', () => {
  it('composites a translucent foreground over an opaque background', () => {
    const painted = blend({ r: 255, g: 0, b: 0, a: 0.5 }, { r: 255, g: 255, b: 255, a: 1 });
    close({ actual: painted.r, expected: 255, delta: 1e-9 });
    close({ actual: painted.g, expected: 127.5, delta: 1e-9 });
    close({ actual: painted.b, expected: 127.5, delta: 1e-9 });
    assert.equal(painted.a, 1);
  });

  it('keeps fully opaque and fully transparent colors intact', () => {
    const bg = { r: 10, g: 20, b: 30, a: 1 };
    assert.deepEqual(blend({ r: 1, g: 2, b: 3, a: 1 }, bg), { r: 1, g: 2, b: 3, a: 1 });
    assert.deepEqual(blend({ r: 1, g: 2, b: 3, a: 0 }, bg), bg);
  });

  it('refuses a translucent background', () => {
    assert.throws(
      () => blend({ r: 1, g: 2, b: 3, a: 0.5 }, { r: 4, g: 5, b: 6, a: 0.5 }),
      /background must be opaque/,
    );
  });
});

describe('isLargeText', () => {
  it('treats 24px and up as large regardless of weight', () => {
    assert.equal(isLargeText(24), true);
    assert.equal(isLargeText(23.9), false);
    assert.equal(isLargeText(40, 100), true);
  });

  it('lowers the bar to 18.66px for bold weights', () => {
    assert.equal(isLargeText(18.66, 700), true);
    assert.equal(isLargeText(18.65, 700), false);
    assert.equal(isLargeText(20, 400), false);
  });

  it('rejects nonsensical font sizes', () => {
    assert.throws(() => isLargeText(0), TypeError);
    assert.throws(() => isLargeText(-5), TypeError);
    assert.throws(() => isLargeText(Number.NaN), TypeError);
  });
});

describe('checkTextContrast', () => {
  it('applies the 4.5:1 AA threshold to normal text', () => {
    const passing = checkTextContrast({ foreground: '#767676', background: '#ffffff' });
    assert.equal(passing.passes, true);
    assert.equal(passing.required, 4.5);
    assert.equal(passing.textSize, 'normal');
    assert.equal(passing.level, 'AA');
    assert.equal(passing.ratio, 4.54);

    const failing = checkTextContrast({ foreground: '#777777', background: '#ffffff' });
    assert.equal(failing.passes, false);
    assert.equal(failing.ratio, 4.47, 'ratios round toward zero, never up');
  });

  it('applies the 3:1 AA threshold to large text', () => {
    const result = checkTextContrast({ foreground: '#777777', background: '#ffffff', fontSize: 30 });
    assert.equal(result.textSize, 'large');
    assert.equal(result.required, 3);
    assert.equal(result.passes, true);
  });

  it('applies the 7:1 AAA threshold to normal text', () => {
    const result = checkTextContrast({ foreground: '#767676', background: '#ffffff', level: 'aaa' });
    assert.equal(result.level, 'AAA', 'levels are reported canonically');
    assert.equal(result.required, 7);
    assert.equal(result.passes, false);
  });

  it('measures contrast against the composited color when alpha is involved', () => {
    const translucent = checkTextContrast({ foreground: 'rgb(0 0 0 / 50%)', background: '#ffffff' });
    const solid = checkTextContrast({ foreground: 'rgb(128 128 128)', background: '#ffffff' });
    close({ actual: translucent.foreground.r, expected: 127.5, delta: 1e-9 });
    close({ actual: translucent.ratio, expected: solid.ratio, delta: 0.05 });
  });

  it('accepts pre-parsed color objects', () => {
    const result = checkTextContrast({ foreground: { r: 0, g: 0, b: 0 }, background: '#fff' });
    assert.equal(result.ratio, 21);
  });

  it('validates its inputs', () => {
    assert.throws(() => checkTextContrast({ foreground: '#000' }), TypeError);
    assert.throws(() => checkTextContrast({ background: '#fff' }), TypeError);
    assert.throws(() => checkTextContrast({ foreground: '#000', background: '#fff', level: 'AAAA' }), TypeError);
    assert.throws(() => checkTextContrast({ foreground: '#000', background: '#fff', fontSize: 0 }), TypeError);
    assert.throws(() => checkTextContrast({ foreground: 'nope', background: '#fff' }), /Unsupported color/);
  });
});

describe('checkNonTextContrast', () => {
  it('applies the 3:1 WCAG 1.4.11 threshold', () => {
    const passing = checkNonTextContrast({ foreground: '#767676', background: '#ffffff' });
    assert.equal(passing.passes, true);
    assert.equal(passing.required, THRESHOLDS.AA.nonText);
    assert.equal(passing.textSize, undefined, 'non-text results carry no text size');

    const failing = checkNonTextContrast({ foreground: '#e0e0e0', background: '#ffffff' });
    assert.equal(failing.passes, false);
  });

  it('applies the 4.5:1 AAA threshold', () => {
    const result = checkNonTextContrast({ foreground: '#949494', background: '#ffffff', level: 'AAA' });
    assert.equal(result.required, 4.5);
    assert.equal(result.passes, false);
  });

  it('composites translucent borders before measuring', () => {
    const result = checkNonTextContrast({ foreground: 'rgb(0 0 0 / 42%)', background: '#ffffff' });
    close({ actual: result.foreground.g, expected: 147.9, delta: 1e-9 });
    assert.equal(result.ratio, 3.03);
    assert.equal(result.passes, true);
  });

  it('validates its inputs', () => {
    assert.throws(() => checkNonTextContrast({ foreground: '#000' }), TypeError);
    assert.throws(() => checkNonTextContrast({ background: '#fff' }), TypeError);
    assert.throws(
      () => checkNonTextContrast({ foreground: '#000', background: '#fff', level: 'B' }),
      /Unknown conformance level/,
    );
  });
});
