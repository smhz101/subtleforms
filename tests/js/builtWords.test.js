/**
 * WordPress.org guideline 5: the shipped bundles hold no licence handling and
 * no upgrade wording (bin/check-built-words.js). The scanner itself is tested
 * here; when build/ exists (after npm run build:all) the real files are
 * scanned too, the same check CI runs after the build.
 */
const fs = require('fs');
const path = require('path');
const { scanText, scanBuild, isNotice } = require('../../bin/check-built-words');

describe('built files scanner', () => {
  test('finds licence words in any spelling', () => {
    expect(scanText('a License tab').map((h) => h.rule)).toEqual(['licence word']);
    expect(scanText('your licence key').length).toBe(1);
    expect(scanText('licensed users').length).toBe(1);
  });

  test('finds upgrade wording', () => {
    expect(scanText('Upgrade to Pro').length).toBe(1);
    expect(scanText('Go Pro now').length).toBe(1);
    expect(scanText('premium templates').length).toBe(1);
  });

  test('allows the minifier pointer to third-party notices and notice files', () => {
    expect(scanText('/*! For license information please see admin.js.LICENSE.txt */')).toEqual([]);
    expect(isNotice('/x/build/frontend/flags/LICENSE')).toBe(true);
    expect(isNotice('/x/build/admin/admin.js.LICENSE.txt')).toBe(true);
    expect(isNotice('/x/build/admin/admin.js')).toBe(false);
  });

  test('plain product text passes', () => {
    expect(scanText('SubtleForms Pro is a separate plugin that adds payments.')).toEqual([]);
  });
});

const build = path.join(__dirname, '..', '..', 'build');
const hasBuild = fs.existsSync(path.join(build, 'admin', 'admin.js'));

(hasBuild ? test : test.skip)('the built admin, front-end and block files have no licence or upgrade wording', () => {
  expect(scanBuild(build)).toEqual([]);
});
