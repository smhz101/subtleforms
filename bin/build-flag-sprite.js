#!/usr/bin/env node
/**
 * Builds the country flag sprite (2.7.2): build/frontend/flags.svg.
 *
 * Reads the 4x3 flags of the MIT licensed `flag-icons` package and writes one
 * <symbol> per country, id "sf-<code>" (lower case), all with the same
 * viewBox. A form draws a flag with <use href=".../flags.svg#sf-pk">, so the
 * browser downloads and caches this one file, and only when a form turned
 * flags on. It is not part of the base front-end bundle.
 *
 * Ids inside a flag (clip paths, gradients) are prefixed with the symbol id,
 * so two flags in one file can never share an id.
 *
 * Run by `npm run build:all` (npm run build:flags).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const sourceDir = path.join(root, 'node_modules', 'flag-icons', 'flags', '4x3');
const target = path.join(root, 'build', 'frontend', 'flags.svg');
const VIEW_BOX = '0 0 640 480';

/**
 * A few flags carry a detailed coat of arms (hundreds of tiny paths) that
 * would make up most of the file, and it cannot be read at 20 by 15 pixels.
 * Those flags (larger than HEAVY bytes) keep their field and first shapes
 * (KEEP_PATHS) and lose the emblem detail.
 */
const HEAVY = 10000;
const KEEP_PATHS = 6;
const SHORT_PATH = 36;
/** Flags whose stripes come after the emblem in the source file. */
const STRIPES_LAST = new Set(['ir']);

/**
 * Drop paths after the first `keep`, and the groups that end up empty.
 *
 * @param {string} inner Symbol contents.
 * @param {number} keep  Paths to keep.
 * @param {boolean} keepShort Also keep short rectangles under the flag's own group.
 * @return {string}
 */
function simplify(inner, keep, keepShort) {
  let seen = 0;
  let depth = 0;
  let inDefs = false;
  let out = inner.replace(/<defs\b[^>]*>|<\/defs>|<g(?:\s[^>]*)?>|<\/g>|<path\b[^>]*?\/>/g, (tag) => {
    if (tag.startsWith('<defs')) {
      inDefs = true;
    } else if (tag === '</defs>') {
      inDefs = false;
    } else if (tag === '</g>') {
      depth -= 1;
    } else if (tag.startsWith('<g')) {
      depth += 1;
    } else if (!inDefs) {
      seen += 1;
      // A stripe or bar is one short rectangle straight under the flag's own
      // group (Iran draws its green stripe after the emblem).
      const d = (tag.match(/\sd="([^"]*)"/) || [])[1] || '';
      if (seen > keep && !(keepShort && depth <= 1 && d.length <= SHORT_PATH)) {
        return '';
      }
    }
    return tag;
  });
  let before;
  do {
    before = out;
    out = out.replace(/<g\b[^>]*><\/g>/g, '');
  } while (out !== before);
  return out;
}

/**
 * Shorten the numbers in path data. Flags are shown at about 20 by 15 pixels,
 * so one decimal on a 640 by 480 canvas is far below what the eye can see,
 * and it makes the heaviest flags (coats of arms) several times smaller.
 *
 * @param {string} value Path data.
 * @return {string} Rounded path data.
 */
function roundPath(value) {
  return value.replace(/-?\d*\.\d+/g, (num) => {
    const rounded = Math.round(parseFloat(num) * 10) / 10;
    return String(rounded).replace(/^(-?)0\./, '$1.');
  });
}

/**
 * One flag as a symbol.
 *
 * @param {string} code   Lower case two-letter code.
 * @param {string} markup Contents of the flag's svg file.
 * @return {string} <symbol> markup.
 */
function toSymbol(code, markup) {
  const open = markup.match(/<svg\b[^>]*>/);
  if (!open || !/viewBox="0 0 640 480"/.test(open[0])) {
    throw new Error(`Flag ${code} is not 640 by 480.`);
  }
  let inner = markup
    .slice(open.index + open[0].length, markup.lastIndexOf('</svg>'))
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/>\s+</g, '><')
    .replace(/\sd="([^"]+)"/g, (all, d) => ` d="${roundPath(d)}"`)
    .trim();
  if (markup.length > HEAVY) {
    inner = simplify(inner, KEEP_PATHS, STRIPES_LAST.has(code));
  }
  const prefix = `sf-${code}-`;
  const ids = new Set();
  inner.replace(/\sid="([^"]+)"/g, (all, id) => {
    ids.add(id);
    return all;
  });
  ids.forEach((id) => {
    const next = prefix + id;
    const quoted = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    inner = inner
      .replace(new RegExp(`\\sid="${quoted}"`, 'g'), ` id="${next}"`)
      .replace(new RegExp(`url\\(#${quoted}\\)`, 'g'), `url(#${next})`)
      .replace(new RegExp(`(href=")#${quoted}(")`, 'g'), `$1#${next}$2`);
  });
  return `<symbol id="sf-${code}" viewBox="${VIEW_BOX}">${inner}</symbol>`;
}

/**
 * The whole sprite.
 *
 * @param {string} dir Folder with the <code>.svg files.
 * @return {{svg: string, codes: string[]}}
 */
function buildSprite(dir) {
  const codes = fs
    .readdirSync(dir)
    .map((file) => file.replace(/\.svg$/, ''))
    .filter((name) => /^[a-z]{2}$/.test(name))
    .sort();
  const symbols = codes.map((code) => toSymbol(code, fs.readFileSync(path.join(dir, `${code}.svg`), 'utf8')));
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' +
    symbols.join('') +
    '</svg>\n';
  return { svg, codes };
}

if (require.main === module) {
  if (!fs.existsSync(sourceDir)) {
    console.error('The flag-icons package is missing. Run: npm install');
    process.exit(1);
  }
  const { svg, codes } = buildSprite(sourceDir);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, svg);
  const gzip = require('zlib').gzipSync(Buffer.from(svg), { level: 9 }).length;
  console.log(`Flag sprite: ${codes.length} flags, ${Buffer.byteLength(svg)} bytes, ${gzip} gzip -> ${path.relative(root, target)}`);
}

module.exports = { buildSprite, toSymbol };
