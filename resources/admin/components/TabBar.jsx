import { __ } from '@wordpress/i18n';

/**
 * Standardized Tab Bar
 * Sharp, minimal tabs for action bars
 */
export default function TabBar({ tabs, activeTab, onChange }) {
  return (
    <div className='flex -mb-px border-gray-300 border-b'>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`
            px-4 py-2 text-sm font-medium border-b-2 transition-colors duration-150
            ${
              activeTab === tab.key
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-400'
            }
          `}>
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={`ml-2 text-xs ${
                activeTab === tab.key ? 'text-gray-600' : 'text-gray-400'
              }`}>
              ({tab.count})
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
