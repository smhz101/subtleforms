/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');

describe('DataTable mobile cards (UX2-19)', () => {
  const scss = fs.readFileSync(path.join(__dirname, 'DataTable.scss'), 'utf8');
  const jsx = fs.readFileSync(path.join(__dirname, 'DataTable.jsx'), 'utf8');

  it('stacks rows as cards under 600px and labels cells', () => {
    expect(scss).toMatch(/@media \(max-width: 600px\)/);
    expect(scss).toMatch(/attr\(data-label\)/);
    expect(jsx).toMatch(/data-label=/);
  });
});
