/**
 * #140 item 5: types the front end does not draw yet say so on the canvas.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import FieldRenderer from './FieldRenderer';
import { NOT_RENDERED_TYPES } from './utils/fieldWarnings';

jest.mock('./FieldRenderer.scss', () => ({}));

global.IS_REACT_ACT_ENVIRONMENT = true;

const WARNING = 'This field is not shown on the form yet. Visitors will not see it, so remove it or use another field.';

function render(field) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<FieldRenderer field={field} />));
  return { container, unmount: () => act(() => root.unmount()) };
}

describe('warning for fields that are not shown yet', () => {
  test('lists the three types', () => {
    expect(NOT_RENDERED_TYPES).toEqual(['dynamic_field', 'post_selection', 'save_resume']);
  });

  test.each(['dynamic_field', 'post_selection', 'save_resume'])('%s shows the warning', (type) => {
    const { container, unmount } = render({ id: 'x', key: 'x', type, label: 'X' });
    expect(container.textContent).toContain(WARNING);
    unmount();
  });

  test('a Dropdown does not', () => {
    const { container, unmount } = render({ id: 'x', key: 'x', type: 'dropdown', label: 'X', options: [] });
    expect(container.textContent).not.toContain(WARNING);
    unmount();
  });
});
