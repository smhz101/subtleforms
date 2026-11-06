import { logoClass } from './logoState';

/**
 * A service logo, decorative (the name is always written next to it or kept
 * for assistive technology). It is drawn in its own colours; `logoClass`
 * decides whether the style sheet greys it.
 *
 * `logo` is a component receiving { size } (the logos of this plugin), any
 * element, or nothing: the name is then written in the brand colour.
 *
 * @param {Object}                        props
 * @param {Function|import('react').ReactNode} props.logo       Logo component or element.
 * @param {string}                        props.label       Service name (the text fallback).
 * @param {string}                        props.brandColor  Colour of the text fallback.
 * @param {boolean}                       props.enabled     Whether the service is on.
 * @param {number}                        props.size        Height of a square logo in pixels.
 */
export default function ServiceLogo({ logo, label, brandColor, enabled, size = 44 }) {
  const Logo = typeof logo === 'function' ? logo : null;
  let inner;
  if (Logo) {
    inner = <Logo size={size} />;
  } else if (logo) {
    inner = logo;
  } else {
    inner = (
      <span className='sf-svc-logo__wordmark' style={brandColor ? { color: brandColor } : undefined}>
        {label}
      </span>
    );
  }
  return (
    <span className={`sf-svc-logo ${logoClass(enabled)}`} aria-hidden='true'>
      {inner}
    </span>
  );
}
