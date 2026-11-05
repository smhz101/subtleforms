import {
  PRESETS,
  applyMask,
  editValue,
  formatMask,
  isRealDate,
  isRealTime,
  maskProblem,
  resolveMask,
  sanitizePhone,
  shownValue,
  storedValue,
} from './inputMask';

describe('formatMask', () => {
  it('adds literals in front of the next character, never after the last', () => {
    expect(formatMask('12', '99-99').value).toBe('12');
    expect(formatMask('123', '99-99').value).toBe('12-3');
    expect(formatMask('1234', '99-99').value).toBe('12-34');
  });

  it('cuts text past the end of the pattern', () => {
    expect(formatMask('123456789', '99-99').value).toBe('12-34');
  });

  it('drops characters that do not fit the token', () => {
    expect(formatMask('a1b2', '99-99').value).toBe('12');
    expect(formatMask('12ab', 'AA-99').value).toBe('ab');
    expect(formatMask('ab12', 'AA-99').value).toBe('ab-12');
    expect(formatMask('a1-2b', '**-**').value).toBe('a1-2b');
  });

  it('takes a pasted value that already has its literals', () => {
    expect(formatMask('31/12/2026', '99/99/9999').value).toBe('31/12/2026');
    expect(formatMask('(555) 010-1234', '999-999-9999').value).toBe('555-010-1234');
  });

  it('handles unicode letters', () => {
    expect(formatMask('éa12', 'AA-99').value).toBe('éa-12');
  });

  it('returns the typed characters without literals', () => {
    expect(formatMask('12-34', '99-99').raw).toBe('1234');
  });
});

describe('applyMask caret', () => {
  it('keeps the caret after the same number of typed characters', () => {
    // "12-3" with the caret at the end after typing 3.
    expect(applyMask('12-3', 4, '99-99')).toMatchObject({ value: '12-3', caret: 4 });
    // Typing before a literal: "123-34" with caret 3.
    expect(applyMask('123-34', 3, '99-99')).toMatchObject({ value: '12-33', caret: 4 });
  });

  it('moves the caret back over a literal that was deleted', () => {
    // "12-34", caret after "-", Backspace removes "-": "1234" caret 2.
    expect(applyMask('1234', 2, '99-99')).toMatchObject({ value: '12-34', caret: 2 });
  });

  it('does not move the caret for a character that was rejected', () => {
    // "12-34" with an "x" typed after "1": "1x2-34", caret 2.
    expect(applyMask('1x2-34', 2, '99-99')).toMatchObject({ value: '12-34', caret: 1 });
  });
});

describe('phone', () => {
  it('keeps digits, spaces, dashes, brackets and a leading plus', () => {
    expect(sanitizePhone('+44 (0) 20-7946 abc')).toBe('+44 (0) 20-7946 ');
    expect(sanitizePhone('12+34')).toBe('1234');
  });

  it('stops at 15 digits', () => {
    expect(sanitizePhone('1234567890123456789').replace(/\D/g, '')).toHaveLength(15);
  });

  it('is checked for length and characters', () => {
    const mask = resolveMask({ inputMask: 'phone' });
    expect(maskProblem(mask, '+44 20 7946 0958')).toBe('');
    expect(maskProblem(mask, '123')).toBe('format');
    expect(maskProblem(mask, '1234567890123456')).toBe('format');
    expect(maskProblem(mask, 'call me')).toBe('format');
    expect(maskProblem(mask, '')).toBe('');
  });

  it('keeps the plus and the digits when saving digits only', () => {
    const mask = resolveMask({ inputMask: 'phone', maskStore: 'digits' });
    expect(storedValue(mask, '+44 (20) 7946-0958')).toBe('+442079460958');
    expect(mask.inputMode).toBe('tel');
  });
});

