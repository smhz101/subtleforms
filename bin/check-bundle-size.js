#!/usr/bin/env node
/**
 * Size budget for the public form code (2.6.0).
 *
 * Every page with a form downloads the base front-end bundle: the main script
 * (build/frontend/frontend.js) and its stylesheet (build/frontend/index.jsx.css).
 * This check fails when the two together, gzip-compressed, grow past the limit
 * in bin/bundle-budget.json, so a change that makes every form slower is caught
 * before it ships. Heavier field code (date picker, phone and country pickers,
 * uploads, payments and so on) lives in separate files that only forms with
 * those fields download; the check also makes sure the country list stays out
 * of the base bundle and that the front end does not need jQuery.
 *
 * Run after a build: npm run build:frontend && npm run size
 * To raise the limit on purpose, edit bin/bundle-budget.json in the same change
 * and say why in the pull request.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const root = path.join(__dirname, '..');
const budget = JSON.parse(fs.readFileSync(path.join(__dirname, 'bundle-budget.json'), 'utf8'));
const dir = path.join(root, 'build', 'frontend');

function gzipSize(buffer) {
  return zlib.gzipSync(buffer, { level: 9 }).length;
}

const problems = [];
let total = 0;
const rows = [];
for (const file of budget.base.files) {
  const full = path.join(dir, file);
  if (!fs.existsSync(full)) {
    console.error(`Missing ${path.relative(root, full)}. Build first: npm run build:frontend`);
    process.exit(1);
  }
  const buffer = fs.readFileSync(full);
  const gz = gzipSize(buffer);
  total += gz;
  rows.push(`  ${file.padEnd(18)} ${String(buffer.length).padStart(8)} bytes, ${String(gz).padStart(7)} gzip`);
}

const limit = budget.base.limitGzipBytes;
console.log('Base front-end bundle (every page with a form):');
console.log(rows.join('\n'));
console.log(`  ${'total'.padEnd(18)} ${String(total).padStart(32)} gzip, limit ${limit}`);
if (total > limit) {
  problems.push(
    `The base front-end bundle is ${total} bytes gzip, over the ${limit} byte limit. ` +
      'Move code only some forms need into a group in resources/frontend/components/fields/lazyFields.jsx, ' +
      'or raise the limit in bin/bundle-budget.json and explain why.'
  );
}

const main = fs.readFileSync(path.join(dir, 'frontend.js'), 'utf8');
for (const marker of budget.base.mustNotContain) {
  if (main.includes(marker)) {
    problems.push(`build/frontend/frontend.js contains "${marker}": ${budget.base.why[marker] || 'it must not be in the base bundle.'}`);
  }
}
const asset = fs.readFileSync(path.join(dir, 'frontend.asset.php'), 'utf8');
if (/'jquery'/.test(asset)) {
  problems.push('The front-end script depends on jQuery. It must not.');
}

if (problems.length) {
  console.error('\n' + problems.join('\n'));
  process.exit(1);
}
console.log('Size budget: OK');
