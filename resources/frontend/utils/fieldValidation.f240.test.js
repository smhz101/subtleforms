import { validateField, normalizeUrl } from './fieldValidation';

/**
 * F240-1: the browser and the server apply one rule per field type.
 */
const check = (type, value, config = {}) => validateField({ type, key: 'f', config }, value);

describe('email (FB-05, FB-06)', () => {
  test('several addresses are accepted when the field allows them', () => {
    expect(check('email', 'a@example.com, b@example.com', { allowMultiple: true })).toBeUndefined();
    expect(check('email', 'a@example.com, nope', { allowMultiple: true })).toBe('Invalid email address.');
    expect(check('email', 'a@example.com, b@example.com')).toBe('Invalid email address.');
  });

  test('RFC validation off accepts an address without a dot in the domain', () => {
    expect(check('email', 'user@localhost', { rfcValidation: false })).toBeUndefined();
    expect(check('email', 'user@localhost')).toBe('Invalid email address.');
    expect(check('email', 'user@', { rfcValidation: false })).toBe('Invalid email address.');
  });
});

describe('website (FB-15)', () => {
  test('a bare domain is accepted and gets https://', () => {
    expect(check('url', 'example.com')).toBeUndefined();
    expect(normalizeUrl('example.com/about')).toBe('https://example.com/about');
    expect(normalizeUrl('https://example.com')).toBe('https://example.com');
  });

  test('other schemes are refused, as on the server', () => {
    expect(check('url', 'ftp://example.com')).toBe('Invalid URL.');
    expect(check('url', 'javascript:alert(1)')).toBe('Invalid URL.');
  });
});

describe('dates, times and colours (FA-01)', () => {
  test('values must be real', () => {
    expect(check('date', 'not-a-date')).toBe('Please enter a valid date.');
    expect(check('date', '2026-02-30')).toBe('Please enter a valid date.');
    expect(check('date', '2026-02-28')).toBeUndefined();
    expect(check('time', '99:99')).toBe('Please enter a valid time.');
    expect(check('time', '09:30')).toBeUndefined();
    expect(check('datetime', 'garbage')).toBe('Please enter a valid date and time.');
    expect(check('datetime', '2026-10-20T09:30')).toBeUndefined();
    expect(check('color_picker', 'javascript:alert(1)')).toBe(
      'Please enter a colour as a hex value, such as #336699.'
    );
    expect(check('color_picker', '#336699')).toBeUndefined();
  });
});

describe('phone (FLD2-07)', () => {
  test('an international number needs a real code and length', () => {
    expect(check('phone', '+1 5')).toBe('Invalid phone number.');
    expect(check('phone', '+999 123')).toBe('Invalid phone number.');
    expect(check('phone', '+1 4155550100')).toBeUndefined();
    expect(check('phone', '+44 7700900123')).toBeUndefined();
  });
});

describe('rich text (FA-17)', () => {
  test('a required editor with no text is empty', () => {
    expect(check('rich_text', '<p><br></p>', { required: true })).toBe('This field is required.');
    expect(check('rich_text', '<p>Hi</p>', { required: true })).toBeUndefined();
  });
});

describe('custom amount (PAY-05)', () => {
  test('minimum and maximum use the server messages', () => {
    expect(check('payment_amount', '1', { min: 5, max: 500 })).toBe('Payment amount must be at least 5.00.');
    expect(check('payment_amount', '600', { min: 5, max: 500 })).toBe('Payment amount cannot exceed 500.00.');
    expect(check('payment_amount', '50', { min: 5, max: 500 })).toBeUndefined();
  });
});

describe('product quantity (review #28, PAY-06)', () => {
  const product = { allowQuantity: true, minQuantity: 2, maxQuantity: 5, price: 10 };

  test('a fractional, negative or non-numeric quantity is refused as on the server', () => {
    expect(check('payment_product', '1.5', product)).toBe('Please enter a whole number for the quantity.');
    expect(check('payment_product', '-1', product)).toBe('Please enter a whole number for the quantity.');
    expect(check('payment_product', '0x3', product)).toBe('Please enter a whole number for the quantity.');
    expect(check('payment_product', 'abc', product)).toBe('Please enter a whole number for the quantity.');
  });

  test('the untouched default of 1 is refused when the minimum is higher', () => {
    expect(check('payment_product', '1', product)).toBe('The quantity must be at least 2.');
  });

  test('a quantity above the maximum is refused', () => {
    expect(check('payment_product', '6', product)).toBe('The quantity can be at most 5.');
  });

  test('a whole quantity in range passes, and so does an empty one', () => {
    expect(check('payment_product', '3', product)).toBeUndefined();
    expect(check('payment_product', 3, product)).toBeUndefined();
    expect(check('payment_product', '3.0', product)).toBeUndefined();
    expect(check('payment_product', '', product)).toBeUndefined();
  });

  test('a fixed product without a quantity box has nothing to check', () => {
    expect(check('payment_product', '1.5', { allowQuantity: false, price: 10 })).toBeUndefined();
  });
});
