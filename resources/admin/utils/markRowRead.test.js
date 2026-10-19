import { markRowRead } from './markRowRead';

describe('markRowRead', () => {
  it('marks an unread row and reports the change', () => {
    const result = markRowRead([{ id: 4, is_read: 0 }, { id: 5, is_read: 0 }], 4);
    expect(result.changed).toBe(true);
    expect(result.rows[0].is_read).toBe(1);
    expect(result.rows[1].is_read).toBe(0);
    expect(markRowRead(result.rows, 4).changed).toBe(false);
  });
});
