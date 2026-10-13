import { validateField, validateFields, isCompositeField } from './fieldValidation';

describe('fieldValidation (Part A2: required validation skips composite fields)', () => {
  const nameGroup = {
    type: 'name_group',
    config: { key: 'name_group_1', required: true },
  };
  const addressGroup = {
    type: 'address_group',
    config: { key: 'address_group_1', required: true },
  };
  const email = { type: 'email', config: { key: 'email_1', required: true } };

  test('isCompositeField identifies name/address groups', () => {
    expect(isCompositeField(nameGroup)).toBe(true);
    expect(isCompositeField(addressGroup)).toBe(true);
    expect(isCompositeField(email)).toBe(false);
  });

  test('empty name_group is invalid with a group-level message', () => {
    expect(validateField(nameGroup, {})).toBe(
      'Please enter your first and last name.'
    );
    expect(validateField(nameGroup, undefined)).toBe(
      'Please enter your first and last name.'
    );
  });

  test('name_group missing only last name is still invalid', () => {
    expect(validateField(nameGroup, { first_name: 'John' })).toBe(
      'Please enter your first and last name.'
    );
  });

  test('name_group with first and last name is valid', () => {
    expect(validateField(nameGroup, { first_name: 'John', last_name: 'Doe' })).toBeUndefined();
  });

  test('empty address_group is invalid', () => {
    expect(validateField(addressGroup, {})).toBe(
      'Please enter your full address.'
    );
  });

  test('complete address_group is valid', () => {
    expect(
      validateField(addressGroup, {
        street_address: '1 Main St',
        city: 'Town',
        state: 'ST',
        postal_code: '00000',
        country: 'US',
      })
    ).toBeUndefined();
  });

  test('empty email is invalid with the standard required message', () => {
    expect(validateField(email, '')).toBe('This field is required.');
  });

  test('invalid email is invalid with the email message', () => {
    expect(validateField(email, 'not-an-email')).toBe('Invalid email address.');
  });

  test('validateFields returns a map keyed by field key', () => {
    const errors = validateFields(
      [nameGroup, email],
      { name_group_1: {}, email_1: 'bad' },
      new Set()
    );
    expect(errors['name_group_1']).toBe('Please enter your first and last name.');
    expect(errors['email_1']).toBe('Invalid email address.');
  });

  test('validateFields skips hidden fields', () => {
    const errors = validateFields(
      [email],
      { email_1: '' },
      new Set(['email_1'])
    );
    expect(errors['email_1']).toBeUndefined();
  });
});
