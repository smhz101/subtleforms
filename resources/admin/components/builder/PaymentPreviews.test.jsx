/**
 * Builder canvas previews for payment fields.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import { ChoicePreview, ProductPreview } from './PaymentPreviews';
import { ConfigContext } from './context/ConfigContext';

global.IS_REACT_ACT_ENVIRONMENT = true;

function render(node, config = null) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<ConfigContext.Provider value={config}>{node}</ConfigContext.Provider>));
  return { container, unmount: () => act(() => root.unmount()) };
}

describe('PAY-19: Priced Options canvas', () => {
  it('shows no radio option selected without a default', () => {
    const field = {
      displayAs: 'radio',
      options: [
        { label: 'Basic', value: 'basic', price: 10 },
        { label: 'Standard', value: 'standard', price: 20 },
        { label: 'Premium', value: 'premium', price: 30 },
      ],
    };
    const { container, unmount } = render(<ChoicePreview field={field} />);
    expect(container.querySelectorAll('.sf-pay-preview__option')).toHaveLength(3);
    expect(container.querySelectorAll('.is-selected')).toHaveLength(0);
    unmount();
  });

  it('does not select options that have no value yet', () => {
    const field = { displayAs: 'radio', defaultValue: '', options: [{ label: 'A', value: '' }, { label: 'B', value: '' }] };
    const { container, unmount } = render(<ChoicePreview field={field} />);
    expect(container.querySelectorAll('.is-selected')).toHaveLength(0);
    unmount();
  });

  it('selects only the default option', () => {
    const field = { displayAs: 'radio', defaultValue: 'b', options: [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }] };
    const { container, unmount } = render(<ChoicePreview field={field} />);
    expect([...container.querySelectorAll('.is-selected')].map((n) => n.textContent)).toEqual(['B']);
    unmount();
  });
});

describe('PAY-09: canvas prices use the form currency', () => {
  it('formats a product in the form currency', () => {
    const { container, unmount } = render(<ProductPreview field={{ price: 1200 }} />, { currency: 'JPY' });
    expect(container.textContent).toMatch(/¥/);
    unmount();
  });
});
