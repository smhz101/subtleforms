import { useEffect, useMemo, useRef, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import {
  formatPhp,
  isIsoDateInRange,
  isTwelveHour,
  joinDateTime,
  dayName,
  monthCells,
  parseIsoDate,
  siteLocale,
  siteWeekStart,
  parseTime,
  splitDateTime,
  toIsoDate,
  toTime,
} from '../../../shared/dateTime';
import { CalendarIcon, ChevronIcon, ClockIcon } from './PickerIcons';
import { useMenu } from './useMenu';
import { moveDate, moveIndex } from '../../../shared/pickerKeyboard';

function weekdayLabels(weekStartsOn, locale) {
  const sunday = new Date(2024, 0, 7);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(sunday);
    day.setDate(sunday.getDate() + ((index + weekStartsOn) % 7));
    return new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(day);
  });
}

function monthTitle(date, locale) {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date);
}

function displayDate(iso, format) {
  const date = parseIsoDate(iso);
  return date ? formatPhp(date, format || 'Y-m-d') : '';
}

function displayTime(clock, format) {
  const parsed = parseTime(clock);
  if (!parsed) {
    return '';
  }
  const date = new Date(2000, 0, 1, parsed.hours, parsed.minutes);
  return formatPhp(date, format || 'H:i');
}

const minuteChoices = Array.from({ length: 60 }, (_, minute) => ({
  value: minute,
  label: String(minute).padStart(2, '0'),
}));

function hourChoices(twelveHour) {
  if (!twelveHour) {
    return Array.from({ length: 24 }, (_, hour) => ({ value: hour, label: String(hour).padStart(2, '0') }));
  }
  return Array.from({ length: 12 }, (_, index) => ({ value: index + 1, label: String(index + 1) }));
}

/**
 * One column of the time picker (hours or minutes), a listbox with a single
 * tab stop. Arrows, Home, End, PageUp and PageDown move through it, Enter or
 * Space picks the focused value, and the left and right arrows jump to the
 * neighbouring column (FLD2-05).
 */