describe('dates and times', () => {
  it('knows real days', () => {
    expect(isRealDate('29022024', 'dmy')).toBe(true);
    expect(isRealDate('29022023', 'dmy')).toBe(false);
    expect(isRealDate('31022026', 'dmy')).toBe(false);
    expect(isRealDate('02312026', 'mdy')).toBe(false);
    expect(isRealDate('20260431', 'ymd')).toBe(false);
    expect(isRealDate('20261231', 'ymd')).toBe(true);
    expect(isRealDate('00000101', 'ymd')).toBe(false);
  });

  it('knows real times', () => {
    expect(isRealTime('2359')).toBe(true);
    expect(isRealTime('2400')).toBe(false);
    expect(isRealTime('1260')).toBe(false);
  });

  it('reports a format problem or a date that does not exist', () => {
    const mask = resolveMask({ inputMask: 'date_dmy' });
    expect(maskProblem(mask, '31/12/2026')).toBe('');
    expect(maskProblem(mask, '31/02/2026')).toBe('date');
    expect(maskProblem(mask, '31/12/26')).toBe('format');
    expect(maskProblem(mask, '3112/2026')).toBe('format');
  });

  it('always keeps dates and times as typed', () => {
    expect(resolveMask({ inputMask: 'date_dmy', maskStore: 'digits' }).store).toBe('typed');
    expect(resolveMask({ inputMask: 'time_24', maskStore: 'digits' }).store).toBe('typed');
  });
});

describe('zip', () => {
  const mask = resolveMask({ inputMask: 'zip_us' });
  it('takes five digits or nine with a dash', () => {
    expect(maskProblem(mask, '12345')).toBe('');
    expect(maskProblem(mask, '12345-6789')).toBe('');
    expect(maskProblem(mask, '123456')).toBe('format');
    expect(maskProblem(mask, '1234')).toBe('format');
    expect(formatMask('123456789', mask.pattern).value).toBe('12345-6789');
  });
});

describe('custom masks and storage', () => {
  it('needs a pattern with at least one token', () => {
    expect(resolveMask({ inputMask: 'custom', maskPattern: '' })).toBeNull();
    expect(resolveMask({ inputMask: 'custom', maskPattern: '--' })).toBeNull();
    expect(resolveMask({ inputMask: 'bogus' })).toBeNull();
    expect(resolveMask({})).toBeNull();
  });

  it('stores as typed or digits only', () => {
    const typed = resolveMask({ inputMask: 'custom', maskPattern: '999-99' });
    const digits = resolveMask({ inputMask: 'custom', maskPattern: '999-99', maskStore: 'digits' });
    expect(storedValue(typed, '123-45')).toBe('123-45');
    expect(storedValue(digits, '123-45')).toBe('12345');
    expect(shownValue(digits, '12345')).toBe('123-45');
    expect(maskProblem(digits, '12345')).toBe('');
    expect(maskProblem(digits, '123-45')).toBe('format');
    expect(maskProblem(typed, '123-45')).toBe('');
    expect(maskProblem(typed, '12345')).toBe('format');
  });

  it('round-trips digits only storage for patterns with literal digits or letters', () => {
    const mask = resolveMask({ inputMask: 'custom', maskPattern: '1-999', maskStore: 'digits' });
    expect(storedValue(mask, '1-123')).toBe('123');
    expect(shownValue(mask, '123')).toBe('1-123');
    expect(maskProblem(mask, '123')).toBe('');
    expect(maskProblem(mask, '1-123')).toBe('format');
    const letters = resolveMask({ inputMask: 'custom', maskPattern: 'x-AA99', maskStore: 'digits' });
    expect(shownValue(letters, 'AB12')).toBe('x-AB12');
    expect(maskProblem(letters, 'AB12')).toBe('');
  });

  it('uses numeric input only for digit patterns', () => {
    expect(resolveMask({ inputMask: 'custom', maskPattern: '999-99' }).inputMode).toBe('numeric');
    expect(resolveMask({ inputMask: 'custom', maskPattern: 'AA-99' }).inputMode).toBe('text');
  });

  it('edits through editValue', () => {
    const mask = resolveMask({ inputMask: 'custom', maskPattern: 'AA-9999' });
    expect(editValue(mask, 'ab12', 4)).toEqual({ value: 'ab-12', caret: 5 });
  });

  it('has the presets the server has', () => {
    expect(Object.keys(PRESETS)).toEqual(['phone', 'date_dmy', 'date_mdy', 'date_ymd', 'time_24', 'zip_us', 'custom']);
  });
});
