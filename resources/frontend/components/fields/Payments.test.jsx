/**
 * Public payment fields (2.4.0, package F240-6).
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import FieldRenderer from '../FieldRenderer';
import { PaymentContext } from './Payments';

global.IS_REACT_ACT_ENVIRONMENT = true;

function render(field, pay, extra = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <PaymentContext.Provider value={pay}>
        <FieldRenderer field={field} values={{}} onChange={() => {}} errors={{}} {...extra} />
      </PaymentContext.Provider>
    );
  });
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe('PAY-09: Custom Amount symbol', () => {
  it('shows the form currency, not a USD stored on the field', () => {
    const field = { id: 'a', type: 'payment_amount', key: 'tip', label: 'Tip', currency: 'USD', config: { currency: 'USD' } };
    const { container, unmount } = render(field, { currency: 'JPY' });
    const symbol = container.querySelector('.subtleforms-currency-symbol');
    expect(symbol.textContent).toMatch(/¥/);
    expect(symbol.textContent).not.toMatch(/\$/);
    unmount();
  });

  it('falls back to the site currency without a payment context', () => {
    window.subtleformsFrontend = { currency: 'EUR' };
    const { container, unmount } = render({ id: 'a', type: 'payment_amount', key: 'tip', label: 'Tip', currency: 'USD' }, null);
    expect(container.querySelector('.subtleforms-currency-symbol').textContent).toMatch(/€/);
    delete window.subtleformsFrontend;
    unmount();
  });
});

describe('PAY-26: card minimum', () => {
  beforeEach(() => {
    window.SubtleFormsPayments = { mount: () => ({ update() {}, destroy() {} }) };
  });
  afterEach(() => {
    delete window.SubtleFormsPayments;
  });

  const pay = (total) => ({ currency: 'USD', quote: { total }, formId: 1, registerCard() {} });

  it('says so before the card step when the total is below the minimum', () => {
    const { container, unmount } = render({ id: 'k', type: 'payment_card', key: 'card', label: 'Card' }, pay(0.3));
    expect(container.querySelector('.subtleforms-card__minimum').textContent).toMatch(/at least \$0\.50/);
    unmount();
  });

  it('stays quiet for a normal total', () => {
    const { container, unmount } = render({ id: 'k', type: 'payment_card', key: 'card', label: 'Card' }, pay(12));
    expect(container.querySelector('.subtleforms-card__minimum')).toBeNull();
    unmount();
  });
});
