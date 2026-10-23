import { useEffect, useRef, useState } from '@wordpress/element';
import {
  flagCode,
  flagHref,
  flagSpriteUrl,
  inlineSprite,
  INLINE_SPRITE_ID,
  isCrossOrigin,
} from '../../../shared/flagSprite';
import { flagMark } from '../../../shared/phone';

/**
 * A small country flag, drawn from the sprite (see shared/flagSprite.js).
 * Decorative: the country is always named in text beside it.
 *
 * Falls back to the two letters the pickers always showed when the sprite
 * address is unknown or the code is not a country code.
 *
 * @param {Object} props      Props.
 * @param {string} props.code Two-letter country code.
 * @return {JSX.Element|string}
 */
export default function FlagIcon({ code }) {
  const url = flagSpriteUrl();
  const ref = useRef(null);
  const [inline, setInline] = useState(false);
  const clean = flagCode(code);

  useEffect(() => {
    const doc = ref.current?.ownerDocument;
    if (!url || !doc) {
      return;
    }
    if (doc.getElementById(INLINE_SPRITE_ID)) {
      setInline(true);
      return;
    }
    if (isCrossOrigin(url, doc)) {
      inlineSprite(url, doc).then(() => {
        if (doc.getElementById(INLINE_SPRITE_ID)) {
          setInline(true);
        }
      });
    }
  }, [url]);

  if (!clean || !url) {
    return flagMark(code);
  }
  return (
    <svg
      ref={ref}
      className='subtleforms-flag'
      width='20'
      height='15'
      aria-hidden='true'
      focusable='false'
      data-flag={clean}>
      <use href={flagHref(clean, url, inline)} />
    </svg>
  );
}
