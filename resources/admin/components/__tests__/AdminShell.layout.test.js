/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');

describe('AdminShell layout (UX2-16)', () => {
  const scss = fs.readFileSync(
    path.join(__dirname, '../AdminShell.scss'),
    'utf8'
  );

  it('pins the wpwrap height to the viewport so no dark band shows under the app', () => {
    expect(scss).toMatch(/#wpwrap\s*\{[^}]*100dvh/s);
    expect(scss).toMatch(/body\.subtleforms-admin-page/);
  });
});
