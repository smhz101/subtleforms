import { readFileSync } from 'fs';
import { join } from 'path';

describe('confirmation spacing', () => {
  it('uses the spacing scale instead of ad hoc 10px gaps', () => {
    const scss = readFileSync(join(__dirname, 'LogicEditor.scss'), 'utf8');
    const start = scss.indexOf('.sf-confirmations');
    const block = scss.slice(start, start + 900);
    expect(block).toContain('gap: 12px');
    expect(block).not.toContain('gap: 10px');
    expect(block).not.toContain('padding: 10px');
    expect(block).toContain('margin-top: 8px');
  });
});
