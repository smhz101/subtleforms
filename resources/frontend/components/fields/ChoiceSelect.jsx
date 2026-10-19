import { useEffect, useMemo, useRef, useState } from '@wordpress/element';
import { typeaheadIndex } from '../../../shared/pickerKeyboard';
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
  const { rootRef, open, setOpen } = useMenu();
  const listRef = useRef(null);
  const triggerRef = useRef(null);
  const typed = useRef('');
  const choices = useMemo(() => normalizeOptions(options), [options]);
  const [localValue, setLocalValue] = useState(value ?? '');
  const stored = onChange ? value : localValue;
  const selected = choices.find((option) => String(option.value) === String(stored ?? ''));
  const [active, setActive] = useState(0);
  const locked = preview || disabled || readOnly;

  useEffect(() => {
    if (!open) {
      return;
    }
    const index = Math.max(0, choices.findIndex((option) => String(option.value) === String(stored ?? '')));
    setActive(index);
  }, [open, choices, stored]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const item = listRef.current?.querySelector('[data-active="true"]');
    item?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

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

  const onKeyDown = (event) => {
    if (locked) {
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      setActive((index) => Math.min(choices.length - 1, Math.max(0, index + delta)));
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
      } else if (choices[active]) {
        choose(choices[active]);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (event.key.length === 1 && /\S/.test(event.key)) {
      event.preventDefault();
      if (!open) {
        setOpen(true);
      }
      typed.current = `${typed.current}${event.key}`.slice(-8);
      const index = typeaheadIndex(choices.map((option) => option.label || option.value), typed.current, active - 1);
      if (index >= 0) {
        setActive(index);
      }
      window.clearTimeout(typed.timer);
      typed.timer = window.setTimeout(() => {
        typed.current = '';
      }, 500);
    }
  };

  const prompt = placeholder || __('Select an option', 'subtleforms');

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
        aria-controls={open ? `${inputId || 'choice'}-list` : undefined}
        aria-activedescendant={open ? `${inputId || 'choice'}-opt-${active}` : undefined}
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
        <div id={`${inputId || 'choice'}-list`} className='subtleforms-picker__menu' role='listbox' ref={listRef} aria-labelledby={inputId}>
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
          ) : choices.map((option, index) => (
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
      )}
    </div>
  );
}
