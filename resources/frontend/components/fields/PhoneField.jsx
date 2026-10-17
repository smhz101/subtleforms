import { useEffect, useId, useMemo, useRef, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import {
  filterPhoneCountries,
  flagEmoji,
  joinPhoneValue,
  splitPhoneValue,
} from '../../../shared/phone';

/**
 * Phone input. With country codes on, a searchable list of dial codes sits
 * in front of the number. Flags can be hidden from Appearance.
 */
export default function PhoneField({
  inputId,
  name,
  describedBy,
  config = {},
  value,
  onChange,
  placeholder,
  required,
  error,
  disabled = false,
  readOnly = false,
  showFlags = true,
  inputClassName = 'subtleforms-input',
}) {
  const listId = useId();
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const preferred = config.defaultCountry || config.default_country || 'US';
  const [localValue, setLocalValue] = useState(value ?? '');
  const stored = onChange ? value : localValue;
  const parsed = useMemo(
    () => splitPhoneValue(stored, preferred),
    [stored, preferred]
  );
  const emit = (next) => {
    if (onChange) {
      onChange(next);
    } else {
      setLocalValue(next);
    }
  };
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const country = parsed.country;
  const national = parsed.national;
  const matches = useMemo(() => filterPhoneCountries(query), [query]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointer);
    searchRef.current?.focus();
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query, open]);

  const choose = (nextCountry) => {
    setOpen(false);
    setQuery('');
    emit(joinPhoneValue(nextCountry, national));
  };

  const onSearchKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, Math.max(matches.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (matches[active]) {
        choose(matches[active]);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div
      ref={rootRef}
      className={`subtleforms-phone${open ? ' is-open' : ''}${disabled ? ' is-disabled' : ''}`}
    >
      <div className="subtleforms-phone__code">
        <button
          type="button"
          className="subtleforms-phone__trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          disabled={disabled || readOnly}
          onClick={() => setOpen((current) => !current)}
        >
          {showFlags && country && (
            <span className="subtleforms-phone__flag" aria-hidden="true">
              {flagEmoji(country.code)}
            </span>
          )}
          <span className="subtleforms-phone__dial">
            {country ? `+${country.dial}` : '+'}
          </span>
          <span className="subtleforms-phone__caret" aria-hidden="true" />
        </button>
        {open && (
          <div className="subtleforms-phone__menu">
            <input
              ref={searchRef}
              type="search"
              className="subtleforms-phone__search"
              value={query}
              placeholder={__('Search country or code', 'subtleforms')}
              aria-label={__('Search country or code', 'subtleforms')}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onSearchKeyDown}
            />
            <ul
              id={listId}
              className="subtleforms-phone__list"
              role="listbox"
              aria-label={__('Country code', 'subtleforms')}
            >
              {matches.length === 0 && (
                <li className="subtleforms-phone__empty">
                  {__('No countries match that search.', 'subtleforms')}
                </li>
              )}
              {matches.map((item, index) => (
                <li key={item.code} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={item.code === country?.code}
                    className={`subtleforms-phone__option${index === active ? ' is-active' : ''}`}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => choose(item)}
                  >
                    {showFlags && (
                      <span className="subtleforms-phone__flag" aria-hidden="true">
                        {flagEmoji(item.code)}
                      </span>
                    )}
                    <span className="subtleforms-phone__name">{item.name}</span>
                    <span className="subtleforms-phone__option-dial">+{item.dial}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <input
        id={inputId}
        type="tel"
        className={`${inputClassName} subtleforms-phone__input`}
        name={name}
        value={national}
        inputMode="tel"
        autoComplete="tel-national"
        placeholder={placeholder || __('Phone number', 'subtleforms')}
        required={required || undefined}
        aria-required={required || undefined}
        aria-invalid={!!error || undefined}
        aria-describedby={describedBy}
        disabled={disabled || undefined}
        readOnly={readOnly || undefined}
        onChange={(event) => emit(joinPhoneValue(country, event.target.value))}
      />
    </div>
  );
}
