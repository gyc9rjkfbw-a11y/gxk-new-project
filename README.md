# @gxk/contrast

Zero-dependency WCAG 2.2 contrast checking for hex and `rgb()` colors, usable as a
library or a command line tool.

```bash
node src/cli.js '#767676' '#ffffff'
# #767676 on #ffffff
# 4.54:1 required for normal text (16px / 400) at level AA: 4.50:1
# PASS
```

Exit codes are script-friendly: `0` pass, `1` fail, `2` bad usage or unparseable color.

## Install

The package ships no runtime dependencies, so cloning the repo is enough. Node 20 or
newer is required.

```bash
git clone https://github.com/gyc9rjkfbw-a11y/gxk-new-project.git
cd gxk-new-project
npm test
```

## Command line

| Option | Effect |
| --- | --- |
| `--size <px>` | Font size in CSS pixels; 24px and above counts as large text (default `16`) |
| `--weight <n>` | Font weight; 700 and above lowers the large-text bar to 18.66px (default `400`) |
| `--level <AA\|AAA>` | Conformance level to score against (default `AA`) |
| `--non-text` | Applies WCAG 1.4.11 (3:1) instead of the text criteria |
| `--json` | Emits a machine-readable result object |

```bash
node src/cli.js '#555' '#fff' --size 30 --json
{
  "foreground": "#555555",
  "background": "#ffffff",
  "ratio": 7.46,
  "required": 3,
  "level": "AA",
  "passes": true,
  "mode": "text",
  "textSize": "large"
}
```

## Library

```js
import { checkTextContrast, checkNonTextContrast, parseColor } from '@gxk/contrast';

checkTextContrast({ foreground: '#777777', background: '#ffffff' });
// { ratio: 4.47, required: 4.5, passes: false, level: 'AA', textSize: 'normal', ... }

checkNonTextContrast({ foreground: '#767676', background: '#ffffff' });
// { ratio: 4.54, required: 3, passes: true, level: 'AA', ... }

parseColor('rgb(0 0 0 / 50%)');
// { r: 0, g: 0, b: 0, a: 0.5 }
```

Colors may be strings or already-parsed `{ r, g, b, a }` objects, which is useful when a
caller caches parsed palette values.

## Supported color syntax

- Hex: `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, with or without the leading `#`
- Functional: `rgb()` and `rgba()` in both legacy comma and modern space-separated
  syntaxes, including `/` alpha and percentage channels
- Named: `black`, `white`, `red`, `green`, `blue`

Out of gamut, unsupported values throw `ColorError`. HSL, `lab()`, `oklch()` and the
full CSS named-color list are deliberately out of scope; the subset above covers the
cases this package was written for and keeps the module dependency-free.

## Behavior notes

- **Translucent foregrounds are composited first.** Browsers paint
  `rgb(0 0 0 / 50%)` over a white background as `#808080`, so contrast is measured on
  the painted color rather than the declared one.
- **Backgrounds must be opaque.** Blending onto a translucent background depends on
  what sits behind it, which this library cannot know, so `blend()` throws instead of
  guessing.
- **Ratios round toward zero.** A reported `4.47` can never be a rounded-up `4.50`, so
  a pass verdict is always backed by the measured value.
- **Large text follows WCAG 2.2 sizing**: 24px at any weight, or 18.66px at weight 700
  and above, which is the px equivalent of 18pt bold.

## Thresholds

| Level | Normal text | Large text | Non-text |
| --- | --- | --- | --- |
| AA | 4.5:1 | 3:1 | 3:1 |
| AAA | 7:1 | 4.5:1 | 4.5:1 |

## Development

```bash
npm test              # node --test
npm run check:syntax  # node --check over src, test and scripts
npm run coverage      # node --test --experimental-test-coverage
```

CI runs all three across Node 20, 22 and 24, plus a job that pins the documented CLI
exit codes.

## License

MIT. See [LICENSE](LICENSE).
