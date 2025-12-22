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
    <div className='subtleforms-status-tabs'>
      <button
        className={`subtleforms-status-tab ${
          statusFilter === 'all' ? 'active' : ''
        }`}
        onClick={() => setStatusFilter('all')}>
        {__('All', 'subtleforms')}
      </button>
      <button
        className={`subtleforms-status-tab ${
          statusFilter === 'unread' ? 'active' : ''
        }`}
        onClick={() => setStatusFilter('unread')}>
        {__('Unread', 'subtleforms')}
      </button>
      <button
        className={`subtleforms-status-tab ${
          statusFilter === 'read' ? 'active' : ''
        }`}
        onClick={() => setStatusFilter('read')}>
        {__('Read', 'subtleforms')}
      </button>
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
