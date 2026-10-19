/**
 * Payment fields for the public form (2.1).
 *
 * The form keeps one order (PaymentContext): every priced field feeds it, the
 * Order Summary shows it with an inline coupon box, and the Card field hands
 * the total to the gateway. The server recomputes the order on submit.
 */
import { createContext, useContext, useEffect, useRef, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { formatMoney } from '../../../shared/pricing';
import { currencySymbol, currencyDecimals } from '../../../shared/currencies';

export const PaymentContext = createContext(null);

export const usePayment = () => useContext(PaymentContext);

function Price({ amount, currency }) {
  return <span className='subtleforms-price'>{formatMoney(amount, currency)}</span>;
}

/* ── Product ─────────────────────────────────────────────────────────────── */

export function PaymentProduct({ config, value, onChange, inputId, error }) {
  const pay = usePayment();
  const currency = pay?.currency || 'USD';
  const price = Number(config.price) || 0;
  const min = Math.max(0, parseInt(config.minQuantity, 10) || 0);
  const max = parseInt(config.maxQuantity, 10) || 0;
  const qty = parseInt(value, 10) || 0;
  const set = (n) => {
    let next = Math.max(min, n);
    if (max > 0) next = Math.min(max, next);
    onChange(String(next));
  };

  return (
    <div className='subtleforms-product'>
      <div className='subtleforms-product__info'>
        {config.productName && <span className='subtleforms-product__name'>{config.productName}</span>}
        <Price amount={price} currency={currency} />
      </div>
      {config.allowQuantity && (
        <div className='subtleforms-qty' role='group' aria-label={__('Quantity', 'subtleforms')}>
          <button
            type='button'
            className='subtleforms-qty__btn'
            aria-label={__('Decrease quantity', 'subtleforms')}
            disabled={qty <= min}
            onClick={() => set(qty - 1)}>
            −
          </button>
          <input
            id={inputId}
            type='number'
            inputMode='numeric'
            className='subtleforms-input subtleforms-qty__input'
            value={value ?? ''}
            min={min}
            max={max > 0 ? max : undefined}
            aria-invalid={!!error}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => set(qty)}
          />
          <button
            type='button'
            className='subtleforms-qty__btn'
            aria-label={__('Increase quantity', 'subtleforms')}
            disabled={max > 0 && qty >= max}
            onClick={() => set(qty + 1)}>
            +
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Custom amount ─────────────────────────────────────────────────────── */

/**
 * An amount the visitor types. The symbol is the form's currency, the one the
 * summary shows and the order is charged in (PAY-09). A `currency` stored on
 * the field by older builds is ignored: no control ever set it.
 */
export function PaymentAmount({ config, value, onChange, inputId, name, placeholder, required, error, describedBy }) {
  const pay = usePayment();
  const currency = pay?.currency || window.subtleformsFrontend?.currency || 'USD';
  const showSymbol = config.showCurrencySymbol !== false;
  const symbol = showSymbol ? currencySymbol(currency) : '';

  return (
    <div className='subtleforms-payment-amount'>
      {symbol && <span className='subtleforms-currency-symbol'>{symbol}</span>}
      <input
        id={inputId}
        type='number'
        className='subtleforms-input'
        name={name}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        min={config.min || 0}
        max={config.max}
        step={currencyDecimals(currency) === 0 ? 1 : config.step || 0.01}
        required={required || undefined}
        aria-required={required}
        aria-invalid={!!error}
        aria-describedby={describedBy}
      />
    </div>
  );
}

/* ── Priced options ─────────────────────────────────────────────────────── */

export function PaymentChoice({ config, value, onChange, inputId, error, name }) {
  const pay = usePayment();
  const currency = pay?.currency || 'USD';
  const options = Array.isArray(config.options) ? config.options : [];
  const mode = config.displayAs || 'radio';
  const multiple = mode === 'checkbox';
  const selected = multiple
    ? Array.isArray(value)
      ? value
      : value
      ? String(value).split(',')
      : []
    : value ?? '';
  const showPrice = config.showPrice !== false;
  const priceText = (o) => (showPrice && Number(o.price) > 0 ? formatMoney(o.price, currency) : '');

  if (mode === 'dropdown') {
    return (
      <select
        id={inputId}
        className='subtleforms-select'
        value={selected}
        aria-invalid={!!error}
        onChange={(e) => onChange(e.target.value)}>
        <option value=''>{__('Select an option', 'subtleforms')}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {priceText(o) ? `${o.label} (${priceText(o)})` : o.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div
      className={`subtleforms-priced subtleforms-priced--${mode}`}
      role={multiple ? 'group' : 'radiogroup'}
      aria-invalid={!!error}>
      {options.map((o, i) => {
        const checked = multiple ? selected.includes(o.value) : selected === o.value;
        return (
          <label key={o.value || i} className={`subtleforms-priced__option${checked ? ' is-selected' : ''}`}>
            <input
              type={multiple ? 'checkbox' : 'radio'}
              id={i === 0 ? inputId : undefined}
              name={name || inputId}
              value={o.value}
              checked={checked}
              onChange={(e) => {
                if (!multiple) {
                  onChange(o.value);
                  return;
                }
                const next = e.target.checked
                  ? [...selected, o.value]
                  : selected.filter((v) => v !== o.value);
                onChange(next);
              }}
            />
            <span className='subtleforms-priced__label'>{o.label}</span>
            {priceText(o) ? (
              <span className='subtleforms-priced__price'>{priceText(o)}</span>
            ) : (
              mode === 'cards' &&
              showPrice && (
                <span className='subtleforms-priced__price subtleforms-priced__price--free'>
                  {__('Included', 'subtleforms')}
                </span>
              )
            )}
          </label>
        );
      })}
    </div>
  );
}

/* ── Coupon box (shared by the summary and the Coupon field) ─────────────── */

function CouponBox({ placeholder, buttonText, autoFocus = false }) {
  const pay = usePayment();
  const [code, setCode] = useState('');
  if (!pay) return null;
  const { coupon, couponBusy, couponError, applyCoupon, removeCoupon, currency, quote } = pay;

  if (coupon) {
    return (
      <div className='subtleforms-coupon is-applied' role='status'>
        <span className='subtleforms-coupon__chip'>
          <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' aria-hidden='true'>
            <path d='M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z' />
            <circle cx='7' cy='7' r='1.5' />
          </svg>
          <strong>{coupon.code}</strong>
          <span>
            {coupon.type === 'percent'
              ? sprintf(
                  /* translators: %s: percentage */
                  __('%s%% off', 'subtleforms'),
                  coupon.amount
                )
              : sprintf(
                  /* translators: %s: amount */
                  __('%s off', 'subtleforms'),
                  formatMoney(quote?.discount ?? coupon.amount, currency)
                )}
          </span>
        </span>
        <button type='button' className='subtleforms-coupon__remove' onClick={removeCoupon}>
          {__('Remove', 'subtleforms')}
        </button>
      </div>
    );
  }

  const submit = () => {
    if (code.trim()) applyCoupon(code.trim());
  };

  return (
    <div className='subtleforms-coupon'>
      <div className='subtleforms-coupon__row'>
        <input
          type='text'
          className='subtleforms-input subtleforms-coupon__input'
          value={code}
          placeholder={placeholder || __('Coupon code', 'subtleforms')}
          aria-label={__('Coupon code', 'subtleforms')}
          aria-invalid={!!couponError}
          maxLength={64}
          autoFocus={autoFocus} // eslint-disable-line jsx-a11y/no-autofocus
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button
          type='button'
          className='subtleforms-button subtleforms-button-secondary subtleforms-coupon__apply'
          disabled={couponBusy || !code.trim()}
          onClick={submit}>
          {couponBusy ? __('Checking…', 'subtleforms') : buttonText || __('Apply', 'subtleforms')}
        </button>
      </div>
      {couponError && (
        <p className='subtleforms-coupon__error' role='alert'>
          {couponError}
        </p>
      )}
    </div>
  );
}

export function PaymentCoupon({ config }) {
  return <CouponBox placeholder={config.placeholder} buttonText={config.buttonText} />;
}

/* ── Coupon limits (2.2.1) ──────────────────────────────────────────────── */

/**
 * "3 uses left · Expires 31 December 2026 · 1 per customer".
 */
export function couponMeta(coupon) {
  if (!coupon) return '';
  const parts = [];
  if (coupon.remaining !== null && coupon.remaining !== undefined) {
    parts.push(
      sprintf(
        /* translators: %d: number of uses left */
        _n('%d use left', '%d uses left', coupon.remaining, 'subtleforms'),
        coupon.remaining
      )
    );
  }
  if (coupon.expires_at) {
    const d = new Date(coupon.expires_at);
    if (!Number.isNaN(d.getTime())) {
      parts.push(
        sprintf(
          /* translators: %s: date */
          __('Expires %s', 'subtleforms'),
          d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
        )
      );
    }
  }
  if (coupon.per_customer > 0) {
    parts.push(
      sprintf(
        /* translators: %d: uses allowed per customer */
        _n('%d use per customer', '%d uses per customer', coupon.per_customer, 'subtleforms'),
        coupon.per_customer
      )
    );
  }
  return parts.join(' · ');
}

/* ── Order summary ───────────────────────────────────────────────────────── */

export function PaymentSummary({ config }) {
  const pay = usePayment();
  const [couponOpen, setCouponOpen] = useState(false);
  if (!pay) return null;
  const { quote, currency, coupon, hasCouponField } = pay;
  const showItems = config.showItems !== false;
  const showCoupon = config.showCoupon !== false && !hasCouponField;

  return (
    <div className='subtleforms-summary' aria-live='polite'>
      {showItems && (
        <ul className='subtleforms-summary__items'>
          {quote.items.length === 0 && (
            <li className='subtleforms-summary__empty'>{__('Nothing selected yet', 'subtleforms')}</li>
          )}
          {quote.items.map((item, i) => (
            <li key={`${item.key}-${i}`} className='subtleforms-summary__item'>
              <span className='subtleforms-summary__label'>
                {item.label}
                {item.qty > 1 && <span className='subtleforms-summary__qty'> × {item.qty}</span>}
              </span>
              <Price amount={item.amount} currency={currency} />
            </li>
          ))}
        </ul>
      )}

      <dl className='subtleforms-summary__totals'>
        {config.showSubtotal !== false && (quote.discount > 0 || quote.tax > 0) && (
          <div className='subtleforms-summary__row'>
            <dt>{__('Subtotal', 'subtleforms')}</dt>
            <dd><Price amount={quote.subtotal} currency={currency} /></dd>
          </div>
        )}
        {quote.discount > 0 && (
          <div className='subtleforms-summary__row subtleforms-summary__row--discount'>
            <dt>
              {sprintf(
                /* translators: %s: coupon code */
                __('Discount (%s)', 'subtleforms'),
                coupon?.code || ''
              )}
              {couponMeta(coupon) && (
                <span className='subtleforms-summary__coupon-meta'>{couponMeta(coupon)}</span>
              )}
            </dt>
            <dd>−{formatMoney(quote.discount, currency)}</dd>
          </div>
        )}
        {quote.tax > 0 && (
          <div className='subtleforms-summary__row'>
            <dt>{`${config.taxLabel || __('Tax', 'subtleforms')} (${quote.taxRate}%)`}</dt>
            <dd><Price amount={quote.tax} currency={currency} /></dd>
          </div>
        )}
        {config.showTotal !== false && (
          <div className='subtleforms-summary__row subtleforms-summary__row--total'>
            <dt>{__('Total', 'subtleforms')}</dt>
            <dd><Price amount={quote.total} currency={currency} /></dd>
          </div>
        )}
      </dl>

      {showCoupon && (
        <div className='subtleforms-summary__coupon'>
          {coupon || couponOpen ? (
            <CouponBox autoFocus={!coupon} />
          ) : (
            <button type='button' className='subtleforms-summary__coupon-toggle' onClick={() => setCouponOpen(true)}>
              {config.couponPrompt || __('Have a coupon code?', 'subtleforms')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Card (gateway element) ─────────────────────────────────────────────── */

export function PaymentCard({ config }) {
  const pay = usePayment();
  const ref = useRef(null);
  const handle = useRef(null);
  const [ready, setReady] = useState(!!window.SubtleFormsPayments);
  const [error, setError] = useState('');

  useEffect(() => {
    if (ready) return undefined;
    const onReady = () => setReady(true);
    document.addEventListener('subtleforms:payments-ready', onReady);
    return () => document.removeEventListener('subtleforms:payments-ready', onReady);
  }, [ready]);

  const amount = pay?.quote?.total || 0;
  const currency = pay?.currency || 'USD';

  useEffect(() => {
    if (!ready || !ref.current || !window.SubtleFormsPayments || pay?.preview || pay?.external) return undefined;
    try {
      handle.current = window.SubtleFormsPayments.mount(ref.current, {
        formId: pay.formId,
        amount,
        currency,
        onError: setError,
      });
      pay.registerCard(handle.current);
    } catch (e) {
      setError(e?.message || __('Payment form could not be loaded.', 'subtleforms'));
    }
    return () => {
      pay.registerCard(null);
      handle.current?.destroy?.();
      handle.current = null;
    };
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    handle.current?.update?.({ amount, currency });
  }, [amount, currency]);

  if (pay?.external) {
    // Payment happens at the store checkout after the form is sent.
    return (
      <p className='subtleforms-card__note'>
        {__('You will pay securely at checkout after sending this form.', 'subtleforms')}
      </p>
    );
  }

  if (pay?.preview || !ready) {
    return (
      <div className='subtleforms-card subtleforms-card--placeholder'>
        <div className='subtleforms-card__mock'>
          <span>{__('Card number', 'subtleforms')}</span>
          <span>{__('MM / YY', 'subtleforms')}</span>
          <span>{__('CVC', 'subtleforms')}</span>
        </div>
        <p className='subtleforms-card__note'>
          {pay?.preview
            ? __('Secure card fields from your payment gateway appear here on the live form.', 'subtleforms')
            : __('Online payment is not available right now.', 'subtleforms')}
        </p>
      </div>
    );
  }

  return (
    <div className='subtleforms-card'>
      <div ref={ref} className='subtleforms-card__element' />
      {error && (
        <p className='subtleforms-card__error' role='alert'>
          {error}
        </p>
      )}
      <p className='subtleforms-card__secure'>
        <svg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' aria-hidden='true'>
          <rect x='3' y='11' width='18' height='11' rx='2' />
          <path d='M7 11V7a5 5 0 0 1 10 0v4' />
        </svg>
        {config.secureText || __('Payments are encrypted and processed securely.', 'subtleforms')}
      </p>
    </div>
  );
}
