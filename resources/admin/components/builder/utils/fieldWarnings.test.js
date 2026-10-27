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
