import { __ } from '@wordpress/i18n';
import clsx from 'clsx';
import './TabBar.scss';

/**
 * Standardized Tab Bar
 * Sharp, minimal tabs for action bars
 */
export default function TabBar({ tabs, activeTab, onTabChange }) {
  return (
    <div className='sf-tab-bar'>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;

        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={clsx(
              'sf-tab-bar__tab',
              isActive ? 'sf-tab-bar__tab--active' : 'sf-tab-bar__tab--inactive'
            )}>
            <span className='sf-tab-bar__label'>{tab.label}</span>

            {tab.count !== undefined && (
              <span
                className={clsx(
                  'sf-tab-bar__count',
                  isActive
                    ? 'sf-tab-bar__count--active'
                    : 'sf-tab-bar__count--inactive'
                )}>
                ({tab.count})
              </span>
            )}

            {/* subtle hover underline animation */}
            {!isActive && <span className='sf-tab-bar__hover-line' />}
          </button>
        );
      })}
    </div>
  );
}
