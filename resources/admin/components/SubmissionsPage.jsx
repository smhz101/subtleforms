import { useState } from '@wordpress/element';
import { SelectControl, SearchControl, Button } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import AdminLayout from './AdminLayout';
import SubmissionsTable from './SubmissionsTable';

export default function SubmissionsPage({ formId }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const title = formId
    ? __('Form Submissions', 'subtleforms')
    : __('All Submissions', 'subtleforms');

  const statusTabs = (
    <div className='subtleforms-admin'>
      <div className='flex border-gray-200 border-b'>
        {[
          { key: 'all', label: __('All', 'subtleforms') },
          { key: 'unread', label: __('Unread', 'subtleforms') },
          { key: 'read', label: __('Read', 'subtleforms') },
        ].map((tab) => (
          <button
            key={tab.key}
            className={`
              px-4 py-2 text-sm font-medium border-b-2 transition-colors duration-150
              ${
                statusFilter === tab.key
                  ? 'border-blue-500 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
            onClick={() => setStatusFilter(tab.key)}>
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );

  const searchControl = (
    <SearchControl
      value={search}
      onChange={setSearch}
      placeholder={__('Search submissions...', 'subtleforms')}
    />
  );

  return (
    <AdminLayout title={title} filters={statusTabs} search={searchControl}>
      <SubmissionsTable
        formId={formId}
        showFormColumn={!formId}
        searchTerm={search}
        statusFilter={statusFilter}
      />
    </AdminLayout>
  );
}
