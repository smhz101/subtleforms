import { __ } from '@wordpress/i18n';
import AdminLayout from './AdminLayout';
import SubmissionsTable from './SubmissionsTable';

export default function SubmissionsPage({ formId }) {
  const title = formId
    ? __('Form Submissions', 'subtleforms')
    : __('All Submissions', 'subtleforms');

  return (
    <AdminLayout title={title}>
      <SubmissionsTable formId={formId} showFormColumn={!formId} />
    </AdminLayout>
  );
}
