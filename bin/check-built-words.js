#!/usr/bin/env node
/**
 * The built files carry no licence handling and no upgrade wording.
 *
 * SubtleForms is a complete plugin on its own (WordPress.org guideline 5). The
 * minified scripts and styles in build/ ship to every site, so they are checked
 * here, not only the sources: no word starting with "licen" (licence, license,
 * licensed) and no "upgrade to", "go pro", "unlock" or "premium" wording.
 * Third-party notices are allowed: LICENSE files, *.LICENSE.txt files and the
 * "For license information" pointer the minifier adds for them.
 *
 * Run after a build: npm run build:all && npm run check:words
 */
'use strict';

const fs = require('fs');
const path = require('path');

const RULES = [
  { name: 'licence word', re: /licen[cs]/gi },
  { name: 'upgrade wording', re: /upgrade to\b|go pro\b|\bunlock (?:this|all|more|pro)\b|\bpremium\b/gi },
];

// Text that may contain a rule word: third-party licence notices.
const ALLOWED = [/For license information please see [\w.-]+\.LICENSE\.txt/g];

/** Whether a file is a third-party notice that may name its licence. */
function isNotice(file) {
  const base = path.basename(file);
  return base === 'LICENSE' || base.endsWith('.LICENSE.txt');
}

/** Rule hits in one text, with a little context. */
function scanText(text) {
  let clean = String(text);
  ALLOWED.forEach((re) => {
    clean = clean.replace(re, '');
  });
  const hits = [];
  RULES.forEach(({ name, re }) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(clean)) !== null) {
      hits.push({ rule: name, match: m[0], context: clean.slice(Math.max(0, m.index - 40), m.index + 40) });
    }
  });
  return hits;
}

/** Every shipped text file under a directory (no source maps). */
function shippedFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...shippedFiles(full));
    } else if (/\.(js|css|php|json|svg|html)$/.test(entry.name) && !entry.name.endsWith('.map')) {
      out.push(full);
    }
  });
  return out;
}

/** Hits in every shipped file under build/. */
function scanBuild(dir) {
  return shippedFiles(dir)
    .filter((file) => !isNotice(file))
    .flatMap((file) => scanText(fs.readFileSync(file, 'utf8')).map((hit) => ({ file, ...hit })));
}

module.exports = { scanText, scanBuild, isNotice };

if (require.main === module) {
  const dir = path.join(__dirname, '..', 'build');
  if (!fs.existsSync(dir)) {
    console.error('No build/ folder. Run npm run build:all first.');
    process.exit(1);
  }
  const hits = scanBuild(dir);
  if (hits.length) {
    hits.forEach((h) => console.error(`${path.relative(process.cwd(), h.file)}: ${h.rule} "${h.match}" in ...${h.context}...`));
    process.exit(1);
  }
  console.log('Built files: no licence or upgrade wording.');
}
