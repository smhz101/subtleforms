import { useState } from '@wordpress/element';
import { Button, SearchControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { plus } from '@wordpress/icons';
import AdminLayout from './AdminLayout';
import FormsList from './FormsList';

export default function FormsPage() {
  const [search, setSearch] = useState('');

  const headerActions = (
    <Button
      isPrimary
      icon={plus}
      onClick={() => {
        window.location.href = 'admin.php?page=subtleforms-new-form';
      }}>
      {__('Add New Form', 'subtleforms')}
    </Button>
  );

  const searchControl = (
    <SearchControl
      value={search}
      onChange={setSearch}
      placeholder={__('Search forms...', 'subtleforms')}
    />
  );

  return (
    <AdminLayout
      title={__('All Forms', 'subtleforms')}
      headerActions={headerActions}
      search={searchControl}>
      <FormsList
        searchTerm={search}
        onSelect={(id) => {
          // Handle form selection if needed
        }}
        onEdit={(id) => {
          window.location.href = `admin.php?page=subtleforms-new-form&form_id=${id}`;
        }}
        onBuild={(id) => {
          window.location.href = `admin.php?page=subtleforms-new-form&form_id=${id}`;
        }}
      />
    </AdminLayout>
  );
}
