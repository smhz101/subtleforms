import { memo } from '@wordpress/element';

/**
 * ActionBar - Reusable Horizontal Bar Component
 *
 * Single reusable action bar for filters, search, and bulk actions.
 * Used consistently across All Forms page and Submissions list.
 *
 * Features:
 * - Fixed height (56px) for consistency
 * - Supports tabs/filters on left, search/bulk actions on right
 * - Flat design matching AdminHeader
 * - No inline styles (uses Tailwind CSS only)
 * - Memoized to prevent unnecessary re-renders
 *
 * @param {Object} props
 * @param {React.ReactNode} props.left - Left side content (tabs, filters)
 * @param {React.ReactNode} props.right - Right side content (search, bulk actions)
 */
const ActionBar = memo(function ActionBar({ left, right }) {
  return (
    <div className='sf-flex sf-flex-shrink-0 sf-justify-between sf-items-center sf-bg-gray-50 sf-px-6 sf-border-gray-300 sf-border-b sf-h-14'>
      {/* Left Side: Tabs/Filters */}
      {left && <div className='sf-flex sf-items-center sf-gap-4'>{left}</div>}

      {/* Right Side: Search/Bulk Actions */}
      {right && <div className='sf-flex sf-items-center sf-gap-4'>{right}</div>}
    </div>
  );
});

export default ActionBar;
