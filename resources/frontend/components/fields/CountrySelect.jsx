import { useEffect, useMemo, useRef, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { orderedCountries, preferredCountryCodes } from '../../../shared/countries';
import { flagEmoji } from '../../../shared/phone';
import { ChevronIcon } from './PickerIcons';
import { useMenu } from './useMenu';
import './Picker.scss';

function matches(country, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return country.name.toLowerCase().includes(needle) || country.code.toLowerCase().includes(needle);
}

/**
 * Searchable country menu. Flags sit with the name; the stored value is
 * still the ISO code or the country name, matching the field's output format.
 */
export default function CountrySelect({
  inputId,
  name,
  value,
  onChange,
  preferredCountries,
  outputFormat = 'code',
  searchable = true,
  placeholder,
  required = false,
  disabled = false,
  readOnly = false,
  describedBy,
  invalid = false,
  preview = false,
}) {
  const { rootRef, open, setOpen } = useMenu();
  const searchRef = useRef(null);
  const listRef = useRef(null);
  const countries = useMemo(
    () => orderedCountries(preferredCountryCodes(preferredCountries)),
    [preferredCountries]
  );
  const preferredSet = useMemo(
    () => new Set(preferredCountryCodes(preferredCountries).map((code) => String(code).toUpperCase())),
    [preferredCountries]
  );
  const [localValue, setLocalValue] = useState(value ?? '');
  const stored = onChange ? value : localValue;
  const selected = countries.find((country) => (
    country.code === String(stored || '').toUpperCase() || country.name === stored
  ));
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const locked = preview || disabled || readOnly;
  const visible = useMemo(
    () => countries.filter((country) => matches(country, query)),
    [countries, query]
  );

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    searchRef.current?.focus();
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [open, active, visible]);

  const choose = (country) => {
    const next = outputFormat === 'name' ? country.name : country.code;
    if (onChange) {
      onChange(next);
    } else {
      setLocalValue(next);
    }
    setOpen(false);
  };

  const onSearchKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, Math.max(visible.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && visible[active]) {
      event.preventDefault();
      choose(visible[active]);
    }
  };

  const prompt = placeholder || __('Select a country', 'subtleforms');

  return (
    <div
      className={`subtleforms-picker${preview ? ' is-preview' : ''}${invalid ? ' is-invalid' : ''}`}
      ref={rootRef}
      onMouseDown={(event) => {
        if (!preview) {
          event.stopPropagation();
        }
      }}>
      <button
        type='button'
        id={inputId}
        className='subtleforms-picker__trigger'
        aria-haspopup='listbox'
        aria-expanded={open}
        aria-required={required || undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        disabled={disabled || readOnly}
        tabIndex={preview ? -1 : 0}
        onClick={() => {
          if (!locked) {
            setOpen((next) => !next);
          }
        }}>
        <span className={selected ? 'subtleforms-picker__value' : 'subtleforms-picker__placeholder'}>
          {selected && <span className='subtleforms-picker__flag' aria-hidden='true'>{flagEmoji(selected.code)}</span>}
          {selected ? selected.name : prompt}
        </span>
        <ChevronIcon />
      </button>
      {name ? <input type='hidden' name={name} value={stored ?? ''} autoComplete='country' /> : null}
      {open && !locked && (
        <div className='subtleforms-picker__menu' role='listbox' aria-labelledby={inputId}>
          {searchable && (
            <input
              ref={searchRef}
              className='subtleforms-picker__search'
              type='text'
              value={query}
              placeholder={__('Search countries', 'subtleforms')}
              aria-label={__('Search countries', 'subtleforms')}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onSearchKeyDown}
            />
          )}
          <div className='subtleforms-picker__list' ref={listRef}>
            {visible.length === 0 ? (
              <p className='subtleforms-picker__empty'>{__('No countries match that search.', 'subtleforms')}</p>
            ) : visible.map((country, index) => (
              <span key={country.code}>
                {query === '' && index > 0 && preferredSet.has(visible[index - 1].code) && !preferredSet.has(country.code) && (
                  <span className='subtleforms-picker__divider' />
                )}
                <button
                  type='button'
                  role='option'
                  className='subtleforms-picker__option'
                  aria-selected={selected?.code === country.code}
                  data-active={index === active ? 'true' : 'false'}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(country)}>
                  <span className='subtleforms-picker__flag' aria-hidden='true'>{flagEmoji(country.code)}</span>
                  <span className='subtleforms-picker__option-label'>{country.name}</span>
                  <span className='subtleforms-picker__meta'>{country.code}</span>
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
