import { useState, useEffect } from '@wordpress/element';
import { Button, SearchControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { FiPlus } from 'react-icons/fi';
import AdminShell from '../components/AdminShell';
import TabBar from '../components/TabBar';
import FormsList from '../components/FormsList';
import OnboardingWizard from '../components/OnboardingWizard';

export default function FormsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showWizard, setShowWizard] = useState(false);
  const [formsCount, setFormsCount] = useState(null);
  const [isDismissed, setIsDismissed] = useState(true);

  // Check if we should show the wizard
  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        // Check onboarding status
        const statusResponse = await fetch(
          (window.subtleformsAdmin?.restUrl?.replace(/\/$/, '') ||
            '/wp-json/subtleforms/v1') + '/onboarding/status',
          {
            credentials: 'same-origin',
            headers: {
              'X-WP-Nonce': window.subtleformsAdmin?.restNonce || '',
            },
          }
        );
        const statusData = await statusResponse.json();
        setIsDismissed(statusData.dismissed);

        // Check forms count
        const formsResponse = await fetch(
          (window.subtleformsAdmin?.restUrl?.replace(/\/$/, '') ||
            '/wp-json/subtleforms/v1') + '/forms?per_page=1',
          {
            credentials: 'same-origin',
            headers: {
              'X-WP-Nonce': window.subtleformsAdmin?.restNonce || '',
            },
          }
        );
        const formsData = await formsResponse.json();
        setFormsCount(formsData.total || 0);

        // Show wizard if not dismissed and no forms exist
        if (!statusData.dismissed && formsData.total === 0) {
          setShowWizard(true);
        }
      } catch (error) {
        console.error('Failed to check onboarding status:', error);
      }
    };

    checkOnboarding();
  }, []);

  const handleWizardComplete = async (formData) => {
    setShowWizard(false);

    // Create form with wizard data
    try {
      const schema = {
        schema_version: 1,
        metadata: {
          name: formData.goal || 'new_form',
          type: formData.type || 'regular',
          title: __('New Form', 'subtleforms'),
        },
        fields: formData.fields || [],
      };

      const createResponse = await fetch(
        (window.subtleformsAdmin?.restUrl?.replace(/\/$/, '') ||
          '/wp-json/subtleforms/v1') + '/forms',
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'X-WP-Nonce': window.subtleformsAdmin?.restNonce || '',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title:
              __('My ', 'subtleforms') +
              (formData.goal?.charAt(0).toUpperCase() +
                formData.goal?.slice(1) || __('Form', 'subtleforms')),
            status: 'draft',
          }),
        }
      );

      const createData = await createResponse.json();
      if (createData.id) {
        // Save schema
        await fetch(
          (window.subtleformsAdmin?.restUrl?.replace(/\/$/, '') ||
            '/wp-json/subtleforms/v1') + `/forms/${createData.id}/schema`,
          {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
              'X-WP-Nonce': window.subtleformsAdmin?.restNonce || '',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ schema }),
          }
        );

        // Redirect to builder
        window.location.href = `admin.php?page=subtleforms-builder&id=${createData.id}`;
      }
    } catch (error) {
      console.error('Failed to create form:', error);
    }
  };

  const handleWizardDismiss = () => {
    setShowWizard(false);
  };

  const tabs = [
    { key: 'all', label: __('All', 'subtleforms') },
    { key: 'published', label: __('Published', 'subtleforms') },
    { key: 'draft', label: __('Draft', 'subtleforms') },
  ];

  return (
    <>
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

      {showWizard && (
        <OnboardingWizard
          onComplete={handleWizardComplete}
          onDismiss={handleWizardDismiss}
        />
      )}
    </>
  );
}