function TimeColumn({ label, options, selected, onPick }) {
  const listRef = useRef(null);
  const selectedIndex = options.findIndex((option) => option.value === selected);
  const [focusIndex, setFocusIndex] = useState(Math.max(0, selectedIndex));

  useEffect(() => {
    if (selectedIndex >= 0) {
      setFocusIndex(selectedIndex);
    }
  }, [selectedIndex]);

  const focusOption = (index) => {
    setFocusIndex(index);
    listRef.current?.children[index]?.focus();
  };

  const onKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (options[focusIndex]) {
        onPick(options[focusIndex].value);
      }
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const sibling = event.key === 'ArrowLeft'
        ? listRef.current?.previousElementSibling
        : listRef.current?.nextElementSibling;
      const target = sibling?.querySelector('[role="option"][tabindex="0"]');
      if (target) {
        event.preventDefault();
        target.focus();
      }
      return;
    }
    const next = moveIndex(focusIndex, event.key, options.length);
    if (next >= 0) {
      event.preventDefault();
      focusOption(next);
    }
  };

  return (
    <div className='subtleforms-picker__column' role='listbox' aria-label={label} ref={listRef} onKeyDown={onKeyDown}>
      {options.map((option, index) => (
        <button
          key={option.value}
          type='button'
          role='option'
          tabIndex={index === focusIndex ? 0 : -1}
          aria-selected={option.value === selected}
          className={`subtleforms-picker__tick${option.value === selected ? ' is-selected' : ''}`}
          onFocus={() => setFocusIndex(index)}
          onClick={() => onPick(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Date, time, or both. The control stores the same ISO values a native
 * input would, and uses the field format only for what the visitor reads.
 */
export default function DateTimeField({
  mode = 'date',
  inputId,
  name,
  value,
  onChange,
  placeholder,
  format,
  min,
  max,
  required = false,
  disabled = false,
  readOnly = false,
  describedBy,
  invalid = false,
  preview = false,
}) {
  const triggerRef = useRef(null);
  const { rootRef, open, setOpen } = useMenu(triggerRef);
  const gridRef = useRef(null);
  const timeRef = useRef(null);
  const focusGrid = useRef(false);
  const dialogId = `${inputId || 'datetime'}-dialog`;
  const locale = siteLocale();
  const weekStartsOn = siteWeekStart();
  const [localValue, setLocalValue] = useState(value ?? '');
  const stored = onChange ? (value ?? '') : localValue;
  const parts = splitDateTime(mode === 'time' ? '' : stored);
  const timeValue = mode === 'time' ? (parseTime(stored) ? String(stored).slice(0, 5) : '') : parts.time;
  const dateValue = mode === 'time' ? '' : parts.date;
  const twelveHour = isTwelveHour(mode === 'date' ? '' : (format || (mode === 'time' ? 'H:i' : 'Y-m-d H:i')));
  const timeFormat = mode === 'datetime'
    ? (String(format || '').includes(' ') ? String(format).split(' ').slice(1).join(' ') : (twelveHour ? 'g:i A' : 'H:i'))
    : (format || 'H:i');
  const dateFormat = mode === 'datetime'
    ? (String(format || 'Y-m-d H:i').split(' ')[0] || 'Y-m-d')
    : (format || 'Y-m-d');
  const parsedTime = parseTime(timeValue) || { hours: 0, minutes: 0 };
  const [cursor, setCursor] = useState(() => parseIsoDate(dateValue) || new Date());
  const locked = preview || disabled || readOnly;
  const weekdays = useMemo(() => weekdayLabels(weekStartsOn, locale), [weekStartsOn, locale]);
  const days = monthCells(cursor, weekStartsOn);

  const emit = (next) => {
    if (onChange) {
      onChange(next);
    } else {
      setLocalValue(next);
    }
  };

  const closeMenu = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const emitDate = (iso) => {
    if (mode === 'datetime') {
      emit(joinDateTime(iso, timeValue));
      return;
    }
    emit(iso);
    closeMenu();
  };

  const emitTime = (hours, minutes) => {
    const clock = toTime(hours, minutes);
    if (mode === 'datetime') {
      emit(joinDateTime(dateValue || toIsoDate(new Date()), clock));
      return;
    }
    emit(clock);
  };

  const label = (() => {
    if (mode === 'time') {
      return displayTime(timeValue, timeFormat);
    }
    if (mode === 'datetime') {
      const dateLabel = displayDate(dateValue, dateFormat);
      const clockLabel = displayTime(timeValue, timeFormat);
      return [dateLabel, clockLabel].filter(Boolean).join('  ');
    }
    return displayDate(dateValue, dateFormat);
  })();

  const prompt = placeholder || (
    mode === 'time'
      ? __('Select a time', 'subtleforms')
      : mode === 'datetime'
        ? __('Select date and time', 'subtleforms')
        : __('Select a date', 'subtleforms')
  );

  const shiftMonth = (delta) => {
    setCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  };

  const selectHour = (hour) => {
    if (!twelveHour) {
      emitTime(hour, timeValue ? parsedTime.minutes : 0);
      return;
    }
    const meridiem = parsedTime.hours >= 12 ? 'PM' : 'AM';
    const base = hour % 12;
    emitTime(meridiem === 'PM' ? base + 12 : base, timeValue ? parsedTime.minutes : 0);
  };

  const setMeridiem = (meridiem) => {
    const hour12 = parsedTime.hours % 12;
    emitTime(meridiem === 'PM' ? hour12 + 12 : hour12, parsedTime.minutes);
  };

  const selectedHour = twelveHour ? (parsedTime.hours % 12 || 12) : parsedTime.hours;

  // Focus goes into the dialog when it opens, and follows the arrow keys in
  // the calendar. Changing the month with its selects keeps focus there.
  useEffect(() => {
    if (!open || mode === 'time' || !focusGrid.current) {
      return;
    }
    focusGrid.current = false;
    gridRef.current?.querySelector('[tabindex="0"]')?.focus();
  }, [open, mode, cursor]);

  useEffect(() => {
    if (open && mode === 'time') {
      timeRef.current?.querySelector('[role="option"][tabindex="0"]')?.focus();
    }
  }, [open, mode]);

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
        ref={triggerRef}
        className='subtleforms-picker__trigger'
        role='combobox'
        aria-haspopup='dialog'
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        aria-required={required || undefined}
        aria-invalid={invalid ? 'true' : undefined}
        aria-describedby={describedBy}
        disabled={disabled || readOnly}
        tabIndex={preview ? -1 : 0}
        onKeyDown={(event) => {
          if (!locked && !open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault();
            event.currentTarget.click();
          }
        }}
        onClick={() => {
          if (!locked) {
            if (!open) {
              focusGrid.current = true;
              if (dateValue) {
                setCursor(parseIsoDate(dateValue) || new Date());
              }
            }
            setOpen((next) => !next);
          }
        }}>
        <span className={label ? 'subtleforms-picker__value' : 'subtleforms-picker__placeholder'}>
          {label || prompt}
        </span>
        <span className='subtleforms-picker__icons'>
          {mode !== 'time' && <CalendarIcon />}
          {mode !== 'date' && <ClockIcon />}
        </span>
      </button>
      {name ? (
        <input
          type='text'
          className='subtleforms-picker__fallback'
          name={name}
          value={stored ?? ''}
          required={required || undefined}
          tabIndex={-1}
          aria-hidden='true'
          autoComplete='off'
          onChange={(event) => {
            const next = event.target.value;
            if (onChange) {
              onChange(next);
            } else {
              setLocalValue(next);
            }
          }}
        />
      ) : null}
      {open && !locked && (
        <div id={dialogId} className='subtleforms-picker__menu subtleforms-picker__menu--calendar' role='dialog' aria-label={prompt}>
          <div className='subtleforms-picker__panel'>
            {mode !== 'time' && (
              <div className='subtleforms-picker__calendar'>
                <div className='subtleforms-picker__calendar-bar'>
                  <button type='button' className='subtleforms-picker__nav' aria-label={__('Previous month', 'subtleforms')} onClick={() => shiftMonth(-1)}>
                    <ChevronIcon />
                  </button>
                  <select
                    className='subtleforms-picker__month'
                    aria-label={__('Month', 'subtleforms')}
                    value={cursor.getMonth()}
                    onChange={(event) => setCursor(new Date(cursor.getFullYear(), Number(event.target.value), 1))}>
                    {Array.from({ length: 12 }, (_, month) => (
                      <option key={month} value={month}>
                        {new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2024, month, 1))}
                      </option>
                    ))}
                  </select>
                  <select
                    className='subtleforms-picker__year'
                    aria-label={__('Year', 'subtleforms')}
                    value={cursor.getFullYear()}
                    onChange={(event) => setCursor(new Date(Number(event.target.value), cursor.getMonth(), 1))}>
                    {Array.from({ length: 141 }, (_, index) => cursor.getFullYear() - 120 + index).map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                  <button type='button' className='subtleforms-picker__nav subtleforms-picker__nav--next' aria-label={__('Next month', 'subtleforms')} onClick={() => shiftMonth(1)}>
                    <ChevronIcon />
                  </button>
                </div>
                <div
                  className='subtleforms-picker__days'
                  role='grid'
                  ref={gridRef}
                  aria-label={monthTitle(cursor, locale)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      const iso = toIsoDate(cursor);
                      if (isIsoDateInRange(iso, min, max)) {
                        emitDate(iso);
                      }
                      return;
                    }
                    const next = moveDate(cursor, event.key, weekStartsOn);
                    if (!next) {
                      return;
                    }
                    event.preventDefault();
                    focusGrid.current = true;
                    setCursor(next);
                  }}>
                  <div className='subtleforms-picker__weekdays' role='row'>
                    {weekdays.map((day, index) => <span key={index} role='columnheader'>{day}</span>)}
                  </div>
                  {Array.from({ length: 6 }, (_, week) => (
                    <div className='subtleforms-picker__week' role='row' key={week}>
                      {days.slice(week * 7, week * 7 + 7).map((day) => {
                        const iso = toIsoDate(day);
                        const outside = day.getMonth() !== cursor.getMonth();
                        const inRange = isIsoDateInRange(iso, min, max);
                        const isSelected = iso === dateValue;
                        return (
                          <button
                            key={iso}
                            type='button'
                            role='gridcell'
                            className={`subtleforms-picker__day${outside ? ' is-outside' : ''}${isSelected ? ' is-selected' : ''}`}
                            aria-disabled={!inRange || undefined}
                            aria-selected={isSelected}
                            aria-label={dayName(day, locale)}
                            tabIndex={toIsoDate(cursor) === iso ? 0 : -1}
                            onClick={() => {
                              if (!inRange) {
                                return;
                              }
                              setCursor(day);
                              emitDate(iso);
                            }}>
                            {day.getDate()}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {mode !== 'date' && (
              <div className='subtleforms-picker__time' ref={timeRef}>
                <div className='subtleforms-picker__columns'>
                  <TimeColumn
                    label={__('Hour', 'subtleforms')}
                    options={hourChoices(twelveHour)}
                    selected={timeValue ? selectedHour : null}
                    onPick={selectHour}
                  />
                  <TimeColumn
                    label={__('Minute', 'subtleforms')}
                    options={minuteChoices}
                    selected={timeValue ? parsedTime.minutes : null}
                    onPick={(minute) => emitTime(parsedTime.hours, minute)}
                  />
                </div>
                {twelveHour && (
                  <div className='subtleforms-picker__meridiem'>
                    {['AM', 'PM'].map((meridiem) => (
                      <button
                        key={meridiem}
                        type='button'
                        className={`subtleforms-picker__tick${(parsedTime.hours >= 12 ? 'PM' : 'AM') === meridiem && timeValue ? ' is-selected' : ''}`}
                        onClick={() => setMeridiem(meridiem)}>
                        {meridiem}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className='subtleforms-picker__footer'>
            {mode !== 'time' && (
              <button
                type='button'
                className='subtleforms-picker__text-button'
                onClick={() => {
                  const today = toIsoDate(new Date());
                  if (isIsoDateInRange(today, min, max)) {
                    setCursor(new Date());
                    emitDate(today);
                  }
                }}>
                {__('Today', 'subtleforms')}
              </button>
            )}
            <button
              type='button'
              className='subtleforms-picker__text-button'
              onClick={() => {
                emit('');
                closeMenu();
              }}>
              {__('Clear', 'subtleforms')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
