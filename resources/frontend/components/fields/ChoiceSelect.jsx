import { useEffect, useMemo, useRef, useState } from '@wordpress/element';
import { foldText, typeaheadIndex } from '../../../shared/pickerKeyboard';
import { __ } from '@wordpress/i18n';
import { ChevronIcon } from './PickerIcons';
import { useMenu } from './useMenu';

function normalizeOptions(options) {
  return (Array.isArray(options) ? options : [])
    .map((option) => (
      option && typeof option === 'object'
        ? { label: option.label || option.value || '', value: option.value ?? option.label ?? '' }
        : { label: String(option ?? ''), value: String(option ?? '') }
    ))
    .filter((option) => option.label || option.value);
}

// Lists longer than this get a search box; shorter ones use type-ahead only.
const SEARCH_THRESHOLD = 15;
const TYPEAHEAD_MAX = 32;
const TYPEAHEAD_RESET_MS = 1000;

/**
 * Dropdown drawn as a field control with its choices in a menu, instead of
 * a native select stacked on a second list.
 */
export default function ChoiceSelect({
  inputId,
  name,
  value,
  onChange,
  options,
  placeholder,
  required = false,
  disabled = false,
  readOnly = false,
  describedBy,
  invalid = false,
  preview = false,
  emptyLabel,
}) {
  const triggerRef = useRef(null);
  const { rootRef, open, setOpen } = useMenu(triggerRef);
  const listRef = useRef(null);
  const searchRef = useRef(null);
  const typed = useRef('');
  const typedTimer = useRef(null);
  // True while the list was opened by a typed character, so the open effect
  // does not move the active option away from what that character found.
  const openedByTyping = useRef(false);
  const choices = useMemo(() => normalizeOptions(options), [options]);
  const [localValue, setLocalValue] = useState(value ?? '');
  const stored = onChange ? value : localValue;
  const selected = choices.find((option) => String(option.value) === String(stored ?? ''));
  const [active, setActive] = useState(0);
  const [query, setQuery] = useState('');
  const locked = preview || disabled || readOnly;
  const searchable = choices.length > SEARCH_THRESHOLD;
  const visible = useMemo(() => {
    const needle = foldText(query.trim());
    const rows = choices.map((option, index) => ({ option, index }));
    if (!searchable || !needle) {
      return rows;
    }
    return rows.filter(({ option }) => foldText(option.label || option.value).includes(needle));
  }, [choices, query, searchable]);

  useEffect(() => {
    if (!open) {
      openedByTyping.current = false;
      setQuery('');
      return;
    }
    if (searchable) {
      searchRef.current?.focus();
    }
    if (openedByTyping.current) {
      return;
    }
    const index = Math.max(0, choices.findIndex((option) => String(option.value) === String(stored ?? '')));
    setActive(index);
  }, [open, choices, stored, searchable]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const item = listRef.current?.querySelector('[data-active="true"]');
    item?.scrollIntoView({ block: 'nearest' });
  }, [open, active, visible]);

  useEffect(() => () => window.clearTimeout(typedTimer.current), []);

  const clear = () => {
    if (onChange) {
      onChange('');
    } else {
      setLocalValue('');
    }
    setOpen(false);
  };

  const choose = (option) => {
    const next = option.value;
    if (onChange) {
      onChange(next);
    } else {
      setLocalValue(next);
    }
    setOpen(false);
    triggerRef.current?.focus();
  };

  const moveActive = (key) => {
    const delta = key === 'ArrowDown' ? 1 : -1;
    setActive((index) => Math.min(Math.max(visible.length - 1, 0), Math.max(0, index + delta)));
  };

  const onSearchKeyDown = (event) => {
    // Enter and the arrows belong to the IME while a composition is open.
    if (event.nativeEvent?.isComposing || event.keyCode === 229) {
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveActive(event.key);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (visible[active]) {
        choose(visible[active].option);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
  };

  const onKeyDown = (event) => {
    if (locked || event.nativeEvent?.isComposing || event.keyCode === 229) {
      return;
    }
    const printable = event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
    const typingSpace = event.key === ' ' && (searchable ? open && query !== '' : typed.current !== '');
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      moveActive(event.key);
    } else if ((event.key === 'Enter' || event.key === ' ') && !typingSpace) {
      event.preventDefault();
      if (!open) {
        setOpen(true);
      } else if (visible[active]) {
        choose(visible[active].option);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (printable && searchable) {
      // The search box takes over once it has focus; this covers the first
      // characters, typed on the trigger before the list opens.
      event.preventDefault();
      if (!open) {
        openedByTyping.current = true;
        setOpen(true);
      }
      setQuery(open ? `${query}${event.key}` : event.key);
      setActive(0);
    } else if (printable) {
      event.preventDefault();
      if (!open) {
        openedByTyping.current = true;
        setOpen(true);
      }
      typed.current = `${typed.current}${event.key}`.slice(-TYPEAHEAD_MAX);
      const selectedAt = Math.max(0, choices.findIndex((option) => String(option.value) === String(stored ?? '')));
      const from = open ? active : selectedAt;
      // One character cycles on from the current option; more keep it.
      const index = typeaheadIndex(
        choices.map((option) => option.label || option.value),
        typed.current,
        typed.current.length === 1 ? from : from - 1
      );
      if (index >= 0) {
        setActive(index);
      }
      window.clearTimeout(typedTimer.current);
      typedTimer.current = window.setTimeout(() => {
        typed.current = '';
      }, TYPEAHEAD_RESET_MS);
    }
  };

  const prompt = placeholder || __('Select an option', 'subtleforms');
  const listId = `${inputId || 'choice'}-list`;
  const activeOptionId = visible[active] ? `${inputId || 'choice'}-opt-${active}` : undefined;

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
        ref={triggerRef}
        role='combobox'
        aria-haspopup='listbox'
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && !searchable ? activeOptionId : undefined}
        aria-required={required || undefined}
        aria-invalid={invalid ? 'true' : undefined}
        aria-describedby={describedBy}
        disabled={disabled || readOnly}
        tabIndex={preview ? -1 : 0}
        onClick={() => {
          if (!locked) {
            setOpen((next) => !next);
          }
        }}
        onKeyDown={onKeyDown}>
        <span className={selected ? 'subtleforms-picker__value' : 'subtleforms-picker__placeholder'}>
          {selected ? (selected.label || selected.value) : prompt}
        </span>
        <ChevronIcon />
      </button>
      <select
        className='subtleforms-picker__fallback'
        name={name}
        required={required || undefined}
        value={stored ?? ''}
        tabIndex={-1}
        aria-hidden='true'
        onChange={(event) => {
          const option = choices.find((item) => String(item.value) === event.target.value);
          if (option) {
            choose(option);
          } else if (onChange) {
            onChange('');
          } else {
            setLocalValue('');
          }
        }}>
        <option value=''>{prompt}</option>
        {choices.map((option, index) => (
          <option key={`${option.value}-${index}`} value={option.value}>
            {option.label || option.value}
          </option>
        ))}
      </select>
      {open && !locked && (
        <div className='subtleforms-picker__menu'>
          {searchable && (
            <input
              ref={searchRef}
              className='subtleforms-picker__search'
              type='text'
              role='combobox'
              aria-autocomplete='list'
              aria-expanded='true'
              aria-haspopup='listbox'
              aria-controls={listId}
              aria-activedescendant={activeOptionId}
              value={query}
              placeholder={__('Search options', 'subtleforms')}
              aria-label={__('Search options', 'subtleforms')}
              autoComplete='off'
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={onSearchKeyDown}
            />
          )}
          <div id={listId} className='subtleforms-picker__list' role='listbox' ref={listRef} aria-labelledby={inputId}>
            {!required && String(stored ?? '') !== '' && (
              <button
                type='button'
                role='option'
                className='subtleforms-picker__option'
                aria-selected={false}
                onClick={clear}>
                <span className='subtleforms-picker__option-label'>{__('Clear selection', 'subtleforms')}</span>
              </button>
            )}
            {choices.length === 0 ? (
              <p className='subtleforms-picker__empty'>
                {emptyLabel || __('No choices yet.', 'subtleforms')}
              </p>
            ) : visible.length === 0 ? (
              <p className='subtleforms-picker__empty'>{__('No options match that search.', 'subtleforms')}</p>
            ) : visible.map(({ option }, index) => (
              <button
                key={`${option.value}-${index}`}
                type='button'
                role='option'
                className='subtleforms-picker__option'
                id={`${inputId || 'choice'}-opt-${index}`}
                tabIndex={-1}
                aria-selected={String(option.value) === String(stored ?? '')}
                data-active={index === active ? 'true' : 'false'}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(option)}>
                <span className='subtleforms-picker__option-label'>{option.label || option.value}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
