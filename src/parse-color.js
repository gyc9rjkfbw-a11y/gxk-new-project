// Parses the CSS color subset used by this package into 8-bit RGBA channels.

export class ColorError extends TypeError {}

// Deliberately small: the full CSS named-color list is out of scope, so only the
// handful used in examples and tests is supported. `green` follows CSS (#008000).
const NAMED_COLORS = {
  black: '#000000',
  white: '#ffffff',
  red: '#ff0000',
  green: '#008000',
  blue: '#0000ff',
};

const HEX_RE = /^#?([\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i;
const FUNC_RE = /^rgba?\(([^)]*)\)$/i;

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

function fail(input, hint) {
  throw new ColorError(`Unsupported color "${input}". ${hint}`);
}

function parseChannel(token, input) {
  const percent = token.endsWith('%');
  const value = Number(percent ? token.slice(0, -1) : token);
  if (!Number.isFinite(value)) fail(input, 'Each RGB channel must be a number.');
  if (percent) return clamp(Math.round((value * 255) / 100), 0, 255);
  return clamp(Math.round(value), 0, 255);
}

function parseAlpha(token, input) {
  const percent = token.endsWith('%');
  const value = Number(percent ? token.slice(0, -1) : token);
  if (!Number.isFinite(value)) fail(input, 'Alpha must be a number or a percentage.');
  const alpha = percent ? value / 100 : value;
  if (alpha < 0 || alpha > 1) fail(input, 'Alpha must be between 0 and 1 (or 0% and 100%).');
  return alpha;
}

function fromHex(body) {
  const digits = body.length <= 4
    ? [...body].map((d) => d + d).join('')
    : body;
  const channels = [0, 2, 4].map((i) => Number.parseInt(digits.slice(i, i + 2), 16));
  const alpha = digits.length === 8 ? Number.parseInt(digits.slice(6, 8), 16) / 255 : 1;
  return { r: channels[0], g: channels[1], b: channels[2], a: alpha };
}

// Legacy comma syntax carries alpha as a fourth argument; the modern syntax puts it
// after a "/". Both are valid CSS, so both are parsed here.
function splitFunctional(input, inner) {
  const tokens = (source, separator) =>
    source.split(separator).map((token) => token.trim()).filter((token) => token !== '');

  if (inner.includes(',')) {
    const parts = tokens(inner, ',');
    if (parts.length === 3) return { channels: parts, alpha: undefined };
    if (parts.length === 4) return { channels: parts.slice(0, 3), alpha: parts[3] };
    fail(input, 'Expected three comma-separated channels, or four when using rgba().');
  }

  const [components, alphaPart, ...rest] = inner.split('/');
  if (rest.length > 0) fail(input, 'Expected a single "/" separating color channels from alpha.');

  const channels = tokens(components, /\s+/);
  if (channels.length !== 3) fail(input, 'Expected three RGB channels.');
  return { channels, alpha: alphaPart === undefined ? undefined : alphaPart.trim() };
}

function fromFunction(input, inner) {
  const { channels, alpha: alphaToken } = splitFunctional(input, inner);

  if (alphaToken === '') fail(input, 'Expected an alpha value after "/".');
  if (alphaToken === undefined && /^rgba\(/i.test(input) && inner.includes(',')) {
    fail(input, 'rgba() needs four comma-separated values.');
  }

  const alpha = alphaToken === undefined ? 1 : parseAlpha(alphaToken, input);
  const [r, g, b] = channels.map((token) => parseChannel(token, input));
  return { r, g, b, a: alpha };
}

/**
 * Accepts `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb()`/`rgba()` in both the
 * legacy comma and modern space-separated syntaxes, channel numbers or
 * percentages, and the named colors listed in NAMED_COLORS.
 *
 * @param {string} input
 * @returns {{r: number, g: number, b: number, a: number}} 8-bit channels, alpha 0..1
 */
export function parseColor(input) {
  if (typeof input !== 'string') {
    throw new ColorError(`Expected a color string, received ${typeof input}.`);
  }

  const text = input.trim();
  if (text === '') throw new ColorError('Expected a color string, received an empty value.');

  const named = NAMED_COLORS[text.toLowerCase()];
  if (named !== undefined) return fromHex(named.slice(1));

  const hex = HEX_RE.exec(text);
  if (hex) return fromHex(hex[1]);

  const fn = FUNC_RE.exec(text.replace(/\s+/g, ' '));
  if (fn) return fromFunction(text, fn[1].trim());

  fail(text, 'Use a hex color, rgb()/rgba(), or one of: ' + Object.keys(NAMED_COLORS).join(', '));
}

/** @param {{r: number, g: number, b: number}} color */
export function formatHex(color) {
  const byte = (value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0');
  return `#${byte(color.r)}${byte(color.g)}${byte(color.b)}`;
}

/** @param {Record<string, string>} colors */
export function namedColors() {
  return { ...NAMED_COLORS };
}

/**
 * Accepts either a color string or an already-parsed `{r,g,b,a}` object, which
 * keeps the public checkers friendly for callers that cache parsed colors.
 *
 * @param {string|{r:number,g:number,b:number,a?:number}} value
 */
export function toColor(value) {
  if (typeof value === 'string') return parseColor(value);
  if (value === null || typeof value !== 'object') {
    throw new ColorError(`Expected a color string or {r,g,b,a} object, received ${typeof value}.`);
  }

  const { r, g, b } = value;
  const a = value.a ?? 1;
  for (const [name, channel] of [['r', r], ['g', g], ['b', b]]) {
    if (!Number.isFinite(channel) || channel < 0 || channel > 255) {
      throw new ColorError(`Channel "${name}" must be a number between 0 and 255, received ${channel}.`);
    }
  }
  if (!Number.isFinite(a) || a < 0 || a > 1) {
    throw new ColorError(`Channel "a" must be a number between 0 and 1, received ${a}.`);
  }

  return { r, g, b, a };
}
