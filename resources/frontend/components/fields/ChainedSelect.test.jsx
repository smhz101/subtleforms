/**
 * Columns layout never answers for the visitor (FLD2-09).
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import ChainedSelect from './ChainedSelect';
import { validateField } from '../../utils/fieldValidation';

global.IS_REACT_ACT_ENVIRONMENT = true;

const config = {
  key: 'car',
  required: true,
  presentation: 'columns',
  levels: [
    { label: 'Make', options: [{ label: 'Ford', value: 'ford' }, { label: 'Toyota', value: 'toyota' }] },
    { label: 'Model', options: [{ label: 'Focus', value: 'focus', parent: 'ford' }] },
  ],
};

describe('FLD2-09: Columns layout', () => {
  it('does not write the first choice into an untouched answer', () => {
    const onChange = jest.fn();
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => {
      root.render(<ChainedSelect inputId='car' config={config} value={[]} onChange={onChange} required />);
    });
    expect(onChange).not.toHaveBeenCalled();
    // The first list's choices are previewed, none is shown as picked.
    expect(container.querySelectorAll('[aria-checked="true"]')).toHaveLength(0);
    expect(container.textContent).toContain('Focus');
    act(() => root.unmount());
  });

  it('an untouched required field fails validation', () => {
    expect(validateField({ type: 'chained_select', ...config }, [])).toBe('This field is required.');
  });
});

describe('FLD2-10: required chained field in the browser', () => {
  it('needs every level that offers choices', () => {
    const field = { type: 'chained_select', ...config, presentation: 'dropdowns' };
    expect(validateField(field, ['ford'])).toBe('This field is required.');
    expect(validateField(field, ['ford', 'focus'])).toBeUndefined();
    expect(validateField(field, ['toyota'])).toBeUndefined();
  });
});
