import { useState, useCallback } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import Icon from '../../ui/Icon';
import './ConnectionSteps.scss';

/**
 * A small copy button for a value the person has to paste somewhere else.
 *
 * @param {Object} props
 * @param {string} props.text What to copy.
 */
function CopyButton({ text }) {
  const [done, setDone] = useState(false);
  const copy = () => {
    const write = window.navigator?.clipboard?.writeText;
    if (!write) return;
    write.call(window.navigator.clipboard, text).then(() => {
      setDone(true);
      window.setTimeout(() => setDone(false), 1500);
    });
  };
  return (
    <Button variant='secondary' size='small' onClick={copy}>
      {done ? __('Copied', 'subtleforms') : __('Copy', 'subtleforms')}
    </Button>
  );
}

/**
 * Whether an address can be linked from a step: a full https address, or an
 * address on this site (the admin page of a step that happens here, which may
 * be http on a local site).
 *
 * @param {*} href Value to check.
 * @return {boolean} True for a safe address.
 */
export function isSafeHref(href) {
  if (typeof href !== 'string' || href.trim() === '') return false;
  try {
    const here = typeof window !== 'undefined' ? window.location.href : 'https://localhost/';
    const url = new URL(href, here);
    if (url.protocol === 'https:' && url.host !== '') return true;
    return url.protocol === 'http:' && url.origin === new URL(here).origin;
  } catch (e) {
    return false;
  }
}

/**
 * Read the remembered open or closed choice for a set of steps.
 *
 * @param {string} key Storage key.
 * @return {?boolean} The saved choice, or null when there is none or storage is unavailable.
 */
function readChoice(key) {
  try {
    const value = window.localStorage.getItem(key);
    if (value === '1') return true;
    if (value === '0') return false;
  } catch (e) {
    // Storage can be blocked; the default applies.
  }
  return null;
}

/**
 * Remember the open or closed choice. Storage may be blocked, so a failure is ignored.
 *
 * @param {string}  key  Storage key.
 * @param {boolean} open Choice to keep.
 */
function writeChoice(key, open) {
  try {
    window.localStorage.setItem(key, open ? '1' : '0');
  } catch (e) {
    // Nothing to do; the choice only lasts for this screen.
  }
}

/**
 * Numbered instructions for connecting a service. Every connection screen
 * uses it, so the steps look and read the same everywhere.
 *
 * A step that happens on another website carries `href`; it is drawn as a link
 * button that opens that page in a new tab. A step that gives the person
 * something to paste carries `code`; it is drawn as a copy field.
 *
 * The steps sit in an accordion so they are read only when needed. Pass
 * `defaultOpen` true when the service is not connected yet and false when it
 * is. The person's own choice is remembered per `storageKey` and wins over the
 * default.
 *
 * The component is also on `window.SubtleFormsExtend.ConnectionSteps`, so an
 * add-on draws its own instructions the same way. Add-ons check that it exists
 * before they use it.
 *
 * @param {Object}   props
 * @param {string}   [props.title]       Heading of the accordion. "How to connect" by default when collapsible.
 * @param {*}        [props.intro]       One or two sentences before the steps.
 * @param {Array}    props.steps         [{ text, href, hrefLabel, code }]. `hrefLabel` is the visible link text, "Open the page" by default.
 * @param {*}        [props.note]        Something to know after the steps.
 * @param {string}   [props.id]          Id prefix, for tests and anchors.
 * @param {boolean}  [props.collapsible] Draw the steps inside an accordion. True by default.
 * @param {boolean}  [props.defaultOpen] Whether the accordion starts open when the person has not chosen yet. True by default.
 * @param {string}   [props.storageKey]  localStorage key of the remembered choice. `id` by default.
 */
export default function ConnectionSteps({
  title,
  intro,
  steps = [],
  note,
  id = 'sf-steps',
  collapsible = true,
  defaultOpen = true,
  storageKey,
}) {
  const list = (Array.isArray(steps) ? steps : []).filter((step) => step && step.text);
  const key = storageKey || id;
  const [saved, setSaved] = useState(() => (collapsible ? readChoice(key) : null));
  const open = !collapsible || (saved === null ? !!defaultOpen : saved);
  const toggle = useCallback(() => {
    const next = !open;
    setSaved(next);
    writeChoice(key, next);
  }, [open, key]);

  const heading = title || (collapsible ? __('How to connect', 'subtleforms') : '');
  const content = (
    <>
      {intro && <p className='sf-steps__intro'>{intro}</p>}
      <ol className='sf-steps__list'>
        {list.map((step, index) => {
          const linked = isSafeHref(step.href);
          return (
            <li key={index} className='sf-steps__item'>
              <span className='sf-steps__num' aria-hidden='true'>
                {index + 1}
              </span>
              <div className='sf-steps__body'>
                <p className='sf-steps__text'>{step.text}</p>
                {linked && (
                  <a className='sf-steps__link' href={step.href} target='_blank' rel='noopener noreferrer'>
                    <span>{step.hrefLabel || __('Open the page', 'subtleforms')}</span>
                    <Icon.ExternalLink size={14} aria-hidden='true' />
                    <span className='sf-sr-only'> {__('(opens in a new tab)', 'subtleforms')}</span>
                  </a>
                )}
                {step.code && (
                  <div className='sf-steps__code'>
                    <code>{step.code}</code>
                    <CopyButton text={step.code} />
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {note && <p className='sf-steps__note'>{note}</p>}
    </>
  );

  if (!collapsible) {
    return (
      <section className='sf-steps' aria-labelledby={heading ? `${id}-title` : undefined} data-testid='connection-steps'>
        {heading && (
          <h4 id={`${id}-title`} className='sf-steps__title'>
            {heading}
          </h4>
        )}
        {content}
      </section>
    );
  }

  return (
    <section
      className={`sf-steps sf-steps--accordion${open ? ' is-open' : ''}`}
      aria-labelledby={`${id}-title`}
      data-testid='connection-steps'
    >
      <h4 className='sf-steps__title'>
        <button
          type='button'
          id={`${id}-title`}
          className='sf-steps__toggle'
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          onClick={toggle}
        >
          <span>{heading}</span>
          <Icon.ChevronDown size={16} aria-hidden='true' className='sf-steps__chevron' />
        </button>
      </h4>
      <div id={`${id}-panel`} className='sf-steps__panel' role='region' aria-labelledby={`${id}-title`} hidden={!open}>
        {content}
      </div>
    </section>
  );
}
