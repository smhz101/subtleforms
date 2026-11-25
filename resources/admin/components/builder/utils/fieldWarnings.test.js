import { chainedNotSetUpWarning } from './fieldWarnings';

const NOT_SET_UP = 'The dropdowns are not set up yet. Visitors will not see this field until you add them.';

describe('getFieldWarnings for a Chained Select (RFUN-02)', () => {
  test('warns when no dropdown has choices', () => {
    expect(chainedNotSetUpWarning({ type: 'chained_select', label: 'Place' })).toBe(NOT_SET_UP);
    expect(chainedNotSetUpWarning({ type: 'chained_select', label: 'Place', levels: [{ label: 'A', options: [] }] })).toBe(NOT_SET_UP);
    expect(chainedNotSetUpWarning({ type: 'chained_select', label: 'Place', config: { options: [] } })).toBe(NOT_SET_UP);
  });

  test('is quiet once the field has choices, in either shape', () => {
    expect(
      chainedNotSetUpWarning({ type: 'chained_select', label: 'Place', levels: [{ label: 'A', options: [{ label: 'x', value: 'x' }] }] })
    ).toBe('');
    expect(
      chainedNotSetUpWarning({ type: 'chained_select', label: 'Place', options: [{ label: 'x', value: 'x', children: [] }] })
    ).toBe('');
  });

  test('other fields are not affected', () => {
    expect(chainedNotSetUpWarning({ type: 'text', label: 'Name' })).toBe('');
  });
});

describe('notShownWarning (#140)', () => {
  const { notShownWarning } = require('./fieldWarnings');
  test('warns for each type that is not drawn yet, not for a Dropdown', () => {
    ['dynamic_field', 'post_selection', 'save_resume'].forEach((type) => {
      expect(notShownWarning({ type })).toContain('not shown on the form yet');
    });
    expect(notShownWarning({ type: 'dropdown' })).toBe('');
  });
});

describe('fieldNote (#140)', () => {
  const { fieldNote } = require('./fieldWarnings');
  test('the Password field says the password is not saved; other types have no note', () => {
    expect(fieldNote({ type: 'password' })).toBe('The password is not saved. Entries show "Password provided" instead.');
    expect(fieldNote({ type: 'text' })).toBe('');
    expect(fieldNote(null)).toBe('');
  });
});
