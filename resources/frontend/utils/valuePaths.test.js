import { getIn, setIn, toPathSegments } from './valuePaths';

describe('valuePaths', () => {
  test('toPathSegments splits dot paths', () => {
    expect(toPathSegments('address.street')).toEqual(['address', 'street']);
  });

  test('getIn returns default when missing', () => {
    expect(getIn({}, 'a.b', 'x')).toBe('x');
  });

  test('setIn creates nested objects immutably', () => {
    const base = { a: { keep: 1 } };
    const next = setIn(base, 'a.b', 2);

    expect(next).toEqual({ a: { keep: 1, b: 2 } });
    expect(base).toEqual({ a: { keep: 1 } });
  });
});
