import { useState, useRef, useEffect, useCallback, createPortal } from '@wordpress/element';
import clsx from 'clsx';
import './IconAction.scss';

const SHOW_DELAY = 350;

/** Whether focus came from the keyboard. True where the browser cannot tell. */
function isKeyboardFocus(element) {
  try {
    return element.matches(':focus-visible');
  } catch (error) {
    return true;
  }
}

/**
 * Position of a tooltip for a button: centred above it, below it when there
 * is no room, and kept inside the window.
 *
 * @param {{top: number, bottom: number, left: number, width: number}} rect Button rect.
 * @param {{width: number, height: number}} tip Tooltip size.
 * @param {{width: number}} view Window size.
 * @return {{top: number, left: number}} Fixed position.
 */
export function tooltipPosition(rect, tip, view) {
  const gap = 6;
  let top = rect.top - tip.height - gap;
  if (top < 4) {
    top = rect.bottom + gap;
  }
  let left = rect.left + rect.width / 2 - tip.width / 2;
  left = Math.max(4, Math.min(left, view.width - tip.width - 4));
  return { top, left };
}

/**
 * An icon-only button with its own tooltip.
 *
 * The tooltip is drawn from this button's own label and shown only while
 * this button is hovered or keyboard-focused, so a label can never appear
 * over another button. The label is also the accessible name.
 *
 * @param {Object} props
 * @param {string} props.label Accessible name and tooltip text.
 * @param {JSX.Element} props.icon Icon.
 * @param {Function} props.onClick Click handler.
 * @param {boolean} [props.pressed] Toggle state (adds aria-pressed).
 * @param {boolean} [props.isDestructive] Red on hover.
 * @param {boolean} [props.disabled] Disabled.
 * @param {string} [props.className] Extra classes.
 */
export default function IconAction({
  label,
  icon,
  onClick,
  pressed,
  isDestructive = false,
  disabled = false,
  className,
  ...rest
}) {
  const buttonRef = useRef(null);
  const tipRef = useRef(null);
  const timerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);

  const hide = useCallback(() => {
    clearTimeout(timerRef.current);
    setOpen(false);
    setPosition(null);
  }, []);

  const show = useCallback((delay) => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(true), delay);
  }, []);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  // Place the tooltip once it is in the page and its size is known.
  useEffect(() => {
    if (!open || !buttonRef.current || !tipRef.current) {
      return undefined;
    }
    const rect = buttonRef.current.getBoundingClientRect();
    const tip = tipRef.current.getBoundingClientRect();
    setPosition(
      tooltipPosition(rect, { width: tip.width, height: tip.height }, { width: window.innerWidth })
    );
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [open, hide]);

  return (
    <>
      <button
        ref={buttonRef}
        type='button'
        className={clsx(
          'sf-icon-action',
          isDestructive && 'is-destructive',
          pressed && 'is-pressed',
          className
        )}
        aria-label={label}
        aria-pressed={typeof pressed === 'boolean' ? pressed : undefined}
        data-tooltip-label={label}
        disabled={disabled}
        onClick={(event) => {
          hide();
          onClick?.(event);
        }}
        onPointerEnter={(event) => {
          if (event.pointerType !== 'touch') {
            show(SHOW_DELAY);
          }
        }}
        onPointerLeave={hide}
        onFocus={(event) => {
          if (isKeyboardFocus(event.target)) {
            show(0);
          }
        }}
        onBlur={hide}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            hide();
          }
        }}
        {...rest}>
        {icon}
      </button>
      {open &&
        createPortal(
          <span
            ref={tipRef}
            role='tooltip'
            className='sf-icon-action__tooltip'
            style={{
              top: position ? position.top : 0,
              left: position ? position.left : 0,
              visibility: position ? 'visible' : 'hidden',
            }}>
            {label}
          </span>,
          document.body
        )}
    </>
  );
}
