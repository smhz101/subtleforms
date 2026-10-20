/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');

describe('SubmissionsTable relative time (UX2-28)', () => {
  const src = fs.readFileSync(path.join(__dirname, 'SubmissionsTable.jsx'), 'utf8');
  it('pluralises hours with _n', () => {
    expect(src).toMatch(/_n\('%d hour ago', '%d hours ago'/);
    expect(src).not.toMatch(/__\('%1\$d hours ago'/);
  });
});
