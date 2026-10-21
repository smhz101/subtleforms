/**
 * The WordPress admin menu keeps its core behaviour on SubtleForms screens:
 * no `sf-menu-scrolls` class, no rule that pins #adminmenuwrap.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..', '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('admin menu is left to WordPress', () => {
  test('the shell styles do not target #adminmenuwrap or sf-menu-scrolls', () => {
    const scss = read('resources/admin/components/AdminShell.scss');
    expect(scss).not.toMatch(/sf-menu-scrolls/);
    expect(scss).not.toMatch(/#adminmenuwrap/);
  });

  test('the document is not locked, so a short window can scroll to the whole menu', () => {
    const scss = read('resources/admin/components/AdminShell.scss');
    expect(scss).not.toMatch(/html:has\(body\.subtleforms-admin/);
    const body = scss.slice(scss.indexOf('body.subtleforms-admin-page'), scss.indexOf('#wpwrap'));
    expect(body).not.toMatch(/overflow\s*:/);
  });

  test('the admin entry does not toggle a menu class', () => {
    const entry = read('resources/admin/index.jsx');
    expect(entry).not.toMatch(/sf-menu-scrolls|watchMenuFit|menuFit/);
    expect(fs.existsSync(path.join(root, 'resources/admin/utils/menuFit.js'))).toBe(false);
  });

  test('no PHP, other script or stylesheet in the plugin source adds the class', () => {
    const { execSync } = require('child_process');
    const out = execSync(
      "grep -rIl 'sf-menu-scrolls' src resources templates assets --include=*.php --include=*.js --include=*.jsx --include=*.scss --include=*.css --exclude=*.test.js || true",
      { cwd: root }
    ).toString().trim();
    expect(out).toBe('');
  });
});
