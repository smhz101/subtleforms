/**
 * Builder canvas previews for payment fields (2.1).
 *
 * The Order Summary reads the other priced fields on the canvas and their
 * default values, so the totals you see while building are the totals a
 * visitor starts with.
 */
import { useMemo } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { useBuilder } from './context/BuilderContext';
import { computeQuote, formatMoney } from '../../../shared/pricing';

const currency = () => window.subtleformsAdmin?.currency || 'USD';

export function ProductPreview({ field }) {
  return (
    <div className='sf-pay-preview sf-pay-preview--product'>
      <div className='sf-pay-preview__product-info'>
        {field.productName && <span className='sf-pay-preview__muted'>{field.productName}</span>}
        <strong>{formatMoney(field.price, currency())}</strong>
      </div>
      {field.allowQuantity !== false && (
        <span className='sf-pay-preview__qty' aria-hidden='true'>
          <span>−</span>
          <span>{field.defaultValue || 1}</span>
          <span>+</span>
        </span>
      )}
    </div>
  );
}

export function ChoicePreview({ field }) {
  const options = Array.isArray(field.options) ? field.options : [];
  const mode = field.displayAs || 'radio';
  const showPrice = field.showPrice !== false;
  const def = String(field.defaultValue || '').split(',');

  if (mode === 'dropdown') {
    return (
      <select className='sf-field-renderer__select' disabled>
        <option>{__('Select an option', 'subtleforms')}</option>
      </select>
    );
  }

  return (
    <div className={`sf-pay-preview sf-pay-preview--choice is-${mode}`}>
      {options.map((o, i) => (
        <span key={o.value || i} className={`sf-pay-preview__option${def.includes(o.value) ? ' is-selected' : ''}`}>
          <span className={`sf-pay-preview__mark${mode === 'checkbox' ? ' is-square' : ''}`} aria-hidden='true' />
          <span className='sf-pay-preview__option-label'>{o.label}</span>
          {showPrice && Number(o.price) > 0 && (
            <strong className='sf-pay-preview__option-price'>{formatMoney(o.price, currency())}</strong>
          )}
        </span>
      ))}
    </div>
  );
}

export function SummaryPreview({ field }) {
  const { tree } = useBuilder();
  const quote = useMemo(() => {
    const nodes = tree?.nodes ? Object.values(tree.nodes) : [];
    const fields = nodes
      .filter((n) => n && n.type)
      .map((n) => ({ type: n.type, ...(n.config || {}), key: n.config?.key || n.key }));
    const values = {};
    fields.forEach((f) => {
      if (f.key && f.defaultValue !== undefined && f.defaultValue !== '') values[f.key] = f.defaultValue;
    });
    // Use this summary's own (unsaved) settings for tax.
    const withSelf = fields.filter((f) => f.type !== 'payment_summary').concat([{ ...field, type: 'payment_summary' }]);
    return computeQuote(withSelf, values, { currency: currency() });
  }, [tree, field]);

  return (
    <div className='sf-pay-preview sf-pay-preview--summary'>
      {field.showItems !== false && (
        <ul className='sf-pay-preview__items'>
          {quote.items.length === 0 ? (
            <li className='sf-pay-preview__muted'>
              {__('Add a Product or Priced Options field to build the order.', 'subtleforms')}
            </li>
          ) : (
            quote.items.map((item, i) => (
              <li key={`${item.key}-${i}`}>
                <span>
                  {item.label}
                  {item.qty > 1 && <span className='sf-pay-preview__muted'> × {item.qty}</span>}
                </span>
                <span>{formatMoney(item.amount, quote.currency)}</span>
              </li>
            ))
          )}
        </ul>
      )}
      <div className='sf-pay-preview__totals'>
        {quote.tax > 0 && (
          <div>
            <span>{`${field.taxLabel || __('Tax', 'subtleforms')} (${quote.taxRate}%)`}</span>
            <span>{formatMoney(quote.tax, quote.currency)}</span>
          </div>
        )}
        {field.showTotal !== false && (
          <div className='is-total'>
            <span>{__('Total', 'subtleforms')}</span>
            <span>{formatMoney(quote.total, quote.currency)}</span>
          </div>
        )}
      </div>
      {field.showCoupon !== false && (
        <div className='sf-pay-preview__coupon'>
          {field.couponPrompt || __('Have a coupon code?', 'subtleforms')}
        </div>
      )}
    </div>
  );
}

export function CardPreview() {
  return (
    <div className='sf-pay-preview sf-pay-preview--card'>
      <span>{__('Card number', 'subtleforms')}</span>
      <span>{__('MM / YY', 'subtleforms')}</span>
      <span>{__('CVC', 'subtleforms')}</span>
    </div>
  );
}
