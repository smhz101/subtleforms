import { flagCode, flagUrl } from '../../../shared/flagFiles';
import { flagMark } from '../../../shared/phone';

/**
 * A small country flag image (shared/flagFiles.js). Decorative: the country
 * is always named in text beside it.
 *
 * `eager` is for the flag in the closed button, so the selected flag shows at
 * once. Flags in the open list are lazy, so only the rows in view load.
 *
 * Falls back to the two letters the pickers always showed when the folder is
 * unknown or the code is not a country code.
 *
 * @param {Object}  props       Props.
 * @param {string}  props.code  Two-letter country code.
 * @param {boolean} props.eager Load now instead of when in view.
 * @return {JSX.Element|string}
 */
export default function FlagIcon({ code, eager = false }) {
  const src = flagUrl(code);
  if (!src) {
    return flagMark(code);
  }
  return (
    <img
      className='subtleforms-flag'
      src={src}
      alt=''
      aria-hidden='true'
      width='20'
      height='15'
      decoding='async'
      loading={eager ? 'eager' : 'lazy'}
      data-flag={flagCode(code)}
    />
  );
}
