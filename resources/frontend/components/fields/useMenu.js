import { useEffect, useRef, useState } from '@wordpress/element';

/**
 * Open/close a popover. It closes on an outside click, when focus moves out
 * of it, and on Escape; Escape gives focus back to the trigger so a keyboard
 * user is not dropped on the page body (FLD2-04, FLD2-05).
 *
 * @param {{current: HTMLElement|null}} [triggerRef] The button that opens it.
 */
export function useMenu(triggerRef) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const onFocusIn = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKey = (event) => {
      if (event.key === 'Escape') {
        const focusInside = rootRef.current?.contains(document.activeElement);
        setOpen(false);
        if (focusInside) {
          triggerRef?.current?.focus();
        }
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, triggerRef]);

  return { rootRef, open, setOpen };
}
