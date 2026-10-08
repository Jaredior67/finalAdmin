/* Guards for the surface elevation ramp.
 *
 * WHY THIS IS A TEST AND NOT A COMMENT
 *
 * The page used to be #f8fafc and the cards #ffffff — about 1% apart in relative
 * luminance, which is under what the eye resolves as an edge. No card had a
 * visible boundary, the layout carried its whole structure on drop shadows, and
 * the largest uninterrupted area on screen sat at near-white. That is the
 * combination behind the eye strain: the eye adapts to the room, then reads the
 * field as glare.
 *
 * The fix is a ramp with resolvable steps. The regression is equally easy to
 * reintroduce by accident — someone reaching for a convenient off-white re-flattens
 * it in one commit — so the property is asserted rather than documented:
 *
 *   - consecutive surfaces differ by a visible amount, not 1%
 *   - the canvas is not near-white, because that is the glare
 *   - every text tier clears WCAG AA on every surface it can land on
 *
 * Run: node --test tests/surfaceRamp.test.js                                   */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '..');
const css = fs.readFileSync(
  path.join(root, 'frontend', 'src', 'index.css'),
  'utf8'
);

/* ------------------------------------------------------------------ *
 * Colour maths
 * ------------------------------------------------------------------ */

const hexToRgb = (hex) => {
  const h = hex.trim().replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16));
};

