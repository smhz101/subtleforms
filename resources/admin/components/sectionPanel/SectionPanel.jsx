import { useCallback, useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import clsx from 'clsx';
import './sectionPanel.scss';

const DOT_LABELS = {
  on: () => __('Active', 'subtleforms'),
  warn: () => __('Needs setup', 'subtleforms'),
  off: () => __('Off', 'subtleforms'),
};

const DOT_CLASS = {
  on: 'sf-ext-status--active',
  warn: 'sf-ext-status--warning',
  off: 'sf-ext-status--inactive',
};

/**
 * Read one parameter from the address hash (`#tab=logs&section=api`).
 *
 * @param {string} name Parameter name.
 * @return {string} Value, or ''.
 */
export function readHashParam(name) {
  try {
    return new URLSearchParams(window.location.hash.replace(/^#/, '')).get(name) || '';
  } catch (e) {
    return '';
  }
}

/**
 * Put one parameter in the address hash without adding a history entry.
 *
 * @param {string}   name  Parameter name.
 * @param {string}   value New value.
 * @param {string[]} keep  When given, every other parameter is removed except
 *                         these (a screen inside the old section must not
 *                         follow the reader to the next one).
 */
export function writeHashParam(name, value, keep = null) {
  try {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    if (Array.isArray(keep)) {
      [...params.keys()].forEach((key) => {
        if (key !== name && !keep.includes(key)) params.delete(key);
      });
    }
    params.set(name, value);
    window.history.replaceState(null, '', `#${params.toString()}`);
  } catch (e) {
    // The address is only a convenience.
  }
}

/** The dot beside a section: a colour plus words for assistive technology. */
function StatusDot({ status }) {
  if (!DOT_CLASS[status]) return null;
  const label = DOT_LABELS[status]();
  return (
    <span className={clsx('sf-ext-status', DOT_CLASS[status])} title={label} data-status={status}>
      <span className='screen-reader-text'>{label}</span>
    </span>
  );
}

/**
 * The section panel: a card with a vertical list of sections on the left, each
 * with a status dot, and the chosen section on the right. Settings >
 * Integrations and Settings > Logs are built with it. On a narrow screen the
 * list sits above the content.
 *
 * The chosen section is kept in the address hash (`urlParam`), so a reload or
 * a link lands on the same section.
 *
 * Public: add-ons reach it as `window.SubtleFormsExtend.SectionPanel`.
 *
 * @param {Object}   props
 * @param {Array}    props.sections   [{ id, label, status: 'on'|'off'|'warn'|null, order, render }]. `render()` returns the section's content, normally a SectionHeader followed by the body.
 * @param {string}   props.current    Id of the chosen section. Leave out to let the panel follow the address.
 * @param {Function} props.onChange   Called with the id when a section is chosen.
 * @param {string}   props.urlParam   Address parameter that holds the chosen section (default `section`).
 * @param {string[]} props.keepParams  Address parameters that stay when another section is chosen (default `tab`). Any other, such as a screen inside the old section, is removed.
 * @param {string}   props.label      Accessible name of the list.
 * @param {string}   props.className  Extra class on the card.
 */
export default function SectionPanel({
  sections = [],
  current,
  onChange,
  urlParam = 'section',
  keepParams = ['tab'],
  label,
  className,
}) {
  const ordered = [...sections]
    .map((section, index) => ({ section, index }))
    .sort((a, b) => (a.section.order ?? 100) - (b.section.order ?? 100) || a.index - b.index)
    .map(({ section }) => section);

  const known = (id) => ordered.some((section) => section.id === id);
  const [own, setOwn] = useState(() => readHashParam(urlParam));
  const wanted = current !== undefined ? current : own;
  const activeId = known(wanted) ? wanted : ordered[0]?.id;

  // A link to another section of the same panel, the browser's Back and
  // Forward buttons, or a hash edited by hand: follow the address.
  useEffect(() => {
    if (current !== undefined) return undefined;
    const sync = () => setOwn(readHashParam(urlParam));
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, [current, urlParam]);

  // Keep the address in step when the chosen section is the first one by default.
  useEffect(() => {
    if (current === undefined && own !== activeId && activeId) {
      setOwn(activeId);
    }
  }, [current, own, activeId]);

  const choose = useCallback(
    (id) => {
      if (current === undefined) setOwn(id);
      writeHashParam(urlParam, id, keepParams);
      if (onChange) onChange(id);
    },
    [current, urlParam, keepParams, onChange]
  );

  const active = ordered.find((section) => section.id === activeId);

  return (
    <div className={clsx('sf-section-panel', 'sf-ext-settings', className)}>
      <nav className='sf-section-panel__sidebar' aria-label={label || __('Sections', 'subtleforms')}>
        <ul className='sf-section-panel__list'>
          {ordered.map((section) => {
            const isActive = section.id === activeId;
            return (
              <li key={section.id}>
                <button
                  type='button'
                  className={clsx('sf-section-panel__item', { 'sf-section-panel__item--active': isActive })}
                  aria-current={isActive ? 'true' : undefined}
                  onClick={() => choose(section.id)}>
                  <span className='sf-section-panel__item-label'>{section.label}</span>
                  <StatusDot status={section.status} />
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className='sf-section-panel__content'>
        {active && typeof active.render === 'function' ? (
          <div className='sf-section-panel__body' key={active.id}>
            {active.render()}
          </div>
        ) : null}
      </div>
    </div>
  );
}
