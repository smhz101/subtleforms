/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');

describe('BuilderTour steps (UX2-26)', () => {
  const src = fs.readFileSync(path.join(__dirname, 'BuilderTour.jsx'), 'utf8');
  it('does not claim Save/Publish/Delete buttons live in the header title', () => {
    expect(src).not.toMatch(/use Save, Publish, or Delete buttons/);
    expect(src).toMatch(/form title/i);
  });
  it('tells users to select a field before the inspector has content', () => {
    expect(src).toMatch(/Select a field on the canvas/);
  });
  it('scrolls tour targets within nearest block only', () => {
    expect(src).toMatch(/block: 'nearest'/);
  });
});
