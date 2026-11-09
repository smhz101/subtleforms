import { useState } from '@wordpress/element';
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
 * Numbered instructions for connecting a service. Every connection screen
 * uses it, so the steps look and read the same everywhere.
 *
 * A step that happens on another website carries `href`; it is drawn as a link
 * button that opens that page in a new tab. A step that gives the person
 * something to paste carries `code`; it is drawn as a copy field.
 *
 * The component is also on `window.SubtleFormsExtend.ConnectionSteps`, so an
 * add-on draws its own instructions the same way. Add-ons check that it exists
 * before they use it.
 *
 * @param {Object}   props
 * @param {string}   [props.title] Optional heading above the steps.
 * @param {*}        [props.intro] One or two sentences before the steps.
 * @param {Array}    props.steps   [{ text, href, hrefLabel, code }]. `hrefLabel` is the visible link text, "Open the page" by default.
 * @param {*}        [props.note]  Something to know after the steps.
 * @param {string}   [props.id]    Id prefix, for tests and anchors.
 */
export default function ConnectionSteps({ title, intro, steps = [], note, id = 'sf-steps' }) {
  const list = (Array.isArray(steps) ? steps : []).filter((step) => step && step.text);
  return (
    <section className='sf-steps' aria-labelledby={title ? `${id}-title` : undefined} data-testid='connection-steps'>
      {title && (
        <h4 id={`${id}-title`} className='sf-steps__title'>
          {title}
        </h4>
      )}
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
    </section>
  );
}
