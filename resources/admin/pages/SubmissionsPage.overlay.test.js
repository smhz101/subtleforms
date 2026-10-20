/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');

describe('Submissions reading pane (UX2-18)', () => {
  const scss = fs.readFileSync(path.join(__dirname, 'SubmissionsPage.scss'), 'utf8');
  it('covers the list as a full-width overlay under 1100px', () => {
    expect(scss).toMatch(/@media \(max-width: 1100px\)[\s\S]*sf-inbox__pane[\s\S]*position:\s*absolute/);
  });
});
