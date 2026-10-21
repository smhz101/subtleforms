import { useState, useLayoutEffect, useRef } from '@wordpress/element';

/**
 * Width of an element, kept up to date as it is resized. The width of the
 * element itself is what matters for a list in a pane: the window can be
 * wide while the pane is narrow.
 *
 * @return {[import('react').MutableRefObject, number|null]} A ref for the
 *   element and its width, or null before the first measurement.
 */
export default function useElementWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) {
      return undefined;
    }
    const measure = () => setWidth(Math.round(node.getBoundingClientRect().width));
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}
