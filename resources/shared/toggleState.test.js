import { toggleInitialValue, toggleIsOn } from './toggleState';

describe('toggle state', () => {
  test('a missing default state is off', () => {
    expect(toggleInitialValue({})).toBe('no');
    expect(toggleInitialValue({ defaultState: 'off' })).toBe('no');
    expect(toggleInitialValue({ defaultState: 'on', onValue: 'yes' })).toBe('yes');
  });

  test('off-like values stay off, and the off value wins', () => {
    expect(toggleIsOn(0)).toBe(false);
    expect(toggleIsOn('0')).toBe(false);
    expect(toggleIsOn('off')).toBe(false);
    expect(toggleIsOn('no')).toBe(false);
    expect(toggleIsOn(false)).toBe(false);
    expect(toggleIsOn('yes')).toBe(true);
    expect(toggleIsOn('0', { onValue: '0', offValue: '0' })).toBe(false);
  });
});
