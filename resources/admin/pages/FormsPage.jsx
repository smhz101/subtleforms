import { useState, useEffect, useRef } from '@wordpress/element';
import { SearchControl } from '@wordpress/components';
import { Button } from '../components/navigation';
import { useNavigate } from 'react-router-dom';
import { __ } from '@wordpress/i18n';
import { useForms, useCreateForm } from '../data';
import Icon from '../components/ui/Icon';
import AdminShell from '../components/AdminShell';
import TabBar from '../components/TabBar';
import FormsList, { ALL_FORM_COLUMNS, DEFAULT_FORM_VISIBLE, FORM_COLUMN_LABELS } from '../components/FormsList';
import OnboardingWizard from '../components/OnboardingWizard';
import HelpMenu from '../components/HelpMenu';
import { buildApiUrl } from '../utils/api';
import './FormsPage.scss';

export default function FormsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showWizard, setShowWizard] = useState(false);
  const [formsCount, setFormsCount] = useState(null);
  const [isDismissed, setIsDismissed] = useState(true);

  // Column visibility — persisted to localStorage
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = localStorage.getItem('sf_forms_visible_cols');
      return saved ? JSON.parse(saved) : DEFAULT_FORM_VISIBLE;
    } catch {
      return DEFAULT_FORM_VISIBLE;
    }
  });
  const [showColPicker, setShowColPicker] = useState(false);
  const colPickerRef = useRef(null);

  const toggleColumn = (key) => {
    setVisibleColumns((prev) => {
      const next = prev.includes(key)
        ? prev.filter((k) => k !== key)
        : [...prev, key];
      localStorage.setItem('sf_forms_visible_cols', JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    if (!showColPicker) return;
    const handleClick = (e) => {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target)) {
        setShowColPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showColPicker]);

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
          buildApiUrl('/forms?per_page=1'),
          {
            credentials: 'same-origin',
            headers: {
              'X-WP-Nonce': window.subtleformsAdmin?.restNonce || '',
            },
          }
        );
        const formsData = await formsResponse.json();
        const totalForms = formsData.meta?.total ?? 0;
        setFormsCount(totalForms);

        // Show wizard if not dismissed and no forms exist
        if (!statusData.dismissed && totalForms === 0) {
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

        // Send onboarding test email to admin to validate delivery
        try {
          const testRes = await fetch(
            (window.subtleformsAdmin?.restUrl?.replace(/\/$/, '') ||
              '/wp-json/subtleforms/v1') + '/onboarding/send-test-email',
            {
              method: 'POST',
              credentials: 'same-origin',
              headers: {
                'X-WP-Nonce': window.subtleformsAdmin?.restNonce || '',
                'Content-Type': 'application/json',
              },
            }
          );

          try {
            const testData = await testRes.json();
            if (testData.success) {
              alert(
                __(
                  'A test email has been sent to your admin email.',
                  'subtleforms'
                )
              );
            } else {
              console.warn('Test email response:', testData);
            }
          } catch (e) {
            // ignore parse errors
          }
        } catch (err) {
          console.warn('Failed to send onboarding test email:', err);
        }

        // Navigate to builder
        navigate('/forms/' + createData.id);
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
        actions={
          <div className='sf-forms-actions'>
            {formsCount === 0 ? (
              <div className='sf-first-run-cta'>
                <h3 className='sf-first-run-cta__title'>
                  {__('Create your first form', 'subtleforms')}
                </h3>
                <p className='sf-first-run-cta__desc'>
                  {__(
                    'Let us help you get started — create a contact form in seconds.',
                    'subtleforms'
                  )}
                </p>
                <Button isPrimary onClick={() => setShowWizard(true)}>
                  {__('Create your first form', 'subtleforms')}
                </Button>
              </div>
            ) : (
              <div className='sf-forms-header'>
                <div className='sf-forms-header__actions'>
                  <HelpMenu
                    onOpenWizard={() => setShowWizard(true)}
                    showWizard={true}
                  />
                  <Button
                    isPrimary
                    onClick={() => {
                      navigate('/forms/new');
                    }}>
                    <Icon.Add className='sf-icon-button' />
                    {__('New Form', 'subtleforms')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        }
        actionBarLeft={
          <TabBar
            tabs={tabs}
            activeTab={statusFilter}
            onTabChange={setStatusFilter}
          />
        }
        actionBarRight={
          <div className='sf-submissions-actions'>
            <div ref={colPickerRef} className='sf-col-picker'>
              <Button
                variant='secondary'
                onClick={() => setShowColPicker((v) => !v)}
                className='sf-button-height sf-col-picker__toggle'
                title={__('Show/hide columns', 'subtleforms')}>
                <Icon.Columns size={14} />
                <span>{__('Columns', 'subtleforms')}</span>
                <Icon.ChevronDown size={12} />
              </Button>
              {showColPicker && (
                <div className='sf-col-picker__dropdown'>
                  {ALL_FORM_COLUMNS.filter((k) => k !== 'actions').map((key) => (
                    <label key={key} className='sf-col-picker__item'>
                      <input
                        type='checkbox'
                        checked={visibleColumns.includes(key)}
                        onChange={() => toggleColumn(key)}
                      />
                      <span>{FORM_COLUMN_LABELS[key] || key}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <SearchControl
              value={search}
              onChange={setSearch}
              placeholder={__('Search forms...', 'subtleforms')}
            />
          </div>
        }>
        <FormsList searchTerm={search} statusFilter={statusFilter} visibleColumns={visibleColumns} />
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
