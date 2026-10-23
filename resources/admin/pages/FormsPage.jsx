import { useState, useEffect, useRef } from '@wordpress/element';
import { SearchControl } from '@wordpress/components';
import { Button } from '../components/navigation';
import { useNavigate } from 'react-router-dom';
import { __ } from '@wordpress/i18n';
import { useForms, useCreateForm } from '../data';
import Icon from '../ui/Icon';
import AdminShell from '../components/AdminShell';
import TabBar from '../components/TabBar';
import { getSlotItems } from '../../shared/extend';
import FormsList, { ALL_FORM_COLUMNS, DEFAULT_FORM_VISIBLE, FORM_COLUMN_LABELS } from '../components/FormsList';
import OnboardingWizard from '../components/OnboardingWizard';
import HelpMenu from '../components/HelpMenu';
import { apiGet, apiPost } from '../utils/api';
import { wizardCreateBody } from '../utils/wizardCreate';
import './FormsPage.scss';

export default function FormsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showWizard, setShowWizard] = useState(false);
  const [wizardError, setWizardError] = useState('');
  const [formsCount, setFormsCount] = useState(null);
  const [isDismissed, setIsDismissed] = useState(true);
  // Per-status counts for the tab bar (Part B10).
  const [statusCounts, setStatusCounts] = useState({});

  const refreshCounts = async () => {
    try {
      const { body } = await apiGet('/forms/counts');
      // apiClient unwraps .data, so body is the counts map directly.
      setStatusCounts(body?.data && typeof body.data === 'object' ? body.data : body || {});
    } catch (error) {
      console.error('Failed to load form status counts:', error);
    }
  };

  // Column visibility, persisted to localStorage
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = localStorage.getItem('sf_forms_visible_cols');
      return saved ? JSON.parse(saved) : DEFAULT_FORM_VISIBLE;
    } catch {
      return DEFAULT_FORM_VISIBLE;
    }
  });
  const [showColPicker, setShowColPicker] = useState(false);
  // A column an add-on brings (conversion with SubtleForms Pro); no toggle without one.
  const [extraColumn] = getSlotItems('forms.list.column');
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
        const { body: statusData } = await apiGet('/onboarding/status');
        setIsDismissed(statusData?.dismissed);

        // Check forms count
        const { body: formsData } = await apiGet('/forms?per_page=1');
        const totalForms = formsData?.meta?.total ?? 0;
        setFormsCount(totalForms);

        // 2.0: first-run users land on the empty state, which opens the
        // template library. The old setup wizard stays available but no
        // longer interrupts on load.
      } catch (error) {
        console.error('Failed to check onboarding status:', error);
      }
    };

    checkOnboarding();
    refreshCounts();
  }, []);

  const handleWizardComplete = async (formData) => {
    setWizardError('');
    try {
      const payload = wizardCreateBody(formData);
      const created = await apiPost('/forms', { title: payload.title });
      const id = created.body?.data?.id ?? created.body?.id;
      if (!created.ok || !id) {
        setWizardError(__('The form could not be created. Try again.', 'subtleforms'));
        return;
      }
      if (payload.schema) {
        await apiPost(`/forms/${id}/schema`, { schema: payload.schema });
      }
      setShowWizard(false);
      navigate('/forms/' + id);
    } catch (error) {
      console.error('Failed to create form:', error);
      setWizardError(__('The form could not be created. Try again.', 'subtleforms'));
    }
  };

  const handleWizardDismiss = () => {
    setShowWizard(false);
  };

  const tabs = [
    { key: 'all', label: __('All', 'subtleforms'), count: statusCounts.all },
    { key: 'published', label: __('Published', 'subtleforms'), count: statusCounts.published },
    { key: 'draft', label: __('Draft', 'subtleforms'), count: statusCounts.draft },
    { key: 'trash', label: __('Trash', 'subtleforms'), count: statusCounts.trash },
  ];

  return (
    <>
      <AdminShell
        title={__('Forms', 'subtleforms')}
        description={__(
          'Build, publish and manage every form on your site.',
          'subtleforms'
        )}
        actions={
          <>
            <HelpMenu
              onOpenWizard={() => setShowWizard(true)}
              showWizard={true}
            />
            <Button
              variant='primary'
              icon={<Icon.Plus size={16} />}
              onClick={() => {
                navigate('/forms/new');
              }}>
              {__('New form', 'subtleforms')}
            </Button>
          </>
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
                <Icon.Columns size={16} />
                <span>{__('View', 'subtleforms')}</span>
                <Icon.ChevronDown size={14} />
              </Button>
              {showColPicker && (
                <div className='sf-col-picker__dropdown'>
                  {ALL_FORM_COLUMNS.filter((k) => k !== 'actions' && (k !== 'performance' || extraColumn)).map((key) => (
                    <label key={key} className='sf-col-picker__item'>
                      <input
                        type='checkbox'
                        checked={visibleColumns.includes(key)}
                        onChange={() => toggleColumn(key)}
                      />
                      <span>{(key === 'performance' && extraColumn?.header) || FORM_COLUMN_LABELS[key] || key}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <SearchControl
              value={search}
              onChange={setSearch}
              placeholder={__('Search forms', 'subtleforms')}
              __nextHasNoMarginBottom
              size='compact'
            />
          </div>
        }>
        <FormsList searchTerm={search} statusFilter={statusFilter} visibleColumns={visibleColumns} onFormsChanged={refreshCounts} />
      </AdminShell>

      {showWizard && (
        <OnboardingWizard
          onComplete={handleWizardComplete}
          onDismiss={handleWizardDismiss}
          createError={wizardError}
        />
      )}
    </>
  );
}
