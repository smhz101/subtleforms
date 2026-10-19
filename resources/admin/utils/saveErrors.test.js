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

  // FLD2-11: say which field, not only which setting.
  it('names the field whose setting stopped the save', () => {
    const schema = {
      fields: [
        { id: 'a', key: 'name', type: 'text', label: 'Your name' },
        { id: 's', type: 'step', fields: [{ id: 'b', key: 'year', type: 'number', config: { label: 'x'.repeat(2001) } }] },
      ],
    };
    const long = { error: { meta: { fields: { 'schema.fields[1].fields[0].label': 'Maximum length is 2000 characters' } } } };
    expect(describeSaveError(long, 422, schema)).toBe(
      `Field label in "${'x'.repeat(40)}...": Maximum length is 2000 characters`
    );
    const placeholder = { error: { meta: { fields: { 'schema.fields[0].placeholder': 'Maximum length is 255 characters' } } } };
    expect(describeSaveError(placeholder, 422, schema)).toBe('Placeholder in "Your name": Maximum length is 255 characters');
    // Without the schema the setting alone is named, as before.
    expect(describeSaveError(placeholder, 422)).toBe('Placeholder: Maximum length is 255 characters');
  });
});
