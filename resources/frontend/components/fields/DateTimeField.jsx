import { useEffect, useRef, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import {
  formatExample,
  formatPhp,
  isIsoDateInRange,
  isTwelveHour,
  joinDateTime,
  dayName,
  monthCells,
  parseIsoDate,
  parseTyped,
  resolveDateLimit,
  resolveFormat,
  siteLocale,
  siteWeekStart,
  parseTime,
  splitDateTime,
  splitFormat,
  toIsoDate,
  toTime,
} from '../../../shared/dateTime';
import { CalendarIcon, ChevronIcon, ClockIcon, CloseIcon } from './PickerIcons';
import { useMenu } from './useMenu';
import { moveDate, moveIndex } from '../../../shared/pickerKeyboard';

/** Two letters of each weekday in the site language, starting on the week's first day. */
function weekdayLabels(weekStartsOn, locale) {
  const sunday = new Date(2024, 0, 7);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(sunday);
    day.setDate(sunday.getDate() + ((index + weekStartsOn) % 7));
    const short = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(day);
    return {
      short: Array.from(short.replace(/\.$/, '')).slice(0, 2).join(''),
      long: new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(day),
    };
  });
}

function monthTitle(date, locale) {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date);
}

function displayDate(iso, format, locale) {
  const date = parseIsoDate(iso);
  return date ? formatPhp(date, format || 'Y-m-d', locale) : '';
}

function displayTime(clock, format, locale) {
  const parsed = parseTime(clock);
  if (!parsed) {
    return '';
  }
  const date = new Date(2000, 0, 1, parsed.hours, parsed.minutes);
  return formatPhp(date, format || 'H:i', locale);
}

const KEY_STEPS = {
  ArrowLeft: [-1, 1],
  ArrowRight: [1, 1],
  ArrowUp: [-1, 7],
  ArrowDown: [1, 7],
  PageUp: [-1, 1],
  PageDown: [1, 1],
  Home: [1, 1],
  End: [-1, 1],
};

/**
 * Where an arrow, Home, End or Page key lands in the calendar, skipping days
 * that cannot be picked. When the first stop is disabled the search goes on
 * in the direction of travel (inward for Home and End) and gives up at the
 * edge of the allowed dates. Null means stay where you are.
 */
function nextEnabledDate(from, key, weekStartsOn, byYear, isDisabled, minIso, maxIso) {
  const first = moveDate(from, key, weekStartsOn, byYear);
  if (!first) {
    return null;
  }
  if (!isDisabled(first)) {
    return first;
  }
  const [direction, step] = KEY_STEPS[key] || [1, 1];
  let candidate = first;
  for (let i = 0; i < 400; i += 1) {
    candidate = new Date(candidate.getFullYear(), candidate.getMonth(), candidate.getDate() + direction * step);
    const iso = toIsoDate(candidate);
    if ((direction < 0 && minIso && iso < minIso) || (direction > 0 && maxIso && iso > maxIso)) {
      return null;
    }
    if (!isDisabled(candidate)) {
      return candidate;
    }
  }
  return null;
}

