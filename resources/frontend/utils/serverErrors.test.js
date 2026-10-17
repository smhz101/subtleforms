import { serverFieldErrors, fixFieldsSummary } from './serverErrors';

describe('serverFieldErrors (2.2.1 bug 2)', () => {
  test('reads meta.fields from a 422 response', () => {
    const body = {
      error: {
        code: 'validation_error',
        message: 'Form validation failed',
        meta: { fields: { first_name: 'First name is required.', email: ['Invalid email address.'] } },
      },
    };
    expect(serverFieldErrors(body)).toEqual({
      first_name: 'First name is required.',
      email: 'Invalid email address.',
    });
  });

  test('accepts the older shapes', () => {
    expect(serverFieldErrors({ data: { errors: { a: 'x' } } })).toEqual({ a: 'x' });
    expect(serverFieldErrors({ error: { meta: { errors: { b: { message: 'y' } } } } })).toEqual({ b: 'y' });
  });

  test('ignores empty and malformed input', () => {
    expect(serverFieldErrors(null)).toEqual({});
    expect(serverFieldErrors({ error: { meta: { fields: ['x'] } } })).toEqual({});
    expect(serverFieldErrors({ error: { meta: { fields: { a: '' } } } })).toEqual({});
  });

  test('summary wording', () => {
    expect(fixFieldsSummary(4)).toBe('Please fix the 4 highlighted fields.');
    expect(fixFieldsSummary(1)).toBe('Please fix the highlighted field.');
  });
});
