import { useState } from '@wordpress/element';
import { Button, SearchControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { plus } from '@wordpress/icons';
import AdminShell from './AdminShell';
import FormsList from './FormsList';

export default function FormsPage() {
  const [search, setSearch] = useState('');

  return (
    <AdminShell
      title={__('Forms', 'subtleforms')}
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
      search={
        <SearchControl
          value={search}
          onChange={setSearch}
          placeholder={__('Search forms...', 'subtleforms')}
        />
      }>
      <FormsList searchTerm={search} />
    </AdminShell>
  );
}
