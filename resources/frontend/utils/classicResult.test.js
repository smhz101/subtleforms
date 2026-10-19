import { classicOutcome } from './classicResult';

describe('classic (no AJAX) outcome (2.4.0, #37)', () => {
  test('a rejected post gives the field errors and the answers, never success', () => {
    const outcome = classicOutcome(
      JSON.stringify({
        ok: false,
        body: {
          error: {
            code: 'validation_error',
            message: 'Please fix the highlighted fields.',
            meta: { fields: { email: 'Enter a valid email address.' } },
          },
        },
        values: { email: 'nope', 'g-recaptcha-response': 'token', website_url: '' },
      })
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.fieldErrors).toEqual({ email: 'Enter a valid email address.' });
    expect(outcome.values).toEqual({ email: 'nope' });
  });

  test('an error without field errors keeps its message', () => {
    const outcome = classicOutcome({ ok: false, body: { error: { message: 'CAPTCHA verification failed.' } }, values: {} });
    expect(outcome.ok).toBe(false);
    expect(outcome.fieldErrors).toEqual({});
    expect(outcome.message).toBe('CAPTCHA verification failed.');
  });

  test('a success carries the confirmation and the entry', () => {
    const outcome = classicOutcome({
      ok: true,
      body: { data: { success: true, submission_id: 9, confirmation: { type: 'message', message: 'Thanks {name}' } } },
      values: { name: 'Ada' },
    });
    expect(outcome).toEqual({
      ok: true,
      confirmation: { type: 'message', message: 'Thanks {name}' },
      submissionId: 9,
      values: { name: 'Ada' },
    });
  });

  test('nothing to show for an empty or broken attribute', () => {
    expect(classicOutcome('')).toBeNull();
    expect(classicOutcome('{broken')).toBeNull();
    expect(classicOutcome(null)).toBeNull();
  });
});
