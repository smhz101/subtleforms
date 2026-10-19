import { computeQuote, formatMoney } from './pricing';
import { currencyDecimals, roundMoney, currencySymbol, currencyOptions, currencyMinimum } from './currencies';

describe('PAY-12: zero-decimal currencies', () => {
  const fields = [
    { type: 'payment_product', key: 'item', label: 'Item', price: 1250.5 },
    { type: 'payment_amount', key: 'tip', label: 'Tip' },
  ];

  it('rounds every JPY line and the total to whole yen', () => {
    const q = computeQuote(fields, { tip: '100.70' }, { currency: 'JPY' });
    expect(q.items.map((i) => i.amount)).toEqual([1251, 101]);
    expect(q.subtotal).toBe(1352);
    expect(q.total).toBe(1352);
  });

  it('keeps cents for two-decimal currencies', () => {
    const q = computeQuote(fields, { tip: '100.70' }, { currency: 'EUR' });
    expect(q.total).toBe(1351.2);
  });

  it('formats yen without decimals', () => {
    expect(formatMoney(1352, 'JPY')).not.toMatch(/[.,]\d{2}$/);
  });

  it('uses the Stripe minimum of 50 KRW, not an approximate USD equivalent', () => {
    expect(currencyMinimum('KRW')).toBe(50);
  });

  it('knows decimals, rounding and symbols', () => {
    expect(currencyDecimals('jpy')).toBe(0);
    expect(currencyDecimals('USD')).toBe(2);
    expect(roundMoney(10.005, 'JPY')).toBe(10);
    expect(currencySymbol('JPY')).toMatch(/¥/);
    expect(currencyOptions().find((o) => o.value === 'PKR')).toBeTruthy();
  });
});
