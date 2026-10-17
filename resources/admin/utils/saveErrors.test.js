import { describeSaveError } from './saveErrors';

describe('describeSaveError (QA-03)', () => {
  it('names the setting at fault', () => {
    const body = { error: { message: 'Validation failed', meta: { fields: { 'schema.metadata.payment': 'Choose an amount.' } } } };
    expect(describeSaveError(body, 422)).toBe('Payment settings: Choose an amount.');
    expect(describeSaveError({ error: { meta: { fields: { 'schema.actions.0.settings.to': 'Bad address' } } } })).toBe('Notifications & actions: Bad address');
  });
  it('falls back to the server message, then a plain sentence', () => {
    expect(describeSaveError({ error: { message: 'Form not found' } })).toBe('Form not found');
    expect(describeSaveError(null, 0)).toMatch(/connection/);
    expect(describeSaveError({}, 500)).toMatch(/Could not save/);
  });
});
