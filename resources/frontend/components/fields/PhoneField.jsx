import { useEffect, useId, useMemo, useRef, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import {
  filterPhoneCountries,
  flagMark,
  joinPhoneValue,
  looksInternational,
  phoneCountry,
  splitPhoneValue,
} from '../../../shared/phone';
import { formatUsPhone } from '../../../shared/phoneFormat';
import FlagIcon from './FlagIcon';

/**
 * Phone input. With country codes on, a searchable list of dial codes sits
 * in front of the number. Flags can be hidden from Appearance. With
 * `flagImages` (the field's "Show country flags" setting, 2.7.2) the flag is
 * a small image instead of the two letters.
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
  flagImages = false,
  inputClassName = 'subtleforms-input',
}) {
  const listId = useId();
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const triggerRef = useRef(null);
  const preferred = config.defaultCountry || config.default_country || 'US';
  const [localValue, setLocalValue] = useState(value ?? '');
  const stored = onChange ? value : localValue;
  const parsed = useMemo(
    () => splitPhoneValue(stored, preferred),
    [stored, preferred]
  );
  // An empty number serializes to '', which parses back to the default
  // country. Remember the visitor's choice so it survives that round trip.
  const [pickedCode, setPickedCode] = useState('');
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
  const picked = phoneCountry(pickedCode);
  // Countries that share a dial code (US and Canada are both +1) cannot be
  // told apart from the stored "+{dial} {digits}" string. Prefer the country
  // the visitor picked whenever the dial code still matches.
  const country =
    picked && (!parsed.national || picked.dial === parsed.country?.dial)
      ? picked
      : parsed.country;
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

  useEffect(() => {
    if (open) {
      rootRef.current?.querySelector('.subtleforms-phone__option.is-active')?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [open, active, matches]);

  const choose = (nextCountry) => {
    setOpen(false);
    triggerRef.current?.focus();
    setQuery('');
    setPickedCode(nextCountry?.code || '');
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
      triggerRef.current?.focus();
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
          ref={triggerRef}
          className="subtleforms-phone__trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-label={country ? `${__('Country code', 'subtleforms')}, ${country.name} +${country.dial}` : __('Country code', 'subtleforms')}
          disabled={disabled || readOnly}
          onClick={() => setOpen((current) => !current)}
        >
          {showFlags && country && (
            <span className="subtleforms-phone__flag" aria-hidden="true">
              {flagImages ? <FlagIcon code={country.code} /> : flagMark(country.code)}
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
              role="combobox"
              aria-autocomplete="list"
              aria-expanded="true"
              aria-haspopup="listbox"
              aria-controls={listId}
              aria-activedescendant={matches[active] ? `${listId}-opt-${active}` : undefined}
              autoComplete="off"
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
                    id={`${listId}-opt-${index}`}
                    tabIndex={-1}
                    aria-selected={item.code === country?.code}
                    className={`subtleforms-phone__option${index === active ? ' is-active' : ''}`}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => choose(item)}
                  >
                    {showFlags && (
                      <span className="subtleforms-phone__flag" aria-hidden="true">
                        {flagImages ? <FlagIcon code={item.code} /> : flagMark(item.code)}
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
        value={config.format === 'us' ? formatUsPhone(national) : national}
        inputMode="tel"
        autoComplete="tel-national"
        placeholder={placeholder || __('Phone number', 'subtleforms')}
        required={required || undefined}
        aria-required={required || undefined}
        aria-invalid={!!error || undefined}
        aria-describedby={describedBy}
        disabled={disabled || undefined}
        readOnly={readOnly || undefined}
        onChange={(event) => {
          const typed = event.target.value;
          // A pasted or typed international number ("+44 20 7946 0958")
          // brings its own country (FLD2-07).
          if (looksInternational(typed)) {
            const next = splitPhoneValue(typed, country?.code);
            if (next.country) {
              setPickedCode(next.country.code);
              emit(joinPhoneValue(next.country, next.national));
              return;
            }
          }
          setPickedCode(country?.code || '');
          const national = config.format === 'us' ? formatUsPhone(typed) : typed;
          emit(joinPhoneValue(country, national));
        }}
      />
    </div>
  );
}
