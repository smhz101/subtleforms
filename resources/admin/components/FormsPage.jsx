import { useState } from '@wordpress/element';
import { Button, SearchControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { plus } from '@wordpress/icons';
import AdminShell from './AdminShell';
import TabBar from './TabBar';
import FormsList from './FormsList';

export default function FormsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const tabs = [
    { key: 'all', label: __('All', 'subtleforms') },
    { key: 'published', label: __('Published', 'subtleforms') },
    { key: 'draft', label: __('Draft', 'subtleforms') },
  ];

  return (
    <AdminShell
      title={__('All Forms', 'subtleforms')}
      noScroll={true}
      actions={
        <Button
          isPrimary
          icon={plus}
          onClick={() => {
            window.location.href = 'admin.php?page=subtleforms-new-form';
          }}>
          {__('New Form', 'subtleforms')}
        </Button>
      }
      actionBarLeft={
        <TabBar
          tabs={tabs}
          activeTab={statusFilter}
          onTabChange={setStatusFilter}
        />
      }
      actionBarRight={
        <SearchControl
          value={search}
          onChange={setSearch}
          placeholder={__('Search forms...', 'subtleforms')}
        />
      }>
      <FormsList searchTerm={search} statusFilter={statusFilter} />
    </AdminShell>
  );
}
