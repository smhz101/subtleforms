import { useLayoutEffect, useRef } from '@wordpress/element';
import { editUsPhone, formatUsPhone } from '../../../shared/phoneFormat';

/**
 * Plain US-format phone input (no country selector). Reformats while typing
 * and keeps the caret by digit count so a mid-number edit does not jump.
 */
export default function UsPhoneInput({ value, onChange, ...rest }) {
  const inputRef = useRef(null);
  const caretRef = useRef(null);
  const shown = formatUsPhone(value ?? '');
  useLayoutEffect(() => {
    if (caretRef.current !== null) {
      inputRef.current?.setSelectionRange?.(caretRef.current, caretRef.current);
    }
    caretRef.current = null;
  });
  return (
    <input
      {...rest}
      ref={inputRef}
      value={shown}
      inputMode="tel"
      onChange={(event) => {
        const typed = event.target.value;
        const edit = editUsPhone(shown, typed, event.target.selectionStart ?? typed.length);
        caretRef.current = edit.caret;
        onChange(edit.value);
      }}
    />
  );
}
