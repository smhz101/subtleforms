/**
 * #140: a Repeat container with no fields shows nothing on the live form, so
 * the builder canvas says so.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import ContainerRenderer from './ContainerRenderer';

jest.mock('./ContainerRenderer.scss', () => ({}));

global.IS_REACT_ACT_ENVIRONMENT = true;

const WARNING = 'Add at least one field to this repeater. It shows nothing on the form until it has fields.';

function render(node, columns) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() =>
    root.render(
      <ContainerRenderer
        node={node}
        columns={columns}
        isSelected={false}
        onSelect={() => {}}
        onDelete={() => {}}
        renderColumn={(items) => items.map((item) => <span key={item}>{item}</span>)}
      />
    )
  );
  return { container, unmount: () => act(() => root.unmount()) };
}

describe('empty Repeat container warning', () => {
  test('shows for an empty repeater', () => {
    const { container, unmount } = render({ id: 'r', type: 'repeat_container' }, [[]]);
    expect(container.querySelector('.sf-container-renderer__empty-warning').textContent).toBe(WARNING);
    unmount();
  });

  test('hides once a field is inside', () => {
    const { container, unmount } = render({ id: 'r', type: 'repeat_container' }, [['child']]);
    expect(container.querySelector('.sf-container-renderer__empty-warning')).toBeNull();
    unmount();
  });

  test('a group is not warned', () => {
    const { container, unmount } = render({ id: 'g', type: 'group_container' }, [[]]);
    expect(container.querySelector('.sf-container-renderer__empty-warning')).toBeNull();
    unmount();
  });
});