/* WCAG 2.1 relative luminance. */
const luminance = (hex) => {
  const [r, g, b] = hexToRgb(hex).map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/* Saturation as HSL, to keep the large fields from reading as tinted. */
const saturation = (hex) => {
  const [r, g, b] = hexToRgb(hex).map(v => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return 0;
  return l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
};

/* ------------------------------------------------------------------ *
 * Token lookup
 * ------------------------------------------------------------------ */

/* Read a custom property out of a selector block. */
function token(name, block = ':root') {
  const start = css.indexOf(`${block} {`);
  assert.ok(start > -1, `${block} is missing from index.css`);
  const end = css.indexOf('\n}', start);
  const body = css.slice(start, end);
  const m = body.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,6})`));
  assert.ok(m, `--${name} is not a literal hex in ${block} — a var() indirection cannot be checked here`);
  return m[1].toLowerCase();
}

/* ------------------------------------------------------------------ *
 * The ramp
 * ------------------------------------------------------------------ */

test('the canvas is not near-white, because a near-white field is the glare', () => {
  const canvas = token('bg-canvas');
  assert.ok(
    luminance(canvas) < 0.93,
    `--bg-canvas is ${canvas} (luminance ${luminance(canvas).toFixed(3)}). A page this large ` +
    'should sit well below white so cards read as brighter than their surround.'
  );
  // The old value, for the record. If this ever passes at #f8fafc the ramp is gone.
  assert.notEqual(canvas, '#f8fafc', '--bg-canvas is back to the flat #f8fafc');
});

test('every surface is distinguishable from the card beside it', () => {
  // 1% is not an edge. Each step below the card has to clear the eye's
  // resolution or the hierarchy is decoration.
  const card = token('bg-card');
  for (const name of ['bg-sunken', 'bg-muted', 'bg-canvas']) {
    const ratio = contrast(card, token(name));
    assert.ok(
      ratio >= 1.06,
      `--bg-${name} is only ${ratio.toFixed(3)}:1 against --bg-card. ` +
      'Surfaces closer than this are not separable without a border.'
    );
  }
});

test('the ramp is ordered — sunken sits between the card and the canvas', () => {
  const card = luminance(token('bg-card'));
  const sunken = luminance(token('bg-sunken'));
  const muted = luminance(token('bg-muted'));
  const canvas = luminance(token('bg-canvas'));

  assert.ok(sunken < card, '--bg-sunken is not darker than --bg-card');
  assert.ok(canvas < muted, '--bg-canvas is not darker than --bg-muted');
  assert.ok(muted <= sunken, '--bg-muted should not be lighter than --bg-sunken');
});

test('the page background is an alias for the canvas, not a second value', () => {
  // --bg-page survives for existing call sites. It must not become a second,
  // independently-editable page colour, or the two drift apart.
  const start = css.indexOf(':root {');
  const body = css.slice(start, css.indexOf('\n}', start));
  assert.match(
    body,
    /--bg-page:\s*var\(--bg-canvas\)/,
    '--bg-page should alias --bg-canvas; a second literal can drift out of step with it'
  );
});

test('the large fields stay close to neutral', () => {
  // A trace of the brand blue is intentional. More than a trace on a field this
  // large reads as a tint, which is how an interface starts to look cheap.
  for (const name of ['bg-canvas', 'bg-sunken', 'bg-muted', 'bg-sidebar']) {
    const s = saturation(token(name));
    assert.ok(
      s <= 0.5,
      `--bg-${name} is ${(s * 100).toFixed(0)}% saturated; keep the neutrals under 50%`
    );
  }
});

/* ------------------------------------------------------------------ *
 * Contrast — the ramp is not free
 * ------------------------------------------------------------------ */

test('every text tier clears AA on every surface it can land on', () => {
  // This is the cost of darkening the canvas. --text-muted at its old #64748b
  // gave 4.76:1 on #f8fafc but 4.16:1 on the new canvas, which fails. If a
  // surface is darkened again without a text tier following, this catches it.
  const surfaces = ['bg-card', 'bg-sunken', 'bg-muted', 'bg-canvas'].map(n => token(n));

  for (const tier of ['text-primary', 'text-secondary', 'text-muted']) {
    const color = token(tier);
    for (const surface of surfaces) {
      const ratio = contrast(color, surface);
      assert.ok(
        ratio >= 4.5,
        `--${tier} (${color}) on ${surface} is ${ratio.toFixed(2)}:1, below the 4.5:1 AA threshold.`
      );
    }
  }
});

test('the tertiary text tier is at least legible, and is not mistaken for body text', () => {
  // --text-light carries 11px uppercase meta labels, so it is content, not
  // decoration. It is not held to 4.5:1 because that would make it compete with
  // --text-muted and the tier would stop meaning anything — but it must clear
  // 3:1, the floor for text this small.
  const color = token('text-light');
  for (const surface of ['bg-card', 'bg-sunken', 'bg-canvas'].map(n => token(n))) {
    const ratio = contrast(color, surface);
    assert.ok(
      ratio >= 3,
      `--text-light (${color}) on ${surface} is ${ratio.toFixed(2)}:1, below the 3:1 legibility floor.`
    );
  }
  assert.ok(
    contrast(token('text-muted'), color) >= 1.15,
    '--text-light has drifted onto --text-muted; the two tiers would be indistinguishable.'
  );
});

test('primary text on the card is not pure black on pure white', () => {
  // #000 on #fff is 21:1 and genuinely harsh at length. The existing #0f172a
  // keeps the contrast far above AA while easing the edge.
  const ratio = contrast(token('text-primary'), token('bg-card'));
  assert.ok(ratio >= 12, `body text on the card is only ${ratio.toFixed(1)}:1`);
  assert.notEqual(token('text-primary'), '#000000', 'body text is pure black');
});

/* ------------------------------------------------------------------ *
 * Adoption — a correct ramp nothing uses changes nothing
 * ------------------------------------------------------------------ */

test('the inset panels that were invisible now use the inset token', () => {
  // Both were painted with the page colour, which is the reason the hierarchy
  // was missing: a filter bar the same tone as the gap around it.
  for (const selector of ['.queue-toolbar', '.wo-card__meta']) {
    const at = css.indexOf(`${selector} {`);
    assert.ok(at > -1, `${selector} is missing`);
    const body = css.slice(at, css.indexOf('}', at));
    assert.match(
      body,
      /background:\s*var\(--bg-sunken\)/,
      `${selector} is still painted with the page colour; an inset panel must use --bg-sunken`
    );
  }
});

test('the surface greys are not hardcoded in components any more', () => {
  // #f8fafc and #f1f5f9 appeared 99 times as literal backgrounds. Every one of
  // them ignored the theme, so the ramp could be edited in index.css and the
  // screens would not move. The two exemptions are a loading shimmer and a
  // semantic disposal/replacement distinction, neither of which is a surface.
  const dir = path.join(root, 'frontend', 'src');
  const offenders = [];
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!/\.jsx?$/.test(entry.name)) continue;
      const src = fs.readFileSync(full, 'utf8');
      src.split('\n').forEach((line, i) => {
        if (!/background[^;]*#(f8fafc|f1f5f9)/.test(line)) return;

        /* Two exemptions, identified by what the line is doing rather than where
           it lives, so a filename allowlist cannot quietly admit new greys:
             - a linear-gradient is an animated placeholder, not a surface
             - a ternary between two explicit colours is a meaning (this
               disposition or that one), not a level on the elevation ramp */
        const isAnimated = /linear-gradient/.test(line);
        const isSemanticChoice = /[^?]*\?[^:]*#[0-9a-fA-F]{3,6}[^:]*:/.test(line)
          && /#[0-9a-fA-F]{3,6}/.test(line.split(':').slice(1).join(':'));
        if (isAnimated || isSemanticChoice) return;

        offenders.push(`${path.relative(root, full)}:${i + 1}`);
      });
    }
  };
  walk(dir);
  assert.deepEqual(
    offenders, [],
    `hardcoded surface greys remain (a loading shimmer and a semantic flag are the only exemptions): ${offenders.join(', ')}`
  );
});

test('a resting style is never painted with the hover token', () => {
  // --bg-hover and --bg-muted happen to share a value, so nothing breaks visually
  // if this is wrong — which is exactly why it needs saying. A resting style
  // using the hover token reads as a hover that never ends, and retuning hover
  // later would move 20 unrelated elements.
  const dir = path.join(root, 'frontend', 'src');
  const offenders = [];
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!/\.jsx?$/.test(entry.name)) continue;
      const src = fs.readFileSync(full, 'utf8');
      src.split('\n').forEach((line, i) => {
        if (/background:\s*'var\(--bg-hover\)'/.test(line) && !/onMouseEnter/.test(line)) {
          offenders.push(`${path.relative(root, full)}:${i + 1}`);
        }
      });
    }
  };
  walk(dir);
  assert.deepEqual(offenders, [], `resting styles using --bg-hover: ${offenders.join(', ')}`);
});

test('hover handlers reset to the same token as the resting style', () => {
  // A mechanical find-and-replace once desynchronised exactly this: the static
  // style became a token while the onBlur that undid the focus state still set
  // the old literal, so the field snapped to a different colour on mouse-out.
  const dir = path.join(root, 'frontend', 'src');
  const offenders = [];
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!/\.jsx?$/.test(entry.name)) continue;
      const src = fs.readFileSync(full, 'utf8');
      // Any imperative reset that still assigns one of the retired literals.
      src.split('\n').forEach((line, i) => {
        if (/(onMouseLeave|onBlur)=/.test(line) && /style\.background = '#(f8fafc|f1f5f9)'/.test(line)) {
          offenders.push(`${path.relative(root, full)}:${i + 1}`);
        }
      });
    }
  };
  walk(dir);
  assert.deepEqual(
    offenders, [],
    `reset handlers still assign a retired literal: ${offenders.join(', ')}`
  );
});

/* ------------------------------------------------------------------ *
 * The dark block
 * ------------------------------------------------------------------ */

test('the dark block defines the same ramp, so no token falls back to nothing', () => {
  // Unreachable today — nothing sets data-theme — but a token defined in one
  // theme and not the other resolves to no value at all, which is how a surface
  // silently goes transparent when a toggle is eventually wired up.
  for (const name of ['bg-canvas', 'bg-sunken', 'bg-muted', 'bg-card', 'bg-hover', 'bg-active']) {
    token(name, '[data-theme="dark"]');
  }
});

test('dark mode runs its elevation the other way — lighter means higher', () => {
  // In light mode a raised surface is brighter than its surround. In dark mode
  // that inverts, and copying the light values across is the usual mistake.
  assert.ok(
    luminance(token('bg-card', '[data-theme="dark"]')) > luminance(token('bg-canvas', '[data-theme="dark"]')),
    'a dark-mode card should be lighter than the canvas, not darker'
  );
});
