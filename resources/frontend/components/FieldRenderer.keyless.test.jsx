/**
 * RCOMPAT-02: a saved node without a key must not stop the form from
 * loading. An input without a key is left out; the rest of the form draws.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import FieldRenderer from './FieldRenderer';
import FormRenderer from './FormRenderer';
import { loadAllFieldGroups } from './fields/lazyFields';

jest.mock('../utils/restFetch', () => ({
  restUrl: '/wp-json/subtleforms/v1',
  restNonce: () => '',
  restRouteUrl: (p) => p,
  restFetch: jest.fn(async () => ({ ok: true, json: async () => ({ data: {} }) })),
}));
jest.mock('../utils/spamToken', () => ({
  createSpamTokenSource: () => ({ prime: () => {}, take: async () => 'token' }),
}));

global.IS_REACT_ACT_ENVIRONMENT = true;
beforeAll(() => loadAllFieldGroups());

function mount(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(element));
  return { container, unmount: () => { act(() => root.unmount()); container.remove(); } };
}

describe('fields without a key', () => {
  test.each(['text', 'email', 'payment_product', 'select'])('a keyless %s draws nothing and does not throw', (type) => {
    const { container, unmount } = mount(
      <FieldRenderer field={{ id: 'x', type, label: 'No key' }} values={{}} onChange={() => {}} errors={{}} />
    );
    expect(container.querySelector('input,select,textarea')).toBeNull();
    unmount();
  });

  test('a layout node with no key and no id still draws', () => {
    const { container, unmount } = mount(
      <FieldRenderer field={{ type: 'html', content: '<p>Hello</p>' }} values={{}} onChange={() => {}} errors={{}} />
    );
    expect(container.textContent).toContain('Hello');
    unmount();
  });

  test('a form with a keyless field in a step still loads its other fields', async () => {
    const schema = {
      metadata: {},
      fields: [
        {
          id: 's1', key: 's1', type: 'step', title: 'One',
          children: [
            { id: 'n', key: 'name', type: 'text', label: 'Your name' },
            { id: 'nokey', type: 'text', label: 'Lost field' },
          ],
        },
      ],
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<FormRenderer preloadedSchema={schema} formId={5} />);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(container.textContent).not.toContain("couldn't load");
    expect(container.querySelector('input[name="name"]')).not.toBeNull();
    expect(container.textContent).not.toContain('Lost field');
    act(() => root.unmount());
  });
});
