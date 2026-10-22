/**
 * Form completion funnel (2.6.0): plain numbers and plain words for the
 * report on the Reports screen.
 */

import { __, _n, sprintf } from '@wordpress/i18n';

/** Date range presets, in days. */
export const FUNNEL_PRESETS = [7, 30, 90];

/** Where the switch that turns form statistics on and off lives. */
export const FUNNEL_SETTINGS_URL = 'admin.php?page=subtleforms-settings#tab=extensions&ext=analytics';

const num = (value) => Math.max(0, Number(value) || 0);

/**
 * A share as a whole percentage, or null when there is nothing to divide by.
 *
 * @param {number} part  Part.
 * @param {number} whole Whole.
 * @return {number|null} Percentage between 0 and 100.
 */
export function share(part, whole) {
  if (num(whole) <= 0) {
    return null;
  }
  return Math.round(Math.min(100, (num(part) / num(whole)) * 100));
}

/**
 * Format a share for display.
 *
 * @param {number|null} value Percentage.
 * @return {string} For example "38%", or a dash.
 */
export function formatShare(value) {
  return value === null || value === undefined ? '–' : `${value}%`;
}

/**
 * The three funnel stages with counts, shares of "Seen" and bar widths.
 *
 * Bars are scaled to the largest stage, so a site that counted no views (or
 * fewer views than starts, for example while view counting was off) still
 * gets a readable chart.
 *
 * @param {Object} report Report from GET /analytics/funnel.
 * @return {Array<{id:string,label:string,count:number,share:number|null,width:number}>}
 */
export function funnelStages(report = {}) {
  const seen = num(report.seen);
  const started = num(report.started);
  const submitted = num(report.submitted);
  const max = Math.max(seen, started, submitted, 1);
  return [
    { id: 'seen', label: __('Seen', 'subtleforms'), count: seen, share: seen > 0 ? 100 : null },
    { id: 'started', label: __('Started', 'subtleforms'), count: started, share: share(started, seen) },
    { id: 'submitted', label: __('Submitted', 'subtleforms'), count: submitted, share: share(submitted, seen) },
  ].map((stage) => ({ ...stage, width: Math.round((stage.count / max) * 100) }));
}

/**
 * Of the people who started, the share who sent the form.
 *
 * @param {Object} report Report.
 * @return {number|null} Percentage.
 */
export function completionRate(report = {}) {
  return share(report.submitted, report.started);
}

/**
 * The name of a field row, with a fallback for drops with no known field.
 *
 * @param {Object} row Field row ({ key, label }).
 * @return {string} Name.
 */
export function fieldName(row = {}) {
  if (!row.key) {
    return __('Before reaching a field', 'subtleforms');
  }
  return row.label || row.key;
}

/**
 * A plain suggestion for the field where people left.
 *
 * @param {Object} row Field row ({ key, label, type, count, known }).
 * @return {string} Hint.
 */
export function dropHint(row = {}) {
  const count = num(row.count);
  const name = fieldName(row);
  let lead;
  if (!row.key) {
    lead = sprintf(
      /* translators: %s: number of people */
      _n(
        '%s person started the form and left without touching a field.',
        '%s people started the form and left without touching a field.',
        count,
        'subtleforms'
      ),
      count.toLocaleString()
    );
    return `${lead} ${__('Check that the first question is easy to see and to answer.', 'subtleforms')}`;
  }

  lead = sprintf(
    /* translators: 1: number of people, 2: field name */
    _n('%1$s person left at %2$s.', '%1$s people left at %2$s.', count, 'subtleforms'),
    count.toLocaleString(),
    name
  );

  if (!row.known) {
    return `${lead} ${__('This field is no longer on the form.', 'subtleforms')}`;
  }

  const type = String(row.type || '');
  let advice;
  if (['phone', 'tel', 'email', 'address', 'address_group', 'date', 'birthday'].includes(type)) {
    advice = __('Consider making it optional, or say why you ask for it.', 'subtleforms');
  } else if (['file', 'file_upload', 'image_upload', 'signature'].includes(type)) {
    advice = __('This takes effort. Consider making it optional.', 'subtleforms');
  } else if (['textarea', 'rich_text', 'wysiwyg'].includes(type)) {
    advice = __('Long answers take time. Consider a shorter question or making it optional.', 'subtleforms');
  } else if (type.indexOf('payment') === 0 || ['product', 'total', 'price'].includes(type)) {
    advice = __('Check that the price and the payment options are clear.', 'subtleforms');
  } else if (type === 'consent') {
    advice = __('Check that the consent text is short and clear.', 'subtleforms');
  } else if (['password', 'captcha', 'recaptcha', 'hcaptcha', 'turnstile'].includes(type)) {
    advice = __('Check that this step works and is easy to get past.', 'subtleforms');
  } else {
    advice = __('Consider making it optional, or check that the question is clear.', 'subtleforms');
  }
  return `${lead} ${advice}`;
}

/**
 * The step name for a step row.
 *
 * @param {Object} row Step row ({ index, label }).
 * @return {string} Name.
 */
export function stepName(row = {}) {
  const number = num(row.index) + 1;
  return row.label
    ? sprintf(
        /* translators: 1: step number, 2: step title */
        __('Step %1$d: %2$s', 'subtleforms'),
        number,
        row.label
      )
    : sprintf(
        /* translators: %d: step number */
        __('Step %d', 'subtleforms'),
        number
      );
}

/**
 * One sentence that sums up the funnel, for example
 * "100 saw, 60 started, 22 stopped at Phone, 38 submitted."
 *
 * @param {Object} report Report.
 * @return {string} Summary.
 */
export function funnelSentence(report = {}) {
  const fields = Array.isArray(report.fields) ? report.fields : [];
  const top = fields.find((row) => row.key) || fields[0];
  const parts = [
    sprintf(
      /* translators: %s: number of people who saw the form */
      __('%s saw', 'subtleforms'),
      num(report.seen).toLocaleString()
    ),
    sprintf(
      /* translators: %s: number of people who started the form */
      __('%s started', 'subtleforms'),
      num(report.started).toLocaleString()
    ),
  ];
  if (top && num(top.count) > 0) {
    parts.push(
      sprintf(
        /* translators: 1: number of people, 2: field name */
        __('%1$s stopped at %2$s', 'subtleforms'),
        num(top.count).toLocaleString(),
        fieldName(top)
      )
    );
  }
  parts.push(
    sprintf(
      /* translators: %s: number of people who sent the form */
      __('%s submitted', 'subtleforms'),
      num(report.submitted).toLocaleString()
    )
  );
  return `${parts.join(', ')}.`;
}

/**
 * Whether the report has anything to show.
 *
 * @param {Object} report Report.
 * @return {boolean} True when there are no numbers at all.
 */
export function isEmptyReport(report = {}) {
  return num(report.seen) === 0 && num(report.started) === 0 && num(report.submitted) === 0;
}
