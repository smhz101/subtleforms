/**
 * Form-level field display defaults and required indicator marks.
 */
import {
  formFieldDefaults,
  requiredIndicatorMark,
  fieldDisplay,
  formHasRequiredFields,
  requiredFieldsLegendParts,
} from './fieldDisplay';

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

  it('text mode ignores custom text', () => {
    expect(requiredIndicatorMark({ requiredIndicator: 'text', requiredIndicatorText: 'Nope' })).toBe('(Required)');
  });

  it('returns the custom string for custom mode', () => {
    expect(requiredIndicatorMark({ requiredIndicator: 'custom', requiredIndicatorText: 'req' })).toBe('req');
    expect(requiredIndicatorMark({ requiredIndicator: 'custom' })).toBe('*');
  });
});

describe('formHasRequiredFields', () => {
  it('finds a required field in a flat list', () => {
    expect(formHasRequiredFields({ fields: [{ key: 'a', type: 'text', required: true }] })).toBe(true);
    expect(formHasRequiredFields({ fields: [{ key: 'a', type: 'text' }] })).toBe(false);
  });

  it('walks nested children and columns', () => {
    expect(
      formHasRequiredFields({
        fields: [
          {
            type: 'group',
            children: [{ key: 'n', type: 'text', required: true }],
          },
        ],
      })
    ).toBe(true);
    expect(
      formHasRequiredFields({
        fields: [{ type: 'columns', columns: [[{ key: 'n', type: 'text', required: true }]] }],
      })
    ).toBe(true);
  });

  it('reads required from a builder tree nodes map', () => {
    expect(
      formHasRequiredFields({
        nodes: {
          root: { type: 'root', children: ['a'] },
          a: { type: 'text', key: 'a', required: true },
        },
      })
    ).toBe(true);
  });
});

describe('requiredFieldsLegendParts', () => {
  it('returns the mark from form defaults', () => {
    expect(requiredFieldsLegendParts({ requiredIndicator: 'custom', requiredIndicatorText: '†' })).toEqual({
      mark: '†',
    });
  });
});

describe('fieldDisplay', () => {
  it('still applies label and help placement defaults', () => {
    const defaults = formFieldDefaults({ labelVisibility: 'hidden', descriptionPlacement: 'above' });
    expect(fieldDisplay({ key: 'a' }, defaults)).toEqual({ labelHidden: true, descriptionAbove: true });
  });
});
