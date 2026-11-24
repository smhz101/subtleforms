/**
 * Autofill hints (2.10.0): a Text field no longer forces autocomplete="off".
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import FieldRenderer from './FieldRenderer';
import { loadAllFieldGroups } from './fields/lazyFields';

global.IS_REACT_ACT_ENVIRONMENT = true;

beforeAll(() => loadAllFieldGroups());

function inputOf(field) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<FieldRenderer field={field} values={{}} onChange={() => {}} errors={{}} />);
  });
  const el = container.querySelector('input, textarea');
  const attr = el ? el.getAttribute('autocomplete') : undefined;
  act(() => root.unmount());
  container.remove();
  return attr;
}

describe('FieldRenderer autocomplete', () => {
  test('a Text field keyed name renders autocomplete="name"', () => {
    expect(inputOf({ type: 'text', key: 'name', label: 'Name' })).toBe('name');
  });

  test('a Text field keyed notes renders no attribute', () => {
    expect(inputOf({ type: 'text', key: 'notes', label: 'Notes' })).toBeNull();
  });

  test('the setting off renders off', () => {
    expect(inputOf({ type: 'text', key: 'name', label: 'Name', autocomplete: 'off' })).toBe('off');
  });

  test('the setting organization wins over inference', () => {
    expect(inputOf({ type: 'text', key: 'name', label: 'Name', config: { autocomplete: 'organization' } })).toBe('organization');
  });

  test('other types keep their tokens', () => {
    expect(inputOf({ type: 'email', key: 'name' })).toBe('email');
    expect(inputOf({ type: 'url', key: 'site' })).toBe('url');
    expect(inputOf({ type: 'number', key: 'qty' })).toBe('off');
  });

  test('a Paragraph field takes the setting and has none by default', () => {
    expect(inputOf({ type: 'textarea', key: 'message' })).toBeNull();
    expect(inputOf({ type: 'textarea', key: 'message', autocomplete: 'street-address' })).toBe('street-address');
  });
});
