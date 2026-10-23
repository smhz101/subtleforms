import { isExternalHref } from '../../shared/safeLinks';

/**
 * The paragraphs of a confirmation message. Links are real anchors with
 * rel="noopener noreferrer"; everything else is text, so it is escaped.
 *
 * @param {Object} props
 * @param {Array}  props.paragraphs Paragraphs from messageParagraphs().
 */
export default function ConfirmationText({ paragraphs }) {
  return (paragraphs || []).map((parts, i) => (
    <p key={i}>
      {parts.map((part, j) =>
        part.type === 'link' ? (
          <a
            key={j}
            className='subtleforms-success-link'
            href={part.href}
            rel='noopener noreferrer'
            target={isExternalHref(part.href) ? '_blank' : undefined}>
            {part.text}
          </a>
        ) : (
          <span key={j}>{part.text}</span>
        )
      )}
    </p>
  ));
}
