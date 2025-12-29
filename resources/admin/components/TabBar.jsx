import { __ } from '@wordpress/i18n';

/**
 * Standardized Tab Bar
 * Sharp, minimal tabs for action bars
 */
export default function TabBar({ tabs, activeTab, onTabChange }) {
  return (
    <div className='sf-flex -mb-px'>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={`
            px-4 py-3 text-sm font-medium border-b-2 transition-colors duration-150
            ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600 bg-blue-50'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }
          `}>
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={`sf-ml-2 sf-text-xs ${
                activeTab === tab.key ? 'sf-text-gray-600' : 'sf-text-gray-400'
              }`}>
              ({tab.count})
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
