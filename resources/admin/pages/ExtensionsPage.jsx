/**
 * Extensions: what each plan adds to SubtleForms. A plain list until the
 * catalog screen (tabs, filters, cards) replaces it.
 */
import { __ } from '@wordpress/i18n';
import AdminShell from '../components/AdminShell';
import { useExtensions } from '../data';

const PLAN_LABELS = {
  free: __('Free', 'subtleforms'),
  starter: __('Starter', 'subtleforms'),
  pro: __('Pro', 'subtleforms'),
  agency: __('Agency', 'subtleforms'),
};

const STATUS_LABELS = {
  included: __('Included', 'subtleforms'),
  locked: __('Locked', 'subtleforms'),
  available: __('Available', 'subtleforms'),
  installed: __('Installed', 'subtleforms'),
  active: __('Active', 'subtleforms'),
  update: __('Update available', 'subtleforms'),
};

export default function ExtensionsPage() {
  const { data, isLoading, error } = useExtensions();
  const entries = data?.entries || [];

  return (
    <AdminShell
      title={__('Extensions', 'subtleforms')}
      description={__('Add what this site needs to SubtleForms.', 'subtleforms')}
      isLoading={isLoading}
      error={error ? error.message || __('Could not load the extensions.', 'subtleforms') : null}>
      <ul className='sf-extensions-list'>
        {entries.map((entry) => (
          <li key={entry.slug}>
            <strong>{entry.title}</strong>
            {' '}
            <span>{PLAN_LABELS[entry.plan] || entry.plan}</span>
            {', '}
            <span>{STATUS_LABELS[entry.status] || entry.status}</span>
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
