/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');

describe('HelpMenu (UX2-25)', () => {
  const src = fs.readFileSync(path.join(__dirname, 'HelpMenu.jsx'), 'utf8');
  it('closes the help menu before starting the tour', () => {
    expect(src).toMatch(/onClose\(\);\s*\n\s*onStartTour\(\)/);
  });
});
