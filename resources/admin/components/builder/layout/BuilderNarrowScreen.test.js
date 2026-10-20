/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');

describe('BuilderNarrowScreen (UX2-17)', () => {
  const src = fs.readFileSync(path.join(__dirname, 'BuilderNarrowScreen.jsx'), 'utf8');
  it('folds the admin menu and explains the wider-screen requirement', () => {
    expect(src).toMatch(/folded/);
    expect(src).toMatch(/builder needs a wider screen/i);
    expect(src).toMatch(/max-width: 900px/);
  });
});
