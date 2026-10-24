/**
 * Form-level field display defaults and required indicator marks.
 */
import { formFieldDefaults, requiredIndicatorMark, fieldDisplay } from './fieldDisplay';

describe('formFieldDefaults', () => {
  it('defaults validation summary on and required mark to asterisk', () => {
    expect(formFieldDefaults({})).toMatchObject({
      validationSummary: true,
      requiredIndicator: 'asterisk',
      requiredIndicatorText: '',
    });
  });

  it('reads validation summary off and custom required indicator', () => {
    expect(
      formFieldDefaults({
        validationSummary: false,
        requiredIndicator: 'custom',
        requiredIndicatorText: '†',
      })
    ).toMatchObject({
      validationSummary: false,
      requiredIndicator: 'custom',
      requiredIndicatorText: '†',
    });
  });

  it('accepts text required indicator', () => {
    expect(formFieldDefaults({ requiredIndicator: 'text' }).requiredIndicator).toBe('text');
  });
});

describe('requiredIndicatorMark', () => {
  it('returns an asterisk by default', () => {
    expect(requiredIndicatorMark()).toBe('*');
    expect(requiredIndicatorMark({ requiredIndicator: 'asterisk' })).toBe('*');
  });

  it('returns (Required) for text mode', () => {
    expect(requiredIndicatorMark({ requiredIndicator: 'text' })).toBe('(Required)');
  });

  it('returns the custom string for custom mode', () => {
    expect(requiredIndicatorMark({ requiredIndicator: 'custom', requiredIndicatorText: 'req' })).toBe('req');
    expect(requiredIndicatorMark({ requiredIndicator: 'custom' })).toBe('*');
  });
});

describe('fieldDisplay', () => {
  it('still applies label and help placement defaults', () => {
    const defaults = formFieldDefaults({ labelVisibility: 'hidden', descriptionPlacement: 'above' });
    expect(fieldDisplay({ key: 'a' }, defaults)).toEqual({ labelHidden: true, descriptionAbove: true });
  });
});
