import { formOptionLabel } from './toolLabels';

describe('formOptionLabel', () => {
  it('keeps two forms with the same title distinct', () => {
    const a = formOptionLabel({ id: 3, title: 'Contact', status: 'published' });
    const b = formOptionLabel({ id: 8, title: 'Contact', status: 'draft' });
    expect(a).not.toBe(b);
    expect(a).toBe('Contact (#3, published)');
    expect(b).toBe('Contact (#8, draft)');
  });
});
