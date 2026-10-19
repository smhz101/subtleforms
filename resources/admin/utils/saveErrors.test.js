import { describeSaveError } from './saveErrors';

describe('describeSaveError (QA-03)', () => {
  it('names the setting at fault', () => {
    const body = { error: { message: 'Validation failed', meta: { fields: { 'schema.metadata.payment': 'Choose an amount.' } } } };
    expect(describeSaveError(body, 422)).toBe('Payment settings: Choose an amount.');
    expect(describeSaveError({ error: { meta: { fields: { 'schema.actions.0.settings.to': 'Bad address' } } } })).toBe('Notifications & actions: Bad address');
  });
  it('names the field setting that is too long', () => {
    const body = { error: { meta: { fields: { 'schema.fields[6].label': 'Maximum length is 2000 characters' } } } };
    expect(describeSaveError(body, 422)).toBe('Field label: Maximum length is 2000 characters');
  });
  it('falls back to the server message, then a plain sentence', () => {
    expect(describeSaveError({ error: { message: 'Form not found' } }, 404)).toBe('Form not found');
    expect(describeSaveError(null, 0)).toBe('Your changes are kept in this tab.');
    expect(describeSaveError({}, 500)).toBe('Your changes are kept in this tab.');
    expect(describeSaveError(null, 'abort')).toBe('Your changes are kept in this tab.');
    expect(describeSaveError({ message: 'Could not get a valid response from the server.' })).toBe('Your changes are kept in this tab.');
  });
});
