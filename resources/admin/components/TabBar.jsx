import { __ } from '@wordpress/i18n';
import classNames from 'classnames';

/**
 * Standardized Tab Bar
 * Sharp, minimal tabs for action bars
 */
export default function TabBar({ tabs, activeTab, onTabChange }) {
  return (
    <div className='sf-flex -mb-px'>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;

        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={classNames(
              // base
              'sf-group sf-relative sf-px-2.5 sf-py-1.5 sf-text-sm sf-font-medium sf-border-b-2 sf-transition-all sf-duration-200 sf-ease-out focus:sf-outline-none focus-visible:sf-ring-2 focus-visible:sf-ring-blue-500/50',
              // active vs inactive
              isActive
                ? 'sf-border-blue-600 sf-text-blue-600 sf-bg-blue-50'
                : 'sf-border-transparent sf-text-gray-600 sf-bg-transparent hover:sf-text-gray-900 hover:sf-border-gray-300 hover:sf-bg-gray-50'
            )}>
            <span className='sf-z-10 sf-relative'>{tab.label}</span>

            {tab.count !== undefined && (
              <span
                className={classNames(
                  'sf-ml-2 sf-text-xs sf-transition-colors sf-duration-200',
                  isActive
                    ? 'sf-text-gray-600'
                    : 'sf-text-gray-400 group-hover:sf-text-gray-600'
                )}>
                ({tab.count})
              </span>
            )}

            {/* subtle hover underline animation */}
            {!isActive && (
              <span className='sf-bottom-0 sf-absolute sf-inset-x-0 sf-bg-blue-500 sf-h-0.5 sf-scale-x-0 group-hover:sf-scale-x-100 sf-origin-left sf-transition-transform sf-duration-200 sf-pointer-events-none' />
            )}
          </button>
        );
      })}
    </div>
  );
}
