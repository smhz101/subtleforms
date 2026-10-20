/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');

describe('BuilderViewSwitcher (UX2-13)', () => {
  const src = fs.readFileSync(path.join(__dirname, 'BuilderViewSwitcher.jsx'), 'utf8');
  it('labels the form settings view Form, not Settings', () => {
    expect(src).toMatch(/label: __\('Form'/);
    expect(src).not.toMatch(/key: 'settings', label: __\('Settings'/);
  });
});
