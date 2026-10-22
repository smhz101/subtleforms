import { useState } from '@wordpress/element';
import { Button } from '@wordpress/components';

/**
 * Long report lists show their first rows and a "Show all" button instead of
 * a box that scrolls on its own (2.6.0). Everything else on the screen keeps
 * flowing with the page.
 *
 * @param {Array}  items Rows, already in the order to show.
 * @param {number} limit Rows shown before "Show all".
 * @return {{ visible: Array, hidden: number, expanded: boolean, toggle: Function }}
 */
export function useShowAll(items, limit) {
  const [expanded, setExpanded] = useState(false);
  const list = Array.isArray(items) ? items : [];
  const hidden = Math.max(0, list.length - limit);
  return {
    visible: expanded || hidden === 0 ? list : list.slice(0, limit),
    hidden,
    expanded,
    toggle: () => setExpanded((value) => !value),
  };
}

/**
 * The button under a shortened list. Renders nothing when every row fits.
 *
 * @param {Object}   props
 * @param {number}   props.hidden   Rows left out while collapsed.
 * @param {boolean}  props.expanded Whether every row is shown.
 * @param {Function} props.onToggle Click handler.
 * @param {string}   props.more     Label while collapsed, e.g. "Show all 24 fields".
 * @param {string}   props.less     Label while expanded, e.g. "Show fewer fields".
 * @param {string}   props.controls Id of the list the button changes.
 */
export default function ShowAllButton({ hidden, expanded, onToggle, more, less, controls }) {
  if (!hidden) {
    return null;
  }
  return (
    <div className='sf-show-all'>
      <Button variant='link' onClick={onToggle} aria-expanded={expanded} aria-controls={controls}>
        {expanded ? less : more}
      </Button>
    </div>
  );
}
