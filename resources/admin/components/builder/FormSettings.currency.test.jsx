/**
 * PAY2-02: saving the Payments tab must not pin a form to USD, and the tab
 * offers a currency control that defaults to the site currency.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import FormSettings from './FormSettings';

jest.mock('./FormSettings.scss', () => ({}));
jest.mock('../../modals/ConfirmModal', () => () => null);
jest.mock('./ActionsPanel', () => () => null);
jest.mock('./FormBehaviorPanels', () => ({ ConfirmationPanel: () => null, AvailabilityPanel: () => null }));
jest.mock('./IntegrationsPanel', () => () => null);

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

function mount(schema, onChange) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<FormSettings schema={schema} onChange={onChange} />));
  const nav = [...container.querySelectorAll('.sf-form-settings__nav-item')].find((b) => b.textContent.includes('Payments'));
  act(() => nav.click());
  return { container, unmount: () => act(() => root.unmount()) };
}

const priced = (type) => ({
  metadata: { type },
  fields: [{ id: 'p', type: 'payment_product', key: 'item', label: 'Item', price: 5 }],
});

function selectByLabel(container, text) {
  const label = [...container.querySelectorAll('label')].find((l) => l.textContent === text);
  return label ? container.querySelector(`#${label.htmlFor}`) : null;
}

function change(select, value) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
  act(() => {
    setter.call(select, value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('PAY2-02 form currency', () => {
  beforeEach(() => {
    window.subtleformsAdmin = { currency: 'EUR' };
  });

  it('changing a payment-form setting does not write a USD currency', () => {
    const onChange = jest.fn();
    const { container, unmount } = mount(priced('payment'), onChange);
    const toggle = [...container.querySelectorAll('input[type="checkbox"]')][0];
    act(() => toggle.click());
    expect(onChange).toHaveBeenCalled();
    const payment = onChange.mock.calls.at(-1)[0].metadata.payment;
    expect(payment).not.toHaveProperty('currency');
    unmount();
  });

  it('offers a currency control that defaults to the site currency', () => {
    const onChange = jest.fn();
    const { container, unmount } = mount(priced('regular'), onChange);
    const select = selectByLabel(container, 'Currency');
    expect(select).toBeTruthy();
    expect(select.value).toBe('');
    expect(select.options[0].textContent).toBe('Site currency (EUR)');
    change(select, 'JPY');
    expect(onChange.mock.calls.at(-1)[0].metadata.payment.currency).toBe('JPY');
    unmount();
  });

  it('choosing the site currency again leaves the form currency unset', () => {
    const onChange = jest.fn();
    const schema = priced('regular');
    schema.metadata.payment = { currency: 'USD', processor: 'subtleforms' };
    const { container, unmount } = mount(schema, onChange);
    change(selectByLabel(container, 'Currency'), '');
    expect(onChange.mock.calls.at(-1)[0].metadata.payment).toEqual({ processor: 'subtleforms' });
    unmount();
  });
});
