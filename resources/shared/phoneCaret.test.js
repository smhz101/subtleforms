import { editUsPhone } from './phoneCaret';

describe('editUsPhone keeps the caret by digit count', () => {
  const prev = '(555) 010-1234';

  test('inserting a digit mid-number puts the caret after it', () => {
    // Type "9" after the third digit: "(555" + "9" + ") 010-1234".
    const typed = '(5559) 010-1234';
    const out = editUsPhone(prev, typed, 5);
    expect(out.value).toBe('(555) 901-0123');
    expect(out.caret).toBe(7);
  });

  test('inserting where a separator is added counts digits only', () => {
    const out = editUsPhone('(555) 010-123', '(555) 0910-123', 8);
    expect(out.value).toBe('(555) 091-0123');
    expect(out.caret).toBe(8);
  });

  test('deleting a digit mid-number keeps the caret where it was', () => {
    const out = editUsPhone(prev, '(55) 010-1234', 3);
    expect(out.value).toBe('(550) 101-234');
    expect(out.caret).toBe(3);
  });

  test('backspace over a separator deletes the digit before it', () => {
    const out = editUsPhone(prev, '(555 010-1234', 4);
    expect(out.value).toBe('(550) 101-234');
    expect(out.caret).toBe(3);
  });

  test('typing at the end is unchanged', () => {
    const out = editUsPhone('(555) 010-123', '(555) 010-1234', 14);
    expect(out.value).toBe('(555) 010-1234');
    expect(out.caret).toBe(14);
  });
});
