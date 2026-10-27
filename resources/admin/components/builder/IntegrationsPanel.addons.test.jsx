/**
 * Panels an add-on registers with registerFormIntegration() are drawn in the
 * form's Integrations tab, even when no built-in integration is available.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import IntegrationsPanel from './IntegrationsPanel';
import { registerFormIntegration } from '../../../shared/extend';

jest.mock('../settings/extensions/extensions.scss', () => ({}));

global.IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  delete window.__subtleformsExtend.slots['form.integrations'];
  delete window.subtleformsAdmin;
});

function mount(props) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<IntegrationsPanel {...props} />));
  return { container, unmount: () => act(() => root.unmount()) };
}

test('draws a registered panel with the form schema and a patch helper', () => {
  window.subtleformsAdmin = { extensions: {} };
  const seen = {};
  registerFormIntegration('demo', {
    component: (props) => {
      Object.assign(seen, props);
      return <p data-testid='demo'>Demo panel</p>;
    },
  });
  const onChange = jest.fn();
  const schema = { fields: [{ key: 'email', type: 'email', label: 'Email' }], metadata: { integrations: {} } };
  const { container, unmount } = mount({ schema, onChange });

  expect(container.textContent).toContain('Demo panel');
  expect(container.textContent).not.toContain('No integrations are available');
  expect(seen.schema).toBe(schema);
  expect(seen.onChange).toBe(onChange);
  expect(Array.isArray(seen.fieldOptions)).toBe(true);
  // P1-03: no provider-specific value is handed to add-on panels.
  expect(seen.crmProvider).toBeUndefined();

  act(() => seen.patch('demo', { enabled: true }));
  expect(onChange).toHaveBeenCalledWith({ ...schema, metadata: { integrations: { demo: { enabled: true } } } });
  unmount();
});

test('read-only forms do not change', () => {
  window.subtleformsAdmin = { extensions: {} };
  let patch;
  registerFormIntegration('demo', {
    component: (props) => {
      patch = props.patch;
      return null;
    },
  });
  const onChange = jest.fn();
  const { unmount } = mount({ schema: { metadata: {} }, onChange, isReadOnly: true });
  act(() => patch('demo', { enabled: true }));
  expect(onChange).not.toHaveBeenCalled();
  unmount();
});

test('with no add-on integration the panel says what the plugin does have (RFUN-03)', () => {
  window.subtleformsAdmin = { extensions: {} };
  const { container, unmount } = mount({ schema: { fields: [], metadata: {} }, onChange: jest.fn() });
  const text = container.textContent;
  expect(text).toBe(
    'Send entries to other services with webhooks. Add a Webhook action under Notifications. Defaults for every webhook are under Settings > Integrations.'
  );
  expect(text).not.toMatch(/No integrations|email marketing|CRM|analytics|add-on|Pro/i);
  unmount();
});

