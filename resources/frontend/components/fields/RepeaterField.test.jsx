/**
 * Repeater group legends use a generic Entry N label, not the field heading.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import RepeaterField from './RepeaterField';

global.IS_REACT_ACT_ENVIRONMENT = true;

function mount(props) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() =>
    root.render(
      <RepeaterField
        field={{ type: 'repeat_container', children: [{ key: 'name', type: 'text', label: 'Name' }] }}
        config={{ key: 'companies', min: 1, max: 3 }}
        path='companies'
        namePrefix='companies'
        label='Companies'
        values={{ companies: [{}] }}
        onChange={() => {}}
        errors={{}}
        renderChild={() => null}
        {...props}
      />
    )
  );
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

test('group legend is Entry N, not the repeater label', () => {
  const { container, unmount } = mount();
  expect(container.querySelector('.subtleforms-repeater__label').textContent).toContain('Companies');
  const legend = container.querySelector('.subtleforms-repeater__legend');
  expect(legend.textContent).toBe('Entry 1');
  expect(legend.textContent).not.toContain('Companies');
  unmount();
});

test('remove control names the entry, not the field heading', () => {
  const { container, unmount } = mount({
    config: { key: 'companies', min: 0, max: 3 },
    values: { companies: [{}, {}] },
  });
  const remove = container.querySelector('.subtleforms-repeater__remove');
  expect(remove).not.toBeNull();
  expect(remove.getAttribute('aria-label')).toMatch(/Entry 1/);
  expect(remove.getAttribute('aria-label')).not.toMatch(/Companies/);
  unmount();
});
