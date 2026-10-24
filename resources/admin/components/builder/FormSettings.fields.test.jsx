/**
 * Field defaults: validation summary and required field indicator.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import FormSettings from './FormSettings';

jest.mock('./FormSettings.scss', () => ({}));
jest.mock('../../modals/ConfirmModal', () => () => null);
jest.mock('./ActionsPanel', () => () => null);
jest.mock('./FormBehaviorPanels', () => ({ ConfirmationPanel: () => null, AvailabilityPanel: () => null }));
jest.mock('./IntegrationsPanel', () => () => null);
jest.mock('./SpamProtectionPanel', () => () => null);

global.IS_REACT_ACT_ENVIRONMENT = true;
global.ResizeObserver =
  global.ResizeObserver ||
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
window.matchMedia =
  window.matchMedia ||
  (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));

function openFields(schema, onChange) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<FormSettings schema={schema} onChange={onChange} />));
  const nav = [...container.querySelectorAll('.sf-form-settings__nav-item')].find((b) =>
    b.textContent.includes('Field defaults')
  );
  act(() => nav.click());
  return { container, unmount: () => act(() => root.unmount()) };
}

describe('Field defaults settings', () => {
  it('offers validation summary and required field indicator controls', () => {
    const onChange = jest.fn();
    const { container, unmount } = openFields({ metadata: {}, fields: [] }, onChange);
    expect(container.textContent).toContain('Validation summary');
    expect(container.textContent).toContain('Required field indicator');
    expect(container.textContent).toContain('Text: (Required)');
    expect(container.textContent).toContain('Asterisk: *');
    expect(container.textContent).toContain('Custom:');

    const toggle = [...container.querySelectorAll('input[type="checkbox"]')].find((el) => {
      const label = el.closest('.components-toggle-control, .components-base-control');
      return label && label.textContent.includes('Validation summary');
    });
    expect(toggle).toBeTruthy();
    expect(toggle.checked).toBe(true);
    act(() => toggle.click());
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)[0].metadata.validationSummary).toBe(false);
    unmount();
  });
});
