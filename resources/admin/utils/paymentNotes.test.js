import { offlinePaymentNote } from './paymentNotes';

describe('offlinePaymentNote (PAY-03)', () => {
  test('a priced form without a Card Payment field gets the note', () => {
    expect(offlinePaymentNote({ fields: [{ type: 'payment_product', key: 'p', price: 5 }] })).toMatch(/Payment pending/);
  });
  test('no note with a Card Payment field, without prices, or with WooCommerce checkout', () => {
    expect(offlinePaymentNote({ fields: [{ type: 'payment_product' }, { type: 'payment_card' }] })).toBe('');
    expect(offlinePaymentNote({ fields: [{ type: 'text' }] })).toBe('');
    expect(
      offlinePaymentNote({ metadata: { payment: { processor: 'woocommerce' } }, fields: [{ type: 'payment_product' }] })
    ).toBe('');
  });
});
