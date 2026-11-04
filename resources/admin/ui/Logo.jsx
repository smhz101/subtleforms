/**
 * SubtleForms logo mark.
 *
 * A rounded tile with the S cut out as empty space, drawn from two paths on a
 * 512 by 512 grid. The tile takes its colour from `--sf-logo-fg` (ink by
 * default). On a dark background set `--sf-logo-fg: #f2f1f1` on the logo or a
 * parent. It deliberately does not follow the admin colour scheme: a logo that
 * changes colour with the user's preferences stops reading as a logo.
 *
 * An add-on can replace the mark through `markSvg` in the
 * `subtleforms/admin_branding` filter. The server sanitises that markup to
 * svg, g and path elements, so it is safe to render as it is.
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

  const a11y = {
    'aria-hidden': wordmark ? 'true' : undefined,
    role: wordmark ? undefined : 'img',
    'aria-label': wordmark ? undefined : 'SubtleForms',
  };

  const mark = branding.markSvg ? (
    <span
      className='sf-logo__mark sf-logo__mark--custom'
      style={{ width: size, height: size }}
      {...a11y}
      dangerouslySetInnerHTML={{ __html: branding.markSvg }}
    />
  ) : (
    <svg
      className='sf-logo__mark'
      width={size}
      height={size}
      viewBox='0 0 512 512'
      fill='none'
      {...a11y}
      xmlns='http://www.w3.org/2000/svg'
      focusable='false'>
      <path
        fill='var(--sf-logo-fg, #1e1e1e)'
        d='M0 122.88 C0 55.015 55.015 0 122.88 0 L389.12 0 C406.467 0 422.974 3.594 437.937 10.079 L170.586 117.679 C131.238 133.516 112.178 178.252 128.015 217.6 L128 217.6 C128 260.015 162.385 294.4 204.8 294.4 L383.975 294.4 L12.8 443.787 C4.607 427.322 0 408.759 0 389.12 Z'
      />
      <path
        fill='var(--sf-logo-fg, #1e1e1e)'
        d='M128.015 217.6 L499.199 68.21 C507.392 84.676 512 103.24 512 122.88 L512 389.12 C512 456.985 456.985 512 389.12 512 L122.88 512 C105.531 512 89.023 508.405 74.058 501.919 L341.403 394.321 C380.751 378.484 399.811 333.748 383.975 294.4 L384 294.4 C384 251.985 349.615 217.6 307.2 217.6 Z'
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
