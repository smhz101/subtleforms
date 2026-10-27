/**
 * SubtleForms logo mark.
 *
 * A neutral ink tile with a white form glyph. It deliberately does not use the
 * brand colour: the brand follows the admin colour scheme, and a logo that
 * changes colour with the user's preferences stops reading as a logo. Ink on
 * the white stage matches how core renders the WordPress mark.
 *
 * @param {Object}  props
 * @param {number}  props.size      Pixel size of the square mark.
 * @param {boolean} props.wordmark  Render the "SubtleForms" wordmark beside it.
 * @param {string}  props.className Extra class names.
 */
import { getBranding } from '../utils/branding';

export default function Logo({
  size = 28,
  wordmark = false,
  className = '',
  ...rest
}) {
  const branding = getBranding();

  // A name or logo from the `subtleforms/admin_branding` filter replaces the mark and wordmark.
  if (branding.logoUrl || branding.name !== 'SubtleForms') {
    const custom = branding.logoUrl ? (
      <img
        className='sf-logo__image'
        src={branding.logoUrl}
        alt={wordmark ? '' : branding.name}
        style={{ height: size, width: 'auto', maxWidth: size * 4 }}
      />
    ) : null;
    return (
      <span className={`sf-logo ${wordmark ? 'sf-logo--wordmark' : ''} ${className}`.trim()} {...rest}>
        {custom}
        {(wordmark || !custom) && (
          <span className='sf-logo__word'>
            <span className='sf-logo__word-strong'>{branding.name}</span>
          </span>
        )}
      </span>
    );
  }

  const mark = (
    <svg
      className='sf-logo__mark'
      width={size}
      height={size}
      viewBox='0 0 32 32'
      fill='none'
      aria-hidden={wordmark ? 'true' : undefined}
      role={wordmark ? undefined : 'img'}
      aria-label={wordmark ? undefined : 'SubtleForms'}
      xmlns='http://www.w3.org/2000/svg'
      focusable='false'>
      <rect width='32' height='32' rx='8' fill='var(--sf-logo-bg, #1e1e1e)' />
      <rect x='8' y='8.5' width='16' height='3' rx='1.5' fill='#fff' />
      <rect x='8' y='14.5' width='10' height='3' rx='1.5' fill='#fff' />
      <rect x='8' y='20.5' width='6' height='3' rx='1.5' fill='#fff' />
      <path
        d='M18.6 21.6l2.3 2.3 4.3-4.6'
        stroke='var(--sf-logo-accent, #fff)'
        strokeWidth='2.4'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  );

  if (!wordmark) {
    return (
      <span className={`sf-logo ${className}`.trim()} {...rest}>
        {mark}
      </span>
    );
  }

  return (
    <span className={`sf-logo sf-logo--wordmark ${className}`.trim()} {...rest}>
      {mark}
      <span className='sf-logo__word'>
        Subtle<span className='sf-logo__word-strong'>Forms</span>
      </span>
    </span>
  );
}
