/**
 * Input mask field code (2.8.0). Downloaded only for forms that have a field
 * with an input mask (see lazyFields.jsx).
 */
import { useLayoutEffect, useRef } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import {
  editValue,
  maskProblem,
  maskSymbols,
  resolveMask,
  shownValue,
  storedValue,
} from '../../../shared/inputMask';

/**
 * Words that tell the visitor what to type.
 *
 * @param {Object} mask Result of resolveMask().
 * @return {string} Hint text.
 */
export function maskHint(mask) {
  const symbols = maskSymbols(mask);
  if (mask.kind === 'phone') {
    return __('Use digits, spaces, dashes and brackets, up to 15 digits.', 'subtleforms');
  }
  if (mask.kind === 'zip') {
    return __('Format: 12345 or 12345-6789', 'subtleforms');
  }
  if (mask.kind !== 'custom') {
    /* translators: %s: format such as DD/MM/YYYY */
    return sprintf(__('Format: %s', 'subtleforms'), symbols.example);
  }
  const parts = [];
  if (symbols.letters) parts.push(__('A is a letter', 'subtleforms'));
  if (symbols.digits) parts.push(__('9 is a digit', 'subtleforms'));
  if (symbols.either) parts.push(__('* is a letter or digit', 'subtleforms'));
  /* translators: 1: format such as AA-9999, 2: what the symbols mean */
  return sprintf(__('Format: %1$s (%2$s)', 'subtleforms'), symbols.example, parts.join(', '));
}

/** Placeholder to show when the field has none. */
export function maskPlaceholder(mask) {
  return mask.kind === 'phone' ? '' : mask.example;
}

/**
 * Error for a value that does not fit the field's mask, or ''.
 *
 * @param {Object} config Field settings.
 * @param {string} value  Stored value.
 * @return {string} Message.
 */
export function maskError(config, value) {
  const mask = resolveMask(config);
  if (!mask) {
    return '';
  }
  const problem = maskProblem(mask, value);
  if (!problem) {
    return '';
  }
  if (mask.kind === 'phone') {
    return __('Invalid phone number.', 'subtleforms');
  }
  if (mask.kind === 'date') {
    /* translators: %s: format such as DD/MM/YYYY */
    const format = sprintf(__('Enter the date as %s.', 'subtleforms'), mask.example);
    return problem === 'date' ? sprintf(__('That date does not exist. %s', 'subtleforms'), format) : format;
  }
  if (mask.kind === 'time') {
    /* translators: %s: format such as HH:MM */
    return sprintf(__('Enter the time as %s (24-hour).', 'subtleforms'), mask.example);
  }
  if (mask.kind === 'zip') {
    return __('Enter a US ZIP code, such as 12345 or 12345-6789.', 'subtleforms');
  }
  /* translators: %s: format such as AA-9999 */
  return sprintf(__('Enter this in the format %s.', 'subtleforms'), mask.example);
}

/**
 * A text input that formats what is typed, pasted or autofilled.
 *
 * @param {Object}   props
 * @param {Object}   props.config      Field settings.
 * @param {string}   props.value        Stored value.
 * @param {Function} props.onChange     Called with the value to store.
 * @param {string}   props.id           Input id.
 * @param {string}   props.describedBy  Ids already describing the input.
 * @param {boolean}  props.showHint     Draw the format hint under the input.
 */
export function MaskedInput({
  config,
  value,
  onChange,
  id,
  describedBy,
  placeholder,
  showHint = true,
  className = 'subtleforms-input',
  ...rest
}) {
  const mask = resolveMask(config);
  const ref = useRef(null);
  const caret = useRef(null);
  const shown = mask ? shownValue(mask, value) : String(value ?? '');

  const place = () => {
    const el = ref.current;
    if (el && caret.current !== null && document.activeElement === el) {
      try {
        el.setSelectionRange(caret.current, caret.current);
      } catch (e) {
        // Some input types cannot hold a caret.
      }
    }
  };

  useLayoutEffect(() => {
    place();
    caret.current = null;
  });

  if (!mask) {
    return <input id={id} className={className} value={shown} onChange={(e) => onChange(e.target.value)} {...rest} />;
  }

  const hintId = `${id}-mask`;
  const hint = maskHint(mask);
  const describes = [describedBy, showHint ? hintId : null].filter(Boolean).join(' ') || undefined;

  const handle = (event) => {
    const el = event.target;
    const result = editValue(mask, el.value, el.selectionStart ?? el.value.length);
    caret.current = result.caret;
    onChange(storedValue(mask, result.value));
    // The input is controlled, so the browser moves the caret to the end when
    // the value is put back. Set it again once that has happened.
    Promise.resolve().then(() => {
      place();
      caret.current = null;
    });
  };

  return (
    <>
      <input
        ref={ref}
        id={id}
        className={className}
        type="text"
        value={shown}
        onChange={handle}
        inputMode={mask.inputMode}
        placeholder={placeholder || maskPlaceholder(mask) || undefined}
        aria-describedby={describes}
        {...rest}
      />
      {showHint && (
        <p id={hintId} className="subtleforms-field-help subtleforms-mask-hint">
          {hint}
        </p>
      )}
    </>
  );
}

export default MaskedInput;
