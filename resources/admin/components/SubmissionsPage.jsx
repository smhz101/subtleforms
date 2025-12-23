import { useState } from '@wordpress/element';
import { SearchControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import AdminShell from './AdminShell';
import TabBar from './TabBar';
import SubmissionsTable from './SubmissionsTable';

export default function SubmissionsPage({ formId }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const title = formId
    ? __('Form Submissions', 'subtleforms')
    : __('All Submissions', 'subtleforms');

  const tabs = [
    { key: 'all', label: __('All', 'subtleforms') },
    { key: 'unread', label: __('Unread', 'subtleforms') },
    { key: 'read', label: __('Read', 'subtleforms') },
  ];

  return (
    <AdminShell
      title={title}
      search={
        <SearchControl
          value={search}
          onChange={setSearch}
          placeholder={__('Search submissions...', 'subtleforms')}
        />
      }
      tabs={
        <TabBar
          tabs={tabs}
          activeTab={statusFilter}
          onTabChange={setStatusFilter}
        />
      }>
      <SubmissionsTable
        formId={formId}
        showFormColumn={!formId}
        searchTerm={search}
        statusFilter={statusFilter}
      />
    </AdminShell>
  );
}
