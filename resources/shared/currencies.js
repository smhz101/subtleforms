/**
 * The currencies SubtleForms can price and charge in.
 *
 * Mirrors SubtleForms\Payments\Currencies on the server (a unit test keeps the
 * two lists the same). Code => [ name, decimals, minimum card charge ].
 */
export const CURRENCIES = {
  USD: ['US dollar', 2, 0.5],
  EUR: ['Euro', 2, 0.5],
  GBP: ['British pound', 2, 0.3],
  CAD: ['Canadian dollar', 2, 0.5],
  AUD: ['Australian dollar', 2, 0.5],
  NZD: ['New Zealand dollar', 2, 0.5],
  CHF: ['Swiss franc', 2, 0.5],
  JPY: ['Japanese yen', 0, 50],
  KRW: ['South Korean won', 0, 700],
  INR: ['Indian rupee', 2, 0.5],
  PKR: ['Pakistani rupee', 2, 140],
  AED: ['UAE dirham', 2, 2],
  SAR: ['Saudi riyal', 2, 2],
  SGD: ['Singapore dollar', 2, 0.5],
  HKD: ['Hong Kong dollar', 2, 4],
  MYR: ['Malaysian ringgit', 2, 2],
  THB: ['Thai baht', 2, 10],
  PHP: ['Philippine peso', 2, 25],
  SEK: ['Swedish krona', 2, 3],
  NOK: ['Norwegian krone', 2, 3],
  DKK: ['Danish krone', 2, 2.5],
  PLN: ['Polish zloty', 2, 2],
  CZK: ['Czech koruna', 2, 15],
  MXN: ['Mexican peso', 2, 10],
  BRL: ['Brazilian real', 2, 0.5],
  ZAR: ['South African rand', 2, 9],
};

const ZERO_DECIMAL = ['BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF'];

/** Minor-unit digits for a currency (0 for JPY). Unknown codes use two. */
export function currencyDecimals(code) {
  const c = String(code || '').toUpperCase();
  if (CURRENCIES[c]) return CURRENCIES[c][1];
  return ZERO_DECIMAL.includes(c) ? 0 : 2;
}

/** Round an amount to what the currency can charge. */
export function roundMoney(amount, code) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  const f = 10 ** currencyDecimals(code);
  return Math.round(n * f) / f;
}

/** Options for a select control: [{ value, label }]. */
export function currencyOptions() {
  return Object.keys(CURRENCIES).map((code) => ({ value: code, label: `${code} - ${CURRENCIES[code][0]}` }));
}

/** The symbol shown next to an amount input, such as "¥" or "€". */
export function currencySymbol(code) {
  const c = String(code || 'USD').toUpperCase();
  try {
    return (
      new Intl.NumberFormat(undefined, { style: 'currency', currency: c })
        .formatToParts(0)
        .find((p) => p.type === 'currency')?.value || c
    );
  } catch (e) {
    return c;
  }
}
