#!/usr/bin/env node
/**
 * Copies the country flags to build/frontend/flags/<code>.svg (2.7.2).
 *
 * The files are the full-detail 4x3 flags of the MIT licensed `flag-icons`
 * package (a build-time dependency only: nothing of the package is shipped but
 * these copied SVGs). They are optimised with svgo when it is installed and
 * copied as they are otherwise. A form that shows flags draws one with
 * <img src=".../flags/pk.svg">, so the browser downloads only the flags it
 * shows.
 *
 * Run by `npm run build:all` (npm run build:flags).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const sourceDir = path.join(root, 'node_modules', 'flag-icons', 'flags', '4x3');
const targetDir = path.join(root, 'build', 'frontend', 'flags');

function loadSvgo() {
  try {
    return require('svgo');
  } catch (e) {
    return null;
  }
}

/**
 * Optimise one flag.
 *
 * @param {Object|null} svgo   The svgo module, or null.
 * @param {string}      markup Flag file contents.
 * @return {string}
 */
function optimise(svgo, markup) {
  if (!svgo) {
    return markup;
  }
  const out = svgo.optimize(markup, {
    multipass: true,
    plugins: [
      {
        name: 'preset-default',
        params: { overrides: { removeViewBox: false } },
      },
    ],
  }).data;
  return /viewBox="0 0 640 480"/.test(out) ? out : markup;
}

/**
 * Write every flag.
 *
 * @param {string} from Source folder.
 * @param {string} to   Target folder.
 * @return {{codes: string[], sizes: number[], optimised: boolean}}
 */
function buildFlags(from, to) {
  const svgo = loadSvgo();
  fs.rmSync(to, { recursive: true, force: true });
  fs.mkdirSync(to, { recursive: true });
  const codes = fs
    .readdirSync(from)
    .map((file) => file.replace(/\.svg$/, ''))
    .filter((name) => /^[a-z]{2}$/.test(name))
    .sort();
  const sizes = codes.map((code) => {
    const data = optimise(svgo, fs.readFileSync(path.join(from, `${code}.svg`), 'utf8'));
    fs.writeFileSync(path.join(to, `${code}.svg`), data);
    return Buffer.byteLength(data);
  });
  return { codes, sizes, optimised: !!svgo };
}

if (require.main === module) {
  if (!fs.existsSync(sourceDir)) {
    console.error('The flag-icons package is missing. Run: npm install');
    process.exit(1);
  }
  const { codes, sizes, optimised } = buildFlags(sourceDir, targetDir);
  const sorted = [...sizes].sort((a, b) => a - b);
  console.log(
    `Flags: ${codes.length} files, median ${sorted[Math.floor(sorted.length / 2)]} bytes, ` +
      `total ${sizes.reduce((a, b) => a + b, 0)} bytes${optimised ? ' (svgo)' : ''} -> ${path.relative(root, targetDir)}/`
  );
}

module.exports = { buildFlags };
