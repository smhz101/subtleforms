/**
 * The upload field in the free plugin takes one file, whatever the saved
 * field asks for. Several files per field are a SubtleForms Pro feature.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import FileUpload from './FileUpload';

global.IS_REACT_ACT_ENVIRONMENT = true;

function mount(props) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<FileUpload inputId='f1' onChange={() => {}} {...props} />));
  return { container, unmount: () => { act(() => root.unmount()); container.remove(); } };
}

const field = { type: 'file_upload', key: 'docs' };

test('a field saved with several files shows a single file picker', () => {
  const { container, unmount } = mount({
    field,
    config: { key: 'docs', multiple: true, maxFiles: 5 },
    value: [],
  });
  const input = container.querySelector('input[type="file"]');
  expect(input.multiple).toBe(false);
  expect(input.name).toBe('docs');
  expect(container.querySelector('.subtleforms-upload__drop')).toBeNull();
  expect(container.querySelector('.subtleforms-upload--multiple')).toBeNull();
  expect(container.textContent).not.toMatch(/up to \d+ files|Drop files/);
  unmount();
});

test('the picker is disabled once a file is attached', () => {
  const { container, unmount } = mount({
    field,
    config: { key: 'docs', multiple: true },
    value: [{ id: 'a1', name: 'a.pdf', size: 10, type: 'application/pdf' }],
  });
  expect(container.querySelector('input[type="file"]').disabled).toBe(true);
  expect(container.textContent).toContain('a.pdf');
  unmount();
});
