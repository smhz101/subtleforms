#!/usr/bin/env node
/**
 * Writes THIRD-PARTY-NOTICES.txt: the licence text of every npm package that
 * webpack bundled into build/, the flag-icons licence, and the PHP packages
 * shipped in vendor/.
 *
 * The production build strips licence comments, so the notices are rebuilt
 * from the source maps of the build (the list of bundled modules) and each
 * package's own licence file.
 *
 *   node bin/build-third-party-notices.js [--build build] [--node-modules node_modules]
 *        [--vendor <dir>] [--out THIRD-PARTY-NOTICES.txt]
 *
 * Pass --vendor only for a release package: it must hold runtime packages
 * only. Run it before the .map files are deleted.
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const root = process.cwd();
const buildDir = path.resolve(root, opt('build', 'build'));
const modulesDir = path.resolve(root, opt('node-modules', 'node_modules'));
const vendorDir = opt('vendor', '') ? path.resolve(root, opt('vendor', '')) : '';
const outFile = path.resolve(root, opt('out', 'THIRD-PARTY-NOTICES.txt'));

function walk(dir, test, found = []) {
  if (!fs.existsSync(dir)) return found;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, test, found);
    else if (test(entry.name)) found.push(full);
  }
  return found;
}

function licenceFile(dir) {
  if (!fs.existsSync(dir)) return null;
  const names = fs.readdirSync(dir).filter((n) => /^(licen[cs]e|copying|notice)(\..*)?$/i.test(n));
  names.sort((a, b) => (/^licen/i.test(a) ? 0 : 1) - (/^licen/i.test(b) ? 0 : 1));
  return names.length ? path.join(dir, names[0]) : null;
}

// Packages bundled into build/, from the source maps.
const bundled = new Map();
for (const mapFile of walk(buildDir, (n) => n.endsWith('.js.map'))) {
  let map;
  try {
    map = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
  } catch (e) {
    continue;
  }
  for (const source of map.sources || []) {
    const found = [...String(source).matchAll(/node_modules\/((?:@[^/]+\/)?[^/]+)/g)];
    if (!found.length) continue;
    const last = found[found.length - 1];
    const upTo = String(source).slice(0, last.index + last[0].length);
    const rel = upTo.slice(upTo.indexOf('node_modules'));
    const dir = path.resolve(modulesDir, '..', rel);
    bundled.set(dir, last[1]);
  }
}

const sections = [];
const missing = [];

for (const [dir, name] of [...bundled.entries()].sort((a, b) => a[1].localeCompare(b[1]))) {
  let pkg = {};
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  } catch (e) {
    missing.push(name);
    continue;
  }
  const file = licenceFile(dir);
  const text = file ? fs.readFileSync(file, 'utf8').trim() : '';
  if (!text) missing.push(name);
  const homepage = pkg.homepage || (pkg.repository && (pkg.repository.url || pkg.repository)) || '';
  sections.push(
    [
      `${pkg.name || name} ${pkg.version || ''}`.trim(),
      `Licence: ${typeof pkg.license === 'string' ? pkg.license : (pkg.license && pkg.license.type) || 'see below'}`,
      homepage ? `Source: ${homepage}` : '',
      '',
      text || '(The package ships no licence file; see the licence named above.)',
    ]
      .filter((line, i) => line !== '' || i > 2)
      .join('\n')
  );
}

// Flag images.
const flagLicence = path.join(buildDir, 'frontend', 'flags', 'LICENSE');
if (fs.existsSync(flagLicence)) {
  sections.push(
    ['flag-icons (4x3 country flags, build/frontend/flags/)', 'Licence: MIT', '', fs.readFileSync(flagLicence, 'utf8').trim()].join('\n')
  );
} else {
  missing.push('flag-icons');
}

// PHP packages shipped in vendor/.
if (vendorDir) {
  const composerLicence = path.join(vendorDir, 'composer', 'LICENSE');
  if (fs.existsSync(composerLicence)) {
    sections.push(['composer/composer runtime autoloader (vendor/composer/)', 'Licence: MIT', '', fs.readFileSync(composerLicence, 'utf8').trim()].join('\n'));
  } else {
    missing.push('vendor/composer');
  }
  for (const org of fs.existsSync(vendorDir) ? fs.readdirSync(vendorDir) : []) {
    const orgDir = path.join(vendorDir, org);
    if (['composer', 'bin'].includes(org) || !fs.statSync(orgDir).isDirectory()) continue;
    for (const pkgName of fs.readdirSync(orgDir)) {
      const dir = path.join(orgDir, pkgName);
      const file = fs.statSync(dir).isDirectory() ? licenceFile(dir) : null;
      sections.push([`${org}/${pkgName} (vendor/)`, '', file ? fs.readFileSync(file, 'utf8').trim() : '(no licence file shipped)'].join('\n'));
      if (!file) missing.push(`${org}/${pkgName}`);
    }
  }
}

const rule = '\n\n' + '-'.repeat(72) + '\n\n';
const header = [
  'SubtleForms third-party notices',
  '',
  'SubtleForms is licensed under GPL-2.0-or-later (see license.txt). The compiled',
  'scripts in build/ contain the open source packages listed below. Their',
  'licences require the notices to be kept with copies of the software, and',
  'they are reproduced here. All are compatible with the GPL.',
  'WordPress script packages (React, @wordpress/components and the like) are',
  'loaded from WordPress itself and are not part of this plugin.',
].join('\n');

fs.writeFileSync(outFile, `${header}${rule}${sections.join(rule)}\n`);
console.log(`Third-party notices: ${sections.length} entries -> ${path.relative(root, outFile)}`);
if (missing.length) {
  console.warn(`No licence text found for: ${missing.join(', ')}`);
  process.exitCode = 1;
}
