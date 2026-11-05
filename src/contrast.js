import { ColorError, toColor } from './parse-color.js';

// WCAG 2.2 success criteria 1.4.3 (text), 1.4.6 (enhanced text), 1.4.11 (non-text).
export const THRESHOLDS = {
  AA: { normal: 4.5, large: 3, nonText: 3 },
  AAA: { normal: 7, large: 4.5, nonText: 4.5 },
};

// 18pt and 14pt bold, expressed in CSS pixels at 96dpi.
const LARGE_TEXT_PX = 24;
const LARGE_TEXT_BOLD_PX = 18.66;
const BOLD_WEIGHT = 700;

/** @param {number} channel 8-bit sRGB channel */
export function srgbToLinear(channel) {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * @param {{r: number, g: number, b: number}} color
 * @returns {number} relative luminance in 0..1
 */
export function relativeLuminance(color) {
  const { r, g, b } = color;
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

/**
 * @param {{r: number, g: number, b: number}} a
 * @param {{r: number, g: number, b: number}} b
 * @returns {number} contrast ratio in 1..21
 */
export function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Composites a translucent foreground over an opaque background, which is what a
 * browser paints before it measures contrast.
 *
 * @param {{r: number, g: number, b: number, a: number}} fg
 * @param {{r: number, g: number, b: number, a: number}} bg
 */
export function blend(fg, bg) {
  if (bg.a !== 1) {
    throw new ColorError('The background must be opaque; blend it first.');
  }
  const a = fg.a;
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
    a: 1,
  };
}

/**
 * @param {number} fontSizePx
 * @param {number} [fontWeight]
 */
export function isLargeText(fontSizePx, fontWeight = 400) {
  if (!Number.isFinite(fontSizePx) || fontSizePx <= 0) {
    throw new TypeError(`font-size must be a positive number of px, received ${fontSizePx}.`);
  }
  return fontSizePx >= LARGE_TEXT_PX || (fontSizePx >= LARGE_TEXT_BOLD_PX && fontWeight >= BOLD_WEIGHT);
}

/** Rounds toward zero so a reported ratio can never overstate the measured one. */
function roundRatio(ratio) {
  return Math.floor(ratio * 100) / 100;
}

function resolveLevel(level) {
  const key = String(level ?? 'AA').toUpperCase();
  if (THRESHOLDS[key] === undefined) {
    throw new TypeError(`Unknown conformance level "${level}"; expected AA or AAA.`);
  }
  return key;
}

/**
 * Evaluates text contrast for a foreground/background pair.
 *
 * @param {object} options
 * @param {string|object} options.foreground
 * @param {string|object} options.background
 * @param {number} [options.fontSize] CSS pixels, default 16
 * @param {number} [options.fontWeight] default 400
 * @param {'AA'|'AAA'} [options.level] default 'AA'
 */
export function checkTextContrast(options) {
  const { foreground, background } = options;
  if (foreground === undefined || background === undefined) {
    throw new TypeError('Both foreground and background are required.');
  }

  const fontSize = options.fontSize ?? 16;
  const fontWeight = options.fontWeight ?? 400;
  const level = resolveLevel(options.level);

  const fg = toColor(foreground);
  const bg = toColor(background);
  const painted = fg.a === 1 ? fg : blend(fg, bg);

  const large = isLargeText(fontSize, fontWeight);
  const required = THRESHOLDS[level][large ? 'large' : 'normal'];
  const ratio = contrastRatio(painted, bg);

  return {
    ratio: roundRatio(ratio),
    required,
    passes: ratio >= required,
    level,
    textSize: large ? 'large' : 'normal',
    foreground: { r: painted.r, g: painted.g, b: painted.b, a: 1 },
    background: bg,
  };
}

/**
 * Evaluates non-text contrast (WCAG 1.4.11) for UI components and graphical objects.
 *
 * @param {object} options
 * @param {string|object} options.foreground
 * @param {string|object} options.background
 * @param {'AA'|'AAA'} [options.level] default 'AA'
 */
export function checkNonTextContrast(options) {
  const { foreground, background } = options;
  if (foreground === undefined || background === undefined) {
    throw new TypeError('Both foreground and background are required.');
  }

  const level = resolveLevel(options.level);
  const fg = toColor(foreground);
  const bg = toColor(background);
  const painted = fg.a === 1 ? fg : blend(fg, bg);
  const required = THRESHOLDS[level].nonText;
  const ratio = contrastRatio(painted, bg);

  return {
    ratio: roundRatio(ratio),
    required,
    passes: ratio >= required,
    level,
    foreground: { r: painted.r, g: painted.g, b: painted.b, a: 1 },
    background: bg,
  };
}
