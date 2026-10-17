import { computeQuote, isPricedForm, isPricedType, registerPricedType } from './pricing';
import { registerFieldType, isRegisteredInputType, getFieldType } from './extend';
import { applyPaymentDefaults } from '../admin/utils/paymentDefaults';

describe('priced type registry', () => {
  beforeAll(() => {
    // An add-on type priced from a snapshot in the field config.
    registerPricedType('test_product', (config, value) =>
      (Array.isArray(value) ? value : []).map((line) => {
        const p = (config.products || []).find((x) => x.id === line.product_id);
        return p ? { label: p.name, qty: line.qty, unit: p.price } : null;
      }).filter(Boolean)
    );
  });

  it('marks forms with registered types as priced', () => {
    expect(isPricedType('test_product')).toBe(true);
    expect(isPricedType('text')).toBe(false);
    expect(isPricedForm([{ type: 'test_product' }])).toBe(true);
    expect(isPricedForm([{ type: 'text' }])).toBe(false);
  });

  it('adds lines from registered types to the quote', () => {
    const fields = [
      { type: 'test_product', config: { key: 'shop', label: 'Shop', products: [{ id: 7, name: 'Mug', price: 12.5 }] } },
      { type: 'payment_hidden_price', config: { key: 'fee', label: 'Fee', amount: 2 } },
    ];
    const q = computeQuote(fields, { shop: [{ product_id: 7, qty: 2 }] }, { currency: 'EUR' });
    expect(q.items).toHaveLength(2);
    expect(q.items[0]).toMatchObject({ key: 'shop', label: 'Mug', qty: 2, unit: 12.5, amount: 25 });
    expect(q.total).toBe(27);
  });

  it('ignores zero-quantity and broken lines', () => {
    registerPricedType('test_broken', () => {
      throw new Error('nope');
    });
    const q = computeQuote(
      [
        { type: 'test_product', config: { key: 'shop', products: [{ id: 7, name: 'Mug', price: 12.5 }] } },
        { type: 'test_broken', config: { key: 'b' } },
      ],
      { shop: [{ product_id: 7, qty: 0 }] }
    );
    expect(q.items).toHaveLength(0);
    expect(q.total).toBe(0);
  });

  it('skips hidden fields', () => {
    const q = computeQuote(
      [{ type: 'test_product', config: { key: 'shop', products: [{ id: 7, name: 'Mug', price: 10 }] } }],
      { shop: [{ product_id: 7, qty: 1 }] },
      { hidden: new Set(['shop']) }
    );
    expect(q.total).toBe(0);
  });
});

describe('field type registry', () => {
  it('registers input field types', () => {
    const C = () => null;
    registerFieldType('test_field', { component: C });
    registerFieldType('test_display', { component: C, input: false });
    expect(getFieldType('test_field').component).toBe(C);
    expect(isRegisteredInputType('test_field')).toBe(true);
    expect(isRegisteredInputType('test_display')).toBe(false);
    expect(isRegisteredInputType('nothing')).toBe(false);
    expect(window.SubtleFormsExtend.registerFieldType).toBeInstanceOf(Function);
  });
});

describe('applyPaymentDefaults', () => {
  const plain = { metadata: {}, fields: [{ type: 'text', config: { key: 'a' } }] };
  const priced = { metadata: {}, fields: [{ type: 'payment_product', config: { key: 'p', price: 5 } }] };
  const defaults = { processor: 'woocommerce' };

  it('stamps defaults when a form gets its first priced field', () => {
    expect(applyPaymentDefaults(plain, priced, defaults).metadata.payment.processor).toBe('woocommerce');
  });

  it('leaves forms that were already priced alone', () => {
    expect(applyPaymentDefaults(priced, { ...priced, fields: [...priced.fields] }, defaults).metadata.payment).toBeUndefined();
  });

  it('never overwrites an explicit choice', () => {
    const chosen = { ...priced, metadata: { payment: { processor: 'subtleforms' } } };
    expect(applyPaymentDefaults(plain, chosen, defaults).metadata.payment.processor).toBe('subtleforms');
  });

  it('does nothing without defaults', () => {
    expect(applyPaymentDefaults(plain, priced, undefined)).toBe(priced);
  });
});

describe('applyPaymentDefaults with composite fields', () => {
  it('ignores object-valued `fields` (name and address groups)', () => {
    const prev = { metadata: {}, fields: [{ type: 'name_group', key: 'n', fields: { first_name: { enabled: true } } }] };
    const next = { ...prev, fields: [...prev.fields, { type: 'payment_product', key: 'p', price: 3 }] };
    expect(applyPaymentDefaults(prev, next, { processor: 'woocommerce' }).metadata.payment.processor).toBe('woocommerce');
  });
});

describe('charged formula failures', () => {
  const charged = (formula) => [
    { type: 'calculation', config: { key: 'due', label: 'Due', usePrice: true, formula } },
  ];

  it('does not turn a failed charged formula into a free or payable line', () => {
    const q = computeQuote(charged('1/0'), { due: 0 });
    expect(q.formulaError).toBe(true);
    expect(q.items).toEqual([]);
    expect(q.items.some((item) => item.amount >= 0)).toBe(false);
  });

  it('does not charge a tampered amount when the formula fails', () => {
    const q = computeQuote(charged('{qty} / {price}'), { qty: 1, price: 0, due: 25 });
    expect(q.formulaError).toBe(true);
    expect(q.items).toEqual([]);
  });

  it('keeps a real zero off the order without flagging a failure', () => {
    const q = computeQuote(charged('0+0'), { due: 40 });
    expect(q.formulaError).toBe(false);
    expect(q.items).toEqual([]);
    expect(q.total).toBe(0);
  });
});
