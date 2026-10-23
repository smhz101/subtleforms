#!/usr/bin/env node
/**
 * Copies the country flags to build/frontend/flags/<code>.svg (2.7.2).
 *
 * The flags live in resources/flags as plain files, so the build needs no
 * extra package. They are the 4x3 flags of the MIT licensed `flag-icons`
 * project, optimised once; its copyright and license notice is kept in
 * resources/flags/LICENSE and copied next to the flags, so a release archive
 * carries it. A form that shows flags draws one with
 * <img src=".../flags/pk.svg">, so the browser downloads only the flags it
 * shows.
 *
 * Run by `npm run build:all` (npm run build:flags).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const sourceDir = path.join(root, 'resources', 'flags');
const targetDir = path.join(root, 'build', 'frontend', 'flags');

/**
 * Write every flag and the license notice.
 *
 * @param {string} from Source folder.
 * @param {string} to   Target folder.
 * @return {{codes: string[], sizes: number[]}}
 */
function buildFlags(from, to) {
  fs.rmSync(to, { recursive: true, force: true });
  fs.mkdirSync(to, { recursive: true });
  const codes = fs
    .readdirSync(from)
    .map((file) => file.replace(/\.svg$/, ''))
    .filter((name) => /^[a-z]{2}$/.test(name))
    .sort();
  const sizes = codes.map((code) => {
    const data = fs.readFileSync(path.join(from, `${code}.svg`));
    fs.writeFileSync(path.join(to, `${code}.svg`), data);
    return data.length;
  });
  fs.copyFileSync(path.join(from, 'LICENSE'), path.join(to, 'LICENSE'));
  return { codes, sizes };
}

if (require.main === module) {
  if (!fs.existsSync(sourceDir)) {
    console.error('resources/flags is missing.');
    process.exit(1);
  }
  const { codes, sizes } = buildFlags(sourceDir, targetDir);
  const sorted = [...sizes].sort((a, b) => a - b);
  console.log(
    `Flags: ${codes.length} files, median ${sorted[Math.floor(sorted.length / 2)]} bytes, ` +
      `total ${sizes.reduce((a, b) => a + b, 0)} bytes -> ${path.relative(root, targetDir)}/`
  );
}

module.exports = { buildFlags };
