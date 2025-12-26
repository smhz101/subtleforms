import { useState } from '@wordpress/element';
import { Button, SearchControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { FiPlus } from 'react-icons/fi';
import AdminShell from '../components/AdminShell';
import TabBar from '../components/TabBar';
import FormsList from '../components/FormsList';

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
          onClick={() => {
            window.location.href = 'admin.php?page=subtleforms-new-form';
          }}>
          <FiPlus className='inline mr-2 w-4 h-4' />
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
