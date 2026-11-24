/**
 * #140 item 6: a Chained Select with nothing to choose is hidden on the live
 * form, so the builder canvas says so on the field.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import FieldRenderer from './FieldRenderer';

jest.mock('./FieldRenderer.scss', () => ({}));

global.IS_REACT_ACT_ENVIRONMENT = true;

const WARNING = 'No options yet, so this field is hidden on the live form. Add them in the field settings.';

function render(field) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<FieldRenderer field={field} />));
  return { container, unmount: () => act(() => root.unmount()) };
}

const chained = (extra) => ({ id: 'c', key: 'place', type: 'chained_select', label: 'Place', ...extra });

describe('Chained Select warning on the canvas', () => {
  test('a new Chained Select with no levels shows the warning', () => {
    const { container, unmount } = render(chained({ levels: [] }));
    const warning = container.querySelector('.sf-field-renderer__chained-warning');
    expect(warning).not.toBeNull();
    expect(warning.textContent).toContain(WARNING);
    unmount();
  });

  test('levels with no choices still show the warning', () => {
    const { container, unmount } = render(chained({ levels: [{ label: 'Country', options: [] }] }));
    expect(container.querySelector('.sf-field-renderer__chained-warning')).not.toBeNull();
    unmount();
  });

  test('a configured Chained Select shows no warning', () => {
    const { container, unmount } = render(
      chained({ levels: [{ label: 'Country', options: [{ label: 'Pakistan', value: 'pk' }] }] })
    );
    expect(container.querySelector('.sf-field-renderer__chained-warning')).toBeNull();
    unmount();
  });

  test('settings kept under config count as configured', () => {
    const { container, unmount } = render(
      chained({ config: { levels: [{ label: 'Country', options: [{ label: 'Pakistan', value: 'pk' }] }] } })
    );
    expect(container.querySelector('.sf-field-renderer__chained-warning')).toBeNull();
    unmount();
  });
});
