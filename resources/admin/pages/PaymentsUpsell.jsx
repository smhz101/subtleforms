/**
 * Payments screen without SubtleForms Pro: one card that says what Pro adds.
 * The payments screen itself (orders, coupons, gateway status) is part of
 * SubtleForms Pro, which mounts it on this route when it is active.
 */
import { __ } from '@wordpress/i18n';
import AdminShell from '../components/AdminShell';
import UpgradePrompt from '../ui/UpgradePrompt';

export default function PaymentsUpsell() {
  return (
    <AdminShell title={__('Payments', 'subtleforms')}>
      <UpgradePrompt
        variant='card'
        feature='payments'
        benefits={[
          __('Take card payments on a form', 'subtleforms'),
          __('Coupons and order summaries', 'subtleforms'),
          __('See orders next to each entry', 'subtleforms'),
        ]}
      />
    </AdminShell>
  );
}
