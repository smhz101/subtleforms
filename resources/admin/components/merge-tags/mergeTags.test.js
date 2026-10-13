import { insertAt, fieldMergeTags, GLOBAL_MERGE_TAGS } from './mergeTags';

describe('merge tags (2.3.0 feature 18)', () => {
  test('lists every documented tag', () => {
    expect(GLOBAL_MERGE_TAGS.map((t) => t.tag)).toEqual([
      '{all_fields}',
      '{form_title}',
      '{entry_id}',
      '{site_name}',
      '{admin_email}',
      '{date}',
    ]);
  });

  test('one {field:key} tag per answer field, never passwords or layout', () => {
    const tags = fieldMergeTags([
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'pw', label: 'Password', type: 'password' },
      { key: 'intro', label: 'Intro', type: 'html' },
    ]);
    expect(tags).toEqual([{ tag: '{field:email}', label: 'Email' }]);
  });

  test('inserts at the caret, or appends with a space', () => {
    expect(insertAt('Hello !', '{form_title}', 6, 6)).toEqual({ value: 'Hello {form_title}!', caret: 18 });
    expect(insertAt('Hello', '{date}')).toEqual({ value: 'Hello {date}', caret: 12 });
    expect(insertAt('', '{date}')).toEqual({ value: '{date}', caret: 6 });
    expect(insertAt('abc', 'X', 1, 2)).toEqual({ value: 'aXc', caret: 2 });
  });
});
