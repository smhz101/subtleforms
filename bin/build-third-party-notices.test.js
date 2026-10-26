/**
 * PKG-02: the notices file is rebuilt from the modules the build bundled.
 * @jest-environment node
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const script = path.join(__dirname, 'build-third-party-notices.js');

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-notices-'));
  const write = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  };
  write('node_modules/pkg-a/package.json', JSON.stringify({ name: 'pkg-a', version: '1.2.3', license: 'MIT' }));
  write('node_modules/pkg-a/LICENSE', 'MIT License\n\nCopyright (c) Author A');
  write('node_modules/@scope/pkg-b/package.json', JSON.stringify({ name: '@scope/pkg-b', version: '4.5.6', license: 'ISC' }));
  write('node_modules/@scope/pkg-b/LICENSE.md', 'ISC License\n\nCopyright (c) Author B');
  write('node_modules/unused/package.json', JSON.stringify({ name: 'unused', version: '9.9.9', license: 'MIT' }));
  write('node_modules/unused/LICENSE', 'Copyright (c) Nobody');
  write('build/admin/admin.js.map', JSON.stringify({ sources: ['../../node_modules/pkg-a/index.js', '../../node_modules/@scope/pkg-b/dist/x.js', '../../resources/own.js'] }));
  write('build/frontend/flags/LICENSE', 'Flag licence text');
  write('vendor/composer/LICENSE', 'Composer licence text');
  return dir;
}

test('writes the licence text of each bundled package, the flags and vendor packages', () => {
  const dir = fixture();
  const run = spawnSync('node', [script, '--vendor', 'vendor'], { cwd: dir, encoding: 'utf8' });
  expect(run.status).toBe(0);
  const text = fs.readFileSync(path.join(dir, 'THIRD-PARTY-NOTICES.txt'), 'utf8');
  expect(text).toContain('pkg-a 1.2.3');
  expect(text).toContain('Copyright (c) Author A');
  expect(text).toContain('@scope/pkg-b 4.5.6');
  expect(text).toContain('Copyright (c) Author B');
  expect(text).toContain('Flag licence text');
  expect(text).toContain('Composer licence text');
  expect(text).not.toContain('unused');
});

test('fails when a bundled package has no licence text', () => {
  const dir = fixture();
  fs.rmSync(path.join(dir, 'node_modules/pkg-a/LICENSE'));
  const run = spawnSync('node', [script], { cwd: dir, encoding: 'utf8' });
  expect(run.status).not.toBe(0);
  expect(run.stderr).toContain('pkg-a');
});

test('the build runs it after the bundles are built', () => {
  const pkg = require('../package.json');
  expect(pkg.scripts['build:notices']).toContain('bin/build-third-party-notices.js');
  expect(pkg.scripts['build:all']).toContain('build:notices');
});
