import { validateField } from './fieldValidation';
import { collectDefaultValues } from './defaults';

describe('QA validation parity', () => {
  const date = {
    type: 'date',
    config: { key: 'when', minDate: '2024-06-01', maxDate: '2024-06-30' },
  };

  test('exact min and max dates pass, and one day outside fails', () => {
    expect(validateField(date, '2024-06-01')).toBeUndefined();
    expect(validateField(date, '2024-06-30')).toBeUndefined();
    expect(validateField(date, '2024-05-31')).toBe('Date must be on or after 2024-06-01.');
    expect(validateField(date, '2024-07-01')).toBe('Date must be on or before 2024-06-30.');
  });

  test('number rejects a value that misses the configured step', () => {
    const number = {
      type: 'number',
      config: { key: 'qty', min: 0, max: 10, step: 2 },
    };
    expect(validateField(number, 3)).toBe('Must match the step of 2.');
    expect(validateField(number, '3')).toBe('Must match the step of 2.');
    expect(validateField(number, 4)).toBeUndefined();
    expect(validateField(number, 0)).toBeUndefined();
  });

  test('international phone rejects letters and accepts a valid number', () => {
    const phone = {
      type: 'phone',
      config: { key: 'phone', format: 'international' },
    };
    expect(validateField(phone, '555-CALL')).toBe('Invalid phone number.');
    expect(validateField(phone, '+1 (555) 123-4567')).toBeUndefined();
  });

  test('untouched slider is not empty after seeding', () => {
    const slider = {
      type: 'range_slider',
      config: { key: 'volume', required: true, min: 0, max: 100 },
    };
    const values = collectDefaultValues([slider]);
    expect(values.volume).toBe(50);
    expect(validateField(slider, values.volume)).toBeUndefined();
  });

  test('slider zero is a valid required answer', () => {
    const slider = {
      type: 'range_slider',
      config: { key: 'volume', required: true, min: 0, max: 100, defaultValue: 0 },
    };
    expect(collectDefaultValues([slider]).volume).toBe(0);
    expect(validateField(slider, 0)).toBeUndefined();
  });

  test('slider seeds its configured default', () => {
    const slider = {
      type: 'range_slider',
      config: { key: 'volume', required: true, min: 0, max: 100, defaultValue: 25 },
    };
    expect(collectDefaultValues([slider]).volume).toBe(25);
  });

  test('required matrix fails when one of two rows is unanswered', () => {
    const matrix = {
      type: 'checkbox_grid',
      config: {
        key: 'grid',
        required: true,
        rows: ['Color', 'Size'],
        columns: ['Red', 'Blue'],
      },
    };
    expect(validateField(matrix, { Color: 'Red' })).toBe('Please answer the "Size" row.');
    expect(validateField(matrix, { Color: { Red: true } })).toBe('Please answer the "Size" row.');
    expect(validateField(matrix, { Color: 'Red', Size: 'Blue' })).toBeUndefined();
    expect(validateField(matrix, { Color: { Red: true }, Size: { Blue: true } })).toBeUndefined();
  });
});