function sameMonth(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function clampDay(year, month, day) {
  return new Date(year, month, Math.min(day, new Date(year, month + 1, 0).getDate()));
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
  label: fieldLabel,
  placeholder,
  format,
  customFormat,
  min,
  max,
  disablePast = false,
  disabledWeekdays,
  firstDay,
  required = false,
  disabled = false,
  readOnly = false,
  describedBy,
  invalid = false,
  preview = false,
}) {
  const inputRef = useRef(null);
  const { rootRef, open, setOpen } = useMenu(inputRef);
  const dialogRef = useRef(null);
  const bodyRef = useRef(null);
  const timeRef = useRef(null);
  const focusBody = useRef(false);
  const focusTime = useRef(false);
  const dialogId = `${inputId || 'datetime'}-dialog`;
  const locale = siteLocale();
  const configuredStart = firstDay === undefined || firstDay === null || firstDay === '' || firstDay === 'site'
    ? NaN
    : Number(firstDay);
  const weekStartsOn = Number.isFinite(configuredStart) ? ((configuredStart % 7) + 7) % 7 : siteWeekStart();
  const [localValue, setLocalValue] = useState(value ?? '');
  // The text being typed, until it is read on blur or Enter.
  const [draft, setDraft] = useState(null);
  const stored = onChange ? (value ?? '') : localValue;
  const fullFormat = resolveFormat(mode, { format, customFormat });
  const parts = splitDateTime(mode === 'time' ? '' : stored);
  const timeValue = mode === 'time' ? (parseTime(stored) ? String(stored).slice(0, 5) : '') : parts.time;
  const dateValue = mode === 'time' ? '' : parts.date;
  const twelveHour = isTwelveHour(mode === 'date' ? '' : (mode === 'time' ? fullFormat : splitFormat(fullFormat).time));
  const timeFormat = mode === 'datetime'
    ? (splitFormat(fullFormat).time || (twelveHour ? 'g:i A' : 'H:i'))
    : fullFormat;
  const dateFormat = mode === 'datetime' ? (splitFormat(fullFormat).date || 'Y-m-d') : fullFormat;
  const parsedTime = parseTime(timeValue) || { hours: 0, minutes: 0 };
  const locked = preview || disabled || readOnly;

  // Dates that cannot be picked: outside the earliest and latest date, before
  // today when "No past dates" is on, or on a disabled weekday.
  const todayIso = toIsoDate(new Date());
  const resolvedMin = resolveDateLimit(min);
  const minIso = disablePast && (!resolvedMin || resolvedMin < todayIso) ? todayIso : resolvedMin;
  const maxIso = resolveDateLimit(max);
  const blockedWeekdays = Array.isArray(disabledWeekdays) ? disabledWeekdays.map(Number) : [];
  const isDisabled = (date) => !isIsoDateInRange(toIsoDate(date), minIso, maxIso) || blockedWeekdays.includes(date.getDay());

  // The day focus starts on: the selected day, else today, else the first
  // day that can be picked, else the 1st.
  const startCursor = () => {
    const selected = parseIsoDate(dateValue);
    if (selected) {
      return selected;
    }
    const today = new Date();
    if (!isDisabled(today)) {
      return today;
    }
    const from = minIso && minIso > todayIso ? parseIsoDate(minIso) : new Date(today.getFullYear(), today.getMonth(), 1);
    for (let i = 0; i < 400 && from; i += 1) {
      const day = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
      if (!isDisabled(day)) {
        return day;
      }
    }
    return new Date(today.getFullYear(), today.getMonth(), 1);
  };

  const [cursor, setCursor] = useState(() => parseIsoDate(dateValue) || new Date());
  const [view, setView] = useState('days');
  const [yearStart, setYearStart] = useState(0);
  const [compact, setCompact] = useState(false);
  const weekdays = weekdayLabels(weekStartsOn, locale);
  const days = monthCells(cursor, weekStartsOn);

  const emit = (next) => {
    setDraft(null);
    if (onChange) {
      onChange(next);
    } else {
      setLocalValue(next);
    }
  };

  const closeMenu = () => {
    setOpen(false);
    inputRef.current?.focus();
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

  // What the input shows: the stored value in the field's format, or, when
  // the visitor typed something that is not a date, that text as it was.
  const knownValue = stored === '' || (mode === 'time' ? !!parseTime(stored) : !!parts.date);
  const shown = (() => {
    if (!knownValue) {
      return String(stored);
    }
    if (mode === 'time') {
      return displayTime(timeValue, timeFormat, locale);
    }
    if (mode === 'datetime') {
      const day = parseIsoDate(dateValue);
      const clock = parseTime(timeValue);
      if (day && clock) {
        day.setHours(clock.hours, clock.minutes);
        return formatPhp(day, fullFormat, locale);
      }
      return displayDate(dateValue, dateFormat, locale);
    }
    return displayDate(dateValue, dateFormat, locale);
  })();

  const prompt = placeholder || formatExample(fullFormat, locale);
  const dialogLabel = (() => {
    const kind = mode === 'time'
      ? __('time picker', 'subtleforms')
      : mode === 'datetime'
        ? __('date and time picker', 'subtleforms')
        : __('calendar', 'subtleforms');
    // translators: 1: field label, 2: kind of picker (calendar, time picker, date and time picker).
    return fieldLabel ? sprintf(__('%1$s, %2$s', 'subtleforms'), fieldLabel, kind) : kind.charAt(0).toUpperCase() + kind.slice(1);
  })();
  const typedNames = /[FMDl]/.test(fullFormat.replace(/\\./g, ''));

  // Read the typed text: a date or time becomes the stored value, anything
  // else is kept as typed so the field's own message can name it.
  const commitDraft = () => {
    if (draft === null) {
      return;
    }
    const text = draft.trim();
    if (!text) {
      emit('');
      return;
    }
    emit(parseTyped(text, mode, fullFormat, locale) ?? text);
  };

  const openMenu = () => {
    if (locked || open) {
      return;
    }
    focusBody.current = true;
    setCompact(typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(pointer: coarse), (max-width: 480px)').matches);
    setCursor(startCursor());
    setView('days');
    setOpen(true);
  };

  const shiftMonth = (delta) => {
    setCursor((current) => clampDay(current.getFullYear(), current.getMonth() + delta, current.getDate()));
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

  // Focus goes into the dialog when it opens, and follows the keys in the
  // calendar. The month buttons keep focus on themselves.
  useEffect(() => {
    if (!open || mode === 'time' || !focusBody.current) {
      return;
    }
    focusBody.current = false;
    bodyRef.current?.querySelector('[tabindex="0"]')?.focus();
  }, [open, mode, cursor, view]);

  useEffect(() => {
    if (open && mode === 'time') {
      timeRef.current?.querySelector('[role="option"][tabindex="0"]')?.focus();
    }
  }, [open, mode]);

  useEffect(() => {
    if (open && focusTime.current) {
      focusTime.current = false;
      timeRef.current?.querySelector('[role="option"][tabindex="0"]')?.focus();
    }
  }, [open, dateValue]);

  // Tab stays inside the dialog: header, grid, time, footer, then round again.
  const trapTab = (event) => {
    if (event.key !== 'Tab' || !dialogRef.current) {
      return;
    }
    const stops = [...dialogRef.current.querySelectorAll('button:not([disabled]), [tabindex="0"]')]
      .filter((el) => el.tabIndex >= 0 && !el.hasAttribute('hidden'));
    if (!stops.length) {
      return;
    }
    const first = stops[0];
    const last = stops[stops.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const pickDay = (day, fromKeyboard) => {
    if (isDisabled(day)) {
      return;
    }
    setCursor(day);
    if (mode === 'datetime' && fromKeyboard) {
      focusTime.current = true;
    }
    emitDate(toIsoDate(day));
    if (mode === 'datetime' && fromKeyboard) {
      // The value may not change (the day was already chosen): move on anyway.
      timeRef.current?.querySelector('[role="option"][tabindex="0"]')?.focus();
    }
  };

  const onDaysKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      pickDay(cursor, true);
      return;
    }
    const next = nextEnabledDate(cursor, event.key, weekStartsOn, event.shiftKey, isDisabled, minIso, maxIso);
    if (moveDate(cursor, event.key, weekStartsOn, event.shiftKey) === null) {
      return;
    }
    event.preventDefault();
    if (next) {
      focusBody.current = true;
      setCursor(next);
    }
  };

  const todayAllowed = !isDisabled(new Date());
  const monthNames = Array.from({ length: 12 }, (_, month) => (
    new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(2024, month, 1))
  ));
  const todayDate = new Date();
  const monthOutOfRange = (year, month) => {
    const first = toIsoDate(new Date(year, month, 1));
    const last = toIsoDate(new Date(year, month + 1, 0));
    return (!!minIso && last < minIso) || (!!maxIso && first > maxIso);
  };
  const yearOutOfRange = (year) => (!!minIso && `${year}-12-31` < minIso) || (!!maxIso && `${year}-01-01` > maxIso);

  const goToView = (next) => {
    focusBody.current = true;
    if (next === 'years') {
      setYearStart(cursor.getFullYear() - 5);
    }
    setView(next);
  };

  const onGridKeyDown = (columns, cellCount, step) => (event) => {
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns };
    if (event.key in moves) {
      event.preventDefault();
      focusBody.current = true;
      setCursor((current) => step(current, moves[event.key]));
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      focusBody.current = true;
      setCursor((current) => step(current, event.key === 'Home' ? -cellCount : cellCount));
    }
  };

  const prevDisabled = view === 'days'
    ? !!minIso && toIsoDate(new Date(cursor.getFullYear(), cursor.getMonth(), 0)) < minIso
    : false;
  const nextDisabled = view === 'days'
    ? !!maxIso && toIsoDate(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)) > maxIso
    : false;

  const stepHeader = (delta) => {
    if (view === 'days') {
      shiftMonth(delta);
    } else if (view === 'months') {
      setCursor((current) => clampDay(current.getFullYear() + delta, current.getMonth(), current.getDate()));
    } else {
      setYearStart((start) => start + delta * 12);
      setCursor((current) => clampDay(current.getFullYear() + delta * 12, current.getMonth(), current.getDate()));
    }
  };

  const stepLabels = {
    days: [__('Previous month', 'subtleforms'), __('Next month', 'subtleforms')],
    months: [__('Previous year', 'subtleforms'), __('Next year', 'subtleforms')],
    years: [__('Previous 12 years', 'subtleforms'), __('Next 12 years', 'subtleforms')],
  }[view];

  const bothSet = !!dateValue && !!timeValue;

  return (
    <div
      className={`subtleforms-picker${preview ? ' is-preview' : ''}${invalid ? ' is-invalid' : ''}`}
      ref={rootRef}
      onMouseDown={(event) => {
        if (!preview) {
          event.stopPropagation();
        }
      }}>
      <input
        type='text'
        id={inputId}
        ref={inputRef}
        className='subtleforms-input subtleforms-picker__input'
        role='combobox'
        aria-haspopup='dialog'
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        aria-required={required || undefined}
        aria-invalid={invalid || !knownValue ? 'true' : undefined}
        aria-describedby={describedBy}
        autoComplete='off'
        inputMode={typedNames ? 'text' : 'numeric'}
        placeholder={prompt}
        value={draft ?? shown}
        disabled={disabled}
        readOnly={readOnly || preview}
        tabIndex={preview ? -1 : 0}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commitDraft}
        onClick={() => {
          if (!stored && draft === null) {
            openMenu();
          }
        }}
        onKeyDown={(event) => {
          if (locked) {
            return;
          }
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            openMenu();
            return;
          }
          if (event.key === 'Enter' && draft !== null) {
            event.preventDefault();
            commitDraft();
          }
        }}
      />
      <button
        type='button'
        className='subtleforms-picker__open'
        aria-label={mode === 'time'
          ? __('Open time picker', 'subtleforms')
          : mode === 'datetime'
            ? __('Open date and time picker', 'subtleforms')
            : __('Open calendar', 'subtleforms')}
        aria-expanded={open}
        aria-haspopup='dialog'
        tabIndex={-1}
        disabled={disabled || readOnly}
        onClick={() => {
          if (locked) {
            return;
          }
          if (open) {
            closeMenu();
          } else {
            openMenu();
          }
        }}>
        {mode !== 'time' && <CalendarIcon />}
        {mode !== 'date' && <ClockIcon />}
      </button>
      {name ? <input type='hidden' name={name} value={stored ?? ''} /> : null}
      {open && !locked && (
        <div
          id={dialogId}
          ref={dialogRef}
          className={`subtleforms-picker__menu subtleforms-picker__menu--calendar${mode === 'datetime' ? ' subtleforms-picker__menu--datetime' : ''}${compact ? ' is-compact' : ''}`}
          role='dialog'
          aria-label={dialogLabel}
          onKeyDown={trapTab}>
          <div className='subtleforms-picker__panel'>
            {mode !== 'time' && (
              <div className='subtleforms-picker__calendar'>
                <div className='subtleforms-picker__calendar-bar'>
                  <button
                    type='button'
                    className='subtleforms-picker__nav'
                    aria-label={stepLabels[0]}
                    aria-disabled={prevDisabled || undefined}
                    onClick={() => !prevDisabled && stepHeader(-1)}>
                    <ChevronIcon />
                  </button>
                  {view === 'days' && (
                    <button
                      type='button'
                      className='subtleforms-picker__title'
                      aria-live='polite'
                      onClick={() => goToView('months')}>
                      {monthTitle(cursor, locale)}
                    </button>
                  )}
                  {view === 'months' && (
                    <button type='button' className='subtleforms-picker__title' onClick={() => goToView('years')}>
                      {cursor.getFullYear()}
                    </button>
                  )}
                  {view === 'years' && (
                    <span className='subtleforms-picker__title subtleforms-picker__title--static' aria-live='polite'>
                      {sprintf(
                        // translators: 1: first year, 2: last year of the years shown.
                        __('%1$s to %2$s', 'subtleforms'),
                        yearStart,
                        yearStart + 11
                      )}
                    </span>
                  )}
                  <button
                    type='button'
                    className='subtleforms-picker__nav subtleforms-picker__nav--next'
                    aria-label={stepLabels[1]}
                    aria-disabled={nextDisabled || undefined}
                    onClick={() => !nextDisabled && stepHeader(1)}>
                    <ChevronIcon />
                  </button>
                  {compact && (
                    <button type='button' className='subtleforms-picker__close' aria-label={__('Close', 'subtleforms')} onClick={closeMenu}>
                      <CloseIcon />
                    </button>
                  )}
                </div>
                <div className='subtleforms-picker__body' ref={bodyRef}>
                  {view === 'days' && (
                    <div
                      className='subtleforms-picker__days'
                      role='grid'
                      aria-label={monthTitle(cursor, locale)}
                      onKeyDown={onDaysKeyDown}>
                      <div className='subtleforms-picker__weekdays' role='row'>
                        {weekdays.map((day, index) => (
                          <span key={index} role='columnheader' aria-label={day.long}>{day.short}</span>
                        ))}
                      </div>
                      {Array.from({ length: 6 }, (_, week) => (
                        <div className='subtleforms-picker__week' role='row' key={week}>
                          {days.slice(week * 7, week * 7 + 7).map((day) => {
                            const iso = toIsoDate(day);
                            const outside = !sameMonth(day, cursor);
                            const off = isDisabled(day);
                            const isSelected = iso === dateValue;
                            const isToday = iso === todayIso;
                            return (
                              <button
                                key={iso}
                                type='button'
                                role='gridcell'
                                className={`subtleforms-picker__day${outside ? ' is-outside' : ''}${isSelected ? ' is-selected' : ''}${isToday ? ' is-today' : ''}`}
                                aria-disabled={off || undefined}
                                aria-selected={isSelected}
                                aria-current={isToday ? 'date' : undefined}
                                aria-label={dayName(day, locale)}
                                tabIndex={toIsoDate(cursor) === iso ? 0 : -1}
                                onClick={() => pickDay(day, false)}>
                                {day.getDate()}
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                  {view === 'months' && (
                    <div
                      className='subtleforms-picker__months'
                      role='grid'
                      aria-label={String(cursor.getFullYear())}
                      onKeyDown={onGridKeyDown(3, 11, (current, delta) => clampDay(current.getFullYear(), current.getMonth() + delta, current.getDate()))}>
                      {Array.from({ length: 4 }, (_, row) => (
                        <div className='subtleforms-picker__row' role='row' key={row}>
                          {monthNames.slice(row * 3, row * 3 + 3).map((name, offset) => {
                            const month = row * 3 + offset;
                            const isCurrent = todayDate.getFullYear() === cursor.getFullYear() && todayDate.getMonth() === month;
                            const off = monthOutOfRange(cursor.getFullYear(), month);
                            return (
                              <button
                                key={month}
                                type='button'
                                role='gridcell'
                                className={`subtleforms-picker__cell${isCurrent ? ' is-today' : ''}${cursor.getMonth() === month ? ' is-selected' : ''}`}
                                aria-disabled={off || undefined}
                                aria-selected={cursor.getMonth() === month}
                                aria-current={isCurrent ? 'date' : undefined}
                                tabIndex={cursor.getMonth() === month ? 0 : -1}
                                onClick={() => {
                                  if (!off) {
                                    focusBody.current = true;
                                    setCursor(clampDay(cursor.getFullYear(), month, cursor.getDate()));
                                    setView('days');
                                  }
                                }}>
                                {name}
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                  {view === 'years' && (
                    <div
                      className='subtleforms-picker__years'
                      role='grid'
                      aria-label={sprintf(__('%1$s to %2$s', 'subtleforms'), yearStart, yearStart + 11)}
                      onKeyDown={onGridKeyDown(4, 11, (current, delta) => {
                        const next = clampDay(current.getFullYear() + delta, current.getMonth(), current.getDate());
                        if (next.getFullYear() < yearStart) {
                          setYearStart(yearStart - 12);
                        } else if (next.getFullYear() > yearStart + 11) {
                          setYearStart(yearStart + 12);
                        }
                        return next;
                      })}>
                      {Array.from({ length: 3 }, (_, row) => (
                        <div className='subtleforms-picker__row' role='row' key={row}>
                          {Array.from({ length: 4 }, (__unused, offset) => {
                            const year = yearStart + row * 4 + offset;
                            const off = yearOutOfRange(year);
                            return (
                              <button
                                key={year}
                                type='button'
                                role='gridcell'
                                className={`subtleforms-picker__cell${todayDate.getFullYear() === year ? ' is-today' : ''}${cursor.getFullYear() === year ? ' is-selected' : ''}`}
                                aria-disabled={off || undefined}
                                aria-selected={cursor.getFullYear() === year}
                                aria-current={todayDate.getFullYear() === year ? 'date' : undefined}
                                tabIndex={cursor.getFullYear() === year ? 0 : -1}
                                onClick={() => {
                                  if (!off) {
                                    focusBody.current = true;
                                    setCursor(clampDay(year, cursor.getMonth(), cursor.getDate()));
                                    setView('months');
                                  }
                                }}>
                                {year}
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
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
            <div className='subtleforms-picker__footer-actions'>
              {mode !== 'time' && (
                <button
                  type='button'
                  className='subtleforms-picker__text-button'
                  aria-disabled={!todayAllowed || undefined}
                  title={todayAllowed ? undefined : __('Today is outside the allowed dates', 'subtleforms')}
                  onClick={() => {
                    if (todayAllowed) {
                      pickDay(new Date(), false);
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
            {mode === 'datetime' && (
              <button
                type='button'
                className='subtleforms-picker__primary-button'
                aria-disabled={!bothSet || undefined}
                onClick={() => {
                  if (bothSet) {
                    closeMenu();
                  }
                }}>
                {__('Done', 'subtleforms')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
