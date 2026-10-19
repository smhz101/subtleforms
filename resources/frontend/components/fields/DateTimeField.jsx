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
import { moveGrid } from '../../../shared/pickerKeyboard';

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

function hourChoices(twelveHour) {
  if (!twelveHour) {
    return Array.from({ length: 24 }, (_, hour) => ({ value: hour, label: String(hour).padStart(2, '0') }));
  }
  return Array.from({ length: 12 }, (_, index) => ({ value: index + 1, label: String(index + 1) }));
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
  const { rootRef, open, setOpen } = useMenu();
  const gridRef = useRef(null);
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

  const emitDate = (iso) => {
    if (mode === 'datetime') {
      emit(joinDateTime(iso, timeValue));
      return;
    }
    emit(iso);
    setOpen(false);
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

  useEffect(() => {
    if (!open || mode === 'time') {
      return;
    }
    gridRef.current?.querySelector('[tabindex="0"]')?.focus();
  }, [open, mode, cursor]);

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
        aria-haspopup='dialog'
        aria-expanded={open}
        aria-invalid={invalid ? 'true' : undefined}
        aria-required={required ? 'true' : undefined}
        aria-describedby={describedBy}
        disabled={disabled || readOnly}
        tabIndex={preview ? -1 : 0}
        onClick={() => {
          if (!locked) {
            if (!open && dateValue) {
              setCursor(parseIsoDate(dateValue) || new Date());
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
        <div className='subtleforms-picker__menu subtleforms-picker__menu--calendar' role='dialog' aria-label={prompt}>
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
                    const focusIso = toIsoDate(cursor);
                    const current = days.findIndex((day) => toIsoDate(day) === focusIso);
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      const iso = focusIso;
                      if (isIsoDateInRange(iso, min, max)) {
                        emitDate(iso);
                      }
                      return;
                    }
                    const next = moveGrid(current < 0 ? 0 : current, event.key, 7, days.length);
                    if (next === (current < 0 ? 0 : current) || !event.key.startsWith('Arrow')) {
                      return;
                    }
                    event.preventDefault();
                    const day = days[next];
                    if (!day) return;
                    setCursor(day);
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
                        const isCursor = iso === toIsoDate(cursor) || (!dateValue && iso === toIsoDate(new Date(cursor.getFullYear(), cursor.getMonth(), 1)));
                        return (
                          <button
                            key={iso}
                            type='button'
                            role='gridcell'
                            className={`subtleforms-picker__day${outside ? ' is-outside' : ''}${isSelected ? ' is-selected' : ''}`}
                            disabled={!inRange}
                            aria-selected={isSelected}
                            aria-label={dayName(day, locale)}
                            tabIndex={toIsoDate(cursor) === iso ? 0 : -1}
                            onClick={() => {
                              setCursor(new Date(day.getFullYear(), day.getMonth(), 1));
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
              <div className='subtleforms-picker__time'>
                <div className='subtleforms-picker__columns'>
                  <div className='subtleforms-picker__column' role='listbox' aria-label={__('Hour', 'subtleforms')}>
                    {hourChoices(twelveHour).map((hour) => (
                      <button
                        key={hour.value}
                        type='button'
                        role='option'
                        tabIndex={-1}
                        aria-selected={!!timeValue && selectedHour === hour.value}
                        className={`subtleforms-picker__tick${timeValue && selectedHour === hour.value ? ' is-selected' : ''}`}
                        onClick={() => selectHour(hour.value)}>
                        {hour.label}
                      </button>
                    ))}
                  </div>
                  <div className='subtleforms-picker__column' role='listbox' aria-label={__('Minute', 'subtleforms')}>
                    {Array.from({ length: 60 }, (_, minute) => (
                      <button
                        key={minute}
                        type='button'
                        role='option'
                        tabIndex={-1}
                        aria-selected={!!timeValue && parsedTime.minutes === minute}
                        className={`subtleforms-picker__tick${timeValue && parsedTime.minutes === minute ? ' is-selected' : ''}`}
                        onClick={() => emitTime(parsedTime.hours, minute)}>
                        {String(minute).padStart(2, '0')}
                      </button>
                    ))}
                  </div>
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
                setOpen(false);
              }}>
              {__('Clear', 'subtleforms')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
